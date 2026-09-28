import { invoke as tauriInvoke } from '@tauri-apps/api/core';

import type { BuildIdentity } from '../composition/buildIdentity';

/** A newer signed release announced by the updater manifest. */
export interface AvailableUpdate {
  readonly version: string;
}

export interface ReleaseUpdateHost {
  /** Resolves `null` when this build is current. */
  checkForUpdate(): Promise<AvailableUpdate | null>;
  /**
   * Downloads, verifies and installs; the application closes and reopens on success.
   * Resolves only when `version` is no longer the pending update, with the one pending now.
   */
  installUpdate(version: string): Promise<AvailableUpdate | null>;
}

/** Saves the open project if needed before the application closes to update. */
export type SaveBeforeInstall = () => Promise<{
  readonly status: 'cancelled' | 'failure' | 'success';
  readonly message: string;
}>;

export interface ReleaseSkipPreference {
  read(): string | undefined;
  write(version: string): void;
}

export type ReleaseUpdateState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'checking' }
  | { readonly kind: 'current' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'available'; readonly version: string; readonly message?: string }
  | { readonly kind: 'confirming'; readonly version: string }
  | { readonly kind: 'saving'; readonly version: string }
  | { readonly kind: 'installing'; readonly version: string }
  | { readonly kind: 'installFailed'; readonly version: string };

export interface ReleaseUpdateController {
  checkAutomatically(): void;
  checkManually(): Promise<void>;
  /** Asks the user to confirm installing the available update. */
  requestInstall(): void;
  cancelInstall(): void;
  /** Saves if needed, then installs; only after `requestInstall`, or to retry a failed install. */
  confirmInstall(): Promise<void>;
  later(): void;
  skip(): void;
  getSnapshot(): ReleaseUpdateState;
  subscribe(listener: () => void): () => void;
}

const STABLE_SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function createTauriReleaseUpdateHost(
  invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T> = tauriInvoke,
): ReleaseUpdateHost {
  return Object.freeze({
    checkForUpdate: () => invoke<AvailableUpdate | null>('release_update_check'),
    installUpdate: (version: string) =>
      invoke<AvailableUpdate | null>('release_update_install', { version }),
  });
}

function isStable(update: AvailableUpdate): boolean {
  return STABLE_SEMVER.test(update.version);
}

export function createBrowserReleaseSkipPreference(
  storage: () => Pick<Storage, 'getItem' | 'setItem'>,
): ReleaseSkipPreference {
  const key = 'run-planner.skipped-release-version';
  return Object.freeze({
    read: () => {
      try {
        const value = storage().getItem(key);
        return value !== null && STABLE_SEMVER.test(value) ? value : undefined;
      } catch {
        return undefined;
      }
    },
    write: (version: string) => {
      try {
        storage().setItem(key, version);
      } catch {
        // The dismissal remains in-memory when local storage is restricted.
      }
    },
  });
}

/** Update checks exist only for stable official builds; the updater owns version ordering. */
export function createReleaseUpdateController(options: {
  readonly buildIdentity: BuildIdentity;
  readonly host: ReleaseUpdateHost;
  readonly saveBeforeInstall: SaveBeforeInstall;
  readonly skipPreference: ReleaseSkipPreference;
}): ReleaseUpdateController | undefined {
  if (!STABLE_SEMVER.test(options.buildIdentity.version)) return undefined;

  let automaticStarted = false;
  let inFlight: Promise<void> | undefined;
  let manualRequested = false;
  let manualFollowUp: Promise<void> | undefined;
  let responseHandled = false;
  let sessionDismissedVersion: string | undefined;
  let state: ReleaseUpdateState = Object.freeze({ kind: 'idle' });
  const listeners = new Set<() => void>();
  const publish = (next: ReleaseUpdateState) => {
    state = Object.freeze(next);
    for (const listener of listeners) listener();
  };
  // A confirmation, save or install in progress is never replaced by a check result.
  const installEngaged = () =>
    state.kind === 'confirming' || state.kind === 'saving' || state.kind === 'installing';
  const check = (manual: boolean): Promise<void> => {
    if (installEngaged()) return Promise.resolve();
    if (inFlight !== undefined) {
      if (manual) {
        if (!responseHandled) {
          manualRequested = true;
          publish({ kind: 'checking' });
          return inFlight;
        }
        manualFollowUp ??= inFlight.then(() => {
          manualFollowUp = undefined;
          return check(true);
        });
        return manualFollowUp;
      }
      return inFlight;
    }
    manualRequested = manual;
    responseHandled = false;
    if (manual) publish({ kind: 'checking' });
    inFlight = options.host
      .checkForUpdate()
      .then((update) => {
        responseHandled = true;
        if (installEngaged()) return;
        const manual = manualRequested;
        if (update === null) {
          if (manual) publish({ kind: 'current' });
          return;
        }
        if (!isStable(update)) {
          if (manual) publish({ kind: 'unavailable' });
          return;
        }
        if (
          !manual &&
          (sessionDismissedVersion === update.version ||
            options.skipPreference.read() === update.version)
        ) {
          return;
        }
        publish({ kind: 'available', version: update.version });
      })
      .catch(() => {
        responseHandled = true;
        if (manualRequested && !installEngaged()) publish({ kind: 'unavailable' });
      })
      .finally(() => {
        inFlight = undefined;
        manualRequested = false;
      });
    return inFlight;
  };
  const dismiss = (persist: boolean) => {
    if (state.kind !== 'available' && state.kind !== 'installFailed') return;
    sessionDismissedVersion = state.version;
    if (persist) options.skipPreference.write(state.version);
    publish({ kind: 'idle' });
  };

  return Object.freeze({
    checkAutomatically: () => {
      if (automaticStarted) return;
      automaticStarted = true;
      void check(false);
    },
    checkManually: () => check(true),
    requestInstall: () => {
      if (state.kind !== 'available') return;
      publish({ kind: 'confirming', version: state.version });
    },
    cancelInstall: () => {
      if (state.kind !== 'confirming') return;
      publish({ kind: 'available', version: state.version });
    },
    confirmInstall: async () => {
      if (state.kind !== 'confirming' && state.kind !== 'installFailed') return;
      const version = state.version;
      publish({ kind: 'saving', version });
      let saving: Awaited<ReturnType<SaveBeforeInstall>>;
      try {
        saving = await options.saveBeforeInstall();
      } catch (error) {
        saving = {
          status: 'failure',
          message: `Not saved, so not updated: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
      if (saving.status !== 'success') {
        publish({ kind: 'available', version, message: saving.message });
        return;
      }
      publish({ kind: 'installing', version });
      try {
        const pending = await options.host.installUpdate(version);
        // The confirmed version was superseded; offer the one pending now instead.
        publish(
          pending === null
            ? { kind: 'current' }
            : isStable(pending)
              ? { kind: 'available', version: pending.version }
              : { kind: 'unavailable' },
        );
      } catch {
        publish({ kind: 'installFailed', version });
      }
    },
    later: () => dismiss(false),
    skip: () => dismiss(true),
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}

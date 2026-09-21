import { invoke as tauriInvoke } from '@tauri-apps/api/core';

import type { BuildIdentity } from '../composition/buildIdentity';

const officialRepository = 'maybe-adamant/RunPlanner';
const portableSuffix = '-windows-x64-portable.zip';

export interface ReleaseAsset {
  readonly browserDownloadUrl: string;
  readonly name: string;
}

export interface ReleaseMetadata {
  readonly assets: readonly ReleaseAsset[];
  readonly draft: boolean;
  readonly htmlUrl: string;
  readonly prerelease: boolean;
  readonly tagName: string;
}

export interface ReleaseUpdateHost {
  checkLatestRelease(): Promise<ReleaseMetadata>;
  openDownload(url: string): Promise<void>;
}

export interface ReleaseSkipPreference {
  read(): string | undefined;
  write(version: string): void;
}

export type ReleaseUpdateState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'checking' }
  | { readonly kind: 'current' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'available'; readonly release: EligibleRelease };

export interface EligibleRelease {
  readonly archiveUrl: string;
  readonly checksumUrl: string;
  readonly version: string;
}

export interface ReleaseUpdateController {
  checkAutomatically(): void;
  checkManually(): Promise<void>;
  download(): Promise<void>;
  later(): void;
  skip(): void;
  getSnapshot(): ReleaseUpdateState;
  subscribe(listener: () => void): () => void;
}

interface StableVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly text: string;
}

export function createTauriReleaseUpdateHost(
  invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T> = tauriInvoke,
): ReleaseUpdateHost {
  return Object.freeze({
    checkLatestRelease: () => invoke<ReleaseMetadata>('release_check_latest'),
    openDownload: (url: string) => invoke<void>('release_open_download', { url }),
  });
}

export function createBrowserReleaseSkipPreference(
  storage: () => Pick<Storage, 'getItem' | 'setItem'>,
): ReleaseSkipPreference {
  const key = 'run-planner.skipped-release-version';
  return Object.freeze({
    read: () => {
      try {
        const value = storage().getItem(key);
        return parseStableVersion(value ?? '')?.text;
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

export function createReleaseUpdateController(options: {
  readonly buildIdentity: BuildIdentity;
  readonly host: ReleaseUpdateHost;
  readonly skipPreference: ReleaseSkipPreference;
}): ReleaseUpdateController | undefined {
  const currentVersion = parseStableVersion(options.buildIdentity.version);
  if (currentVersion === undefined) return undefined;

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
  const check = (manual: boolean): Promise<void> => {
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
      .checkLatestRelease()
      .then((metadata) => {
        responseHandled = true;
        const manual = manualRequested;
        const assessment = assessRelease(metadata, currentVersion.text);
        if (assessment.kind === 'current') {
          if (manual) publish({ kind: 'current' });
          return;
        }
        if (assessment.kind === 'unavailable') {
          if (manual) publish({ kind: 'unavailable' });
          return;
        }
        if (
          !manual &&
          (sessionDismissedVersion === assessment.release.version ||
            options.skipPreference.read() === assessment.release.version)
        ) {
          return;
        }
        publish({ kind: 'available', release: assessment.release });
      })
      .catch(() => {
        responseHandled = true;
        if (manualRequested) publish({ kind: 'unavailable' });
      })
      .finally(() => {
        inFlight = undefined;
        manualRequested = false;
      });
    return inFlight;
  };

  return Object.freeze({
    checkAutomatically: () => {
      if (automaticStarted) return;
      automaticStarted = true;
      void check(false);
    },
    checkManually: () => check(true),
    download: async () => {
      if (state.kind !== 'available') return;
      try {
        await options.host.openDownload(state.release.archiveUrl);
      } catch {
        publish({ kind: 'unavailable' });
      }
    },
    later: () => {
      if (state.kind !== 'available') return;
      sessionDismissedVersion = state.release.version;
      publish({ kind: 'idle' });
    },
    skip: () => {
      if (state.kind !== 'available') return;
      sessionDismissedVersion = state.release.version;
      options.skipPreference.write(state.release.version);
      publish({ kind: 'idle' });
    },
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}

export function compareStableVersions(left: string, right: string): number | undefined {
  const leftVersion = parseStableVersion(left);
  const rightVersion = parseStableVersion(right);
  if (leftVersion === undefined || rightVersion === undefined) return undefined;
  return (
    leftVersion.major - rightVersion.major ||
    leftVersion.minor - rightVersion.minor ||
    leftVersion.patch - rightVersion.patch
  );
}

export function eligibleRelease(
  metadata: ReleaseMetadata,
  currentVersion: string,
): EligibleRelease | undefined {
  const assessment = assessRelease(metadata, currentVersion);
  return assessment.kind === 'available' ? assessment.release : undefined;
}

export function assessRelease(
  metadata: ReleaseMetadata,
  currentVersion: string,
):
  | { readonly kind: 'current' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'available'; readonly release: EligibleRelease } {
  if (metadata.draft || metadata.prerelease) return Object.freeze({ kind: 'unavailable' as const });
  const version = parseStableVersion(
    metadata.tagName.startsWith('v') ? metadata.tagName.slice(1) : '',
  );
  const comparison =
    version === undefined ? undefined : compareStableVersions(version.text, currentVersion);
  if (version === undefined || comparison === undefined) {
    return Object.freeze({ kind: 'unavailable' as const });
  }
  if (comparison <= 0) return Object.freeze({ kind: 'current' as const });
  const archiveName = `RunPlanner-${version.text}${portableSuffix}`;
  const archive = metadata.assets.find((asset) => asset.name === archiveName);
  const checksum = metadata.assets.find((asset) => asset.name === `${archiveName}.sha256`);
  if (
    archive === undefined ||
    checksum === undefined ||
    !isOfficialReleaseUrl(archive.browserDownloadUrl, metadata.tagName, archiveName) ||
    !isOfficialReleaseUrl(checksum.browserDownloadUrl, metadata.tagName, checksum.name)
  ) {
    return Object.freeze({ kind: 'unavailable' as const });
  }
  return Object.freeze({
    kind: 'available' as const,
    release: Object.freeze({
      archiveUrl: archive.browserDownloadUrl,
      checksumUrl: checksum.browserDownloadUrl,
      version: version.text,
    }),
  });
}

function parseStableVersion(value: string): StableVersion | undefined {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);
  if (match === null) return undefined;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (![major, minor, patch].every(Number.isSafeInteger)) return undefined;
  return Object.freeze({ major, minor, patch, text: value });
}

function isOfficialReleaseUrl(value: string, tag: string, assetName: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'github.com' &&
      url.username === '' &&
      url.password === '' &&
      url.port === '' &&
      url.pathname === `/${officialRepository}/releases/download/${tag}/${assetName}` &&
      url.search === '' &&
      url.hash === ''
    );
  } catch {
    return false;
  }
}

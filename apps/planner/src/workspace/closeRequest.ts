import type { PlannerStore } from '../state/store';

export type CloseRequestState =
  { readonly kind: 'idle' } | { readonly kind: 'confirming'; readonly message: string };

/**
 * Decides whether the window may close. Pending edits are written first; a successful write
 * closes silently, and only a write that still fails asks whether to close anyway.
 */
export interface CloseRequestController {
  /**
   * Resolves true when the window may close. `holdOpen` runs before the question is asked, so
   * the host keeps the window open while the user answers.
   */
  request(holdOpen: () => Promise<void>): Promise<boolean>;
  answer(close: boolean): void;
  getSnapshot(): CloseRequestState;
  subscribe(listener: () => void): () => void;
}

const IDLE: CloseRequestState = Object.freeze({ kind: 'idle' });

export function createCloseRequestController(
  flush: () => Promise<{ readonly status: 'failure' | 'success'; readonly message: string }>,
): CloseRequestController {
  let state = IDLE;
  let settle: ((close: boolean) => void) | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: CloseRequestState) => {
    state = next;
    for (const listener of listeners) listener();
  };
  return Object.freeze({
    async request(holdOpen: () => Promise<void>): Promise<boolean> {
      const written = await flush();
      if (written.status === 'success') return true;
      await holdOpen();
      return new Promise<boolean>((resolve) => {
        settle = resolve;
        publish(Object.freeze({ kind: 'confirming', message: written.message }));
      });
    },
    answer(close: boolean): void {
      const resolve = settle;
      settle = null;
      publish(IDLE);
      resolve?.(close);
    },
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  });
}

/** A page about to unload asks first only while the open plan's latest write failed. */
export function unloadNeedsConfirmation(store: PlannerStore): boolean {
  return store.getState().librarySession.writeError !== null;
}

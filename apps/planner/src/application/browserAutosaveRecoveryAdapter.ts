import type { AutosaveRecoveryAdapter, AutosaveScheduler } from './autosaveRecovery';

const autosaveRecoveryKey = 'run-planner.autosave-recovery';

export interface BrowserAutosaveRecoveryEnvironment {
  storage(): Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;
}

export function createBrowserAutosaveRecoveryAdapter(
  environment: BrowserAutosaveRecoveryEnvironment,
): AutosaveRecoveryAdapter {
  return Object.freeze({
    read: () => environment.storage().getItem(autosaveRecoveryKey),
    write: (json: string) => environment.storage().setItem(autosaveRecoveryKey, json),
    clear: () => environment.storage().removeItem(autosaveRecoveryKey),
  });
}

export interface BrowserTimerEnvironment<Handle> {
  setTimeout(task: () => void, delayMs: number): Handle;
  clearTimeout(handle: Handle): void;
}

export function createBrowserAutosaveScheduler<Handle>(
  environment: BrowserTimerEnvironment<Handle>,
): AutosaveScheduler {
  return Object.freeze({
    schedule(delayMs: number, task: () => void) {
      const handle = environment.setTimeout(task, delayMs);
      return () => environment.clearTimeout(handle);
    },
  });
}

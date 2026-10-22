/** The project the planner autosaved before plans lived in the library, kept until settled. */
export interface LegacyAutosave {
  read(): string | null;
  clear(): void;
}

const LEGACY_AUTOSAVE_KEY = 'run-planner.autosave-recovery';

/** The autosave in the window's local storage, where planners before the library kept it. */
export function createBrowserLegacyAutosave(
  storage: () => Pick<Storage, 'getItem' | 'removeItem'>,
): LegacyAutosave {
  return Object.freeze({
    read: () => storage().getItem(LEGACY_AUTOSAVE_KEY),
    clear: () => storage().removeItem(LEGACY_AUTOSAVE_KEY),
  });
}

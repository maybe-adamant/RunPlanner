export interface NavigationPinPreference {
  read(): boolean | undefined;
  write(pinned: boolean): void;
}

const storageKey = 'run-planner.navigation-pinned';

/** Whether the editor's panel navigation stays open: a device-local preference. */
export function createBrowserNavigationPinPreference(
  storage: () => Pick<Storage, 'getItem' | 'setItem'>,
): NavigationPinPreference {
  return {
    read() {
      try {
        const value = storage().getItem(storageKey);
        return value === null ? undefined : value === 'true';
      } catch {
        // Restricted storage must not prevent opening the application.
        return undefined;
      }
    },
    write(pinned) {
      try {
        storage().setItem(storageKey, String(pinned));
      } catch {
        // The choice still holds for this session when storage is unavailable.
      }
    },
  };
}

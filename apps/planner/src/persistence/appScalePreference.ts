export interface AppScalePreference {
  read(): number | undefined;
  write(percent: number): void;
}

const storageKey = 'run-planner.app-scale';

/** A device-local preference, independent of profile files and recovery. */
export function createBrowserAppScalePreference(
  storage: () => Pick<Storage, 'getItem' | 'setItem'>,
): AppScalePreference {
  return {
    read() {
      try {
        const value = storage().getItem(storageKey);
        if (value === null) return undefined;
        const percent = Number(value);
        return Number.isFinite(percent) ? percent : undefined;
      } catch {
        // Restricted storage must not prevent opening the application.
        return undefined;
      }
    },
    write(percent) {
      try {
        storage().setItem(storageKey, String(percent));
      } catch {
        // Scaling remains usable for this session when storage is unavailable.
      }
    },
  };
}

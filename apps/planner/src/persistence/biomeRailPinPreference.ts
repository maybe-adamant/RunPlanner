export interface BiomeRailPinPreference {
  read(): boolean | undefined;
  write(pinned: boolean): void;
}

const storageKey = 'run-planner.biome-rail-pinned';

/** Whether a biome's room rail stays open beside its room: a device-local preference. */
export function createBrowserBiomeRailPinPreference(
  storage: () => Pick<Storage, 'getItem' | 'setItem'>,
): BiomeRailPinPreference {
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

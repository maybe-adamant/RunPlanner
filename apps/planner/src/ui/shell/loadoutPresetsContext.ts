import { createContext, useContext, useSyncExternalStore } from 'react';

import type {
  LoadoutPresetController,
  LoadoutPresetsSnapshot,
} from '@planner/persistence/loadoutPresets';

/** The planner's Arcana and Vow presets; absent where the planner keeps none. */
export const LoadoutPresetsContext = createContext<LoadoutPresetController | null>(null);

const NONE: LoadoutPresetsSnapshot = Object.freeze({ arcana: [], vows: [], dropped: 0 });
const noSubscription = () => () => undefined;
const noSnapshot = () => NONE;

/** The presets as they are now, with the controller that changes them. */
export function useLoadoutPresets(): {
  readonly controller: LoadoutPresetController | null;
  readonly snapshot: LoadoutPresetsSnapshot;
} {
  const controller = useContext(LoadoutPresetsContext);
  const snapshot = useSyncExternalStore(
    controller?.subscribe ?? noSubscription,
    controller?.getSnapshot ?? noSnapshot,
    noSnapshot,
  );
  return { controller, snapshot };
}

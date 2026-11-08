import { useMemo, useState, type ReactNode } from 'react';

import {
  highlightOwner,
  RoomMapHighlightChannel,
  RoomMapHighlightValue,
  RoomMapPointedChannel,
  RoomMapPointedValue,
  sameHighlight,
  type RoomMapHighlight,
  type RoomMapHighlightActions,
} from './roomMapHighlight';

/** What a control previews on the map, and the map point the pointer is on. */
type Slot = 'highlight' | 'pointed';

/**
 * The room workbench's map preview and the map point being pointed at, UI-session
 * state only: a new `scope` (another room or tab) starts with neither.
 */
export function RoomMapHighlightScope({
  children,
  scope,
}: {
  readonly children: ReactNode;
  readonly scope: string;
}) {
  const [state, setState] = useState<{
    readonly scope: string;
    readonly highlight?: RoomMapHighlight;
    readonly pointed?: RoomMapHighlight;
  }>({ scope });
  const current = state.scope === scope ? state : { scope };
  const [highlightActions, pointedActions] = useMemo(() => {
    const actions = (slot: Slot): RoomMapHighlightActions => ({
      show: (next) =>
        setState((shown) => {
          const kept = shown.scope === scope ? shown : { scope };
          return sameHighlight(kept[slot], next) ? kept : { ...kept, [slot]: next };
        }),
      release: (owned) =>
        setState((shown) => {
          const held = shown[slot];
          if (shown.scope !== scope || held === undefined) return shown;
          if (highlightOwner(held) !== highlightOwner(owned)) return shown;
          return slot === 'highlight'
            ? {
                scope: shown.scope,
                ...(shown.pointed === undefined ? {} : { pointed: shown.pointed }),
              }
            : {
                scope: shown.scope,
                ...(shown.highlight === undefined ? {} : { highlight: shown.highlight }),
              };
        }),
    });
    return [actions('highlight'), actions('pointed')] as const;
  }, [scope]);
  return (
    <RoomMapHighlightChannel.Provider value={highlightActions}>
      <RoomMapPointedChannel.Provider value={pointedActions}>
        <RoomMapHighlightValue.Provider value={current.highlight}>
          <RoomMapPointedValue.Provider value={current.pointed}>
            {children}
          </RoomMapPointedValue.Provider>
        </RoomMapHighlightValue.Provider>
      </RoomMapPointedChannel.Provider>
    </RoomMapHighlightChannel.Provider>
  );
}

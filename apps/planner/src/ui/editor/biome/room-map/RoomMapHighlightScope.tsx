import { useMemo, useState, type ReactNode } from 'react';

import {
  highlightOwner,
  RoomMapHighlightChannel,
  RoomMapHighlightValue,
  RoomMapListChannel,
  RoomMapPointedChannel,
  RoomMapPointedValue,
  sameHighlight,
  type RoomMapHighlight,
  type RoomMapHighlightActions,
} from './roomMapHighlight';

/** An open list's preview, what a hovered or focused control previews, and the map point pointed at. */
type Slot = 'list' | 'highlight' | 'pointed';

type ScopeState = { readonly scope: string } & Partial<Record<Slot, RoomMapHighlight>>;

/**
 * The room workbench's map preview and the map point being pointed at, UI-session
 * state only: a new `scope` (another room or tab) starts with neither. An open
 * list's preview stands over a hovered control's.
 */
export function RoomMapHighlightScope({
  children,
  scope,
}: {
  readonly children: ReactNode;
  readonly scope: string;
}) {
  const [state, setState] = useState<ScopeState>({ scope });
  const current: ScopeState = state.scope === scope ? state : { scope };
  const [listActions, highlightActions, pointedActions] = useMemo(() => {
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
          const { [slot]: _released, ...rest } = shown;
          void _released;
          return rest;
        }),
    });
    return [actions('list'), actions('highlight'), actions('pointed')] as const;
  }, [scope]);
  return (
    <RoomMapListChannel.Provider value={listActions}>
      <RoomMapHighlightChannel.Provider value={highlightActions}>
        <RoomMapPointedChannel.Provider value={pointedActions}>
          <RoomMapHighlightValue.Provider value={current.list ?? current.highlight}>
            <RoomMapPointedValue.Provider value={current.pointed}>
              {children}
            </RoomMapPointedValue.Provider>
          </RoomMapHighlightValue.Provider>
        </RoomMapPointedChannel.Provider>
      </RoomMapHighlightChannel.Provider>
    </RoomMapListChannel.Provider>
  );
}

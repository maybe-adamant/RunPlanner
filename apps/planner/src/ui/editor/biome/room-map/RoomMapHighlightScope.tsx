import { useMemo, useState, type ReactNode } from 'react';

import {
  highlightOwner,
  RoomMapHighlightChannel,
  RoomMapHighlightValue,
  sameHighlight,
  type RoomMapHighlight,
  type RoomMapHighlightActions,
} from './roomMapHighlight';

/**
 * The room workbench's map preview, UI-session state only: a new `scope`
 * (another room or tab) starts with none.
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
  }>({ scope });
  const highlight = state.scope === scope ? state.highlight : undefined;
  const actions = useMemo<RoomMapHighlightActions>(
    () => ({
      show: (next) =>
        setState((current) =>
          current.scope === scope && sameHighlight(current.highlight, next)
            ? current
            : { scope, highlight: next },
        ),
      release: (owned) =>
        setState((current) =>
          current.highlight !== undefined &&
          highlightOwner(current.highlight) === highlightOwner(owned)
            ? { scope: current.scope }
            : current,
        ),
    }),
    [scope],
  );
  return (
    <RoomMapHighlightChannel.Provider value={actions}>
      <RoomMapHighlightValue.Provider value={highlight}>{children}</RoomMapHighlightValue.Provider>
    </RoomMapHighlightChannel.Provider>
  );
}

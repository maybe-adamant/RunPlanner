import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type FocusEventHandler,
  type PointerEventHandler,
} from 'react';

/**
 * What the room's map previews for the control being worked on: one door by
 * its number, the Chaos gate, or every Chaos point with one position previewed.
 */
export type RoomMapHighlight =
  | { readonly kind: 'door'; readonly doorIndex: number }
  | { readonly kind: 'chaosGate' }
  | { readonly kind: 'chaosPoints'; readonly position?: number | undefined };

export interface RoomMapHighlightActions {
  readonly show: (highlight: RoomMapHighlight) => void;
  /** Clears the preview only while it is still this control's own. */
  readonly release: (highlight: RoomMapHighlight) => void;
}

export const RoomMapHighlightValue = createContext<RoomMapHighlight | undefined>(undefined);
export const RoomMapHighlightChannel = createContext<RoomMapHighlightActions | undefined>(
  undefined,
);

// One picker's preview stays one owner while its highlighted position moves.
export const highlightOwner = (highlight: RoomMapHighlight): string =>
  highlight.kind === 'door' ? `door:${highlight.doorIndex}` : highlight.kind;

export const sameHighlight = (
  left: RoomMapHighlight | undefined,
  right: RoomMapHighlight,
): boolean =>
  left !== undefined &&
  highlightOwner(left) === highlightOwner(right) &&
  (left.kind !== 'chaosPoints' || right.kind !== 'chaosPoints' || left.position === right.position);

/** The map's current preview; none outside a room workbench with a map. */
export function useRoomMapHighlight(): RoomMapHighlight | undefined {
  return useContext(RoomMapHighlightValue);
}

/** Shows and releases a preview directly, such as a picker's highlighted option. */
export function useRoomMapHighlightActions(): RoomMapHighlightActions | undefined {
  const channel = useContext(RoomMapHighlightChannel);
  const owned = useRef<RoomMapHighlight | undefined>(undefined);
  useEffect(
    () => () => {
      // A control that leaves while previewing takes its preview with it.
      const last = owned.current;
      if (last !== undefined) channel?.release(last);
    },
    [channel],
  );
  return useMemo(
    () =>
      channel === undefined
        ? undefined
        : {
            show: (highlight) => {
              owned.current = highlight;
              channel.show(highlight);
            },
            release: (highlight) => {
              owned.current = undefined;
              channel.release(highlight);
            },
          },
    [channel],
  );
}

export interface RoomMapLinkProps {
  readonly onPointerEnter?: PointerEventHandler<HTMLElement>;
  readonly onPointerLeave?: PointerEventHandler<HTMLElement>;
  readonly onFocus?: FocusEventHandler<HTMLElement>;
  readonly onBlur?: FocusEventHandler<HTMLElement>;
}

/**
 * Hovering or focusing an element linked to a map point previews that point;
 * nothing where the element has no point or no map.
 */
export function useRoomMapLinks(): (target: RoomMapHighlight | undefined) => RoomMapLinkProps {
  const actions = useRoomMapHighlightActions();
  return useCallback(
    (target) =>
      target === undefined || actions === undefined
        ? {}
        : {
            onPointerEnter: () => actions.show(target),
            onPointerLeave: () => actions.release(target),
            onFocus: () => actions.show(target),
            onBlur: () => actions.release(target),
          },
    [actions],
  );
}

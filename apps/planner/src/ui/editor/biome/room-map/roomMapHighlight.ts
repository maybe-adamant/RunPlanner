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
 * its number, the Chaos gate, every Chaos point with one position previewed,
 * the entry being picked (one entry with the flip choosing it sets), an
 * object anchor, or a Fields slot's point with the free points it can pick
 * numbered.
 */
export type RoomMapHighlight =
  | { readonly kind: 'door'; readonly doorIndex: number }
  | { readonly kind: 'chaosGate' }
  | { readonly kind: 'chaosPoints'; readonly position?: number | undefined }
  | { readonly kind: 'entry'; readonly pointId?: number; readonly flipped?: boolean | undefined }
  | { readonly kind: 'anchor'; readonly anchorId: number }
  | {
      readonly kind: 'fieldsPoint';
      readonly pointId?: number | undefined;
      /** Each free point of the slot's family with its number; a disabled one cannot take it. */
      readonly marks?: readonly RoomMapPointMark[] | undefined;
    };

/** A map point's number while its slot is being placed. */
export interface RoomMapPointMark {
  readonly pointId: number;
  readonly mark: string;
  readonly disabled?: boolean | undefined;
}

export interface RoomMapHighlightActions {
  readonly show: (highlight: RoomMapHighlight) => void;
  /** Clears the preview only while it is still this control's own. */
  readonly release: (highlight: RoomMapHighlight) => void;
}

export const RoomMapHighlightValue = createContext<RoomMapHighlight | undefined>(undefined);
export const RoomMapHighlightChannel = createContext<RoomMapHighlightActions | undefined>(
  undefined,
);
/** The map point under the pointer, which lights the control that owns it. */
export const RoomMapPointedValue = createContext<RoomMapHighlight | undefined>(undefined);
export const RoomMapPointedChannel = createContext<RoomMapHighlightActions | undefined>(undefined);

// One picker's preview stays one owner while its highlighted position moves.
export const highlightOwner = (highlight: RoomMapHighlight): string => {
  switch (highlight.kind) {
    case 'door':
      return `door:${highlight.doorIndex}`;
    case 'anchor':
      return `anchor:${highlight.anchorId}`;
    case 'fieldsPoint':
      return `fieldsPoint:${highlight.pointId ?? '?'}`;
    case 'chaosGate':
    case 'chaosPoints':
    case 'entry':
      return highlight.kind;
  }
};

export const sameHighlight = (
  left: RoomMapHighlight | undefined,
  right: RoomMapHighlight,
): boolean =>
  left !== undefined && highlightOwner(left) === highlightOwner(right) && sameDetail(left, right);

/** The previewed position within one owner: a Chaos point or an entry. */
function sameDetail(left: RoomMapHighlight, right: RoomMapHighlight): boolean {
  if (left.kind === 'chaosPoints' && right.kind === 'chaosPoints')
    return left.position === right.position;
  if (left.kind === 'entry' && right.kind === 'entry')
    return left.pointId === right.pointId && left.flipped === right.flipped;
  return true;
}

/** The map's current preview; none outside a room workbench with a map. */
export function useRoomMapHighlight(): RoomMapHighlight | undefined {
  return useContext(RoomMapHighlightValue);
}

/** Whether the map point under the pointer is one of these; never outside a map scope. */
export function useRoomMapPointedAmong(
  targets: readonly (RoomMapHighlight | undefined)[],
): boolean {
  const pointed = useContext(RoomMapPointedValue);
  if (pointed === undefined) return false;
  const owner = highlightOwner(pointed);
  return targets.some((target) => target !== undefined && highlightOwner(target) === owner);
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
  /** The map point this element owns is under the pointer. */
  readonly 'data-map-pointed'?: true;
}

/**
 * Hovering or focusing an element linked to a map point previews that point,
 * and pointing at that point on the map marks the element; nothing where the
 * element has no point or no map.
 */
export function useRoomMapLinks(): (target: RoomMapHighlight | undefined) => RoomMapLinkProps {
  const actions = useRoomMapHighlightActions();
  const pointed = useContext(RoomMapPointedValue);
  const pointedOwner = pointed === undefined ? undefined : highlightOwner(pointed);
  return useCallback(
    (target) =>
      target === undefined || actions === undefined
        ? {}
        : {
            onPointerEnter: () => actions.show(target),
            onPointerLeave: () => actions.release(target),
            onFocus: () => actions.show(target),
            onBlur: () => actions.release(target),
            ...(highlightOwner(target) === pointedOwner ? { 'data-map-pointed': true } : {}),
          },
    [actions, pointedOwner],
  );
}

export interface RoomMapPointerProps {
  readonly onPointerEnter?: PointerEventHandler<HTMLElement>;
  readonly onPointerLeave?: PointerEventHandler<HTMLElement>;
}

/** Pointing at a map point marks the controls linked to it; nothing outside a map scope. */
export function useRoomMapPointers(): (
  target: RoomMapHighlight | undefined,
) => RoomMapPointerProps {
  const channel = useContext(RoomMapPointedChannel);
  return useCallback(
    (target) =>
      target === undefined || channel === undefined
        ? {}
        : {
            onPointerEnter: () => channel.show(target),
            onPointerLeave: () => channel.release(target),
          },
    [channel],
  );
}

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
 * its number, an Ephyra side door by its slot, a Ship wheel offer, the Chaos gate, every Chaos point with one position previewed,
 * the entry being picked (one entry with the flip choosing it sets), an
 * object anchor, a Fields slot's point with the free points it can pick
 * numbered, or an item the game places with the points it can take.
 */
export type RoomMapHighlight =
  | { readonly kind: 'door'; readonly doorIndex: number }
  | { readonly kind: 'sideDoor'; readonly slotKey: string }
  | { readonly kind: 'wheelOffer'; readonly offerKey: string }
  | { readonly kind: 'chaosGate' }
  | { readonly kind: 'chaosPoints'; readonly position?: number | undefined }
  | { readonly kind: 'entry'; readonly pointId?: number; readonly flipped?: boolean | undefined }
  | { readonly kind: 'anchor'; readonly anchorId: number }
  | { readonly kind: 'unplaced'; readonly key: string }
  /** A point some items the game places may take, by their keys; only ever pointed at. */
  | { readonly kind: 'candidate'; readonly pointId: number; readonly keys: readonly string[] }
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
/** Hovered or focused linked controls; an open list's preview stands over theirs. */
export const RoomMapHighlightChannel = createContext<RoomMapHighlightActions | undefined>(
  undefined,
);
/** An open picker list's preview, which follows its active option until the list closes. */
export const RoomMapListChannel = createContext<RoomMapHighlightActions | undefined>(undefined);
/** The map point under the pointer, which lights the control that owns it. */
export const RoomMapPointedValue = createContext<RoomMapHighlight | undefined>(undefined);
export const RoomMapPointedChannel = createContext<RoomMapHighlightActions | undefined>(undefined);

// One picker's preview stays one owner while its highlighted position moves.
export const highlightOwner = (highlight: RoomMapHighlight): string => {
  switch (highlight.kind) {
    case 'door':
      return `door:${highlight.doorIndex}`;
    case 'sideDoor':
      return `sideDoor:${highlight.slotKey}`;
    case 'wheelOffer':
      return `wheelOffer:${highlight.offerKey}`;
    case 'anchor':
      return `anchor:${highlight.anchorId}`;
    case 'fieldsPoint':
      return `fieldsPoint:${highlight.pointId ?? '?'}`;
    case 'unplaced':
      return `unplaced:${highlight.key}`;
    case 'candidate':
      return `candidate:${highlight.pointId}`;
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

/** Whether the point pointed at belongs to this control: its own point, or one its item may take. */
function pointsAt(pointed: RoomMapHighlight, target: RoomMapHighlight): boolean {
  if (pointed.kind === 'candidate' && target.kind === 'unplaced')
    return pointed.keys.includes(target.key);
  return highlightOwner(pointed) === highlightOwner(target);
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
  return targets.some((target) => target !== undefined && pointsAt(pointed, target));
}

/**
 * Shows and releases an open picker list's preview, its highlighted option:
 * leaving or blurring the controls around it never clears it.
 */
export function useRoomMapHighlightActions(): RoomMapHighlightActions | undefined {
  return useOwnedActions(useContext(RoomMapListChannel));
}

function useOwnedActions(
  channel: RoomMapHighlightActions | undefined,
): RoomMapHighlightActions | undefined {
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
  const actions = useOwnedActions(useContext(RoomMapHighlightChannel));
  const pointed = useContext(RoomMapPointedValue);
  return useCallback(
    (target) =>
      target === undefined || actions === undefined
        ? {}
        : {
            onPointerEnter: () => actions.show(target),
            onPointerLeave: () => actions.release(target),
            onFocus: () => actions.show(target),
            onBlur: () => actions.release(target),
            ...(pointed !== undefined && pointsAt(pointed, target)
              ? { 'data-map-pointed': true }
              : {}),
          },
    [actions, pointed],
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

import { useCallback, useEffect, useId, useLayoutEffect, useState } from 'react';

/** One place a reordered row can stand, in document order. */
export interface TimelineReorderPosition {
  /** The projected move that puts the row here; undefined is the row's current place. */
  readonly move: string | undefined;
  readonly label: string;
  /** The `data-reorder-anchor` of the row the indicator draws against. */
  readonly anchor: string;
  readonly edge: 'before' | 'after' | 'self';
  /** Why the move here cannot be authored; pointer drag shows it, the keyboard skips it. */
  readonly unavailable?: string;
}

/** A reorderable row with every legal place it can move to, its own place included. */
export interface TimelineReorderItem {
  readonly key: string;
  readonly label: string;
  readonly positions: readonly TimelineReorderPosition[];
  readonly onMove: (move: string) => void;
}

export interface TimelineReorderLift {
  readonly item: TimelineReorderItem;
  readonly index: number;
  readonly via: 'keyboard' | 'pointer';
  readonly x: number;
  readonly y: number;
}

export interface TimelineReorderSession {
  /** Callback ref for the element that holds every anchor of the list. */
  readonly attachRoot: (element: HTMLElement | null) => void;
  readonly root: () => HTMLElement | null;
  readonly instructionsId: string;
  readonly lift: TimelineReorderLift | undefined;
  readonly setLift: (lift: TimelineReorderLift | undefined) => void;
  readonly announcement: string;
  readonly announce: (text: string) => void;
  /** The item whose handle regains focus if its move remounts the row. */
  readonly pendingFocus: string | undefined;
  readonly refocusAfterMove: (itemKey: string) => void;
  readonly focusClaimed: () => void;
}

export function reorderAnchorElement(
  root: HTMLElement | null,
  anchor: string,
): HTMLElement | undefined {
  return (
    root?.querySelector<HTMLElement>(`[data-reorder-anchor="${CSS.escape(anchor)}"]`) ?? undefined
  );
}

/** One list's pick-up, step and drop state for its row handles. */
export function useTimelineReorder(): TimelineReorderSession {
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [pendingFocus, setPendingFocus] = useState<string | undefined>(undefined);
  const instructionsId = useId();
  const [lift, setLift] = useState<TimelineReorderLift | undefined>(undefined);
  const [announcement, setAnnouncement] = useState('');
  const rootElement = useCallback(() => root, [root]);
  const position = lift?.item.positions[lift.index];
  const own = lift?.item.positions.find((candidate) => candidate.edge === 'self');
  // The lifted row and the candidate place are marked on rendered rows only.
  useLayoutEffect(() => {
    if (own === undefined) return;
    const lifted = reorderAnchorElement(root, own.anchor);
    lifted?.setAttribute('data-reorder-lifted', lift?.via ?? 'keyboard');
    const target =
      position === undefined || position.edge === 'self'
        ? undefined
        : reorderAnchorElement(root, position.anchor);
    target?.setAttribute('data-reorder-indicator', position!.edge);
    if (position?.unavailable !== undefined) target?.setAttribute('data-reorder-unavailable', '');
    if (lift?.via === 'keyboard') target?.scrollIntoView?.({ block: 'nearest' });
    return () => {
      lifted?.removeAttribute('data-reorder-lifted');
      target?.removeAttribute('data-reorder-indicator');
      target?.removeAttribute('data-reorder-unavailable');
    };
  }, [root, own, position, lift?.via]);
  // Focus is owed only to the render that commits the move; a later mount of the
  // same row never claims it.
  useEffect(() => {
    if (pendingFocus === undefined) return;
    const expire = setTimeout(() => setPendingFocus(undefined), 0);
    return () => clearTimeout(expire);
  }, [pendingFocus]);
  return {
    attachRoot: setRoot,
    root: rootElement,
    instructionsId,
    lift,
    setLift,
    announcement,
    // A repeated message still reaches the live region.
    announce: (text) =>
      setAnnouncement((previous) =>
        previous === text ? `${text}${String.fromCharCode(160)}` : text,
      ),
    pendingFocus,
    refocusAfterMove: setPendingFocus,
    focusClaimed: () => setPendingFocus(undefined),
  };
}

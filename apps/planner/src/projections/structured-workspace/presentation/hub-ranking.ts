/**
 * Presentation-only ordering for one ranked board. The authored prefix is
 * supplied by the owning domain; only the relative tail order is transient UI
 * state. This module deliberately does not judge whether a complete prefix is
 * valid in simulation—the owning aggregate interaction supplies that evidence.
 */

export interface RankedPrefix {
  readonly authoredVisitOrder: readonly string[];
  readonly rankedSlotKeys: readonly string[];
  readonly tailSlotKeys: readonly string[];
}

export type RankedPrefixMove =
  | { readonly kind: 'addToVisits'; readonly slotKey: string }
  | { readonly kind: 'moveEarlier'; readonly slotKey: string }
  | { readonly kind: 'moveLater'; readonly slotKey: string }
  | { readonly kind: 'removeFromVisits'; readonly slotKey: string };

/**
 * A rendered drop location on the Hub roster. `nextVisit` is the compact
 * incomplete-prefix target rather than a stand-in for an unrendered row.
 */
export type RankedPrefixDropTarget =
  | { readonly kind: 'beforeSlot'; readonly slotKey: string }
  | { readonly kind: 'afterSlot'; readonly slotKey: string }
  | { readonly kind: 'nextVisit' };

export interface RankedPrefixMoveResult {
  readonly ranking: RankedPrefix;
  /** Omitted when the move only changes transient tail presentation. */
  readonly proposedVisitOrder?: readonly string[];
}

function appendUniqueOpenKeys(
  target: string[],
  source: readonly string[],
  openKeys: ReadonlySet<string>,
  excluded: ReadonlySet<string>,
): void {
  for (const key of source) {
    if (!openKeys.has(key) || excluded.has(key) || target.includes(key)) continue;
    target.push(key);
  }
}

function swap(values: readonly string[], left: number, right: number): readonly string[] {
  const next = [...values];
  const leftValue = next[left];
  const rightValue = next[right];
  if (leftValue === undefined || rightValue === undefined) return values;
  next[left] = rightValue;
  next[right] = leftValue;
  return Object.freeze(next);
}

function insertAt(values: readonly string[], index: number, value: string): readonly string[] {
  const next = [...values];
  next.splice(index, 0, value);
  return Object.freeze(next);
}

function removeAt(values: readonly string[], index: number): readonly string[] {
  const next = [...values];
  next.splice(index, 1);
  return Object.freeze(next);
}

function sameSlotKeys(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((slotKey, index) => slotKey === right[index]);
}

function rankingFor(rankedSlotKeys: readonly string[], authoredVisitCount: number): RankedPrefix {
  const authoredVisitOrder = Object.freeze(rankedSlotKeys.slice(0, authoredVisitCount));
  const tailSlotKeys = Object.freeze(rankedSlotKeys.slice(authoredVisitCount));
  return Object.freeze({
    authoredVisitOrder,
    rankedSlotKeys: Object.freeze([...rankedSlotKeys]),
    tailSlotKeys,
  });
}

/**
 * Reconciles a mounted board after a semantic publication. The exact authored
 * prefix always wins; surviving tail rooms keep their transient order, and
 * newly visible tail rooms enter in declaration order.
 */
export function reconcileRankedPrefix(input: {
  readonly authoredVisitOrder: readonly string[];
  readonly declarationOpenSlotKeys: readonly string[];
  readonly retainedTailSlotKeys?: readonly string[];
}): RankedPrefix {
  const openKeys = new Set(input.declarationOpenSlotKeys);
  const authored: string[] = [];
  appendUniqueOpenKeys(authored, input.authoredVisitOrder, openKeys, new Set());
  const authoredKeys = new Set(authored);
  const tail: string[] = [];
  appendUniqueOpenKeys(tail, input.retainedTailSlotKeys ?? [], openKeys, authoredKeys);
  appendUniqueOpenKeys(tail, input.declarationOpenSlotKeys, openKeys, authoredKeys);
  return rankingFor(Object.freeze([...authored, ...tail]), authored.length);
}

function semanticMoveResult(
  rankedSlotKeys: readonly string[],
  authoredVisitCount: number,
): RankedPrefixMoveResult {
  const ranking = rankingFor(rankedSlotKeys, authoredVisitCount);
  return Object.freeze({ ranking, proposedVisitOrder: ranking.authoredVisitOrder });
}

function transientMoveResult(
  ranking: RankedPrefix,
  rankedSlotKeys: readonly string[],
): RankedPrefixMoveResult {
  return Object.freeze({
    ranking: rankingFor(rankedSlotKeys, ranking.authoredVisitOrder.length),
  });
}

function dropResult(
  ranking: RankedPrefix,
  rankedSlotKeys: readonly string[],
  authoredVisitCount: number,
): RankedPrefixMoveResult | undefined {
  const nextRanking = rankingFor(rankedSlotKeys, authoredVisitCount);
  if (
    authoredVisitCount === ranking.authoredVisitOrder.length &&
    sameSlotKeys(ranking.rankedSlotKeys, nextRanking.rankedSlotKeys)
  ) {
    return undefined;
  }
  if (
    authoredVisitCount === ranking.authoredVisitOrder.length &&
    sameSlotKeys(ranking.authoredVisitOrder, nextRanking.authoredVisitOrder)
  ) {
    return Object.freeze({ ranking: nextRanking });
  }
  return Object.freeze({
    ranking: nextRanking,
    proposedVisitOrder: nextRanking.authoredVisitOrder,
  });
}

function droppedAtSlot(
  ranking: RankedPrefix,
  sourceIndex: number,
  target: Exclude<RankedPrefixDropTarget, { readonly kind: 'nextVisit' }>,
): readonly string[] | undefined {
  const sourceSlotKey = ranking.rankedSlotKeys[sourceIndex];
  if (sourceSlotKey === undefined || sourceSlotKey === target.slotKey) return undefined;
  const withoutSource = removeAt(ranking.rankedSlotKeys, sourceIndex);
  const targetIndex = withoutSource.indexOf(target.slotKey);
  if (targetIndex === -1) return undefined;
  return insertAt(
    withoutSource,
    target.kind === 'beforeSlot' ? targetIndex : targetIndex + 1,
    sourceSlotKey,
  );
}

/**
 * Interprets one bounded roster drag/drop as either a complete authored
 * prefix proposal or a transient tail presentation move. It deliberately
 * exposes only semantically truthful targets: an incomplete tail may enter
 * authorship through `nextVisit`, and a full prefix may leave it through an
 * after-tail target so the next tail room promotes naturally.
 */
export function dropRankedPrefixItem(
  ranking: RankedPrefix,
  requiredVisitCount: number,
  sourceSlotKey: string,
  target: RankedPrefixDropTarget,
): RankedPrefixMoveResult | undefined {
  const authoredVisitCount = ranking.authoredVisitOrder.length;
  if (
    !Number.isInteger(requiredVisitCount) ||
    requiredVisitCount < 1 ||
    authoredVisitCount > requiredVisitCount ||
    authoredVisitCount > ranking.rankedSlotKeys.length
  ) {
    return undefined;
  }

  const sourceIndex = ranking.rankedSlotKeys.indexOf(sourceSlotKey);
  if (sourceIndex === -1) return undefined;
  const sourceIsPrefix = sourceIndex < authoredVisitCount;

  if (target.kind === 'nextVisit') {
    if (sourceIsPrefix || authoredVisitCount >= requiredVisitCount) return undefined;
    const withoutSource = removeAt(ranking.rankedSlotKeys, sourceIndex);
    return dropResult(
      ranking,
      insertAt(withoutSource, authoredVisitCount, sourceSlotKey),
      authoredVisitCount + 1,
    );
  }

  const targetIndex = ranking.rankedSlotKeys.indexOf(target.slotKey);
  if (targetIndex === -1 || targetIndex === sourceIndex) return undefined;
  const targetIsPrefix = targetIndex < authoredVisitCount;
  const nextRankedSlotKeys = droppedAtSlot(ranking, sourceIndex, target);
  if (nextRankedSlotKeys === undefined) return undefined;

  if (sourceIsPrefix && targetIsPrefix) {
    return dropResult(ranking, nextRankedSlotKeys, authoredVisitCount);
  }

  if (!sourceIsPrefix && !targetIsPrefix) {
    return dropResult(ranking, nextRankedSlotKeys, authoredVisitCount);
  }

  if (!sourceIsPrefix && targetIsPrefix) {
    // A partial prefix has one honest entry point: its compact next-visit
    // target. Dropping directly onto a rendered prefix must not imply that
    // an arbitrary later ordinal is authorable.
    if (authoredVisitCount < requiredVisitCount) return undefined;
    return dropResult(ranking, nextRankedSlotKeys, authoredVisitCount);
  }

  // A prefix room can move below the boundary. With a partial prefix that
  // shortens authorship; with a full prefix only an after-tail target is
  // truthful because the resulting first required-count rooms promote.
  if (authoredVisitCount < requiredVisitCount) {
    return dropResult(ranking, nextRankedSlotKeys, authoredVisitCount - 1);
  }
  if (target.kind !== 'afterSlot') return undefined;
  return dropResult(ranking, nextRankedSlotKeys, authoredVisitCount);
}

/**
 * Produces one visual board move and, only when the active prefix changes,
 * its complete semantic proposal. It has no candidate or topology policy.
 */
export function moveRankedPrefixItem(
  ranking: RankedPrefix,
  requiredVisitCount: number,
  move: RankedPrefixMove,
): RankedPrefixMoveResult | undefined {
  const authoredVisitCount = ranking.authoredVisitOrder.length;
  const sourceIndex = ranking.rankedSlotKeys.indexOf(move.slotKey);
  if (sourceIndex === -1) return undefined;

  switch (move.kind) {
    case 'addToVisits': {
      if (
        sourceIndex < authoredVisitCount ||
        requiredVisitCount < 1 ||
        authoredVisitCount > requiredVisitCount
      ) {
        return undefined;
      }
      const withoutSource = removeAt(ranking.rankedSlotKeys, sourceIndex);
      const nextVisitCount = Math.min(authoredVisitCount + 1, requiredVisitCount);
      return semanticMoveResult(
        insertAt(withoutSource, nextVisitCount - 1, move.slotKey),
        nextVisitCount,
      );
    }
    case 'moveEarlier': {
      if (sourceIndex === 0) return undefined;
      const next = swap(ranking.rankedSlotKeys, sourceIndex, sourceIndex - 1);
      if (sourceIndex < authoredVisitCount) {
        return semanticMoveResult(next, authoredVisitCount);
      }
      if (sourceIndex === authoredVisitCount) {
        if (authoredVisitCount < requiredVisitCount) {
          // The visible gap represents un-authored visits. Crossing into it
          // appends at the next dense position; it must not reorder already
          // authored rooms merely because the card is adjacent to the board
          // boundary in presentation layout.
          return semanticMoveResult(ranking.rankedSlotKeys, authoredVisitCount + 1);
        }
        return semanticMoveResult(next, authoredVisitCount);
      }
      return transientMoveResult(ranking, next);
    }
    case 'moveLater': {
      if (sourceIndex >= ranking.rankedSlotKeys.length - 1) return undefined;
      if (sourceIndex === authoredVisitCount - 1 && authoredVisitCount < requiredVisitCount) {
        // An incomplete prefix has visible empty positions. Removing a room
        // from that prefix is an explicit action rather than silently filling
        // its next position with a tail room.
        return undefined;
      }
      const next = swap(ranking.rankedSlotKeys, sourceIndex, sourceIndex + 1);
      return sourceIndex < authoredVisitCount
        ? semanticMoveResult(next, authoredVisitCount)
        : transientMoveResult(ranking, next);
    }
    case 'removeFromVisits': {
      if (sourceIndex >= authoredVisitCount) return undefined;
      const withoutSource = removeAt(ranking.rankedSlotKeys, sourceIndex);
      if (authoredVisitCount === requiredVisitCount && withoutSource.length >= authoredVisitCount) {
        // The next ranked tail room becomes visit six; the removed room starts
        // the tail so the visual move matches its newly inactive state.
        const next = insertAt(withoutSource, authoredVisitCount, move.slotKey);
        return semanticMoveResult(next, authoredVisitCount);
      }
      const next = insertAt(withoutSource, authoredVisitCount - 1, move.slotKey);
      return semanticMoveResult(next, authoredVisitCount - 1);
    }
  }
}

/**
 * Hub keeps its established domain vocabulary as aliases over the shared
 * ranked-prefix mechanics. This preserves its public surface while acquisition
 * editors consume the same implementation directly.
 */
export type HubBoardRanking = RankedPrefix;
export type HubBoardDropTarget = RankedPrefixDropTarget;
export type HubBoardMove = RankedPrefixMove;
export type HubBoardMoveResult = RankedPrefixMoveResult;
export const reconcileHubBoardRanking = reconcileRankedPrefix;
export const moveHubBoardRoom = moveRankedPrefixItem;
export const dropHubBoardRoom = dropRankedPrefixItem;

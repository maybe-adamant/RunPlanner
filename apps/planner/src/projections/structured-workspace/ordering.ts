import type { OccurrenceId } from '@run-planner/engine/authored-project';

import { StructuredWorkspaceProjectionContractError } from './contract';

export interface AuthoredTargetOrderable {
  readonly exitKey: string;
  readonly occurrenceId: OccurrenceId;
}

export function compareCodeUnitStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function normalExitOrdinal(exitKey: string): number | undefined {
  const match = /^exit([1-9][0-9]*)$/.exec(exitKey);
  if (match === null) return undefined;
  const index = Number(match[1]);
  return Number.isSafeInteger(index) ? index : undefined;
}

export function requiredNormalExitOrdinal(exitKey: string): number {
  const index = normalExitOrdinal(exitKey);
  if (index === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${exitKey} is not a canonical normal physical exit key`,
    );
  }
  return index;
}

/** Kept solely as a defensive sort fallback; it is never a published ordinal. */
const unknownPhysicalExitSortIndex = Number.MAX_SAFE_INTEGER;

/**
 * The catalog normally gives each declared exit a unique physical ordinal.
 * This total comparator keeps the workspace deterministic even when a
 * malformed in-memory document bypasses codec validation.
 */
export function compareAuthoredTargetsInPhysicalOrder(
  physicalOrder: ReadonlyMap<string, number>,
  left: AuthoredTargetOrderable,
  right: AuthoredTargetOrderable,
): number {
  const rankDifference =
    (physicalOrder.get(left.exitKey) ??
      normalExitOrdinal(left.exitKey) ??
      unknownPhysicalExitSortIndex) -
    (physicalOrder.get(right.exitKey) ??
      normalExitOrdinal(right.exitKey) ??
      unknownPhysicalExitSortIndex);
  if (rankDifference !== 0) return rankDifference;
  const exitKeyDifference = compareCodeUnitStrings(left.exitKey, right.exitKey);
  return exitKeyDifference !== 0
    ? exitKeyDifference
    : compareCodeUnitStrings(left.occurrenceId, right.occurrenceId);
}

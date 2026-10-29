import {
  screenRerollCost,
  screenRerollSupported,
  type OccurrenceAddress,
  type RerollableScreen,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';

import type { WorkspaceScreenRerolls } from '../contracts/traits';
import type { WorkspaceBiomeSource } from '../source-index';

/** A room's single-pick screens and the pool their native rerolls spend. */
export type WorkspaceScreenRerollSource = (
  screen: RerollableScreen,
  count: number | undefined,
) => WorkspaceScreenRerolls | undefined;

/**
 * The reroll tabs of one screen in a room. They appear where the screen shows
 * the native button and a held card enables screen rerolls, or where the plan
 * already rerolls it. The pool is a fixed budget: rerolls past what it pays
 * for at the screen's point are not offered.
 */
export function workspaceScreenRerollSource(input: {
  readonly catalog: Catalog;
  readonly occurrence: OccurrenceAddress;
  readonly screenRerollAllowance: WorkspaceBiomeSource['screenRerollAllowance'];
}): WorkspaceScreenRerollSource {
  const { catalog, occurrence, screenRerollAllowance } = input;
  return (screen, authored) => {
    if (!screenRerollSupported(catalog, screen)) return undefined;
    const count = authored ?? 0;
    const allowance = screenRerollAllowance({ kind: 'screen', occurrence, fromCount: count });
    if (allowance.kind === 'unreached')
      return count === 0
        ? undefined
        : Object.freeze({ count, maxCount: count, lockAtMax: 'unreached', nextCost });
    if (!allowance.enabled && count === 0) return undefined;
    return Object.freeze({
      count,
      maxCount: allowance.maxCount,
      lockAtMax: allowance.limit,
      nextCost,
    });
  };
}

// An editor draft can run ahead of the plan's count, so the cost follows the draft.
function nextCost(fromCount: number): number {
  return screenRerollCost(fromCount + 1) - screenRerollCost(fromCount);
}

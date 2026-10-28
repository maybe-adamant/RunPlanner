import {
  createRoomRunStateCheckpointAddress,
  screenRerollCost,
  screenRerollSupported,
  type OccurrenceAddress,
  type RerollableScreen,
  type RoomRunStateCheckpointAddress,
} from '@run-planner/engine/authored-project';
import type { RunStateSnapshot } from '@run-planner/engine/simulation';
import type { Catalog } from '@run-planner/engine/catalog-schema';

import type { WorkspaceScreenRerollLock, WorkspaceScreenRerolls } from '../contracts/traits';
import type { WorkspaceBiomeSource } from '../source-index';

/** A room's single-pick screens and the pool their native rerolls spend. */
export type WorkspaceScreenRerollSource = (
  screen: RerollableScreen,
  count: number | undefined,
) => WorkspaceScreenRerolls | undefined;

// A count stepper never offers more than this many rerolls of one screen.
const MAX_SCREEN_REROLLS = 20;

/**
 * The reroll count control of one screen in a room. It appears where the
 * screen shows the native button and a held card enables screen rerolls, or
 * where the plan already rerolls it. The pool is a fixed budget: counts that
 * would leave a later spend short are not offered.
 */
export function workspaceScreenRerollSource(input: {
  readonly catalog: Catalog;
  readonly occurrence: OccurrenceAddress;
  readonly source: {
    readonly rerollSpendAllowance: WorkspaceBiomeSource['rerollSpendAllowance'];
    readonly runState: (
      owner: RoomRunStateCheckpointAddress,
    ) =>
      | { readonly availability: 'available'; readonly snapshot: RunStateSnapshot }
      | { readonly availability: 'unavailable' }
      | undefined;
  };
}): WorkspaceScreenRerollSource {
  const { catalog, occurrence, source } = input;
  return (screen, authored) => {
    if (!screenRerollSupported(catalog, screen)) return undefined;
    const count = authored ?? 0;
    const entered = source.runState(
      createRoomRunStateCheckpointAddress(occurrence, { kind: 'roomEntered' }),
    );
    const snapshot = entered?.availability === 'available' ? entered.snapshot : undefined;
    const enabled = snapshot?.rerolls.screensEnabled === true;
    if (!enabled && count === 0) return undefined;
    const allowance = source.rerollSpendAllowance({
      kind: 'screen',
      occurrence,
      fromCount: count,
    });
    const capped = (lock: WorkspaceScreenRerollLock) =>
      Object.freeze({ count, maxCount: count, lockAtMax: lock });
    if (allowance.kind === 'unreached') return capped('unreached');
    if (!enabled) return capped('notEnabled');
    // Each further reroll costs one more than the last, on top of the plan's spend.
    const extra = (to: number) => screenRerollCost(to) - screenRerollCost(count);
    let maxCount = count;
    while (maxCount < MAX_SCREEN_REROLLS && extra(maxCount + 1) <= allowance.lowestRemaining)
      maxCount += 1;
    if (maxCount === MAX_SCREEN_REROLLS) return Object.freeze({ count, maxCount });
    const atScreen = (snapshot?.rerolls.remaining ?? 0) - screenRerollCost(count);
    const lockAtMax: WorkspaceScreenRerollLock =
      atScreen <= 0 ? 'poolEmpty' : atScreen >= extra(maxCount + 1) ? 'poolReserved' : 'poolShort';
    return Object.freeze({ count, maxCount, lockAtMax });
  };
}

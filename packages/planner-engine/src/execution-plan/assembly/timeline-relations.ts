import type { CanonicalAuthoredRoom } from '../../simulation/materialization';
import { semanticAddressKey } from '../../authored-project/addresses';
import type { PlannerTimelineFacts } from '../../simulation/timeline-facts';
import { assembleLifecycleWindow } from './lifecycle';
import type {
  ExecutionTimeline,
  ExecutionTimelineObligation,
  ExecutionTimelineTransaction,
} from '../model';

/**
 * Project planner-published timeline facts into the wire shape.
 *
 * This adapter retains the owner-bearing nodes selected by the planner and
 * copies their opaque edges. Acquisition transactions are steering and DAG
 * instructions; durable outcome proof belongs to room-exit conformance, so
 * only non-acquisition transactions become lifecycle obligations.
 */
export function assembleTimelineRelations(
  transactions: readonly ExecutionTimelineTransaction[],
  room: CanonicalAuthoredRoom,
  facts: PlannerTimelineFacts,
): ExecutionTimeline {
  const nodeByOwner = new Map(
    facts.nodes.map((node) => [semanticAddressKey(node.owner), node] as const),
  );
  for (const transaction of transactions) {
    if (!nodeByOwner.has(transaction.owner))
      throw new Error(`${room.gameName} has no planner disposition for ${transaction.owner}`);
  }
  const localTransactionOwners = new Set(transactions.map((transaction) => transaction.owner));
  const dependencies = facts.dependencies
    .map((dependency) => ({
      owner: semanticAddressKey(dependency.owner),
      afterOwner: semanticAddressKey(dependency.afterOwner),
    }))
    .filter(
      (dependency) =>
        localTransactionOwners.has(dependency.owner) &&
        localTransactionOwners.has(dependency.afterOwner),
    );
  const obligations = transactions
    .filter((transaction) => transaction.kind !== 'acquisition')
    .map((transaction) => {
      const checkpoint =
        transaction.window.kind === 'postOutgoing'
          ? 'roomExit'
          : transaction.window.kind === 'encounterEnd'
            ? 'roomExit'
            : transaction.window.kind === 'shipPreCombat' ||
                transaction.window.kind === 'shipPostCombat'
              ? 'exitUsable'
              : transaction.window.kind === 'standard' &&
                  transaction.window.phase === 'beforeCombat'
                ? 'outgoingGeneration'
                : 'exitUsable';
      return Object.freeze({
        owner: transaction.owner,
        checkpoint,
      }) as ExecutionTimelineObligation;
    });
  // Keep lifecycle window validation close to its existing room authority;
  // no action meaning is inferred by this projection.
  for (const row of room.roomActionRoster.rows) {
    if (!row.stale && row.rank !== null) assembleLifecycleWindow(row.window);
  }
  return Object.freeze({
    transactions: Object.freeze([...transactions]),
    dependencies: Object.freeze(dependencies),
    obligations: Object.freeze(obligations),
  });
}

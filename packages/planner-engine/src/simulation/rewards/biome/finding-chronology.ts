import type { FindingChronology, HistoryFindingChronology } from '../../finding-regions';
import type { BiomeRewardSnapshot } from './evaluation-contract';
import { samePreparedRewardRoomOwner } from './prepared-inputs';

export type RewardRoomOwner = {
  readonly kind: string;
  readonly routeKey: string;
  readonly biomeKey: string;
  readonly occurrenceId?: string;
  readonly groupKey?: string;
  readonly slotKey?: string;
};

export function historyFindingChronology(sequence: number): HistoryFindingChronology {
  return Object.freeze({ kind: 'history', sequence, boundary: 'at' });
}

function hubFindingChronology(
  snapshot: BiomeRewardSnapshot,
  owner: RewardRoomOwner,
  sequence: number,
  phase: 'targetLifecycle' | 'sideGeneration' | 'localRoomLifecycle',
): FindingChronology | undefined {
  for (const decision of snapshot.decisions) {
    if (decision.kind !== 'hub') continue;
    for (const [visitIndex, visit] of decision.visits.entries()) {
      if (samePreparedRewardRoomOwner(visit.target.room.origin, owner))
        return Object.freeze({
          kind: 'hubVisit',
          visitIndex,
          phase: 'targetLifecycle',
          history: historyFindingChronology(sequence),
        });
      const local = visit.localSlots.find((slot) =>
        samePreparedRewardRoomOwner(slot.origin, owner),
      );
      if (local !== undefined)
        return Object.freeze({
          kind: 'hubVisit',
          visitIndex,
          phase,
          ...(phase === 'localRoomLifecycle' && local.localVisit.enteredOrdinal !== null
            ? { localLifecycleIndex: local.localVisit.enteredOrdinal - 1 }
            : {}),
          history: historyFindingChronology(sequence),
        });
    }
  }
  return undefined;
}

export function rewardFindingChronologyForRoom(
  snapshot: BiomeRewardSnapshot,
  owner: RewardRoomOwner,
  sequence: number,
  phase: 'targetLifecycle' | 'sideGeneration' | 'localRoomLifecycle',
): FindingChronology {
  return (
    hubFindingChronology(snapshot, owner, sequence, phase) ?? historyFindingChronology(sequence)
  );
}

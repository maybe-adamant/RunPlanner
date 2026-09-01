import type { CanonicalAuthoredRoom, CanonicalBatch } from '../../simulation/materialization';
import type { CompleteValidBiomeProjectEvaluation } from '../../simulation/evaluation-products';
import type { RunStateSnapshot } from '../../simulation/rewards/run-state';
import { executionRoomOwnerKey } from './support';
import { assembleExecutionOverview, executionReward } from './overview';
import { executionTimelineTransactions } from './timeline-transactions';
import { assembleTimelineRelations } from './timeline-relations';
import { assembleOccurrenceDiagnostics } from './diagnostics';
import { assembleExecutionDoors } from './doors';
import { assembleGAnomalyReplacement } from './g-anomaly';
import type { ExecutionOccurrence } from '../model';

export function executionOccurrence(
  room: CanonicalAuthoredRoom,
  snapshots: ReadonlyMap<string, RunStateSnapshot>,
  batches: ReadonlyMap<string, CanonicalBatch>,
  fixedTargets: ReadonlyMap<string, CanonicalAuthoredRoom>,
  crossBiomeTarget: CanonicalAuthoredRoom | undefined,
  crossBiomeSourceId: string | undefined,
  biome: CompleteValidBiomeProjectEvaluation,
): ExecutionOccurrence {
  const batch = batches.get(executionRoomOwnerKey(room));
  const transactions = executionTimelineTransactions(room, biome);
  const diagnostics = assembleOccurrenceDiagnostics(room, snapshots);
  const anomaly = assembleGAnomalyReplacement(room);
  return Object.freeze({
    id: room.occurrenceId,
    owner: executionRoomOwnerKey(room),
    biomeKey: room.origin.biomeKey,
    gameName: room.gameName,
    kind: room.encounterEnvelopeKey,
    ...(anomaly === undefined ? {} : { anomaly }),
    overview: assembleExecutionOverview(room, biome, batch),
    timeline: assembleTimelineRelations(transactions, room),
    doors: assembleExecutionDoors({
      room,
      batches,
      fixedTargets,
      crossBiomeTarget,
      crossBiomeSourceId,
      rewardForRoom: executionReward,
    }),
    ...(diagnostics === undefined ? {} : { diagnostics }),
  });
}

import type { CanonicalAuthoredRoom, CanonicalBatch } from '../../simulation/materialization';
import type { CompleteValidBiomeProjectEvaluation } from '../../simulation/evaluation-products';
import type { RunStateSnapshot } from '../../simulation/rewards/run-state';
import { executionRoomOwnerKey } from './support';
import { assembleExecutionOverview, executionReward } from './overview';
import { executionTimelineTransactions } from './timeline-transactions';
import { assembleTimelineRelations } from './timeline-relations';
import type { PlannerTimelineFacts } from '../../simulation/timeline-facts';
import { assembleOccurrenceDiagnostics } from './diagnostics';
import { assembleExecutionDoors } from './doors';
import { assembleGAnomalyReplacement } from './g-anomaly';
import type { ExecutionOccurrence } from '../model';
import type { RoomExitConformanceDelta } from '../../simulation/rewards/run-state-conformance';
import type {
  CanonicalHubDecision,
  CanonicalLocalVisitRoom,
} from '../../simulation/materialization';
import { hubOverview, localSlotsOverview } from './hub';

export function executionOccurrence(
  room: CanonicalAuthoredRoom,
  snapshots: ReadonlyMap<string, RunStateSnapshot>,
  batches: ReadonlyMap<string, CanonicalBatch>,
  fixedTargets: ReadonlyMap<string, CanonicalAuthoredRoom>,
  crossBiomeTarget: CanonicalAuthoredRoom | undefined,
  crossBiomeSourceId: string | undefined,
  biome: CompleteValidBiomeProjectEvaluation,
  transactions: ReturnType<typeof executionTimelineTransactions>,
  timelineFacts: PlannerTimelineFacts,
  roomExitConformance: RoomExitConformanceDelta | undefined,
  hub: CanonicalHubDecision | undefined,
  hubExit: CanonicalBatch | undefined,
  localSlots: readonly CanonicalLocalVisitRoom[] | undefined,
): ExecutionOccurrence {
  const batch = batches.get(executionRoomOwnerKey(room));
  const publishedHub = hub === undefined ? undefined : hubOverview(hub, hubExit);
  const publishedLocalSlots = localSlots === undefined ? undefined : localSlotsOverview(localSlots);
  const diagnostics = assembleOccurrenceDiagnostics(room, snapshots);
  const anomaly = assembleGAnomalyReplacement(room);
  return Object.freeze({
    id: room.occurrenceId,
    owner: executionRoomOwnerKey(room),
    biomeKey: room.origin.biomeKey as import('../model').ExecutionBiomeKey,
    gameName: room.gameName,
    kind: room.encounterEnvelopeKey,
    ...(anomaly === undefined ? {} : { anomaly }),
    overview: Object.freeze({
      ...assembleExecutionOverview(room, biome, batch),
      ...(publishedHub === undefined ? {} : { hub: publishedHub }),
      ...(publishedLocalSlots === undefined ? {} : { localSlots: publishedLocalSlots }),
    }),
    timeline: assembleTimelineRelations(transactions, room, timelineFacts),
    doors: assembleExecutionDoors({
      room,
      batches,
      fixedTargets,
      crossBiomeTarget,
      crossBiomeSourceId,
      rewardForRoom: executionReward,
    }),
    ...(roomExitConformance === undefined
      ? {}
      : {
          roomExitConformance: Object.freeze({
            facts: Object.freeze([...roomExitConformance.facts]),
          }),
        }),
    ...(diagnostics === undefined ? {} : { diagnostics }),
  });
}

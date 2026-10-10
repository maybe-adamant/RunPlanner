import type { CanonicalAuthoredRoom, CanonicalBatch } from '../../simulation/materialization';
import type { Catalog } from '../../catalog-schema';
import type { CompleteValidBiomeProjectEvaluation } from '../../simulation/evaluation/evaluation-products';
import type { RunStateSnapshot } from '../../simulation/rewards/run-state';
import { executionRoomOwnerKey } from './support';
import { assembleExecutionOverview, executionReward } from './overview';
import { executionTimelineTransactions } from './timeline-transactions';
import { assembleTimelineRelations } from './timeline-relations';
import type { PlannerTimelineFacts } from '../../simulation/timeline-facts';
import { assembleOccurrenceDiagnostics } from './diagnostics';
import { assembleExecutionDoors } from './doors';
import { assembleGAnomalyReplacement } from './g-anomaly';
import type { ExecutionOccurrence, ExecutionRoomExitConformance } from '../model';
import type {
  CanonicalHubDecision,
  CanonicalLocalVisitRoom,
} from '../../simulation/materialization';
import { hubOverview, localSlotsOverview } from './hub';
import { assembleExecutionRoomGuide } from './room-guide';

export function executionOccurrence(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
  snapshots: ReadonlyMap<string, RunStateSnapshot>,
  batches: ReadonlyMap<string, CanonicalBatch>,
  fixedTargets: ReadonlyMap<string, CanonicalAuthoredRoom>,
  crossBiomeTarget: CanonicalAuthoredRoom | undefined,
  crossBiomeSourceId: string | undefined,
  biome: CompleteValidBiomeProjectEvaluation,
  transactions: ReturnType<typeof executionTimelineTransactions>,
  timelineFacts: PlannerTimelineFacts,
  roomExitConformance: ExecutionRoomExitConformance | undefined,
  hub: CanonicalHubDecision | undefined,
  hubExit: CanonicalBatch | undefined,
  localSlots: readonly CanonicalLocalVisitRoom[] | undefined,
  selected: boolean,
): ExecutionOccurrence {
  const batch = batches.get(executionRoomOwnerKey(room));
  const publishedHub =
    hub === undefined ? undefined : hubOverview(hub, hubExit, biome.rewards.hubDepartures);
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
      ...assembleExecutionOverview(catalog, room, biome, batch, transactions),
      ...(publishedHub === undefined ? {} : { hub: publishedHub }),
      ...(publishedLocalSlots === undefined ? {} : { localSlots: publishedLocalSlots }),
    }),
    timeline: assembleTimelineRelations(transactions, room, timelineFacts),
    roomGuide: assembleExecutionRoomGuide(room, biome, transactions, selected),
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
          roomExitConformance,
        }),
    ...(diagnostics === undefined ? {} : { diagnostics }),
  });
}

import type { Catalog } from '../../catalog-schema';
import { createBiomeAddress } from '../../authored-project/addresses';
import type { ProjectDocument } from '../../authored-project/model';
import {
  candidateArtifactsForProjectEvaluationAssembly,
  type ProjectEvaluation,
  type ProjectEvaluationAssembly,
} from '../project';
import {
  evaluateBatchRewardStoreCandidate,
  type BatchRewardStoreCandidateQuery,
  type EvaluatedBatchRewardStoreCandidate,
} from './batch-reward-store';
import {
  evaluateFieldsCageOutcomeCandidate,
  type EvaluatedFieldsCageOutcomeCandidate,
  type FieldsCageOutcomeCandidateQuery,
} from './fields-cage-outcome';
import {
  evaluateHubSlotCandidate,
  evaluateHubVisitCandidate,
  evaluateSideRoomEntryOrderCandidate,
  evaluateSideRoomGenerationCandidate,
  type EvaluatedHubSlotCandidate,
  type EvaluatedHubVisitCandidate,
  type EvaluatedSideRoomEntryOrderCandidate,
  type EvaluatedSideRoomGenerationCandidate,
  type HubSlotCandidateQuery,
  type HubVisitCandidateQuery,
  type SideRoomEntryOrderCandidateQuery,
  type SideRoomGenerationCandidateQuery,
} from './hub';
import {
  evaluateRewardProducerCandidate,
  type EvaluatedIncomingRewardCandidate,
  type EvaluatedLocalRewardCandidate,
  type EvaluatedRewardWheelOfferCandidate,
  type EvaluatedShopOfferCandidate,
  type IncomingRewardCandidateQuery,
  type LocalRewardCandidateQuery,
  type RewardWheelOfferCandidateQuery,
  type ShopOfferCandidateQuery,
} from './reward-producer';
import {
  evaluateRewardWheelLifecycleCandidate,
  evaluateShipEncounterCountCandidate,
  evaluateShopPurchaseCandidate,
  type EvaluatedRewardWheelOfferCountCandidate,
  type EvaluatedRewardWheelPickedCandidate,
  type EvaluatedRewardWheelStoreCandidate,
  type EvaluatedShipEncounterCountCandidate,
  type EvaluatedShopPurchaseCandidate,
  type RewardWheelOfferCountCandidateQuery,
  type RewardWheelPickedCandidateQuery,
  type RewardWheelStoreCandidateQuery,
  type ShipEncounterCountCandidateQuery,
  type ShopPurchaseCandidateQuery,
} from './room-lifecycle';
import {
  evaluateRoomTargetCandidate,
  type EvaluatedRoomTargetCandidate,
  type RoomTargetCandidateQuery,
} from './room-target';
import {
  evaluateStartRoomCandidate,
  type EvaluatedStartRoomCandidate,
  type StartRoomCandidateQuery,
} from './start-room';
import {
  evaluateTakeoverPrebossBatch,
  type EvaluatedTakeoverPrebossBatchCandidate,
  type TakeoverPrebossBatchCandidateQuery,
} from './takeover-preboss';
import type { CandidateContextUnavailable } from './availability';

export type ProjectCandidateQuery =
  | BatchRewardStoreCandidateQuery
  | FieldsCageOutcomeCandidateQuery
  | HubSlotCandidateQuery
  | HubVisitCandidateQuery
  | IncomingRewardCandidateQuery
  | LocalRewardCandidateQuery
  | RewardWheelOfferCandidateQuery
  | RewardWheelOfferCountCandidateQuery
  | RewardWheelPickedCandidateQuery
  | RewardWheelStoreCandidateQuery
  | RoomTargetCandidateQuery
  | ShipEncounterCountCandidateQuery
  | ShopOfferCandidateQuery
  | ShopPurchaseCandidateQuery
  | SideRoomEntryOrderCandidateQuery
  | SideRoomGenerationCandidateQuery
  | StartRoomCandidateQuery
  | TakeoverPrebossBatchCandidateQuery;

export type ProjectCandidateEvaluation =
  | CandidateContextUnavailable
  | EvaluatedBatchRewardStoreCandidate
  | EvaluatedFieldsCageOutcomeCandidate
  | EvaluatedHubSlotCandidate
  | EvaluatedHubVisitCandidate
  | EvaluatedIncomingRewardCandidate
  | EvaluatedLocalRewardCandidate
  | EvaluatedRewardWheelOfferCandidate
  | EvaluatedRewardWheelOfferCountCandidate
  | EvaluatedRewardWheelPickedCandidate
  | EvaluatedRewardWheelStoreCandidate
  | EvaluatedRoomTargetCandidate
  | EvaluatedShipEncounterCountCandidate
  | EvaluatedShopOfferCandidate
  | EvaluatedShopPurchaseCandidate
  | EvaluatedSideRoomEntryOrderCandidate
  | EvaluatedSideRoomGenerationCandidate
  | EvaluatedStartRoomCandidate
  | EvaluatedTakeoverPrebossBatchCandidate;

export type CandidateEvaluationEvent = {
  readonly kind: 'queryBatch';
  readonly queryCount: number;
};

export interface ProjectCandidateSessionOptions {
  readonly observe?: (event: CandidateEvaluationEvent) => void;
}

export interface ProjectCandidateSession {
  readonly project: ProjectDocument;
  readonly evaluation: ProjectEvaluation;
  readonly evaluate: {
    (query: ProjectCandidateQuery): ProjectCandidateEvaluation;
    (queries: readonly ProjectCandidateQuery[]): readonly ProjectCandidateEvaluation[];
  };
}

function assertNever(value: never): never {
  throw new Error(`candidate dispatcher received an unknown query: ${String(value)}`);
}

function evaluateCandidateQuery(
  catalog: Catalog,
  assembly: ProjectEvaluationAssembly,
  query: ProjectCandidateQuery,
): ProjectCandidateEvaluation {
  const { project, evaluation } = assembly;
  const candidateArtifacts = candidateArtifactsForProjectEvaluationAssembly(assembly);
  switch (query.kind) {
    case 'startRoom':
      return evaluateStartRoomCandidate(catalog, project, query);
    case 'roomTarget':
      return evaluateRoomTargetCandidate(
        catalog,
        project,
        evaluation,
        candidateArtifacts.biomeAt(createBiomeAddress(query.target.routeKey, query.target.biomeKey))
          ?.roomTargets,
        query,
      );
    case 'takeoverPrebossBatch':
      return evaluateTakeoverPrebossBatch(catalog, project, evaluation, query);
    case 'batchRewardStore':
      return evaluateBatchRewardStoreCandidate(catalog, project, evaluation, query);
    case 'fieldsCageOutcome':
      return evaluateFieldsCageOutcomeCandidate(catalog, project, evaluation, query);
    case 'hubSlot':
      return evaluateHubSlotCandidate(catalog, project, evaluation, query);
    case 'hubVisit':
      return evaluateHubVisitCandidate(catalog, project, evaluation, query);
    case 'sideRoomGeneration':
      return evaluateSideRoomGenerationCandidate(catalog, project, evaluation, query);
    case 'sideRoomEntryOrder':
      return evaluateSideRoomEntryOrderCandidate(catalog, project, evaluation, query);
    case 'incomingReward':
      return evaluateRewardProducerCandidate(
        catalog,
        project,
        evaluation,
        candidateArtifacts.biomeAt(createBiomeAddress(query.reward.routeKey, query.reward.biomeKey))
          ?.rewardProducers,
        query,
      );
    case 'localReward':
      return evaluateRewardProducerCandidate(
        catalog,
        project,
        evaluation,
        candidateArtifacts.biomeAt(createBiomeAddress(query.reward.routeKey, query.reward.biomeKey))
          ?.rewardProducers,
        query,
      );
    case 'rewardWheelOffer':
      return evaluateRewardProducerCandidate(
        catalog,
        project,
        evaluation,
        candidateArtifacts.biomeAt(createBiomeAddress(query.offer.routeKey, query.offer.biomeKey))
          ?.rewardProducers,
        query,
      );
    case 'shopOffer':
      return evaluateRewardProducerCandidate(
        catalog,
        project,
        evaluation,
        candidateArtifacts.biomeAt(createBiomeAddress(query.offer.routeKey, query.offer.biomeKey))
          ?.rewardProducers,
        query,
      );
    case 'shipEncounterCount':
      return evaluateShipEncounterCountCandidate(
        catalog,
        project,
        evaluation,
        candidateArtifacts.biomeAt(
          createBiomeAddress(query.occurrence.routeKey, query.occurrence.biomeKey),
        )?.roomLifecycles,
        query,
      );
    case 'rewardWheelOfferCount':
      return evaluateRewardWheelLifecycleCandidate(
        catalog,
        project,
        evaluation,
        candidateArtifacts.biomeAt(createBiomeAddress(query.wheel.routeKey, query.wheel.biomeKey))
          ?.roomLifecycles,
        query,
      );
    case 'rewardWheelStore':
      return evaluateRewardWheelLifecycleCandidate(
        catalog,
        project,
        evaluation,
        candidateArtifacts.biomeAt(createBiomeAddress(query.wheel.routeKey, query.wheel.biomeKey))
          ?.roomLifecycles,
        query,
      );
    case 'rewardWheelPicked':
      return evaluateRewardWheelLifecycleCandidate(
        catalog,
        project,
        evaluation,
        candidateArtifacts.biomeAt(createBiomeAddress(query.wheel.routeKey, query.wheel.biomeKey))
          ?.roomLifecycles,
        query,
      );
    case 'shopPurchase':
      return evaluateShopPurchaseCandidate(
        catalog,
        project,
        evaluation,
        candidateArtifacts.biomeAt(
          createBiomeAddress(query.purchase.routeKey, query.purchase.biomeKey),
        )?.roomLifecycles,
        query,
      );
  }
  return assertNever(query);
}

export function createPreparedProjectCandidateSession(
  catalog: Catalog,
  assembly: ProjectEvaluationAssembly,
  options: ProjectCandidateSessionOptions = {},
): ProjectCandidateSession {
  // Attest the exact assembly at binding time even when no query is loaded.
  candidateArtifactsForProjectEvaluationAssembly(assembly);
  const { project, evaluation } = assembly;
  function evaluate(query: ProjectCandidateQuery): ProjectCandidateEvaluation;
  function evaluate(
    queries: readonly ProjectCandidateQuery[],
  ): readonly ProjectCandidateEvaluation[];
  function evaluate(
    queryOrQueries: ProjectCandidateQuery | readonly ProjectCandidateQuery[],
  ): ProjectCandidateEvaluation | readonly ProjectCandidateEvaluation[] {
    if (!Array.isArray(queryOrQueries)) {
      return evaluateCandidateQuery(catalog, assembly, queryOrQueries as ProjectCandidateQuery);
    }
    const queries = queryOrQueries as readonly ProjectCandidateQuery[];
    options.observe?.(Object.freeze({ kind: 'queryBatch', queryCount: queries.length }));
    return Object.freeze(queries.map((query) => evaluateCandidateQuery(catalog, assembly, query)));
  }
  return Object.freeze({ project, evaluation, evaluate });
}

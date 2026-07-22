import type { ProjectDocument } from '../../authored-project/model';
import type { Catalog } from '../../catalog-schema';
import type { ProjectEvaluation, ProjectSimulationScope } from '../project';
import { assertProjectEvaluationSource, simulateProject } from '../project';
import type {
  ProjectCandidateEvaluation,
  ProjectCandidateEvaluator,
  ProjectCandidateQuery,
} from './model';

import type { PreparedCandidateContext } from './context';
import {
  evaluateHubSlotCandidate,
  evaluateHubVisitCandidate,
  evaluateSideRoomEntryOrderCandidate,
  evaluateSideRoomGenerationCandidate,
} from './hub';
import { evaluateBiomeFieldCandidate, evaluateFieldsCageOutcomeCandidate } from './layout-fields';
import {
  evaluateBatchRewardStoreCandidate,
  evaluateRewardCandidate,
  evaluateRewardWheelOfferCandidate,
  evaluateRewardWheelOfferCountCandidate,
  evaluateRewardWheelPickedCandidate,
  evaluateRewardWheelStoreCandidate,
  evaluateShipEncounterCountCandidate,
  evaluateShopPurchaseCandidate,
} from './reward-shop-wheel';
import { evaluateRoomTargetCandidate, evaluateStartRoomCandidate } from './room-topology';

export function evaluateProjectCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  query: ProjectCandidateQuery,
  scope?: ProjectSimulationScope,
): ProjectCandidateEvaluation {
  const evaluation = evaluateProjectCandidates(catalog, project, Object.freeze([query]), scope)[0];
  if (evaluation === undefined) {
    throw new Error('single candidate evaluation returned no result');
  }
  return evaluation;
}

export function evaluateProjectCandidates(
  catalog: Catalog,
  project: ProjectDocument,
  queries: readonly ProjectCandidateQuery[],
  scope?: ProjectSimulationScope,
): readonly ProjectCandidateEvaluation[] {
  if (queries.length === 0) {
    return Object.freeze([]);
  }
  return createProjectCandidateEvaluator(catalog, project, scope).evaluate(queries);
}

export function createProjectCandidateEvaluator(
  catalog: Catalog,
  project: ProjectDocument,
  scope?: ProjectSimulationScope,
): ProjectCandidateEvaluator {
  return createPreparedProjectCandidateEvaluator(
    catalog,
    project,
    simulateProject(catalog, project, scope),
  );
}

export function createPreparedProjectCandidateEvaluator(
  catalog: Catalog,
  project: ProjectDocument,
  projectEvaluation: ProjectEvaluation,
): ProjectCandidateEvaluator {
  assertProjectEvaluationSource(project, projectEvaluation);
  const context: PreparedCandidateContext = {
    projectEvaluation,
  };
  return Object.freeze({
    evaluate: (queries: readonly ProjectCandidateQuery[]) =>
      evaluatePreparedProjectCandidates(catalog, project, context, queries),
  });
}

function evaluatePreparedProjectCandidates(
  catalog: Catalog,
  project: ProjectDocument,
  context: PreparedCandidateContext,
  queries: readonly ProjectCandidateQuery[],
): readonly ProjectCandidateEvaluation[] {
  if (queries.length === 0) {
    return Object.freeze([]);
  }
  return Object.freeze(
    queries.map((query): ProjectCandidateEvaluation => {
      switch (query.kind) {
        case 'biomeField':
          return evaluateBiomeFieldCandidate(catalog, project, context, query);
        case 'startRoom':
          return evaluateStartRoomCandidate(catalog, project, query);
        case 'roomTarget':
          return evaluateRoomTargetCandidate(catalog, project, context, query);
        case 'batchRewardStore':
          return evaluateBatchRewardStoreCandidate(catalog, project, context, query);
        case 'fieldsCageOutcome':
          return evaluateFieldsCageOutcomeCandidate(catalog, project, context, query);
        case 'shipEncounterCount':
          return evaluateShipEncounterCountCandidate(catalog, project, context, query);
        case 'rewardWheelOfferCount':
          return evaluateRewardWheelOfferCountCandidate(catalog, project, context, query);
        case 'rewardWheelStore':
          return evaluateRewardWheelStoreCandidate(catalog, project, context, query);
        case 'rewardWheelOffer':
          return evaluateRewardWheelOfferCandidate(catalog, project, context, query);
        case 'rewardWheelPicked':
          return evaluateRewardWheelPickedCandidate(catalog, project, context, query);
        case 'hubSlot':
          return evaluateHubSlotCandidate(catalog, project, context, query);
        case 'hubVisit':
          return evaluateHubVisitCandidate(catalog, project, context, query);
        case 'incomingReward':
        case 'localReward':
        case 'shopOffer':
          return evaluateRewardCandidate(catalog, project, context, query);
        case 'shopPurchase':
          return evaluateShopPurchaseCandidate(catalog, project, context, query);
        case 'sideRoomEntryOrder':
          return evaluateSideRoomEntryOrderCandidate(catalog, project, context, query);
        case 'sideRoomGeneration':
          return evaluateSideRoomGenerationCandidate(catalog, project, context, query);
      }
    }),
  );
}

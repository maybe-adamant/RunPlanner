import type { ProjectDocument } from '../../authored-project/model';
import type { Catalog } from '../../catalog-schema';
import type { ProjectEvaluation } from '../project';
import { assertProjectEvaluationSource, simulateProject } from '../project';
import type {
  ProjectCandidateEvaluation,
  ProjectCandidateEvaluator,
  ProjectCandidateQuery,
  ProjectCandidateSession,
  ProjectCandidateSessionOptions,
} from './model';

import type { PreparedCandidateContext } from './context';
import { prepareCandidateContext } from './context';
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
): ProjectCandidateEvaluation {
  const evaluation = evaluateProjectCandidates(catalog, project, Object.freeze([query]))[0];
  if (evaluation === undefined) {
    throw new Error('single candidate evaluation returned no result');
  }
  return evaluation;
}

export function evaluateProjectCandidates(
  catalog: Catalog,
  project: ProjectDocument,
  queries: readonly ProjectCandidateQuery[],
): readonly ProjectCandidateEvaluation[] {
  if (queries.length === 0) {
    return Object.freeze([]);
  }
  return createProjectCandidateEvaluator(catalog, project).evaluate(queries);
}

export function createProjectCandidateEvaluator(
  catalog: Catalog,
  project: ProjectDocument,
): ProjectCandidateEvaluator {
  return createProjectCandidateSession(catalog, project);
}

export function createProjectCandidateSession(
  catalog: Catalog,
  project: ProjectDocument,
  options: ProjectCandidateSessionOptions = {},
): ProjectCandidateSession {
  return createPreparedProjectCandidateSession(
    catalog,
    project,
    simulateProject(catalog, project),
    options,
  );
}

export function createPreparedProjectCandidateEvaluator(
  catalog: Catalog,
  project: ProjectDocument,
  projectEvaluation: ProjectEvaluation,
): ProjectCandidateEvaluator {
  return createPreparedProjectCandidateSession(catalog, project, projectEvaluation);
}

export function createPreparedProjectCandidateSession(
  catalog: Catalog,
  project: ProjectDocument,
  projectEvaluation: ProjectEvaluation,
  options: ProjectCandidateSessionOptions = {},
): ProjectCandidateSession {
  assertProjectEvaluationSource(project, projectEvaluation);
  const context: PreparedCandidateContext = prepareCandidateContext(
    catalog,
    project,
    projectEvaluation,
    options,
  );
  return Object.freeze({
    project,
    evaluation: projectEvaluation,
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
  context.observe?.(Object.freeze({ kind: 'queryBatch', queryCount: queries.length }));
  return Object.freeze(
    queries.map((query): ProjectCandidateEvaluation => {
      switch (query.kind) {
        case 'biomeField':
          return evaluateBiomeFieldCandidate(catalog, project, context, query);
        case 'startRoom':
          return evaluateStartRoomCandidate(catalog, context, query);
        case 'roomTarget':
          return evaluateRoomTargetCandidate(catalog, context, query);
        case 'batchRewardStore':
          return evaluateBatchRewardStoreCandidate(catalog, context, query);
        case 'fieldsCageOutcome':
          return evaluateFieldsCageOutcomeCandidate(catalog, context, query);
        case 'shipEncounterCount':
          return evaluateShipEncounterCountCandidate(catalog, project, context, query);
        case 'rewardWheelOfferCount':
          return evaluateRewardWheelOfferCountCandidate(catalog, project, context, query);
        case 'rewardWheelStore':
          return evaluateRewardWheelStoreCandidate(catalog, project, context, query);
        case 'rewardWheelOffer':
          return evaluateRewardWheelOfferCandidate(catalog, context, query);
        case 'rewardWheelPicked':
          return evaluateRewardWheelPickedCandidate(catalog, project, context, query);
        case 'hubSlot':
          return evaluateHubSlotCandidate(catalog, project, context, query);
        case 'hubVisit':
          return evaluateHubVisitCandidate(catalog, project, context, query);
        case 'incomingReward':
        case 'localReward':
        case 'shopOffer':
          return evaluateRewardCandidate(catalog, context, query);
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

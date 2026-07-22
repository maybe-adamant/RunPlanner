import { semanticAddressKey, type SemanticAddress } from '../../authored-project/addresses';
import { applyProjectCommand, type ProjectCommand } from '../../authored-project/commands/dispatch';
import type {
  AuthoredBiomePlan,
  HubBiomePlan,
  LinearBiomePlan,
  ProjectDocument,
} from '../../authored-project/model';
import type { Catalog } from '../../catalog-schema';
import type { ResolvedRewardOffer } from '../../reward-kernel/model';
import type {
  CompleteHubProjectEvaluation,
  CompleteLinearProjectEvaluation,
  HubBiomeProjectEvaluation,
  LinearBiomeProjectEvaluation,
  PrefixIncompleteHubProjectEvaluation,
  PrefixIncompleteLinearProjectEvaluation,
  ProjectEvaluation,
  ProjectRouteEvaluation,
} from '../project';
import { evaluateHubBiome, evaluateLinearBiome } from '../project';
import type {
  BiomeFieldCandidateQuery,
  CandidateContextUnavailableReason,
  CandidateContextUnavailableEvidence,
  FieldsCageOutcomeCandidateQuery,
  HubSlotCandidateQuery,
  HubVisitCandidateQuery,
  IncomingRewardCandidateQuery,
  LocalRewardCandidateQuery,
  ProjectCandidateQuery,
  RewardWheelOfferCandidateQuery,
  RewardWheelOfferCountCandidateQuery,
  RewardWheelPickedCandidateQuery,
  RewardWheelStoreCandidateQuery,
  ShipEncounterCountCandidateQuery,
  ShopOfferCandidateQuery,
  ShopPurchaseCandidateQuery,
  SideRoomEntryOrderCandidateQuery,
  SideRoomGenerationCandidateQuery,
} from './model';

export type CandidateLinearBiomeEvaluation =
  CompleteLinearProjectEvaluation | PrefixIncompleteLinearProjectEvaluation;
export type CandidateHubBiomeEvaluation =
  CompleteHubProjectEvaluation | PrefixIncompleteHubProjectEvaluation;

export interface CandidateContextUnavailable {
  readonly reason: CandidateContextUnavailableReason;
  readonly evidence: CandidateContextUnavailableEvidence;
}

type CandidateAddress = Exclude<SemanticAddress, { readonly kind: 'project' | 'route' }>;

export function queryAddress(query: ProjectCandidateQuery): CandidateAddress {
  switch (query.kind) {
    case 'biomeField':
      return query.field;
    case 'startRoom':
      return query.owner;
    case 'roomTarget':
      return query.target;
    case 'batchRewardStore':
      return query.rewardStore;
    case 'incomingReward':
      return query.reward;
    case 'localReward':
      return query.reward;
    case 'fieldsCageOutcome':
      return query.continuation;
    case 'shipEncounterCount':
      return query.occurrence;
    case 'rewardWheelOfferCount':
    case 'rewardWheelStore':
    case 'rewardWheelPicked':
      return query.wheel;
    case 'rewardWheelOffer':
      return query.offer;
    case 'hubSlot':
      return query.slot;
    case 'hubVisit':
      return query.visit;
    case 'shopOffer':
      return query.offer;
    case 'shopPurchase':
      return query.purchase;
    case 'sideRoomEntryOrder':
      return query.group;
    case 'sideRoomGeneration':
      return query.sideRoom;
  }
}

function requiredCheckpoint(query: ProjectCandidateQuery) {
  switch (query.kind) {
    case 'startRoom':
    case 'biomeField':
      return 'beforeTargetGeneration' as const;
    case 'shopOffer':
    case 'shopPurchase':
    case 'rewardWheelOfferCount':
    case 'rewardWheelStore':
    case 'rewardWheelOffer':
    case 'rewardWheelPicked':
      return 'afterRoomLifecycle' as const;
    case 'roomTarget':
    case 'batchRewardStore':
    case 'incomingReward':
    case 'localReward':
    case 'fieldsCageOutcome':
    case 'shipEncounterCount':
    case 'hubSlot':
    case 'hubVisit':
    case 'sideRoomEntryOrder':
    case 'sideRoomGeneration':
      return 'afterTargetGeneration' as const;
  }
}

export function coverageNotReached(
  query: ProjectCandidateQuery,
  evaluation: LinearBiomeProjectEvaluation | HubBiomeProjectEvaluation,
): CandidateContextUnavailable {
  return Object.freeze({
    reason: 'coverageNotReached',
    evidence: Object.freeze({
      kind: 'coverageNotReached',
      requiredOwner: queryAddress(query),
      requiredCheckpoint: requiredCheckpoint(query),
      coverage: evaluation.coverage,
    }),
  });
}

export function isCandidateContextUnavailable(
  value: unknown,
): value is CandidateContextUnavailable {
  return typeof value === 'object' && value !== null && 'reason' in value && 'evidence' in value;
}

export function unavailableCandidate(
  query: ProjectCandidateQuery,
  unavailable: CandidateContextUnavailable,
) {
  return Object.freeze({
    context: 'unavailable' as const,
    query,
    reason: unavailable.reason,
    evidence: unavailable.evidence,
  });
}

export class CandidateEvaluationContractError extends Error {
  readonly queryKind: ProjectCandidateQuery['kind'];
  readonly targetKey: string;
  readonly detail: string;

  constructor(query: ProjectCandidateQuery, detail: string) {
    const targetKey = semanticAddressKey(queryAddress(query));
    super(`${query.kind} at ${targetKey}: ${detail}`);
    this.name = 'CandidateEvaluationContractError';
    this.queryKind = query.kind;
    this.targetKey = targetKey;
    this.detail = detail;
  }
}

export function failCandidate(query: ProjectCandidateQuery, detail: string): never {
  throw new CandidateEvaluationContractError(query, detail);
}

function immutableOffer(value: ResolvedRewardOffer): ResolvedRewardOffer {
  return Object.freeze({
    rewardType: value.rewardType,
    ...(value.payload === undefined ? {} : { payload: Object.freeze({ ...value.payload }) }),
  });
}

export function immutableQuery(query: ProjectCandidateQuery): ProjectCandidateQuery {
  switch (query.kind) {
    case 'biomeField':
      return Object.freeze({ ...query, field: Object.freeze({ ...query.field }) });
    case 'startRoom':
      return Object.freeze({ ...query, owner: Object.freeze({ ...query.owner }) });
    case 'roomTarget':
      return Object.freeze({ ...query, target: Object.freeze({ ...query.target }) });
    case 'batchRewardStore':
      return Object.freeze({ ...query, rewardStore: Object.freeze({ ...query.rewardStore }) });
    case 'incomingReward':
      return Object.freeze({
        ...query,
        reward: Object.freeze({ ...query.reward }),
        value: immutableOffer(query.value),
      });
    case 'localReward':
      return Object.freeze({
        ...query,
        reward: Object.freeze({ ...query.reward }),
        value: immutableOffer(query.value),
      });
    case 'fieldsCageOutcome':
      return Object.freeze({
        ...query,
        continuation: Object.freeze({ ...query.continuation }),
      });
    case 'shipEncounterCount':
      return Object.freeze({ ...query, occurrence: Object.freeze({ ...query.occurrence }) });
    case 'rewardWheelOfferCount':
    case 'rewardWheelStore':
    case 'rewardWheelPicked':
      return Object.freeze({ ...query, wheel: Object.freeze({ ...query.wheel }) });
    case 'rewardWheelOffer':
      return Object.freeze({
        ...query,
        offer: Object.freeze({ ...query.offer }),
        value: immutableOffer(query.value),
      });
    case 'hubSlot':
      return Object.freeze({ ...query, slot: Object.freeze({ ...query.slot }) });
    case 'hubVisit':
      return Object.freeze({ ...query, visit: Object.freeze({ ...query.visit }) });
    case 'shopOffer':
      return Object.freeze({
        ...query,
        offer: Object.freeze({ ...query.offer }),
        value: immutableOffer(query.value),
      });
    case 'shopPurchase':
      return Object.freeze({ ...query, purchase: Object.freeze({ ...query.purchase }) });
    case 'sideRoomEntryOrder':
      return Object.freeze({
        ...query,
        group: Object.freeze({ ...query.group }),
        enteredSlotKeys: Object.freeze([...query.enteredSlotKeys]),
      });
    case 'sideRoomGeneration':
      return Object.freeze({ ...query, sideRoom: Object.freeze({ ...query.sideRoom }) });
  }
}

export function locateBiomePlan(
  project: ProjectDocument,
  query: ProjectCandidateQuery,
): AuthoredBiomePlan {
  const address = queryAddress(query);
  const route = project.routes.find((candidate) => candidate.routeKey === address.routeKey);
  if (route === undefined) {
    failCandidate(query, `project has no route ${address.routeKey}`);
  }
  const biome = route.biomes.find((candidate) => candidate.biomeKey === address.biomeKey);
  if (biome === undefined) {
    failCandidate(query, `project has no configured biome ${address.biomeKey}`);
  }
  return biome;
}

export function locateLinearBiomePlan(
  project: ProjectDocument,
  query: ProjectCandidateQuery,
): LinearBiomePlan {
  const biome = locateBiomePlan(project, query);
  if (biome.kind !== 'LinearBiome') {
    failCandidate(
      query,
      `${queryAddress(query).biomeKey} does not use linear candidate evaluation`,
    );
  }
  return biome;
}

export function locateHubBiomePlan(
  project: ProjectDocument,
  query: ProjectCandidateQuery,
): HubBiomePlan {
  const biome = locateBiomePlan(project, query);
  if (biome.kind !== 'HubBiome') {
    failCandidate(query, `${queryAddress(query).biomeKey} does not use Hub candidate evaluation`);
  }
  return biome;
}

export function requireRoute(
  routes: readonly ProjectRouteEvaluation[],
  query: ProjectCandidateQuery,
): ProjectRouteEvaluation {
  const address = queryAddress(query);
  const route = routes.find((candidate) => candidate.routeKey === address.routeKey);
  if (route === undefined) {
    failCandidate(query, `simulation has no route ${address.routeKey}`);
  }
  return route;
}

function unavailableReason(
  route: ProjectRouteEvaluation,
  query: ProjectCandidateQuery,
): CandidateContextUnavailable {
  const address = queryAddress(query);
  const { active } = route.processing;
  if (active?.kind === 'incomplete') {
    if (active.biomeKey === address.biomeKey) {
      failCandidate(query, 'active candidate biome is missing its evaluation');
    }
    return Object.freeze({
      reason: 'upstreamIncomplete',
      evidence: Object.freeze({ kind: 'upstreamIncomplete', upstreamBiomeKey: active.biomeKey }),
    });
  }
  if (active?.kind === 'invalid') {
    return Object.freeze({
      reason: 'upstreamInvalid',
      evidence: Object.freeze({ kind: 'upstreamInvalid', upstreamBiomeKey: active.biomeKey }),
    });
  }
  failCandidate(query, 'simulation omitted the candidate biome without an active route region');
}

function locateCompleteLinear(
  route: ProjectRouteEvaluation,
  query: ProjectCandidateQuery,
): CandidateLinearBiomeEvaluation | CandidateContextUnavailable {
  const address = queryAddress(query);
  const evaluation = route.biomes.find((candidate) => candidate.biomeKey === address.biomeKey);
  if (evaluation === undefined) {
    return unavailableReason(route, query);
  }
  if (evaluation.kind !== 'LinearBiome') {
    failCandidate(query, `${address.biomeKey} does not have a linear evaluation`);
  }
  return evaluation.authoring === 'complete' || 'materializedPrefix' in evaluation
    ? evaluation
    : coverageNotReached(query, evaluation);
}

export interface PreparedCandidateContext {
  readonly projectEvaluation: ProjectEvaluation;
}

export function locateCandidateLinear(
  context: PreparedCandidateContext,
  query: ProjectCandidateQuery,
): CandidateLinearBiomeEvaluation | CandidateContextUnavailable {
  const route = requireRoute(context.projectEvaluation.routes, query);
  return locateCompleteLinear(route, query);
}

export function locateCandidateHub(
  context: PreparedCandidateContext,
  query: ProjectCandidateQuery,
): CandidateHubBiomeEvaluation | CandidateContextUnavailable {
  const address = queryAddress(query);
  const route = requireRoute(context.projectEvaluation.routes, query);
  const activeEvaluation = route.biomes.find(
    (candidate) => candidate.biomeKey === address.biomeKey,
  );
  if (activeEvaluation !== undefined) {
    if (activeEvaluation.kind !== 'HubBiome') {
      failCandidate(query, `${address.biomeKey} does not have a Hub evaluation`);
    }
    return activeEvaluation.authoring === 'complete' || 'materializedPrefix' in activeEvaluation
      ? activeEvaluation
      : coverageNotReached(query, activeEvaluation);
  }
  return unavailableReason(route, query);
}

export function applyCandidateCommand(
  catalog: Catalog,
  project: ProjectDocument,
  query: ProjectCandidateQuery,
  command: ProjectCommand,
): ProjectDocument {
  try {
    return applyProjectCommand(project, catalog, command);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    failCandidate(query, `candidate proposal is malformed: ${detail}`);
  }
}

type CandidateBiomeEvaluation = CandidateLinearBiomeEvaluation | CandidateHubBiomeEvaluation;

export function locateCandidateBiome(
  project: ProjectDocument,
  context: PreparedCandidateContext,
  query: ProjectCandidateQuery,
) {
  const sourcePlan = locateBiomePlan(project, query);
  return sourcePlan.kind === 'LinearBiome'
    ? locateCandidateLinear(context, query)
    : locateCandidateHub(context, query);
}

export function evaluateCandidateBiome(
  catalog: Catalog,
  project: ProjectDocument,
  proposal: ProjectDocument,
  context: PreparedCandidateContext,
  query:
    | BiomeFieldCandidateQuery
    | FieldsCageOutcomeCandidateQuery
    | HubSlotCandidateQuery
    | HubVisitCandidateQuery
    | IncomingRewardCandidateQuery
    | LocalRewardCandidateQuery
    | RewardWheelOfferCandidateQuery
    | RewardWheelOfferCountCandidateQuery
    | RewardWheelPickedCandidateQuery
    | RewardWheelStoreCandidateQuery
    | ShipEncounterCountCandidateQuery
    | ShopOfferCandidateQuery
    | ShopPurchaseCandidateQuery
    | SideRoomEntryOrderCandidateQuery
    | SideRoomGenerationCandidateQuery,
): CandidateBiomeEvaluation | CandidateContextUnavailable {
  const address = queryAddress(query);
  const baselineRoute = requireRoute(context.projectEvaluation.routes, query);
  const sourcePlan = locateBiomePlan(project, query);
  const baselineBiome = locateCandidateBiome(project, context, query);
  if (isCandidateContextUnavailable(baselineBiome)) {
    return baselineBiome;
  }

  const route = proposal.routes.find((candidate) => candidate.routeKey === address.routeKey);
  if (route === undefined) {
    failCandidate(query, `candidate proposal has no route ${address.routeKey}`);
  }
  const biomeIndex = route.biomes.findIndex((candidate) => candidate.biomeKey === address.biomeKey);
  const plan = route.biomes[biomeIndex];
  if (biomeIndex < 0 || plan === undefined) {
    failCandidate(query, `candidate proposal has no configured biome ${address.biomeKey}`);
  }
  if (plan.kind !== sourcePlan.kind) {
    failCandidate(query, 'candidate proposal changed biome layout kind');
  }
  if (plan.kind === 'HubBiome') {
    const evaluation = evaluateHubBiome(catalog, route.routeKey, plan);
    return evaluation.authoring === 'complete' || 'materializedPrefix' in evaluation
      ? evaluation
      : coverageNotReached(query, evaluation);
  }

  const previous = biomeIndex === 0 ? undefined : baselineRoute.biomes[biomeIndex - 1];
  if (previous?.authoring === 'incomplete') {
    failCandidate(query, 'candidate biome has an incomplete upstream evaluation');
  }
  const previousComplete = previous?.authoring === 'complete' ? previous : undefined;
  const evaluation = evaluateLinearBiome(
    catalog,
    route.routeKey,
    plan,
    biomeIndex + 1,
    previousComplete,
  );
  return evaluation.authoring === 'complete' || 'materializedPrefix' in evaluation
    ? evaluation
    : coverageNotReached(query, evaluation);
}

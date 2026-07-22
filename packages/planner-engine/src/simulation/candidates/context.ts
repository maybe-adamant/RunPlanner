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
  ProjectBiomeEvaluation,
  ProjectEvaluation,
  ProjectRouteEvaluation,
} from '../project';
import { evaluateLinearBiome, evaluateNBiome } from '../project';
import type {
  BiomeFieldCandidateQuery,
  CandidateContextUnavailableReason,
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

type CandidateAddress = Exclude<SemanticAddress, { readonly kind: 'project' | 'route' }>;

function queryAddress(query: ProjectCandidateQuery): CandidateAddress {
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
): CandidateContextUnavailableReason {
  const address = queryAddress(query);
  const { horizon } = route;
  if (horizon.kind === 'incomplete') {
    return horizon.biomeKey === address.biomeKey ? 'biomeIncomplete' : 'upstreamIncomplete';
  }
  if (horizon.kind === 'invalid') {
    return 'upstreamInvalid';
  }
  if (horizon.kind === 'simulatorBoundary') {
    return 'simulatorUnavailable';
  }
  failCandidate(query, 'simulation omitted the candidate biome without a processing horizon');
}

function locateCompleteLinear(
  route: ProjectRouteEvaluation,
  query: ProjectCandidateQuery,
): CompleteLinearProjectEvaluation | CandidateContextUnavailableReason {
  const address = queryAddress(query);
  const evaluation = route.biomes.find((candidate) => candidate.biomeKey === address.biomeKey);
  if (evaluation === undefined) {
    return unavailableReason(route, query);
  }
  if (evaluation.completion === 'incomplete') {
    return 'biomeIncomplete';
  }
  if (evaluation.kind !== 'LinearBiome') {
    failCandidate(query, `${address.biomeKey} does not have a linear evaluation`);
  }
  return evaluation;
}

export interface PreparedCandidateContext {
  readonly projectEvaluation: ProjectEvaluation;
}

export function locateCandidateLinear(
  context: PreparedCandidateContext,
  query: ProjectCandidateQuery,
): CompleteLinearProjectEvaluation | CandidateContextUnavailableReason {
  const route = requireRoute(context.projectEvaluation.routes, query);
  return locateCompleteLinear(route, query);
}

export function locateCandidateHub(
  context: PreparedCandidateContext,
  query: ProjectCandidateQuery,
): CompleteHubProjectEvaluation | CandidateContextUnavailableReason {
  const address = queryAddress(query);
  const route = requireRoute(context.projectEvaluation.routes, query);
  const activeEvaluation = route.biomes.find(
    (candidate) => candidate.biomeKey === address.biomeKey,
  );
  if (activeEvaluation !== undefined) {
    if (activeEvaluation.completion === 'incomplete') {
      return 'biomeIncomplete';
    }
    if (activeEvaluation.kind !== 'HubBiome') {
      failCandidate(query, `${address.biomeKey} does not have a Hub evaluation`);
    }
    return activeEvaluation;
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

type CandidateBiomeEvaluation = ProjectBiomeEvaluation;

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
): CandidateBiomeEvaluation | CandidateContextUnavailableReason {
  const address = queryAddress(query);
  const baselineRoute = requireRoute(context.projectEvaluation.routes, query);
  const sourcePlan = locateBiomePlan(project, query);
  const baselineBiome = locateCandidateBiome(project, context, query);
  if (typeof baselineBiome === 'string') {
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
    return evaluateNBiome(catalog, route.routeKey, plan);
  }

  const previous = biomeIndex === 0 ? undefined : baselineRoute.biomes[biomeIndex - 1];
  if (previous?.completion === 'incomplete') {
    failCandidate(query, 'candidate biome has an incomplete upstream evaluation');
  }
  const previousComplete = previous?.completion === 'complete' ? previous : undefined;
  return evaluateLinearBiome(catalog, route.routeKey, plan, biomeIndex + 1, previousComplete);
}

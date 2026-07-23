import {
  createBiomeAddress,
  createContinuationAddress,
  createOccurrenceAddress,
  createTargetAddress,
  semanticAddressKey,
  type SemanticAddress,
} from '../../authored-project/addresses';
import { applyProjectCommand, type ProjectCommand } from '../../authored-project/commands/dispatch';
import type {
  AuthoredBiomePlan,
  AuthoredRoutePlan,
  HubBiomePlan,
  LinearContinuation,
  LinearBiomePlan,
  LinearTargetReference,
  OccurrenceId,
  ProjectDocument,
  RoomOccurrence,
} from '../../authored-project/model';
import type { Catalog } from '../../catalog-schema';
import type { ResolvedRewardOffer } from '../../reward-kernel/model';
import {
  linearRoomTargetCandidateContexts,
  type FieldsCageOutcomeSupportEntry,
  type LinearRoomTargetCandidateContext,
} from '../generation';
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
import type { LinearRewardStoreSupportEntry } from '../rewards';
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
  ProjectCandidateSessionOptions,
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

export function producerFrontierUnavailable(
  query: ProjectCandidateQuery,
): CandidateContextUnavailable {
  return Object.freeze({
    reason: 'producerFrontierUnavailable',
    evidence: Object.freeze({
      kind: 'producerFrontierUnavailable',
      producer: queryAddress(query),
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
  context: PreparedCandidateContext,
  query: ProjectCandidateQuery,
): ProjectRouteEvaluation {
  const address = queryAddress(query);
  const route = context.index.routesByKey.get(address.routeKey)?.evaluation;
  if (route === undefined) {
    failCandidate(query, `simulation has no route ${address.routeKey}`);
  }
  return route;
}

export function locateIndexedBiome(
  context: PreparedCandidateContext,
  query: ProjectCandidateQuery,
): IndexedCandidateBiome {
  const address = queryAddress(query);
  const biome = context.index.biomesByOwner.get(
    semanticAddressKey(createBiomeAddress(address.routeKey, address.biomeKey)),
  );
  if (biome === undefined) {
    failCandidate(query, `project has no configured biome ${address.biomeKey}`);
  }
  return biome;
}

export function locateIndexedLinearPlan(
  context: PreparedCandidateContext,
  query: ProjectCandidateQuery,
): LinearBiomePlan {
  const plan = locateIndexedBiome(context, query).plan;
  if (plan.kind !== 'LinearBiome') {
    failCandidate(
      query,
      `${queryAddress(query).biomeKey} does not use linear candidate evaluation`,
    );
  }
  return plan;
}

export function locateIndexedHubPlan(
  context: PreparedCandidateContext,
  query: ProjectCandidateQuery,
): HubBiomePlan {
  const plan = locateIndexedBiome(context, query).plan;
  if (plan.kind !== 'HubBiome') {
    failCandidate(query, `${queryAddress(query).biomeKey} does not use Hub candidate evaluation`);
  }
  return plan;
}

export function locateIndexedOccurrence(
  context: PreparedCandidateContext,
  query: ProjectCandidateQuery,
  occurrenceId: OccurrenceId,
): IndexedCandidateOccurrence {
  const address = queryAddress(query);
  const occurrence = context.index.occurrencesByOwner.get(
    semanticAddressKey(
      createOccurrenceAddress(createBiomeAddress(address.routeKey, address.biomeKey), occurrenceId),
    ),
  );
  if (occurrence === undefined) {
    failCandidate(query, `project has no occurrence ${occurrenceId}`);
  }
  return occurrence;
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
  context: PreparedCandidateContext,
  query: ProjectCandidateQuery,
): CandidateLinearBiomeEvaluation | CandidateContextUnavailable {
  const address = queryAddress(query);
  const route = requireRoute(context, query);
  const evaluation = locateIndexedBiome(context, query).evaluation;
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
  readonly project: ProjectDocument;
  readonly projectEvaluation: ProjectEvaluation;
  readonly index: PreparedCandidateIndex;
  readonly observe?: ProjectCandidateSessionOptions['observe'];
}

export interface IndexedCandidateBiome {
  readonly plan: AuthoredBiomePlan;
  readonly evaluation?: LinearBiomeProjectEvaluation | HubBiomeProjectEvaluation;
  readonly route: AuthoredRoutePlan;
  readonly routeEvaluation: ProjectRouteEvaluation;
}

export interface IndexedCandidateOccurrence {
  readonly biome: IndexedCandidateBiome;
  readonly occurrence: RoomOccurrence;
}

export interface IndexedCandidateTarget {
  readonly biome: IndexedCandidateBiome;
  readonly continuation: LinearContinuation;
  readonly occurrence: RoomOccurrence;
  readonly target: LinearTargetReference;
}

export interface IndexedStartRoomDomain {
  readonly biome: IndexedCandidateBiome;
  readonly supportedGameNames: readonly string[];
}

export interface PreparedCandidateIndex {
  readonly routesByKey: ReadonlyMap<
    string,
    {
      readonly plan: AuthoredRoutePlan;
      readonly evaluation: ProjectRouteEvaluation;
    }
  >;
  readonly biomesByOwner: ReadonlyMap<string, IndexedCandidateBiome>;
  readonly occurrencesByOwner: ReadonlyMap<string, IndexedCandidateOccurrence>;
  readonly targetsByOwner: ReadonlyMap<string, IndexedCandidateTarget>;
  readonly batchTargetParentsByOwner: ReadonlySet<string>;
  readonly targetSlotsByOwner: ReadonlySet<string>;
  readonly roomTargetContextsByOwner: ReadonlyMap<string, LinearRoomTargetCandidateContext>;
  readonly startRoomDomainsByOwner: ReadonlyMap<string, IndexedStartRoomDomain>;
  readonly batchRewardStoresByOwner: ReadonlyMap<string, LinearRewardStoreSupportEntry>;
  readonly fieldsCageOutcomesByOwner: ReadonlyMap<string, FieldsCageOutcomeSupportEntry>;
}

export function prepareCandidateContext(
  catalog: Catalog,
  project: ProjectDocument,
  projectEvaluation: ProjectEvaluation,
  options: ProjectCandidateSessionOptions = {},
): PreparedCandidateContext {
  const routesByKey = new Map<
    string,
    {
      readonly plan: AuthoredRoutePlan;
      readonly evaluation: ProjectRouteEvaluation;
    }
  >();
  const biomesByOwner = new Map<string, IndexedCandidateBiome>();
  const occurrencesByOwner = new Map<string, IndexedCandidateOccurrence>();
  const targetsByOwner = new Map<string, IndexedCandidateTarget>();
  const batchTargetParentsByOwner = new Set<string>();
  const targetSlotsByOwner = new Set<string>();
  const roomTargetContextsByOwner = new Map<string, LinearRoomTargetCandidateContext>();
  const startRoomDomainsByOwner = new Map<string, IndexedStartRoomDomain>();
  const batchRewardStoresByOwner = new Map<string, LinearRewardStoreSupportEntry>();
  const fieldsCageOutcomesByOwner = new Map<string, FieldsCageOutcomeSupportEntry>();

  for (const route of project.routes) {
    const routeEvaluation = projectEvaluation.routes.find(
      (candidate) => candidate.routeKey === route.routeKey,
    );
    if (routeEvaluation === undefined) {
      throw new Error(`candidate index has no evaluation for route ${route.routeKey}`);
    }
    routesByKey.set(route.routeKey, Object.freeze({ plan: route, evaluation: routeEvaluation }));
    for (const plan of route.biomes) {
      const biomeAddress = createBiomeAddress(route.routeKey, plan.biomeKey);
      const evaluation = routeEvaluation.biomes.find(
        (candidate) => candidate.biomeKey === plan.biomeKey,
      );
      const biome: IndexedCandidateBiome = Object.freeze({
        plan,
        route,
        routeEvaluation,
        ...(evaluation === undefined ? {} : { evaluation }),
      });
      biomesByOwner.set(semanticAddressKey(biomeAddress), biome);
      const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
      let candidateContexts: ReadonlyMap<string, LinearRoomTargetCandidateContext> | undefined;
      if (plan.kind === 'LinearBiome') {
        if (layout?.kind !== 'LinearBiome') {
          throw new Error(`candidate index has no linear layout for ${plan.biomeKey}`);
        }
        if (layout.start.kind === 'authoredStart') {
          const domain = Object.freeze({
            biome,
            supportedGameNames: layout.start.roomGameNames,
          });
          startRoomDomainsByOwner.set(semanticAddressKey(biomeAddress), domain);
          if (plan.topology !== null && plan.topology.startOccurrenceId !== null) {
            startRoomDomainsByOwner.set(
              semanticAddressKey(
                createOccurrenceAddress(biomeAddress, plan.topology.startOccurrenceId),
              ),
              domain,
            );
          }
        }
        if (evaluation !== undefined) {
          if (evaluation.kind !== 'LinearBiome') {
            throw new Error(`candidate index evaluation kind changed for ${plan.biomeKey}`);
          }
          if ('roomGeneration' in evaluation) {
            candidateContexts = linearRoomTargetCandidateContexts(evaluation.roomGeneration);
            for (const entry of evaluation.rewards.storeSupport) {
              batchRewardStoresByOwner.set(semanticAddressKey(entry.origin), entry);
            }
            for (const entry of evaluation.roomGeneration.fieldsCageOutcomes) {
              fieldsCageOutcomesByOwner.set(semanticAddressKey(entry.origin), entry);
            }
          }
        }
      } else if (evaluation !== undefined && evaluation.kind !== 'HubBiome') {
        throw new Error(`candidate index evaluation kind changed for ${plan.biomeKey}`);
      }
      if (plan.topology === null) {
        continue;
      }
      const occurrencesById = new Map(
        plan.topology.occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence]),
      );
      for (const occurrence of plan.topology.occurrences) {
        occurrencesByOwner.set(
          semanticAddressKey(createOccurrenceAddress(biomeAddress, occurrence.occurrenceId)),
          Object.freeze({ biome, occurrence }),
        );
      }
      if (plan.kind !== 'LinearBiome') {
        continue;
      }
      if (layout?.kind !== 'LinearBiome') {
        throw new Error(`candidate index has no linear layout for ${plan.biomeKey}`);
      }
      for (const continuation of plan.topology.continuations) {
        if (continuation.kind === 'batch') {
          const parentGameName =
            continuation.parentOccurrenceId === null
              ? ([...layout.entries].reverse().find((entry) => entry.kind === 'fixedEntry')
                  ?.roomGameName ??
                (layout.start.kind === 'fixedEntry' ? layout.start.roomGameName : undefined))
              : occurrencesById.get(continuation.parentOccurrenceId)?.gameName;
          const parentRoom =
            parentGameName === undefined ? undefined : catalog.rooms.byKey[parentGameName];
          if (parentRoom === undefined) {
            throw new Error(
              `candidate index batch ${String(continuation.parentOccurrenceId)} has no parent room`,
            );
          }
          batchTargetParentsByOwner.add(
            semanticAddressKey(
              createContinuationAddress(biomeAddress, continuation.parentOccurrenceId),
            ),
          );
          for (const exit of parentRoom.exits) {
            targetSlotsByOwner.add(
              semanticAddressKey(
                createTargetAddress(biomeAddress, continuation.parentOccurrenceId, exit.index),
              ),
            );
          }
        }
        for (const target of continuation.targets) {
          const occurrence = occurrencesById.get(target.occurrenceId);
          if (occurrence === undefined) {
            throw new Error(
              `candidate index target ${target.occurrenceId} has no authored occurrence`,
            );
          }
          const targetAddress = createTargetAddress(
            biomeAddress,
            continuation.parentOccurrenceId,
            target.exitIndex,
          );
          const targetKey = semanticAddressKey(targetAddress);
          targetSlotsByOwner.add(targetKey);
          targetsByOwner.set(targetKey, Object.freeze({ biome, continuation, occurrence, target }));
          if (candidateContexts !== undefined) {
            const candidateContext = candidateContexts.get(targetKey);
            if (candidateContext !== undefined) {
              roomTargetContextsByOwner.set(targetKey, candidateContext);
            }
          }
        }
      }
    }
  }

  return Object.freeze({
    project,
    projectEvaluation,
    ...(options.observe === undefined ? {} : { observe: options.observe }),
    index: Object.freeze({
      routesByKey,
      biomesByOwner,
      occurrencesByOwner,
      targetsByOwner,
      batchTargetParentsByOwner,
      targetSlotsByOwner,
      roomTargetContextsByOwner,
      startRoomDomainsByOwner,
      batchRewardStoresByOwner,
      fieldsCageOutcomesByOwner,
    }),
  });
}

export function observeCandidateBiomeReplay(
  context: PreparedCandidateContext,
  query: ProjectCandidateQuery,
  scope: 'hubBiome' | 'linearBiome',
): void {
  const address = queryAddress(query);
  context.observe?.(
    Object.freeze({
      kind: 'biomeReplay',
      queryKind: query.kind,
      routeKey: address.routeKey,
      biomeKey: address.biomeKey,
      scope,
    }),
  );
}

export function locateCandidateLinear(
  context: PreparedCandidateContext,
  query: ProjectCandidateQuery,
): CandidateLinearBiomeEvaluation | CandidateContextUnavailable {
  return locateCompleteLinear(context, query);
}

export function locateCandidateHub(
  context: PreparedCandidateContext,
  query: ProjectCandidateQuery,
): CandidateHubBiomeEvaluation | CandidateContextUnavailable {
  const address = queryAddress(query);
  const route = requireRoute(context, query);
  const activeEvaluation = locateIndexedBiome(context, query).evaluation;
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
  context: PreparedCandidateContext,
  query: ProjectCandidateQuery,
) {
  const sourcePlan = locateIndexedBiome(context, query).plan;
  return sourcePlan.kind === 'LinearBiome'
    ? locateCandidateLinear(context, query)
    : locateCandidateHub(context, query);
}

export function evaluateCandidateBiome(
  catalog: Catalog,
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
  const baselineRoute = requireRoute(context, query);
  const sourcePlan = locateIndexedBiome(context, query).plan;
  const baselineBiome = locateCandidateBiome(context, query);
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
    observeCandidateBiomeReplay(context, query, 'hubBiome');
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
  observeCandidateBiomeReplay(context, query, 'linearBiome');
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

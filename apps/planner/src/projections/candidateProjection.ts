import {
  createPreparedProjectCandidateSession,
  type CandidateEvaluationEvent,
  type ProjectCandidateEvaluation,
  type ProjectCandidateEvaluator,
  type ProjectCandidateQuery,
  type ProjectEvaluation,
} from '@run-planner/engine/simulation';
import {
  resolveLinearOccurrenceRewardStore,
  semanticAddressKey,
  type AuthoredFieldValue,
  type BatchRewardStoreAddress,
  type BiomeAddress,
  type BiomeFieldAddress,
  type ContinuationAddress,
  type HubSlotAddress,
  type HubVisitAddress,
  type IncomingRewardAddress,
  type LocalChildAddress,
  type LocalChildGroupAddress,
  type LocalRewardAddress,
  type OccurrenceId,
  type OccurrenceAddress,
  type ProjectDocument,
  type RewardWheelAddress,
  type RewardWheelOfferAddress,
  type ShopOfferAddress,
  type ShopPurchaseAddress,
  type SideRoomGeneration,
  type TargetAddress,
} from '@run-planner/engine/authored-project';
import { type Catalog, type RoomDeclaration } from '@run-planner/engine/catalog-schema';
import type { CountedRewardBinding, ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';

import {
  prepareRewardDomain,
  projectRewardDomain,
  rewardDomainOffers,
  type PreparedRewardDomain,
  type ProjectedRewardDomain,
} from './rewardDomainProjection';

export type RewardCandidateOwner =
  | { readonly kind: 'incomingReward'; readonly address: IncomingRewardAddress }
  | { readonly kind: 'localReward'; readonly address: LocalRewardAddress }
  | { readonly kind: 'rewardWheelOffer'; readonly address: RewardWheelOfferAddress }
  | { readonly kind: 'shopOffer'; readonly address: ShopOfferAddress };

export type CountedRewardCandidateOwner = Exclude<
  RewardCandidateOwner,
  { readonly kind: 'shopOffer' }
>;

export interface CandidateOptionProjection<T> {
  readonly value: T;
  readonly evaluation: ProjectCandidateEvaluation;
}

export interface CandidateProjectionSession {
  readonly project: ProjectDocument;
  readonly evaluation: ProjectEvaluation;
  readonly prepareRewardDomain: (
    rewardTypes: readonly string[],
    selected: ResolvedRewardOffer,
  ) => PreparedRewardDomain;
  readonly countedRewardTypes: (
    owner: CountedRewardCandidateOwner,
    binding: CountedRewardBinding,
    selectedRewardType: string,
  ) => readonly string[];
  readonly rewardDomain: (
    owner: RewardCandidateOwner,
    rewardTypes: readonly string[],
    selected: ResolvedRewardOffer,
  ) => Promise<ProjectedRewardDomain>;
  readonly startRooms: (
    owner: BiomeAddress | OccurrenceAddress,
    rooms: readonly RoomDeclaration[],
  ) => readonly CandidateOptionProjection<RoomDeclaration>[];
  readonly roomTargets: (
    target: TargetAddress,
    rooms: readonly RoomDeclaration[],
  ) => readonly CandidateOptionProjection<RoomDeclaration>[];
  readonly biomeFields: (
    field: BiomeFieldAddress,
    values: readonly AuthoredFieldValue[],
  ) => readonly CandidateOptionProjection<AuthoredFieldValue>[];
  readonly batchRewardStores: (
    rewardStore: BatchRewardStoreAddress,
    storeKeys: readonly string[],
  ) => readonly CandidateOptionProjection<string>[];
  readonly fieldsCageOutcomes: (
    continuation: ContinuationAddress,
    outcomes: readonly ('min' | 'max')[],
  ) => readonly CandidateOptionProjection<'min' | 'max'>[];
  readonly shipEncounterCounts: (
    occurrence: OccurrenceAddress,
    values: readonly (2 | 3)[],
  ) => readonly CandidateOptionProjection<2 | 3>[];
  readonly rewardWheelOfferCounts: (
    wheel: RewardWheelAddress,
    values: readonly number[],
  ) => readonly CandidateOptionProjection<number>[];
  readonly rewardWheelStores: (
    wheel: RewardWheelAddress,
    storeKeys: readonly string[],
  ) => readonly CandidateOptionProjection<string>[];
  readonly rewardWheelPicks: (
    wheel: RewardWheelAddress,
    values: readonly number[],
  ) => readonly CandidateOptionProjection<number>[];
  readonly hubSlots: (
    slot: HubSlotAddress,
    occurrenceId: OccurrenceId,
    values: readonly boolean[],
  ) => readonly CandidateOptionProjection<boolean>[];
  readonly hubVisits: (
    visit: HubVisitAddress,
    hubSlotKeys: readonly string[],
  ) => readonly CandidateOptionProjection<string>[];
  readonly sideRoomGenerations: (
    sideRoom: LocalChildAddress,
    values: readonly SideRoomGeneration[],
  ) => readonly CandidateOptionProjection<SideRoomGeneration>[];
  readonly sideRoomEntryOrders: (
    group: LocalChildGroupAddress,
    values: readonly (readonly string[])[],
  ) => readonly CandidateOptionProjection<readonly string[]>[];
  readonly shopPurchases: (
    purchase: ShopPurchaseAddress,
    values: readonly boolean[],
  ) => readonly CandidateOptionProjection<boolean>[];
}

export interface CandidateProjectionService {
  readonly bind: (
    project: ProjectDocument,
    evaluation: ProjectEvaluation,
  ) => CandidateProjectionSession;
  readonly prepareRewardDomain: (
    rewardTypes: readonly string[],
    selected: ResolvedRewardOffer,
  ) => PreparedRewardDomain;
  readonly countedRewardTypes: (
    project: ProjectDocument,
    owner: CountedRewardCandidateOwner,
    binding: CountedRewardBinding,
    selectedRewardType: string,
  ) => readonly string[];
  readonly rewardDomain: (
    project: ProjectDocument,
    owner: RewardCandidateOwner,
    rewardTypes: readonly string[],
    selected: ResolvedRewardOffer,
  ) => Promise<ProjectedRewardDomain>;
  readonly biomeFields: (
    project: ProjectDocument,
    field: BiomeFieldAddress,
    values: readonly AuthoredFieldValue[],
  ) => readonly CandidateOptionProjection<AuthoredFieldValue>[];
  readonly startRooms: (
    project: ProjectDocument,
    owner: BiomeAddress | OccurrenceAddress,
    rooms: readonly RoomDeclaration[],
  ) => readonly CandidateOptionProjection<RoomDeclaration>[];
  readonly roomTargets: (
    project: ProjectDocument,
    target: TargetAddress,
    rooms: readonly RoomDeclaration[],
  ) => readonly CandidateOptionProjection<RoomDeclaration>[];
  readonly batchRewardStores: (
    project: ProjectDocument,
    rewardStore: BatchRewardStoreAddress,
    storeKeys: readonly string[],
  ) => readonly CandidateOptionProjection<string>[];
  readonly incomingRewards: (
    project: ProjectDocument,
    reward: IncomingRewardAddress,
    offers: readonly ResolvedRewardOffer[],
  ) => readonly CandidateOptionProjection<ResolvedRewardOffer>[];
  readonly localRewards: (
    project: ProjectDocument,
    reward: LocalRewardAddress,
    offers: readonly ResolvedRewardOffer[],
  ) => readonly CandidateOptionProjection<ResolvedRewardOffer>[];
  readonly fieldsCageOutcomes: (
    project: ProjectDocument,
    continuation: ContinuationAddress,
    outcomes: readonly ('min' | 'max')[],
  ) => readonly CandidateOptionProjection<'min' | 'max'>[];
  readonly shipEncounterCounts: (
    project: ProjectDocument,
    occurrence: OccurrenceAddress,
    values: readonly (2 | 3)[],
  ) => readonly CandidateOptionProjection<2 | 3>[];
  readonly rewardWheelOfferCounts: (
    project: ProjectDocument,
    wheel: RewardWheelAddress,
    values: readonly number[],
  ) => readonly CandidateOptionProjection<number>[];
  readonly rewardWheelStores: (
    project: ProjectDocument,
    wheel: RewardWheelAddress,
    storeKeys: readonly string[],
  ) => readonly CandidateOptionProjection<string>[];
  readonly rewardWheelOffers: (
    project: ProjectDocument,
    offer: RewardWheelOfferAddress,
    values: readonly ResolvedRewardOffer[],
  ) => readonly CandidateOptionProjection<ResolvedRewardOffer>[];
  readonly rewardWheelPicks: (
    project: ProjectDocument,
    wheel: RewardWheelAddress,
    values: readonly number[],
  ) => readonly CandidateOptionProjection<number>[];
  readonly hubSlots: (
    project: ProjectDocument,
    slot: HubSlotAddress,
    occurrenceId: OccurrenceId,
    values: readonly boolean[],
  ) => readonly CandidateOptionProjection<boolean>[];
  readonly hubVisits: (
    project: ProjectDocument,
    visit: HubVisitAddress,
    hubSlotKeys: readonly string[],
  ) => readonly CandidateOptionProjection<string>[];
  readonly sideRoomGenerations: (
    project: ProjectDocument,
    sideRoom: LocalChildAddress,
    values: readonly SideRoomGeneration[],
  ) => readonly CandidateOptionProjection<SideRoomGeneration>[];
  readonly sideRoomEntryOrders: (
    project: ProjectDocument,
    group: LocalChildGroupAddress,
    values: readonly (readonly string[])[],
  ) => readonly CandidateOptionProjection<readonly string[]>[];
  readonly shopOffers: (
    project: ProjectDocument,
    offer: ShopOfferAddress,
    values: readonly ResolvedRewardOffer[],
  ) => readonly CandidateOptionProjection<ResolvedRewardOffer>[];
  readonly shopPurchases: (
    project: ProjectDocument,
    purchase: ShopPurchaseAddress,
    values: readonly boolean[],
  ) => readonly CandidateOptionProjection<boolean>[];
}

export interface CandidateProjectionServiceOptions {
  readonly observeCandidateEvaluation?: (event: CandidateEvaluationEvent) => void;
  readonly yieldToHost?: () => Promise<void>;
}

function offerKey(value: ResolvedRewardOffer): string {
  return JSON.stringify(value);
}

function domainKey(values: readonly string[]): string {
  return JSON.stringify(values);
}

function fieldValueKey(value: AuthoredFieldValue): string {
  return JSON.stringify(value);
}

function rewardQueries(
  owner: RewardCandidateOwner,
  offers: readonly ResolvedRewardOffer[],
): readonly ProjectCandidateQuery[] {
  switch (owner.kind) {
    case 'incomingReward':
      return offers.map((value) => ({ kind: 'incomingReward', reward: owner.address, value }));
    case 'localReward':
      return offers.map((value) => ({ kind: 'localReward', reward: owner.address, value }));
    case 'rewardWheelOffer':
      return offers.map((value) => ({ kind: 'rewardWheelOffer', offer: owner.address, value }));
    case 'shopOffer':
      return offers.map((value) => ({ kind: 'shopOffer', offer: owner.address, value }));
  }
}

function requireProjectCache(
  cache: WeakMap<ProjectDocument, WeakMap<ProjectEvaluation, ProjectCandidateProjectionCache>>,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  catalog: Catalog,
  options: CandidateProjectionServiceOptions,
): ProjectCandidateProjectionCache {
  let byEvaluation = cache.get(project);
  if (byEvaluation === undefined) {
    byEvaluation = new WeakMap();
    cache.set(project, byEvaluation);
  }
  let projectCache = byEvaluation.get(evaluation);
  if (projectCache === undefined) {
    projectCache = {
      evaluator: createPreparedProjectCandidateSession(
        catalog,
        project,
        evaluation,
        options.observeCandidateEvaluation === undefined
          ? {}
          : { observe: options.observeCandidateEvaluation },
      ),
      options: new Map(),
    };
    byEvaluation.set(evaluation, projectCache);
  }
  return projectCache;
}

function projectOptions<T>(
  cache: WeakMap<ProjectDocument, WeakMap<ProjectEvaluation, ProjectCandidateProjectionCache>>,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  key: string,
  values: readonly T[],
  queries: readonly ProjectCandidateQuery[],
  catalog: Catalog,
  options: CandidateProjectionServiceOptions,
): readonly CandidateOptionProjection<T>[] {
  const projectCache = requireProjectCache(cache, project, evaluation, catalog, options);
  const existing = projectCache.options.get(key);
  if (existing !== undefined) {
    return existing as readonly CandidateOptionProjection<T>[];
  }
  const evaluations = projectCache.evaluator.evaluate(queries);
  const projected = Object.freeze(
    values.map((value, index) => {
      const evaluation = evaluations[index];
      if (evaluation === undefined) {
        throw new Error(`candidate projection ${key} omitted value ${index}`);
      }
      return Object.freeze({ value, evaluation });
    }),
  );
  projectCache.options.set(key, projected);
  return projected;
}

interface ProjectCandidateProjectionCache {
  readonly evaluator: ProjectCandidateEvaluator;
  readonly options: Map<string, readonly CandidateOptionProjection<unknown>[]>;
}

async function projectOptionsCooperatively<T>(
  cache: WeakMap<ProjectDocument, WeakMap<ProjectEvaluation, ProjectCandidateProjectionCache>>,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  key: string,
  values: readonly T[],
  queries: readonly ProjectCandidateQuery[],
  catalog: Catalog,
  options: CandidateProjectionServiceOptions,
  yieldToHost: () => Promise<void>,
): Promise<readonly CandidateOptionProjection<T>[]> {
  const cached = cache.get(project)?.get(evaluation)?.options.get(key);
  if (cached !== undefined) {
    return cached as readonly CandidateOptionProjection<T>[];
  }
  await yieldToHost();
  const projectCache = requireProjectCache(cache, project, evaluation, catalog, options);
  const existing = projectCache.options.get(key);
  if (existing !== undefined) {
    return existing as readonly CandidateOptionProjection<T>[];
  }
  const projected: CandidateOptionProjection<T>[] = [];
  for (const [index, query] of queries.entries()) {
    const evaluation = projectCache.evaluator.evaluate([query])[0];
    if (evaluation === undefined) {
      throw new Error(`candidate projection ${key} omitted value ${index}`);
    }
    projected.push(Object.freeze({ value: values[index]!, evaluation }));
    if (index + 1 < queries.length) {
      await yieldToHost();
    }
  }
  const result = Object.freeze(projected);
  projectCache.options.set(key, result);
  return result;
}

function requireBiomePlan(project: ProjectDocument, owner: CountedRewardCandidateOwner) {
  const address = owner.address;
  const route = project.routes.find((candidate) => candidate.routeKey === address.routeKey);
  const plan = route?.biomes.find((candidate) => candidate.biomeKey === address.biomeKey);
  if (plan === undefined) {
    throw new Error(`reward producer ${semanticAddressKey(address)} has no authored biome plan`);
  }
  return plan;
}

function requireOccurrence(project: ProjectDocument, owner: CountedRewardCandidateOwner) {
  const plan = requireBiomePlan(project, owner);
  const occurrence = plan.topology?.occurrences.find(
    (candidate) => candidate.occurrenceId === owner.address.occurrenceId,
  );
  if (occurrence === undefined) {
    throw new Error(`reward producer ${semanticAddressKey(owner.address)} has no occurrence`);
  }
  return { occurrence, plan };
}

function resolvedCountedStoreKey(
  catalog: Catalog,
  project: ProjectDocument,
  owner: CountedRewardCandidateOwner,
  binding: CountedRewardBinding,
): string {
  let storeKey: string | undefined;
  switch (owner.kind) {
    case 'incomingReward': {
      const { occurrence, plan } = requireOccurrence(project, owner);
      const room = catalog.rooms.byKey[occurrence.gameName];
      if (room === undefined) {
        throw new Error(`reward producer references unknown room ${occurrence.gameName}`);
      }
      if (plan.kind === 'LinearBiome') {
        const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
        if (layout?.kind !== 'LinearBiome') {
          throw new Error(`${plan.biomeKey} has no Linear reward-store layout`);
        }
        storeKey = resolveLinearOccurrenceRewardStore(
          plan,
          catalog,
          layout,
          occurrence.occurrenceId,
        );
      } else {
        storeKey = room.forcedRewardStoreKey ?? room.individualRewardStoreKey;
      }
      break;
    }
    case 'localReward':
      if (binding.storeKeys.length !== 1) {
        throw new Error(
          `local reward ${semanticAddressKey(owner.address)} has no exact declaration-owned store`,
        );
      }
      storeKey = binding.storeKeys[0];
      break;
    case 'rewardWheelOffer': {
      const { occurrence, plan } = requireOccurrence(project, owner);
      if (plan.kind !== 'LinearBiome' || occurrence.state.kind !== 'shipCombat') {
        throw new Error(`${semanticAddressKey(owner.address)} is not a ShipCombat reward wheel`);
      }
      storeKey = occurrence.state.wheels[owner.address.wheelKey]?.storeKey;
      break;
    }
  }
  if (storeKey === undefined || !binding.storeKeys.includes(storeKey)) {
    throw new Error(
      `reward producer ${semanticAddressKey(owner.address)} resolved unsupported store ${String(storeKey)}`,
    );
  }
  return storeKey;
}

function countedRewardTypeDomain(
  catalog: Catalog,
  binding: CountedRewardBinding,
  storeKey: string,
  selectedRewardType: string,
): readonly string[] {
  const store = catalog.rewards.stores.byKey[storeKey];
  if (store === undefined) {
    throw new Error(`reward producer resolved unknown store ${storeKey}`);
  }
  const rewardTypes: string[] = [];
  const seen = new Set<string>();
  for (const entry of store.entries) {
    if (!binding.allowedRewardTypes.includes(entry.rewardType) || seen.has(entry.rewardType)) {
      continue;
    }
    seen.add(entry.rewardType);
    rewardTypes.push(entry.rewardType);
  }
  if (!seen.has(selectedRewardType)) {
    rewardTypes.push(selectedRewardType);
  }
  if (rewardTypes.length === 0) {
    throw new Error(`reward producer store ${storeKey} has no selectable reward types`);
  }
  return Object.freeze(rewardTypes);
}

export function createCandidateProjectionService(
  catalog: Catalog,
  evaluateProject: (project: ProjectDocument) => ProjectEvaluation,
  options: CandidateProjectionServiceOptions = {},
): CandidateProjectionService {
  const yieldToHost =
    options.yieldToHost ??
    (() =>
      new Promise((resolve) => {
        setTimeout(resolve, 0);
      }));
  const cache = new WeakMap<
    ProjectDocument,
    WeakMap<ProjectEvaluation, ProjectCandidateProjectionCache>
  >();
  const legacyEvaluationCache = new WeakMap<ProjectDocument, ProjectEvaluation>();
  const rewardTypeDomainCache = new WeakMap<ProjectDocument, Map<string, readonly string[]>>();
  const preparedRewardDomainCache = new Map<string, PreparedRewardDomain>();
  const pendingRewardDomains = new WeakMap<
    ProjectDocument,
    WeakMap<ProjectEvaluation, Map<string, Promise<ProjectedRewardDomain>>>
  >();
  const boundSessionCache = new WeakMap<
    ProjectDocument,
    WeakMap<ProjectEvaluation, CandidateProjectionSession>
  >();
  const legacyEvaluationFor = (project: ProjectDocument): ProjectEvaluation => {
    const existing = legacyEvaluationCache.get(project);
    if (existing !== undefined) {
      return existing;
    }
    const evaluation = evaluateProject(project);
    legacyEvaluationCache.set(project, evaluation);
    return evaluation;
  };
  const prepareCachedRewardDomain = (
    rewardTypes: readonly string[],
    selected: ResolvedRewardOffer,
  ): PreparedRewardDomain => {
    const key = domainKey([...rewardTypes, offerKey(selected)]);
    const existing = preparedRewardDomainCache.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const prepared = prepareRewardDomain(catalog, rewardTypes, selected);
    preparedRewardDomainCache.set(key, prepared);
    return prepared;
  };
  const countedRewardTypesFor = (
    project: ProjectDocument,
    owner: CountedRewardCandidateOwner,
    binding: CountedRewardBinding,
    selectedRewardType: string,
  ): readonly string[] => {
    let projectCache = rewardTypeDomainCache.get(project);
    if (projectCache === undefined) {
      projectCache = new Map();
      rewardTypeDomainCache.set(project, projectCache);
    }
    const storeKey = resolvedCountedStoreKey(catalog, project, owner, binding);
    const key = `reward-types:${semanticAddressKey(owner.address)}:${storeKey}:${selectedRewardType}`;
    const existing = projectCache.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const domain = countedRewardTypeDomain(catalog, binding, storeKey, selectedRewardType);
    projectCache.set(key, domain);
    return domain;
  };
  const rewardDomainFor = (
    project: ProjectDocument,
    evaluation: ProjectEvaluation,
    owner: RewardCandidateOwner,
    rewardTypes: readonly string[],
    selected: ResolvedRewardOffer,
  ): Promise<ProjectedRewardDomain> => {
    const prepared = prepareCachedRewardDomain(rewardTypes, selected);
    const offers = rewardDomainOffers(prepared);
    const candidateKey = `reward-domain:${semanticAddressKey(owner.address)}:${domainKey(offers.map(offerKey))}`;
    const pendingKey = `${candidateKey}:selected:${offerKey(selected)}`;
    let byEvaluation = pendingRewardDomains.get(project);
    if (byEvaluation === undefined) {
      byEvaluation = new WeakMap();
      pendingRewardDomains.set(project, byEvaluation);
    }
    let projectPending = byEvaluation.get(evaluation);
    if (projectPending === undefined) {
      projectPending = new Map();
      byEvaluation.set(evaluation, projectPending);
    }
    const existing = projectPending.get(pendingKey);
    if (existing !== undefined) {
      return existing;
    }
    const pending = projectOptionsCooperatively(
      cache,
      project,
      evaluation,
      candidateKey,
      offers,
      rewardQueries(owner, offers),
      catalog,
      options,
      yieldToHost,
    )
      .then((candidates) => projectRewardDomain(prepared, candidates))
      .finally(() => {
        projectPending?.delete(pendingKey);
      });
    projectPending.set(pendingKey, pending);
    return pending;
  };
  const startRoomsFor = (
    project: ProjectDocument,
    evaluation: ProjectEvaluation,
    owner: BiomeAddress | OccurrenceAddress,
    rooms: readonly RoomDeclaration[],
  ) =>
    projectOptions(
      cache,
      project,
      evaluation,
      `start:${semanticAddressKey(owner)}:${domainKey(rooms.map((room) => room.gameName))}`,
      rooms,
      rooms.map((room) => ({ kind: 'startRoom', owner, gameName: room.gameName })),
      catalog,
      options,
    );
  const roomTargetsFor = (
    project: ProjectDocument,
    evaluation: ProjectEvaluation,
    target: TargetAddress,
    rooms: readonly RoomDeclaration[],
  ) =>
    projectOptions(
      cache,
      project,
      evaluation,
      `target:${semanticAddressKey(target)}:${domainKey(rooms.map((room) => room.gameName))}`,
      rooms,
      rooms.map((room) => ({ kind: 'roomTarget', target, gameName: room.gameName })),
      catalog,
      options,
    );
  const bind = (
    project: ProjectDocument,
    evaluation: ProjectEvaluation,
  ): CandidateProjectionSession => {
    let byEvaluation = boundSessionCache.get(project);
    if (byEvaluation === undefined) {
      byEvaluation = new WeakMap();
      boundSessionCache.set(project, byEvaluation);
    }
    const existing = byEvaluation.get(evaluation);
    if (existing !== undefined) {
      return existing;
    }
    requireProjectCache(cache, project, evaluation, catalog, options);
    const session = Object.freeze({
      project,
      evaluation,
      prepareRewardDomain: prepareCachedRewardDomain,
      countedRewardTypes: (
        owner: CountedRewardCandidateOwner,
        binding: CountedRewardBinding,
        selectedRewardType: string,
      ) => countedRewardTypesFor(project, owner, binding, selectedRewardType),
      rewardDomain: (
        owner: RewardCandidateOwner,
        rewardTypes: readonly string[],
        selected: ResolvedRewardOffer,
      ) => rewardDomainFor(project, evaluation, owner, rewardTypes, selected),
      startRooms: (owner: BiomeAddress | OccurrenceAddress, rooms: readonly RoomDeclaration[]) =>
        startRoomsFor(project, evaluation, owner, rooms),
      roomTargets: (target: TargetAddress, rooms: readonly RoomDeclaration[]) =>
        roomTargetsFor(project, evaluation, target, rooms),
      biomeFields: (field: BiomeFieldAddress, values: readonly AuthoredFieldValue[]) =>
        projectOptions(
          cache,
          project,
          evaluation,
          `biome-field:${semanticAddressKey(field)}:${domainKey(values.map(fieldValueKey))}`,
          values,
          values.map((value) => ({ kind: 'biomeField', field, value })),
          catalog,
          options,
        ),
      batchRewardStores: (rewardStore: BatchRewardStoreAddress, storeKeys: readonly string[]) =>
        projectOptions(
          cache,
          project,
          evaluation,
          `store:${semanticAddressKey(rewardStore)}:${domainKey(storeKeys)}`,
          storeKeys,
          storeKeys.map((storeKey) => ({ kind: 'batchRewardStore', rewardStore, storeKey })),
          catalog,
          options,
        ),
      fieldsCageOutcomes: (
        continuation: ContinuationAddress,
        outcomes: readonly ('min' | 'max')[],
      ) =>
        projectOptions(
          cache,
          project,
          evaluation,
          `fields:${semanticAddressKey(continuation)}:${domainKey(outcomes)}`,
          outcomes,
          outcomes.map((cageOutcome) => ({
            kind: 'fieldsCageOutcome',
            continuation,
            cageOutcome,
          })),
          catalog,
          options,
        ),
      shipEncounterCounts: (occurrence: OccurrenceAddress, values: readonly (2 | 3)[]) =>
        projectOptions(
          cache,
          project,
          evaluation,
          `ship-encounters:${semanticAddressKey(occurrence)}:${domainKey(values.map(String))}`,
          values,
          values.map((encounterCount) => ({
            kind: 'shipEncounterCount',
            occurrence,
            encounterCount,
          })),
          catalog,
          options,
        ),
      rewardWheelOfferCounts: (wheel: RewardWheelAddress, values: readonly number[]) =>
        projectOptions(
          cache,
          project,
          evaluation,
          `wheel-count:${semanticAddressKey(wheel)}:${domainKey(values.map(String))}`,
          values,
          values.map((offerCount) => ({ kind: 'rewardWheelOfferCount', wheel, offerCount })),
          catalog,
          options,
        ),
      rewardWheelStores: (wheel: RewardWheelAddress, storeKeys: readonly string[]) =>
        projectOptions(
          cache,
          project,
          evaluation,
          `wheel-store:${semanticAddressKey(wheel)}:${domainKey(storeKeys)}`,
          storeKeys,
          storeKeys.map((storeKey) => ({ kind: 'rewardWheelStore', wheel, storeKey })),
          catalog,
          options,
        ),
      rewardWheelPicks: (wheel: RewardWheelAddress, values: readonly number[]) =>
        projectOptions(
          cache,
          project,
          evaluation,
          `wheel-pick:${semanticAddressKey(wheel)}:${domainKey(values.map(String))}`,
          values,
          values.map((pickedOfferIndex) => ({
            kind: 'rewardWheelPicked',
            wheel,
            pickedOfferIndex,
          })),
          catalog,
          options,
        ),
      hubSlots: (slot: HubSlotAddress, occurrenceId: OccurrenceId, values: readonly boolean[]) =>
        projectOptions(
          cache,
          project,
          evaluation,
          `hub-slot:${semanticAddressKey(slot)}:${occurrenceId}:${domainKey(values.map(String))}`,
          values,
          values.map((open) => ({ kind: 'hubSlot', slot, open, occurrenceId })),
          catalog,
          options,
        ),
      hubVisits: (visit: HubVisitAddress, hubSlotKeys: readonly string[]) =>
        projectOptions(
          cache,
          project,
          evaluation,
          `hub-visit:${semanticAddressKey(visit)}:${domainKey(hubSlotKeys)}`,
          hubSlotKeys,
          hubSlotKeys.map((hubSlotKey) => ({ kind: 'hubVisit', visit, hubSlotKey })),
          catalog,
          options,
        ),
      sideRoomGenerations: (sideRoom: LocalChildAddress, values: readonly SideRoomGeneration[]) =>
        projectOptions(
          cache,
          project,
          evaluation,
          `side-generation:${semanticAddressKey(sideRoom)}:${domainKey(values)}`,
          values,
          values.map((generation) => ({ kind: 'sideRoomGeneration', sideRoom, generation })),
          catalog,
          options,
        ),
      sideRoomEntryOrders: (
        group: LocalChildGroupAddress,
        values: readonly (readonly string[])[],
      ) =>
        projectOptions(
          cache,
          project,
          evaluation,
          `side-entry-order:${semanticAddressKey(group)}:${domainKey(values.map((value) => JSON.stringify(value)))}`,
          values,
          values.map((enteredSlotKeys) => ({
            kind: 'sideRoomEntryOrder',
            group,
            enteredSlotKeys,
          })),
          catalog,
          options,
        ),
      shopPurchases: (purchase: ShopPurchaseAddress, values: readonly boolean[]) =>
        projectOptions(
          cache,
          project,
          evaluation,
          `shop-purchase:${semanticAddressKey(purchase)}:${domainKey(values.map(String))}`,
          values,
          values.map((purchased) => ({ kind: 'shopPurchase', purchase, purchased })),
          catalog,
          options,
        ),
    });
    byEvaluation.set(evaluation, session);
    return session;
  };
  const service: CandidateProjectionService = {
    bind,
    prepareRewardDomain: prepareCachedRewardDomain,
    countedRewardTypes: (project, owner, binding, selectedRewardType) =>
      countedRewardTypesFor(project, owner, binding, selectedRewardType),
    rewardDomain: (project, owner, rewardTypes, selected) =>
      bind(project, legacyEvaluationFor(project)).rewardDomain(owner, rewardTypes, selected),
    biomeFields: (project, field, values) =>
      bind(project, legacyEvaluationFor(project)).biomeFields(field, values),
    startRooms: (project, owner, rooms) =>
      bind(project, legacyEvaluationFor(project)).startRooms(owner, rooms),
    roomTargets: (project, target, rooms) =>
      bind(project, legacyEvaluationFor(project)).roomTargets(target, rooms),
    batchRewardStores: (project, rewardStore, storeKeys) =>
      bind(project, legacyEvaluationFor(project)).batchRewardStores(rewardStore, storeKeys),
    incomingRewards: (project, reward, offers) =>
      projectOptions(
        cache,
        project,
        legacyEvaluationFor(project),
        `incoming:${semanticAddressKey(reward)}:${domainKey(offers.map(offerKey))}`,
        offers,
        offers.map((value) => ({ kind: 'incomingReward', reward, value })),
        catalog,
        options,
      ),
    localRewards: (project, reward, offers) =>
      projectOptions(
        cache,
        project,
        legacyEvaluationFor(project),
        `local:${semanticAddressKey(reward)}:${domainKey(offers.map(offerKey))}`,
        offers,
        offers.map((value) => ({ kind: 'localReward', reward, value })),
        catalog,
        options,
      ),
    fieldsCageOutcomes: (project, continuation, outcomes) =>
      bind(project, legacyEvaluationFor(project)).fieldsCageOutcomes(continuation, outcomes),
    shipEncounterCounts: (project, occurrence, values) =>
      bind(project, legacyEvaluationFor(project)).shipEncounterCounts(occurrence, values),
    rewardWheelOfferCounts: (project, wheel, values) =>
      bind(project, legacyEvaluationFor(project)).rewardWheelOfferCounts(wheel, values),
    rewardWheelStores: (project, wheel, storeKeys) =>
      bind(project, legacyEvaluationFor(project)).rewardWheelStores(wheel, storeKeys),
    rewardWheelOffers: (project, offer, values) =>
      projectOptions(
        cache,
        project,
        legacyEvaluationFor(project),
        `wheel-offer:${semanticAddressKey(offer)}:${domainKey(values.map(offerKey))}`,
        values,
        values.map((value) => ({ kind: 'rewardWheelOffer', offer, value })),
        catalog,
        options,
      ),
    rewardWheelPicks: (project, wheel, values) =>
      bind(project, legacyEvaluationFor(project)).rewardWheelPicks(wheel, values),
    hubSlots: (project, slot, occurrenceId, values) =>
      bind(project, legacyEvaluationFor(project)).hubSlots(slot, occurrenceId, values),
    hubVisits: (project, visit, hubSlotKeys) =>
      bind(project, legacyEvaluationFor(project)).hubVisits(visit, hubSlotKeys),
    sideRoomGenerations: (project, sideRoom, values) =>
      bind(project, legacyEvaluationFor(project)).sideRoomGenerations(sideRoom, values),
    sideRoomEntryOrders: (project, group, values) =>
      bind(project, legacyEvaluationFor(project)).sideRoomEntryOrders(group, values),
    shopOffers: (project, offer, values) =>
      projectOptions(
        cache,
        project,
        legacyEvaluationFor(project),
        `shop-offer:${semanticAddressKey(offer)}:${domainKey(values.map(offerKey))}`,
        values,
        values.map((value) => ({ kind: 'shopOffer', offer, value })),
        catalog,
        options,
      ),
    shopPurchases: (project, purchase, values) =>
      bind(project, legacyEvaluationFor(project)).shopPurchases(purchase, values),
  };
  return Object.freeze(service);
}

export function candidateSupport(
  option: CandidateOptionProjection<unknown> | undefined,
): 'forced' | 'impossible' | 'possible' | 'unavailable' {
  if (option === undefined || option.evaluation.context === 'unavailable') {
    return 'unavailable';
  }
  return option.evaluation.support;
}

export function presentCandidateLabel(
  label: string,
  option: CandidateOptionProjection<unknown> | undefined,
): string {
  return candidateSupport(option) === 'impossible' ? `${label} — unavailable` : label;
}

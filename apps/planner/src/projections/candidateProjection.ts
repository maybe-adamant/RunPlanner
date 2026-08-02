import {
  countedRewardTypeDomain,
  createPreparedProjectCandidateSession,
  type CandidateEvaluationEvent,
  type ProjectCandidateEvaluation,
  type ProjectCandidateQuery,
  type ProjectCandidateSession,
  type ProjectEvaluation,
  type ProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';
import {
  semanticAddressKey,
  type BatchRewardStoreAddress,
  type BiomeAddress,
  type ExitDecisionAddress,
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
  readonly batchRewardStores: (
    rewardStore: BatchRewardStoreAddress,
    storeKeys: readonly string[],
  ) => readonly CandidateOptionProjection<string>[];
  readonly fieldsCageOutcomes: (
    decision: ExitDecisionAddress,
    outcomes: readonly ('min' | 'max')[],
  ) => readonly CandidateOptionProjection<'min' | 'max'>[];
  readonly takeoverPrebossBatches: (
    source: ExitDecisionAddress,
    gameNames: readonly string[],
  ) => readonly CandidateOptionProjection<string>[];
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

export interface CandidateSessionFactory {
  readonly bind: (assembly: ProjectEvaluationAssembly) => CandidateProjectionSession;
}

export interface CandidateSessionFactoryOptions {
  readonly observeCandidateEvaluation?: (event: CandidateEvaluationEvent) => void;
  readonly yieldToHost?: () => Promise<void>;
}

function offerKey(value: ResolvedRewardOffer): string {
  return JSON.stringify(value);
}

function domainKey(values: readonly string[]): string {
  return JSON.stringify(values);
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
  cache: WeakMap<ProjectEvaluationAssembly, ProjectCandidateProjectionCache>,
  assembly: ProjectEvaluationAssembly,
  catalog: Catalog,
  options: CandidateSessionFactoryOptions,
): ProjectCandidateProjectionCache {
  let projectCache = cache.get(assembly);
  if (projectCache === undefined) {
    projectCache = {
      evaluator: createPreparedProjectCandidateSession(
        catalog,
        assembly,
        options.observeCandidateEvaluation === undefined
          ? {}
          : { observe: options.observeCandidateEvaluation },
      ),
      options: new Map(),
    };
    cache.set(assembly, projectCache);
  }
  return projectCache;
}

function projectOptions<T>(
  cache: WeakMap<ProjectEvaluationAssembly, ProjectCandidateProjectionCache>,
  assembly: ProjectEvaluationAssembly,
  key: string,
  values: readonly T[],
  queries: readonly ProjectCandidateQuery[],
  catalog: Catalog,
  options: CandidateSessionFactoryOptions,
): readonly CandidateOptionProjection<T>[] {
  const projectCache = requireProjectCache(cache, assembly, catalog, options);
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
  readonly evaluator: ProjectCandidateSession;
  readonly options: Map<string, readonly CandidateOptionProjection<unknown>[]>;
}

async function projectOptionsCooperatively<T>(
  cache: WeakMap<ProjectEvaluationAssembly, ProjectCandidateProjectionCache>,
  assembly: ProjectEvaluationAssembly,
  key: string,
  values: readonly T[],
  queries: readonly ProjectCandidateQuery[],
  catalog: Catalog,
  options: CandidateSessionFactoryOptions,
  yieldToHost: () => Promise<void>,
): Promise<readonly CandidateOptionProjection<T>[]> {
  const cached = cache.get(assembly)?.options.get(key);
  if (cached !== undefined) {
    return cached as readonly CandidateOptionProjection<T>[];
  }
  await yieldToHost();
  const projectCache = requireProjectCache(cache, assembly, catalog, options);
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

export function createCandidateSessionFactory(
  catalog: Catalog,
  options: CandidateSessionFactoryOptions = {},
): CandidateSessionFactory {
  const yieldToHost =
    options.yieldToHost ??
    (() =>
      new Promise((resolve) => {
        setTimeout(resolve, 0);
      }));
  const cache = new WeakMap<ProjectEvaluationAssembly, ProjectCandidateProjectionCache>();
  const rewardTypeDomainCache = new WeakMap<
    ProjectEvaluationAssembly,
    Map<string, readonly string[]>
  >();
  const preparedRewardDomainCache = new Map<string, PreparedRewardDomain>();
  const pendingRewardDomains = new WeakMap<
    ProjectEvaluationAssembly,
    Map<string, Promise<ProjectedRewardDomain>>
  >();
  const boundSessionCache = new WeakMap<ProjectEvaluationAssembly, CandidateProjectionSession>();
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
    assembly: ProjectEvaluationAssembly,
    owner: CountedRewardCandidateOwner,
    binding: CountedRewardBinding,
    selectedRewardType: string,
  ): readonly string[] => {
    let projectCache = rewardTypeDomainCache.get(assembly);
    if (projectCache === undefined) {
      projectCache = new Map();
      rewardTypeDomainCache.set(assembly, projectCache);
    }
    const selectable = countedRewardTypeDomain(catalog, assembly, owner.address, binding);
    const key = `reward-types:${semanticAddressKey(owner.address)}:${domainKey(selectable)}:${selectedRewardType}`;
    const existing = projectCache.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const domain = selectable.includes(selectedRewardType)
      ? selectable
      : Object.freeze([...selectable, selectedRewardType]);
    projectCache.set(key, domain);
    return domain;
  };
  const rewardDomainFor = (
    assembly: ProjectEvaluationAssembly,
    owner: RewardCandidateOwner,
    rewardTypes: readonly string[],
    selected: ResolvedRewardOffer,
  ): Promise<ProjectedRewardDomain> => {
    const prepared = prepareCachedRewardDomain(rewardTypes, selected);
    const offers = rewardDomainOffers(prepared);
    const candidateKey = `reward-domain:${semanticAddressKey(owner.address)}:${domainKey(offers.map(offerKey))}`;
    const pendingKey = `${candidateKey}:selected:${offerKey(selected)}`;
    let projectPending = pendingRewardDomains.get(assembly);
    if (projectPending === undefined) {
      projectPending = new Map();
      pendingRewardDomains.set(assembly, projectPending);
    }
    const existing = projectPending.get(pendingKey);
    if (existing !== undefined) {
      return existing;
    }
    const pending = projectOptionsCooperatively(
      cache,
      assembly,
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
    assembly: ProjectEvaluationAssembly,
    owner: BiomeAddress | OccurrenceAddress,
    rooms: readonly RoomDeclaration[],
  ) =>
    projectOptions(
      cache,
      assembly,
      `start:${semanticAddressKey(owner)}:${domainKey(rooms.map((room) => room.gameName))}`,
      rooms,
      rooms.map((room) => ({ kind: 'startRoom', owner, gameName: room.gameName })),
      catalog,
      options,
    );
  const roomTargetsFor = (
    assembly: ProjectEvaluationAssembly,
    target: TargetAddress,
    rooms: readonly RoomDeclaration[],
  ) =>
    projectOptions(
      cache,
      assembly,
      `target:${semanticAddressKey(target)}:${domainKey(rooms.map((room) => room.gameName))}`,
      rooms,
      rooms.map((room) => ({ kind: 'roomTarget', target, gameName: room.gameName })),
      catalog,
      options,
    );
  const bind = (assembly: ProjectEvaluationAssembly): CandidateProjectionSession => {
    const existing = boundSessionCache.get(assembly);
    if (existing !== undefined) {
      return existing;
    }
    requireProjectCache(cache, assembly, catalog, options);
    const { evaluation, project } = assembly;
    const session = Object.freeze({
      project,
      evaluation,
      prepareRewardDomain: prepareCachedRewardDomain,
      countedRewardTypes: (
        owner: CountedRewardCandidateOwner,
        binding: CountedRewardBinding,
        selectedRewardType: string,
      ) => countedRewardTypesFor(assembly, owner, binding, selectedRewardType),
      rewardDomain: (
        owner: RewardCandidateOwner,
        rewardTypes: readonly string[],
        selected: ResolvedRewardOffer,
      ) => rewardDomainFor(assembly, owner, rewardTypes, selected),
      startRooms: (owner: BiomeAddress | OccurrenceAddress, rooms: readonly RoomDeclaration[]) =>
        startRoomsFor(assembly, owner, rooms),
      roomTargets: (target: TargetAddress, rooms: readonly RoomDeclaration[]) =>
        roomTargetsFor(assembly, target, rooms),
      batchRewardStores: (rewardStore: BatchRewardStoreAddress, storeKeys: readonly string[]) =>
        projectOptions(
          cache,
          assembly,
          `store:${semanticAddressKey(rewardStore)}:${domainKey(storeKeys)}`,
          storeKeys,
          storeKeys.map((storeKey) => ({ kind: 'batchRewardStore', rewardStore, storeKey })),
          catalog,
          options,
        ),
      fieldsCageOutcomes: (decision: ExitDecisionAddress, outcomes: readonly ('min' | 'max')[]) =>
        projectOptions(
          cache,
          assembly,
          `fields:${semanticAddressKey(decision)}:${domainKey(outcomes)}`,
          outcomes,
          outcomes.map((cageOutcome) => ({
            kind: 'fieldsCageOutcome',
            decision,
            cageOutcome,
          })),
          catalog,
          options,
        ),
      shipEncounterCounts: (occurrence: OccurrenceAddress, values: readonly (2 | 3)[]) =>
        projectOptions(
          cache,
          assembly,
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
          assembly,
          `wheel-count:${semanticAddressKey(wheel)}:${domainKey(values.map(String))}`,
          values,
          values.map((offerCount) => ({ kind: 'rewardWheelOfferCount', wheel, offerCount })),
          catalog,
          options,
        ),
      rewardWheelStores: (wheel: RewardWheelAddress, storeKeys: readonly string[]) =>
        projectOptions(
          cache,
          assembly,
          `wheel-store:${semanticAddressKey(wheel)}:${domainKey(storeKeys)}`,
          storeKeys,
          storeKeys.map((storeKey) => ({ kind: 'rewardWheelStore', wheel, storeKey })),
          catalog,
          options,
        ),
      rewardWheelPicks: (wheel: RewardWheelAddress, values: readonly number[]) =>
        projectOptions(
          cache,
          assembly,
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
          assembly,
          `hub-slot:${semanticAddressKey(slot)}:${occurrenceId}:${domainKey(values.map(String))}`,
          values,
          values.map((open) => ({ kind: 'hubSlot', slot, open, occurrenceId })),
          catalog,
          options,
        ),
      hubVisits: (visit: HubVisitAddress, hubSlotKeys: readonly string[]) =>
        projectOptions(
          cache,
          assembly,
          `hub-visit:${semanticAddressKey(visit)}:${domainKey(hubSlotKeys)}`,
          hubSlotKeys,
          hubSlotKeys.map((hubSlotKey) => ({ kind: 'hubVisit', visit, hubSlotKey })),
          catalog,
          options,
        ),
      sideRoomGenerations: (sideRoom: LocalChildAddress, values: readonly SideRoomGeneration[]) =>
        projectOptions(
          cache,
          assembly,
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
          assembly,
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
          assembly,
          `shop-purchase:${semanticAddressKey(purchase)}:${domainKey(values.map(String))}`,
          values,
          values.map((purchased) => ({ kind: 'shopPurchase', purchase, purchased })),
          catalog,
          options,
        ),
      takeoverPrebossBatches: (source: ExitDecisionAddress, gameNames: readonly string[]) =>
        projectOptions(
          cache,
          assembly,
          `takeover:${semanticAddressKey(source)}:${domainKey(gameNames)}`,
          gameNames,
          gameNames.map((gameName) => ({ kind: 'takeoverPrebossBatch', source, gameName })),
          catalog,
          options,
        ),
    });
    boundSessionCache.set(assembly, session);
    return session;
  };
  return Object.freeze({ bind });
}

export type CandidateSupport = 'forced' | 'impossible' | 'possible' | 'unavailable';

function candidateSelectedPossible(evaluation: ProjectCandidateEvaluation): boolean {
  switch (evaluation.kind) {
    case 'unavailable':
      return false;
    case 'roomTarget':
      return evaluation.result.pressure.selectedPossible;
    case 'incomingReward':
    case 'localReward':
    case 'rewardWheelOffer':
    case 'shopOffer':
    case 'shopPurchase':
      return evaluation.result.supported;
    case 'takeoverPrebossBatch':
      return evaluation.result.support !== 'impossible';
    default:
      return evaluation.result.selectedPossible;
  }
}

function candidateForced(
  evaluation: Exclude<ProjectCandidateEvaluation, { readonly kind: 'unavailable' }>,
): boolean {
  switch (evaluation.kind) {
    case 'roomTarget':
      return (
        evaluation.result.pressure.selectedPossible &&
        evaluation.result.pressure.requiredForcedRoomGameNames.includes(
          evaluation.result.pressure.selectedGameName,
        )
      );
    case 'startRoom':
      return (
        evaluation.result.selectedPossible && evaluation.result.supportedGameNames.length === 1
      );
    case 'batchRewardStore':
      return evaluation.result.selectedPossible && evaluation.result.supportStoreKeys.length === 1;
    case 'fieldsCageOutcome':
      return evaluation.result.selectedPossible && evaluation.result.supportOutcomes.length === 1;
    case 'shipEncounterCount':
      return (
        evaluation.result.selectedPossible && evaluation.result.supportEncounterCounts.length === 1
      );
    case 'rewardWheelStore':
      return (
        evaluation.result.selectedPossible && evaluation.result.supportedStoreKeys.length === 1
      );
    case 'hubSlot':
    case 'hubVisit':
    case 'rewardWheelOfferCount':
    case 'rewardWheelPicked':
    case 'sideRoomGeneration':
    case 'sideRoomEntryOrder':
    case 'incomingReward':
    case 'localReward':
    case 'rewardWheelOffer':
    case 'shopOffer':
    case 'shopPurchase':
      return false;
    case 'takeoverPrebossBatch':
      return evaluation.result.support === 'required';
  }
}

export function candidateSupport(
  option: CandidateOptionProjection<unknown> | undefined,
): CandidateSupport {
  if (option === undefined || option.evaluation.kind === 'unavailable') return 'unavailable';
  if (!candidateSelectedPossible(option.evaluation)) return 'impossible';
  return candidateForced(option.evaluation) ? 'forced' : 'possible';
}

export function presentCandidateLabel(
  label: string,
  option: CandidateOptionProjection<unknown> | undefined,
): string {
  return candidateSupport(option) === 'impossible' ? `${label} — unavailable` : label;
}

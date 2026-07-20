import {
  createProjectCandidateEvaluator,
  semanticAddressKey,
  type BatchRewardStoreAddress,
  type BiomeAddress,
  type Catalog,
  type IncomingRewardAddress,
  type OccurrenceAddress,
  type ProjectCandidateEvaluation,
  type ProjectCandidateEvaluator,
  type ProjectCandidateQuery,
  type ProjectDocument,
  type ProjectSimulationScope,
  type RoomDeclaration,
  type ShopOfferAddress,
  type ShopPurchaseAddress,
  type TargetAddress,
} from '@run-planner/core';
import type { ResolvedRewardOffer } from '@run-planner/core/reward-kernel';

export interface CandidateOptionProjection<T> {
  readonly value: T;
  readonly evaluation: ProjectCandidateEvaluation;
}

export interface CandidateProjectionService {
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

function offerKey(value: ResolvedRewardOffer): string {
  return JSON.stringify(value);
}

function domainKey(values: readonly string[]): string {
  return JSON.stringify(values);
}

function projectOptions<T>(
  cache: WeakMap<ProjectDocument, ProjectCandidateProjectionCache>,
  project: ProjectDocument,
  key: string,
  values: readonly T[],
  queries: readonly ProjectCandidateQuery[],
  catalog: Catalog,
  simulationScope: ProjectSimulationScope,
): readonly CandidateOptionProjection<T>[] {
  let projectCache = cache.get(project);
  if (projectCache === undefined) {
    projectCache = {
      evaluator: createProjectCandidateEvaluator(catalog, project, simulationScope),
      options: new Map(),
    };
    cache.set(project, projectCache);
  }
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

export function createCandidateProjectionService(
  catalog: Catalog,
  simulationScope: ProjectSimulationScope,
): CandidateProjectionService {
  const cache = new WeakMap<ProjectDocument, ProjectCandidateProjectionCache>();
  const service: CandidateProjectionService = {
    startRooms: (project, owner, rooms) =>
      projectOptions(
        cache,
        project,
        `start:${semanticAddressKey(owner)}:${domainKey(rooms.map((room) => room.gameName))}`,
        rooms,
        rooms.map((room) => ({ kind: 'startRoom', owner, gameName: room.gameName })),
        catalog,
        simulationScope,
      ),
    roomTargets: (project, target, rooms) =>
      projectOptions(
        cache,
        project,
        `target:${semanticAddressKey(target)}:${domainKey(rooms.map((room) => room.gameName))}`,
        rooms,
        rooms.map((room) => ({ kind: 'roomTarget', target, gameName: room.gameName })),
        catalog,
        simulationScope,
      ),
    batchRewardStores: (project, rewardStore, storeKeys) =>
      projectOptions(
        cache,
        project,
        `store:${semanticAddressKey(rewardStore)}:${domainKey(storeKeys)}`,
        storeKeys,
        storeKeys.map((storeKey) => ({ kind: 'batchRewardStore', rewardStore, storeKey })),
        catalog,
        simulationScope,
      ),
    incomingRewards: (project, reward, offers) =>
      projectOptions(
        cache,
        project,
        `incoming:${semanticAddressKey(reward)}:${domainKey(offers.map(offerKey))}`,
        offers,
        offers.map((value) => ({ kind: 'incomingReward', reward, value })),
        catalog,
        simulationScope,
      ),
    shopOffers: (project, offer, values) =>
      projectOptions(
        cache,
        project,
        `shop-offer:${semanticAddressKey(offer)}:${domainKey(values.map(offerKey))}`,
        values,
        values.map((value) => ({ kind: 'shopOffer', offer, value })),
        catalog,
        simulationScope,
      ),
    shopPurchases: (project, purchase, values) =>
      projectOptions(
        cache,
        project,
        `shop-purchase:${semanticAddressKey(purchase)}:${domainKey(values.map(String))}`,
        values,
        values.map((purchased) => ({ kind: 'shopPurchase', purchase, purchased })),
        catalog,
        simulationScope,
      ),
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

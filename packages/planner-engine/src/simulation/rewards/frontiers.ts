import { semanticAddressKey, type SemanticAddress } from '../../authored-project/addresses';
import type { OccurrenceAddress, ShopPurchaseAddress } from '../../authored-project/addresses';
import type { ShipCombatState, ShopState } from '../../authored-project/model';
import type { ResolvedRewardOffer } from '../../reward-kernel';
import type { SemanticFinding } from '../model';
import type { RewardSimulation } from './model';

export type RewardProducerGenerationPolicy = 'jointShopInventory' | 'jointUnordered' | 'sequential';

export interface RewardProducerCandidateResult {
  readonly findings: readonly SemanticFinding[];
  readonly supported: boolean;
}

export interface RewardProducerFrontier {
  readonly generationPolicy: RewardProducerGenerationPolicy;
  readonly generationHistorySequence: number;
  readonly reachableBranchCount: number;
  readonly acquisitionHorizon: 'generationOnly' | 'ownEnteredLifecycle';
  readonly owners: readonly SemanticAddress[];
  readonly evaluateOffer: (
    owner: SemanticAddress,
    offer: ResolvedRewardOffer,
  ) => RewardProducerCandidateResult;
}

export type RewardProducerFrontierIndex = ReadonlyMap<string, RewardProducerFrontier>;

const frontiersBySimulation = new WeakMap<RewardSimulation, RewardProducerFrontierIndex>();

export interface RoomLifecycleCandidateResult {
  readonly findings: readonly SemanticFinding[];
  readonly supported: boolean;
}

export interface ShipLifecycleCandidateContext {
  readonly origin: OccurrenceAddress;
  readonly activeWheelKeys: readonly string[];
  readonly evaluateState: (state: ShipCombatState) => RoomLifecycleCandidateResult;
}

export interface ShopPurchaseCandidateContext {
  readonly origin: OccurrenceAddress;
  readonly purchaseOrigins: readonly ShopPurchaseAddress[];
  readonly evaluateState: (state: ShopState) => RoomLifecycleCandidateResult;
}

export interface RoomLifecycleCandidateContextIndex {
  readonly shipsByOwner: ReadonlyMap<string, ShipLifecycleCandidateContext>;
  readonly shopsByOwner: ReadonlyMap<string, ShopPurchaseCandidateContext>;
}

const lifecycleContextsBySimulation = new WeakMap<
  RewardSimulation,
  RoomLifecycleCandidateContextIndex
>();

export function indexRewardProducerFrontier(
  index: Map<string, RewardProducerFrontier>,
  frontier: RewardProducerFrontier,
): void {
  for (const owner of frontier.owners) {
    const key = semanticAddressKey(owner);
    if (index.has(key)) {
      throw new Error(`reward producer frontier already owns ${key}`);
    }
    index.set(key, frontier);
  }
}

export function registerRewardProducerFrontiers(
  simulation: RewardSimulation,
  index: Map<string, RewardProducerFrontier>,
): void {
  frontiersBySimulation.set(simulation, new Map(index));
}

export function rewardProducerFrontier(
  simulation: RewardSimulation,
  owner: SemanticAddress,
): RewardProducerFrontier | undefined {
  return frontiersBySimulation.get(simulation)?.get(semanticAddressKey(owner));
}

export function registerRoomLifecycleCandidateContexts(
  simulation: RewardSimulation,
  contexts: RoomLifecycleCandidateContextIndex,
): void {
  lifecycleContextsBySimulation.set(simulation, {
    shipsByOwner: new Map(contexts.shipsByOwner),
    shopsByOwner: new Map(contexts.shopsByOwner),
  });
}

export function roomLifecycleCandidateContexts(
  simulation: RewardSimulation,
): RoomLifecycleCandidateContextIndex {
  const contexts = lifecycleContextsBySimulation.get(simulation);
  if (contexts === undefined) {
    throw new Error(`reward simulation for ${simulation.biomeKey} has no lifecycle contexts`);
  }
  return contexts;
}

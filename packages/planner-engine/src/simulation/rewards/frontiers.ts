import { semanticAddressKey, type SemanticAddress } from '../../authored-project/addresses';
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

import {
  semanticAddressKey,
  type IncomingRewardAddress,
  type AcquisitionEntryAddress,
  type LocalRewardAddress,
  type RewardWheelOfferAddress,
  type ShopOfferAddress,
} from '../../authored-project/addresses';
import type { ResolvedRewardOffer } from '../../reward-kernel';
import type { SemanticFinding } from '../model';

export type RewardProducerGenerationPolicy = 'jointShopInventory' | 'jointUnordered' | 'sequential';

export interface RewardProducerCandidateResult {
  readonly findings: readonly SemanticFinding[];
  readonly supported: boolean;
}

export type RewardProducerOwnerAddress =
  | IncomingRewardAddress
  | LocalRewardAddress
  | RewardWheelOfferAddress
  | ShopOfferAddress
  | AcquisitionEntryAddress;

export interface RewardProducerCandidateCapability {
  /** The farthest lifecycle point candidate evaluation is allowed to model. */
  readonly acquisitionHorizon: 'generationOnly' | 'ownEnteredLifecycle';
  readonly resolvedStoreKey?: string;
  readonly evaluateOffer: (
    owner: RewardProducerOwnerAddress,
    offer: ResolvedRewardOffer,
  ) => RewardProducerCandidateResult;
}

export interface RewardProducerFrontier extends RewardProducerCandidateCapability {
  readonly generationPolicy: RewardProducerGenerationPolicy;
  readonly generationHistorySequence: number;
  readonly reachableBranchCount: number;
  readonly acquisitionHorizon: 'generationOnly' | 'ownEnteredLifecycle';
  readonly owners: readonly RewardProducerOwnerAddress[];
}

/**
 * Opaque reward-producer capability from one exact reward evaluation.
 *
 * The mutable construction index stays private. Candidate evaluation can ask
 * only for the exact semantic owner it is evaluating.
 */
export interface RewardProducerCandidateArtifacts {
  readonly at: (owner: RewardProducerOwnerAddress) => RewardProducerCandidateCapability | undefined;
}

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

export function createRewardProducerCandidateArtifacts(
  frontiers: ReadonlyMap<string, RewardProducerFrontier>,
): RewardProducerCandidateArtifacts {
  const privateFrontiers = new Map<string, RewardProducerCandidateCapability>();
  for (const [key, frontier] of frontiers) {
    privateFrontiers.set(
      key,
      Object.freeze({
        acquisitionHorizon: frontier.acquisitionHorizon,
        evaluateOffer: frontier.evaluateOffer,
        ...(frontier.resolvedStoreKey === undefined
          ? {}
          : { resolvedStoreKey: frontier.resolvedStoreKey }),
      }),
    );
  }
  return Object.freeze({
    at: (owner: RewardProducerOwnerAddress) => privateFrontiers.get(semanticAddressKey(owner)),
  });
}

export function createEmptyRewardProducerCandidateArtifacts(): RewardProducerCandidateArtifacts {
  return createRewardProducerCandidateArtifacts(new Map());
}

import {
  semanticAddressKey,
  type IncomingRewardAddress,
  type AcquisitionEntryAddress,
  type LocalRewardAddress,
  type RewardWheelOfferAddress,
  type ShopOfferAddress,
  type StartingRewardAddress,
} from '../../authored-project/addresses';
import type { ResolvedRewardOffer } from '../../reward-kernel';
import type { ShopOptionSelection, ShopSlotAssessment } from '../../reward-kernel';
import type { SemanticFinding } from '../model';
import type { FindingRegionEntry } from '../finding-regions';
import {
  staticRewardOfferExclusion,
  type RewardOfferExclusionEvidence,
  type RewardOfferExclusionReason,
} from './offer-exclusions';

export type RewardProducerGenerationPolicy = 'jointShopInventory' | 'jointUnordered' | 'sequential';

export interface RewardProducerCandidateResult {
  readonly findings: readonly SemanticFinding[];
  readonly supported: boolean;
  /** Why the offer is impossible; present only when unsupported and explained. */
  readonly exclusions?: readonly RewardOfferExclusionEvidence[];
}

/** Freezes the only public result shape produced by an exact offer frontier. */
export function createRewardProducerCandidateResult(
  findings: ReadonlyMap<string, FindingRegionEntry>,
  branches: readonly unknown[],
  exclusions?: readonly RewardOfferExclusionEvidence[],
): RewardProducerCandidateResult {
  const supported = branches.length > 0;
  return Object.freeze({
    findings: Object.freeze([...findings.values()].map((entry) => entry.finding)),
    supported,
    ...(supported || exclusions === undefined ? {} : { exclusions }),
  });
}

/** An unsupported result whose producer statically rules the offer out. */
export function staticallyExcludedCandidateResult(
  reason: RewardOfferExclusionReason,
): RewardProducerCandidateResult {
  return Object.freeze({
    findings: Object.freeze([]),
    supported: false,
    exclusions: staticRewardOfferExclusion(reason),
  });
}

export type RewardProducerOwnerAddress =
  | IncomingRewardAddress
  | LocalRewardAddress
  | RewardWheelOfferAddress
  | ShopOfferAddress
  | AcquisitionEntryAddress
  | StartingRewardAddress;

export interface RewardProducerCandidateCapability {
  /** Reached generation contact, when backed by a captured producer frontier. */
  readonly generationHistorySequence?: number;
  /** The farthest lifecycle point candidate evaluation is allowed to model. */
  readonly acquisitionHorizon: 'generationOnly' | 'ownEnteredLifecycle';
  readonly resolvedStoreKey?: string;
  readonly evaluateOffer: (
    owner: RewardProducerOwnerAddress,
    offer: ResolvedRewardOffer,
  ) => RewardProducerCandidateResult;
  readonly evaluateShopOption?: (
    owner: ShopOfferAddress,
    selection: ShopOptionSelection,
  ) => RewardProducerCandidateResult;
  /** Reached inventory standing of one declared Shop slot. */
  readonly shopSlotAssessment?: (owner: ShopOfferAddress) => ShopSlotAssessment | undefined;
}

export interface RewardProducerFrontier extends Omit<
  RewardProducerCandidateCapability,
  'evaluateOffer'
> {
  /**
   * Evaluates an offer whose own acquisition is modelled only at contacts the
   * published attempt reached: those at or before `reachedThrough`.
   */
  readonly evaluateOffer: (
    owner: RewardProducerOwnerAddress,
    offer: ResolvedRewardOffer,
    reachedThrough: number,
  ) => RewardProducerCandidateResult;
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
  reachedThrough = Number.POSITIVE_INFINITY,
): RewardProducerCandidateArtifacts {
  const privateFrontiers = new Map<string, RewardProducerCandidateCapability>();
  for (const [key, frontier] of frontiers) {
    privateFrontiers.set(
      key,
      Object.freeze({
        generationHistorySequence: frontier.generationHistorySequence,
        acquisitionHorizon: frontier.acquisitionHorizon,
        evaluateOffer: (owner: RewardProducerOwnerAddress, offer: ResolvedRewardOffer) =>
          frontier.evaluateOffer(owner, offer, reachedThrough),
        ...(frontier.evaluateShopOption === undefined
          ? {}
          : { evaluateShopOption: frontier.evaluateShopOption }),
        ...(frontier.shopSlotAssessment === undefined
          ? {}
          : { shopSlotAssessment: frontier.shopSlotAssessment }),
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

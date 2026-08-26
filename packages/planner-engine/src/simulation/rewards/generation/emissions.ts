import type { FindingRegionEntry } from '../../finding-regions';
import type {
  ResolvedRewardOffer,
  RewardHistoryState,
  RewardKernelFacts,
} from '../../../reward-kernel';
import type { CanonicalAuthoredRoom, CanonicalResolvedIncomingReward } from '../../materialization';
import type { RoomDeclaration } from '../../../catalog-schema';
import type { OfferProcessingContext, OfferProcessingPeer } from '../processing';
import type { RewardBranchState } from '../branch-primitives';
import type { RewardProducerFrontier } from '../producer-frontiers';
import type {
  AcquisitionRoleFrontier,
  DerivedAcquisitionEntryFrontier,
} from '../acquisition-settlement';
import type { ReachedTraitChildCheckpoint } from '../trait-settlement';
import type { HistoryStateView } from '../../history';
import type { CanonicalLifecycleRoom } from '../../history/lifecycleInput';
import type { RunStateOwner } from '../run-state';
import type { TargetAddress } from '../../../authored-project/addresses';

export interface RuntimeOfferFallbackEmission {
  readonly address: import('../../../authored-project/addresses').SemanticAddress;
  readonly preferredRewardType: string;
  readonly fallbackRewardType: string;
}

/** Complete non-branch emissions from one authored acquisition-site settlement. */
export interface AuthoredSiteSettlementEmissions {
  readonly acquisitionRoleFrontiers: readonly AcquisitionRoleFrontier[];
  readonly derivedEntryFrontiers: readonly DerivedAcquisitionEntryFrontier[];
  readonly traitChildSettlements: readonly ReachedTraitChildCheckpoint[];
  readonly runtimeOfferFallbacks: readonly RuntimeOfferFallbackEmission[];
  readonly findings: readonly FindingRegionEntry[];
}

export interface RunStateCheckpointEmission {
  readonly owner: RunStateOwner;
  readonly source: CanonicalLifecycleRoom;
  readonly view: HistoryStateView;
  readonly branches: readonly RewardBranchState[];
}

export interface TargetHistoryCheckpointEmission {
  readonly origin: TargetAddress;
  readonly historySequence: number;
  readonly branches: readonly RewardBranchState[];
}

export function createAuthoredSiteSettlementEmissions(input: {
  readonly acquisitionRoleFrontiers?: readonly AcquisitionRoleFrontier[];
  readonly derivedEntryFrontiers?: readonly DerivedAcquisitionEntryFrontier[];
  readonly traitChildSettlements?: readonly ReachedTraitChildCheckpoint[];
  readonly runtimeOfferFallbacks?: readonly RuntimeOfferFallbackEmission[];
  readonly findings: ReadonlyMap<string, FindingRegionEntry>;
}): AuthoredSiteSettlementEmissions {
  return Object.freeze({
    acquisitionRoleFrontiers: Object.freeze(input.acquisitionRoleFrontiers ?? []),
    derivedEntryFrontiers: Object.freeze(input.derivedEntryFrontiers ?? []),
    traitChildSettlements: Object.freeze(input.traitChildSettlements ?? []),
    runtimeOfferFallbacks: Object.freeze(
      (input.runtimeOfferFallbacks ?? []).map((fallback) => Object.freeze({ ...fallback })),
    ),
    findings: Object.freeze([...input.findings.values()]),
  });
}

export interface ResolvedHubBoardGenerationParticipant {
  readonly kind: 'resolved';
  readonly context: OfferProcessingContext;
  readonly incoming: CanonicalResolvedIncomingReward;
}

export interface UnresolvedHubBoardGenerationParticipant {
  readonly kind: 'unresolved';
  readonly declaration: RoomDeclaration;
  readonly incoming: NonNullable<CanonicalAuthoredRoom['unresolvedIncomingReward']>;
  readonly historySequence: number;
  readonly facts: (history: RewardHistoryState) => RewardKernelFacts;
  readonly candidateFor: (offer: ResolvedRewardOffer) => CanonicalResolvedIncomingReward;
}

export type HubBoardGenerationParticipant =
  ResolvedHubBoardGenerationParticipant | UnresolvedHubBoardGenerationParticipant;

export interface PendingHubBoardGeneration {
  readonly frontierBranches: readonly RewardBranchState[];
  readonly participants: readonly HubBoardGenerationParticipant[];
}

/** One room-generation event's complete immutable mutations for the coordinator. */
export interface GenerationEmissions {
  readonly branches: readonly RewardBranchState[];
  readonly peers: readonly OfferProcessingPeer[];
  readonly findings: readonly FindingRegionEntry[];
  readonly producerFrontiers: readonly RewardProducerFrontier[];
  readonly pendingHubBoard?: PendingHubBoardGeneration;
}

export function createGenerationEmissions(
  branches: readonly RewardBranchState[],
  peers: readonly OfferProcessingPeer[],
  findings: ReadonlyMap<string, FindingRegionEntry>,
  producerFrontiers: readonly RewardProducerFrontier[],
  pendingHubBoard?: PendingHubBoardGeneration,
): GenerationEmissions {
  return Object.freeze({
    branches: Object.freeze(branches),
    peers: Object.freeze(peers),
    findings: Object.freeze([...findings.values()]),
    producerFrontiers: Object.freeze(producerFrontiers),
    ...(pendingHubBoard === undefined ? {} : { pendingHubBoard }),
  });
}

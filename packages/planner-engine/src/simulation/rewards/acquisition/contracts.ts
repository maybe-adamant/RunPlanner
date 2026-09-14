import type {
  AcquisitionEntryAddress,
  AcquisitionSiteAddress,
  AcquisitionSiteOwnerAddress,
  SemanticAddress,
} from '../../../authored-project/addresses';
import type { AuthoredRewardState } from '../../../authored-project/model';
import type {
  ConcreteAcquisitionEvent,
  ProducerLifecyclePointKey,
  ResolvedRewardOffer,
  RewardHistoryState,
  RewardKernelFacts,
} from '../../../reward-kernel';
import type { FindingRegionEntry } from '../../finding-regions';
import type { CanonicalAuthoredRoom, CanonicalLocalVisitRoom } from '../../materialization';
import type { RewardBranchState } from '../branch-primitives';
import type {
  PriorTraitMutation,
  ReachedTraitChildCheckpoint,
  ReachedTraitOfferCandidateContact,
} from '../trait-settlement/coordinator';
import type { AcquisitionSource } from './source';

export type CanonicalRewardRoom = CanonicalAuthoredRoom | CanonicalLocalVisitRoom;

/**
 * The complete result of one reached mandatory producer acquisition site.
 * Participation and order are derived; optional entries can extend the same
 * history fold without changing its chronology authority.
 */
export interface AcquisitionSettlementProduct {
  readonly site: AcquisitionSiteAddress;
  readonly entries: readonly AcquisitionSettlementEntry[];
  readonly branches: readonly RewardBranchState[];
  /** Ordered findings emitted while this site and its composed children settled. */
  readonly findingEmissions: readonly FindingRegionEntry[];
  /**
   * Exact pre-entry histories captured by one canonical ordered optional-pickup
   * settlement. Candidate artifacts consume these products; they never replay
   * the real settlement merely to rediscover an entry frontier.
   */
  readonly pickupEntryFrontiers?: readonly PickupAcquisitionEntryFrontier[];
  /** Exact pre-role branch products from the canonical settlement fold. */
  readonly roleFrontiers?: readonly AcquisitionRoleFrontier[];
  /** Reached derived entry whose authored child is not part of the site's order. */
  readonly derivedEntryFrontiers?: readonly DerivedAcquisitionEntryFrontier[];
  /** Exact post-outer checkpoints for reached trait children that block chronology. */
  readonly traitChildSettlements?: readonly ReachedTraitChildCheckpoint[];
  /** Exact same-room owner barriers resolved by this acquisition settlement. */
  readonly timelineFacts?: import('../../timeline-facts').PlannerTimelineFacts;
}

/** Complete output of one ordered producer-role fold. */
export interface ProducerRoleSettlementProduct {
  readonly branches: readonly RewardBranchState[];
  /**
   * Ordered, deduplicated finding entries emitted by this fold, including
   * recursive Artificer replacement settlement.
   */
  readonly findingEmissions: readonly FindingRegionEntry[];
  readonly roleFrontiers: readonly AcquisitionRoleFrontier[];
  readonly traitChildSettlements: readonly ReachedTraitChildCheckpoint[];
}

export interface DerivedAcquisitionEntryFrontier {
  readonly address: AcquisitionEntryAddress;
  readonly kind:
    | 'echoDoubleShopPlaceholder'
    | 'echoDoubleShopReward'
    | 'echoLastReward'
    | 'acquisitionResolvedReward'
    | 'hermesShrineDelivery'
    | 'clockedTraitPickup'
    | 'travelDealPlaceholder'
    | 'travelDealRefill';
  readonly branchCohortSize: number;
  readonly sourceOfferKey?: string;
  readonly slotIndex?: number;
  /** Exact declaration families with at least one supported resolved offer on this branch. */
  readonly rewardTypes?: readonly string[];
  /** Exact engine-derived state when the source offer is copied without fresh payload resolution. */
  readonly fixedReward?: AuthoredRewardState;
  readonly producerLifecycleKey?: string;
  /** Exact encounter end that matured a cross-occurrence Shrine delivery. */
  readonly encounterPhaseKey?: string;
  readonly participation?: 'optional';
  /** The retained authored identity disagrees with this exact derived source. */
  readonly retainedSourceMismatch?: boolean;
  /** Candidate support for editing the exact derived reward before participation is selected. */
  readonly roleFrontiers?: readonly AcquisitionRoleFrontier[];
  /** Paid entries that can source a first-eligible derived child in this Shop. */
  readonly eligibleSourceOfferKeys?: readonly string[];
  readonly branchesBeforeEntry: readonly RewardBranchState[];
  readonly evaluateOffer?: (
    offer: ResolvedRewardOffer,
  ) => import('../producer-frontiers').RewardProducerCandidateResult;
}

export interface AcquisitionRoleFrontier {
  readonly address: import('../../../authored-project/addresses').AcquisitionRoleAddress;
  /** Exact active Room Action that reached this role, when it is consequential. */
  readonly timelineOwner?: SemanticAddress;
  readonly branchesBeforeRole: readonly RewardBranchState[];
  /**
   * Concrete materialization produced by this role when its outer RoomReward
   * was forfeited. The array follows branchesBeforeRole and is absent for
   * roles with no realized substitution.
   */
  readonly realizedAcquisitionByBranch?: readonly (ConcreteAcquisitionEvent | undefined)[];
  readonly source: AcquisitionSource;
  readonly lifecyclePoint: ProducerLifecyclePointKey;
  readonly historySequence: number;
  readonly settlement: {
    readonly site: AcquisitionSiteAddress;
    readonly entry: AcquisitionEntryAddress;
  };
  /** Exact generated child owner used by the ordinary trait/Pom candidate machinery. */
  readonly artificerReplacementAddress: AcquisitionEntryAddress;
  readonly artificerReplacementOptions?: readonly AuthoredRewardState[];
  readonly artificerReplacementCandidate?: {
    readonly rewardTypes: readonly string[];
    readonly evaluateOffer: (
      offer: ResolvedRewardOffer,
    ) => import('../producer-frontiers').RewardProducerCandidateResult;
  };
  readonly blocksArtificerConversion?: true;
  /** Immediate same-occurrence mutation prefix supplied by trait settlement. */
  readonly priorTraitMutations?: readonly PriorTraitMutation[];
  /** Exact pre-offer contacts reached while this acquisition role was settled. */
  readonly traitOfferCandidateContacts?: readonly ReachedTraitOfferCandidateContact[];
}

export interface PickupAcquisitionEntryFrontier {
  readonly address: AcquisitionEntryAddress;
  readonly reward: AuthoredRewardState | null;
  readonly branchesBeforeEntry: readonly RewardBranchState[];
}

export interface AcquisitionSettlementEntry {
  readonly address: AcquisitionEntryAddress;
  readonly source: SemanticAddress;
  /** One atomic entry may apply several declaration-owned roles in sequence. */
  readonly acquisitionRoles: readonly AcquisitionSettlementRole[];
  readonly participation: 'mandatory' | 'optional' | 'dormant';
}

export interface AcquisitionSettlementRole {
  readonly role: string;
  readonly lifecyclePoint: ProducerLifecyclePointKey;
  readonly blocksArtificerConversion?: true;
}

export interface OwnedAcquisitionSettlementRequest {
  readonly siteOwner: AcquisitionSiteOwnerAddress;
  readonly pointKey: string;
  readonly entryKey: string;
  readonly source: AcquisitionSource;
  /** Exact active Room Action owner supplied by the reached transition. */
  readonly timelineOwner?: SemanticAddress;
  readonly historySequence: number;
  readonly roleBindings?: readonly AcquisitionSettlementRole[];
  /** Exact peer branches used to attest one directly selected trait screen. */
  readonly directTraitAgreementBranches?: readonly RewardBranchState[];
  /** Exact authored Sea Star result sites whose source frontier must be retained. */
  readonly authoredSeaStarDuplicateSiteKeys?: ReadonlySet<string>;
  /** Ordered sites publish a distinct dependent action instead of settling immediately. */
  readonly deferArtificerReplacement?: boolean;
}

export interface AcquisitionRoleResolution extends AcquisitionSettlementRole {
  readonly historySequence: number;
}

export type RewardFactsFactory = (
  history: RewardHistoryState,
  currentRoomShopOptionNames?: ReadonlySet<string>,
  branch?: RewardBranchState,
) => RewardKernelFacts;

import type { RequiredRoomObjectDescriptor, RoomCounterEffects } from '../../catalog-schema';
import type {
  AdditionalExitAddress,
  BatchRewardStoreAddress,
  ExitDecisionAddress,
  ExitDecisionSourceAddress,
  ExitSelectionAddress,
  HubDecisionAddress,
  HubOpenSetAddress,
  HubRoomAddress,
  HubSlotAddress,
  HubVisitAddress,
  IncomingRewardAddress,
  LocalVisitSlotAddress,
  LocalRewardAddress,
  OccurrenceAddress,
  RewardWheelAddress,
  RewardWheelOfferAddress,
  ShopOfferAddress,
  TargetAddress,
} from '../../authored-project/addresses';
import type {
  OccurrenceId,
  RoomActionState,
  RoomEncounterState,
} from '../../authored-project/model';
import type { AuthoredLevelResolution, AuthoredTraitOffer } from '../../authored-project/traits';
import type { TraitOfferContext } from '../trait-offers';
import type { ResolvedRewardOffer } from '../../reward-kernel/model';
import type { ResolvedEncounterPhase } from '../encounters';

export interface CanonicalResolvedIncomingReward {
  readonly origin: IncomingRewardAddress | LocalRewardAddress;
  readonly kind: 'resolved';
  readonly producerKind: 'countedChoice' | 'fixed' | 'freeReward' | 'shop';
  /** Concrete source provenance is required by acquisition effects such as Time Piece. */
  readonly instanceProvenance: 'free' | 'paid';
  readonly producerLifecycleKey: string;
  readonly offer: ResolvedRewardOffer;
  readonly traitOffersByAcquisitionRole?: Readonly<Record<string, AuthoredTraitOffer | null>>;
  readonly levelResolutionsByAcquisitionRole?:
    Readonly<Record<string, AuthoredLevelResolution>> | undefined;
  readonly dispositionByAcquisitionRole?: import('../../authored-project/model').AuthoredRewardState['dispositionByAcquisitionRole'];
  readonly traitContext?: TraitOfferContext;
  readonly resolvedStoreKey?: string;
  /**
   * An Anomaly always creates and consumes its retained offer. Its authored
   * outcome alone decides whether the ordinary reward producer reaches an
   * acquisition point during the entered lifecycle.
   */
  readonly acquisitionEnabled?: boolean;
}

export interface CanonicalShopOffer {
  readonly offerKey: string;
  readonly offerOrigin: ShopOfferAddress;
  readonly offer: ResolvedRewardOffer;
  readonly traitOffersByAcquisitionRole?: Readonly<Record<string, AuthoredTraitOffer | null>>;
  readonly levelResolutionsByAcquisitionRole?:
    Readonly<Record<string, AuthoredLevelResolution>> | undefined;
  readonly dispositionByAcquisitionRole?: import('../../authored-project/model').AuthoredRewardState['dispositionByAcquisitionRole'];
  readonly traitContext?: TraitOfferContext;
}

export interface CanonicalShopEntryState {
  readonly kind: 'shop';
  readonly profileKey: string;
  readonly offers: readonly CanonicalShopOffer[];
  readonly unresolvedOffers: readonly {
    readonly offerKey: string;
    readonly offerOrigin: ShopOfferAddress;
  }[];
}

export interface CanonicalLocalReward {
  readonly origin: LocalRewardAddress;
  readonly groupKey: string;
  readonly slotKey: string;
  readonly encounterPhaseKey: string;
  readonly producerLifecycleKey: string;
  readonly offer: ResolvedRewardOffer;
  readonly traitOffersByAcquisitionRole?: Readonly<Record<string, AuthoredTraitOffer | null>>;
  readonly levelResolutionsByAcquisitionRole?:
    Readonly<Record<string, AuthoredLevelResolution>> | undefined;
  readonly dispositionByAcquisitionRole?: import('../../authored-project/model').AuthoredRewardState['dispositionByAcquisitionRole'];
  readonly traitContext?: TraitOfferContext;
  readonly resolvedStoreKey: string;
}

/** One entry-generated Fields pickup, independent of cage encounter rewards. */
export interface CanonicalFieldsOptionalReward {
  readonly origin: LocalRewardAddress;
  readonly groupKey: 'optionalRewards';
  readonly slotKey: string;
  readonly producerLifecycleKey: string;
  readonly offer: ResolvedRewardOffer;
  readonly traitOffersByAcquisitionRole?: Readonly<Record<string, AuthoredTraitOffer | null>>;
  readonly levelResolutionsByAcquisitionRole?:
    Readonly<Record<string, AuthoredLevelResolution>> | undefined;
  readonly dispositionByAcquisitionRole?: import('../../authored-project/model').AuthoredRewardState['dispositionByAcquisitionRole'];
  readonly traitContext?: TraitOfferContext;
  readonly resolvedStoreKey: 'FieldsOptionalRewards';
}

export interface CanonicalRewardWheelOffer {
  readonly origin: RewardWheelOfferAddress;
  readonly offerKey: string;
  readonly offer: ResolvedRewardOffer;
  readonly traitOffersByAcquisitionRole?: Readonly<Record<string, AuthoredTraitOffer | null>>;
  readonly levelResolutionsByAcquisitionRole?:
    Readonly<Record<string, AuthoredLevelResolution>> | undefined;
  readonly dispositionByAcquisitionRole?: import('../../authored-project/model').AuthoredRewardState['dispositionByAcquisitionRole'];
  readonly traitContext?: TraitOfferContext;
  readonly picked: boolean;
}

export interface CanonicalRewardWheel {
  readonly origin: RewardWheelAddress;
  readonly wheelKey: string;
  readonly encounterPhaseKey: string;
  readonly producerLifecycleKey: string;
  readonly storeKey: string;
  readonly offers: readonly CanonicalRewardWheelOffer[];
  readonly unresolvedOffers: readonly {
    readonly origin: RewardWheelOfferAddress;
    readonly offerKey: string;
    readonly picked: boolean;
  }[];
  readonly pickedOfferIndex: number;
}

export interface CanonicalAuthoredRoom {
  readonly kind: 'authored';
  readonly origin: OccurrenceAddress;
  readonly occurrenceId: OccurrenceId;
  readonly gameName: string;
  /**
   * An Anomaly replacement still evaluates the normal G target it displaced.
   * Keep that authored provenance on the canonical room rather than asking a
   * later simulation stage to rediscover topology ownership from a game name.
   */
  readonly anomalyReplacement?: { readonly replacedRoomGameName: string };
  readonly encounters: RoomEncounterState;
  readonly encounterEnvelopeKey: string;
  readonly encounterPhases: readonly ResolvedEncounterPhase[];
  readonly lifecycleProfileKey: string;
  readonly counterEffects: RoomCounterEffects;
  readonly entered: boolean;
  /** Declaration-fixed automatic rooms inherit selected Preboss reward-store provenance. */
  readonly enteredRewardStoreKey?: string;
  /** Persisted occurrence chronology and its sole derived roster product. */
  readonly roomActions: RoomActionState;
  /** Exact optional Postboss rack state remains owned by its automatic occurrence. */
  readonly keepsakeRack?: NonNullable<
    import('../../authored-project/model').RoomOccurrence['keepsakeRack']
  >;
  /** The exact realized Pool list remains occurrence-owned through simulation. */
  readonly purgingPool?: NonNullable<
    import('../../authored-project/model').RoomOccurrence['purgingPool']
  >;
  /** Entry-time Shrine inventory participates in outgoing exclusions, never Shop settlement. */
  readonly hermesShrine?: NonNullable<
    import('../../authored-project/model').RoomOccurrence['hermesShrine']
  >;
  readonly stygianWell?: NonNullable<
    import('../../authored-project/model').RoomOccurrence['stygianWell']
  >;
  readonly roomActionRoster: import('../room-actions').RoomActionRoster;
  readonly roomLifecycleTimeline: import('../room-actions').RoomLifecycleTimeline;
  readonly requiredObjects?: readonly RequiredRoomObjectDescriptor[];
  readonly clockworkReward?: 'goal' | 'nonGoal';
  readonly incomingReward?: CanonicalResolvedIncomingReward;
  readonly unresolvedIncomingReward?: Omit<
    CanonicalResolvedIncomingReward,
    | 'kind'
    | 'offer'
    | 'traitOffersByAcquisitionRole'
    | 'levelResolutionsByAcquisitionRole'
    | 'dispositionByAcquisitionRole'
    | 'traitContext'
  >;
  readonly localRewards?: readonly CanonicalLocalReward[];
  readonly unresolvedLocalRewards?: readonly Omit<
    CanonicalLocalReward,
    | 'offer'
    | 'traitOffersByAcquisitionRole'
    | 'levelResolutionsByAcquisitionRole'
    | 'dispositionByAcquisitionRole'
    | 'traitContext'
  >[];
  readonly fieldsOptionalRewards?: readonly CanonicalFieldsOptionalReward[];
  /** Persisted Fields count, retained independently from resolved optional leaves. */
  readonly fieldsOptionalRewardCount?: number;
  readonly unresolvedFieldsOptionalRewards?: readonly Omit<
    CanonicalFieldsOptionalReward,
    | 'offer'
    | 'traitOffersByAcquisitionRole'
    | 'levelResolutionsByAcquisitionRole'
    | 'dispositionByAcquisitionRole'
    | 'traitContext'
  >[];
  readonly rewardWheels?: readonly CanonicalRewardWheel[];
  readonly entryState?: CanonicalShopEntryState;
  /** Active producer instances feeding the shared acquisition-site pipeline. */
  readonly pickupProducers?: readonly import('../../authored-project/pickup-producers').SelectedPickupProducer[];
  /** Every exact persisted acquisition site; chronology addresses site and entry independently. */
  readonly acquisitionSites: Readonly<
    Record<
      string,
      {
        readonly address: import('../../authored-project/addresses').AcquisitionSiteAddress;
        readonly entries: Readonly<
          Record<string, import('../../authored-project/model').AuthoredRewardState | null>
        >;
      }
    >
  >;
}

export interface CanonicalHubRoom {
  readonly kind: 'hub';
  readonly origin: HubRoomAddress;
  readonly gameName: string;
  readonly encounterEnvelopeKey: string;
  readonly encounterPhases: readonly ResolvedEncounterPhase[];
  readonly lifecycleProfileKey: string;
  readonly counterEffects: RoomCounterEffects;
  readonly entered: true;
}

/** An ordinary authored occurrence reached through parent-local topology. */
export interface CanonicalLocalVisitRoom extends CanonicalAuthoredRoom {
  readonly localVisit: {
    readonly origin: LocalVisitSlotAddress;
    readonly groupKey: string;
    readonly slotKey: string;
    readonly physicalDoorId: number;
    readonly availabilityRank: number;
    readonly generation: 'generated' | 'notGenerated';
    readonly enteredOrdinal: number | null;
  };
}

export type CanonicalRoom = CanonicalAuthoredRoom;

export interface CanonicalRoomReference {
  readonly origin: OccurrenceAddress;
  readonly occurrenceId: OccurrenceId;
  readonly gameName: string;
}

export interface CanonicalHubRoomReference {
  readonly origin: HubRoomAddress;
  readonly gameName: string;
}

export type CanonicalDecisionParent = CanonicalRoomReference | CanonicalHubRoomReference;

export type CanonicalPhysicalExit =
  | {
      readonly kind: 'available';
      readonly exitKey: string;
      readonly index: number;
      readonly type: string;
      readonly compatibilityPolicyKey: string;
    }
  | { readonly kind: 'unavailable'; readonly exitKey: string; readonly index: number };

export type CanonicalTargetContinuation = 'continuesSpine' | 'deadLeaf' | 'startsCompletion';

export interface CanonicalTarget {
  readonly origin: TargetAddress;
  readonly exit: CanonicalPhysicalExit;
  readonly picked: boolean;
  readonly continuation: CanonicalTargetContinuation;
  readonly room: CanonicalAuthoredRoom;
}

/**
 * A closed, entry-time sibling continuation. It intentionally has its own
 * semantic owner rather than borrowing a normal-door target address: the
 * source still generates its complete normal batch at the later outgoing
 * checkpoint, while this room is created when the entered source exposes the
 * contract.
 */
export interface CanonicalAdditionalContinuation {
  readonly origin: AdditionalExitAddress;
  readonly key: 'zagreusContract' | 'naturalChaos' | 'sparkChaos';
  readonly picked: boolean;
  readonly room: CanonicalAuthoredRoom;
}

export type CanonicalSelectedBatchContinuation =
  | { readonly kind: 'normal'; readonly target: CanonicalTarget }
  | { readonly kind: 'additional'; readonly continuation: CanonicalAdditionalContinuation };

export type CanonicalBatchRewardStore =
  | {
      readonly origin: BatchRewardStoreAddress;
      readonly kind: 'authoredBaseStore';
      readonly baseRewardStoreKey: string;
    }
  | { readonly origin: BatchRewardStoreAddress; readonly kind: 'sourceOfferPoint' }
  | { readonly origin: BatchRewardStoreAddress; readonly kind: 'none' };

export type CanonicalBatchState =
  | { readonly kind: 'standard' }
  | {
      readonly kind: 'clockwork';
      readonly goalsRemaining: number;
      readonly nonGoalRewardsAcquired: number;
      readonly maxNonGoalRewards: number;
    }
  | {
      readonly kind: 'fields';
      readonly cageOutcome: 'min' | 'max';
      readonly batchCapacity: number;
      readonly cageTargetCount: number;
      readonly doorCageRewardCount: number;
    };

export interface CanonicalBatch {
  readonly kind: 'batch';
  readonly origin: ExitDecisionAddress;
  readonly source: ExitDecisionSourceAddress;
  readonly parent: CanonicalDecisionParent;
  readonly rewardStore: CanonicalBatchRewardStore;
  /** Final shared store after declaration-owned forced stores run in physical order. */
  readonly resolvedSharedRewardStoreKey?: string;
  readonly batchState: CanonicalBatchState;
  readonly targets: readonly CanonicalTarget[];
  readonly additional: readonly CanonicalAdditionalContinuation[];
  /**
   * A materialized prefix may have generated its physical doors before an
   * authored selection exists. Complete batches always carry a concrete key.
   */
  readonly selectedExitKey: string | null;
  readonly selectedOrigin: ExitSelectionAddress;
}

export interface CanonicalHubTarget {
  readonly origin: HubSlotAddress;
  readonly hubSlotKey: string;
  readonly physicalDoorId: number;
  readonly room: CanonicalAuthoredRoom;
}

export interface CanonicalHubBoard {
  readonly origin: HubOpenSetAddress;
  readonly room: CanonicalHubRoom;
  readonly targets: readonly CanonicalHubTarget[];
}

export interface CanonicalRoomRestore {
  readonly kind: 'restore';
  readonly after: HubVisitAddress | LocalVisitSlotAddress;
  readonly room: CanonicalHubRoomReference | CanonicalRoomReference;
}

export interface CanonicalHubVisit {
  readonly origin: HubVisitAddress;
  readonly visitIndex: number;
  readonly target: CanonicalHubTarget;
  readonly localSlots: readonly CanonicalLocalVisitRoom[];
  readonly enteredLocalRooms: readonly CanonicalLocalVisitRoom[];
  readonly parentRestores: readonly CanonicalRoomRestore[];
  readonly hubRestore: CanonicalRoomRestore;
}

export interface CanonicalHubDecision {
  readonly kind: 'hub';
  readonly origin: HubDecisionAddress;
  /** Exact authored occurrence replaced by this persistent Hub decision. */
  readonly source: CanonicalRoomReference;
  readonly room: CanonicalHubRoom;
  readonly board: CanonicalHubBoard;
  readonly visits: readonly CanonicalHubVisit[];
}

export type CanonicalDecision = CanonicalBatch | CanonicalHubDecision;

export type CanonicalBiomeState = Readonly<Record<string, boolean | number | string>>;

export interface CanonicalBiome {
  readonly kind: 'biome';
  readonly routeKey: string;
  readonly biomeKey: string;
  readonly entryRoom: CanonicalAuthoredRoom;
  readonly decisions: readonly CanonicalDecision[];
  readonly automaticRooms: readonly CanonicalAuthoredRoom[];
  readonly biomeState: CanonicalBiomeState;
  readonly echoKeepsakeReplayResults?: Pick<
    import('../../authored-project/model').AuthoredKeepsakeEquipResults,
    'experimentalHammer'
  >;
}

export interface MaterializedExitDecisionFrontier {
  readonly kind: 'exitDecision';
  readonly origin: ExitDecisionAddress;
  readonly parent: CanonicalDecisionParent;
  /**
   * A contiguous declaration-ordered prefix already generated before the
   * first blank or invalid physical exit. These rooms exist but are not yet
   * entered, so they remain on the decision frontier rather than the spine.
   */
  readonly targets: readonly CanonicalTarget[];
  /**
   * Entry-time sibling continuations belong to the decision even when its
   * ordinary normal lane has not produced a contiguous target prefix.  The
   * Midshop contract is created at room start, so hiding it behind a partial
   * normal batch would incorrectly erase an already-authored room.
   */
  readonly additional: readonly CanonicalAdditionalContinuation[];
  /**
   * The partial normal batch that owns the generated target prefix. Keeping
   * its reward-store contract lets history and reward replay treat physical
   * targets as facts without pretending that the decision is complete.
   */
  readonly partialBatch?: CanonicalBatch;
  readonly batchState?: CanonicalBatchState;
  readonly selectedExitKey: string | null;
  readonly selectedOrigin: ExitSelectionAddress;
  /**
   * The current bounded Hub data has two exact empty envelopes whose source
   * room still completes its lifecycle despite the absent ordinary target:
   * the Opening entry picker and the PreHub terminal takeover. This is a
   * closed N progression fact, not a generic resume or host capability.
   */
  readonly hubContinuation?: MaterializedHubContinuationFrontier;
}

export type MaterializedHubContinuationFrontier =
  | { readonly kind: 'boundedEntry'; readonly hubKey: string }
  | { readonly kind: 'terminalTakeover'; readonly hubKey: string };

/**
 * A blocked Hub visit has reached one of three distinct lifecycle phases.
 * The completed visit list never contains this frontier visit: history uses
 * the phase to stop before any later local lifecycle, restore, or Hub return.
 */
export interface MaterializedHubVisitFrontier {
  readonly kind: 'hubVisit';
  readonly origin: HubVisitAddress;
  readonly phase: 'targetLifecycle' | 'sideGeneration' | 'localRoomLifecycle';
  readonly target: CanonicalHubTarget;
  readonly localSlots: readonly CanonicalLocalVisitRoom[];
  readonly enteredLocalRooms: readonly CanonicalLocalVisitRoom[];
  readonly parentRestores: readonly CanonicalRoomRestore[];
}

export type MaterializedHubDecisionFrontier =
  | { readonly kind: 'hubBoard'; readonly origin: HubDecisionAddress }
  | { readonly kind: 'hubVisit'; readonly origin: HubVisitAddress }
  | MaterializedHubVisitFrontier;

export interface MaterializedBiomePrefix {
  readonly kind: 'biomePrefix';
  readonly routeKey: string;
  readonly biomeKey: string;
  readonly entryRoom?: CanonicalAuthoredRoom;
  readonly decisions: readonly CanonicalDecision[];
  /**
   * Completion-tail rooms become part of a structurally complete prefix when
   * its selected Preboss target has no further authored decision. Keeping the
   * declared tail on the prefix lets progressive evaluation assess the final
   * entered room without manufacturing a canonical complete snapshot.
   */
  readonly automaticRooms?: readonly CanonicalAuthoredRoom[];
  readonly frontier?: MaterializedExitDecisionFrontier | MaterializedHubDecisionFrontier;
  readonly biomeState: CanonicalBiomeState;
  readonly echoKeepsakeReplayResults?: Pick<
    import('../../authored-project/model').AuthoredKeepsakeEquipResults,
    'experimentalHammer'
  >;
}

export type BiomeMaterialization = CanonicalBiome | MaterializedBiomePrefix;

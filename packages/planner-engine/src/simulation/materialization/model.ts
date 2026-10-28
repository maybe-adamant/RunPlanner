import type {
  RequiredRoomObjectDescriptor,
  RoomCounterEffects,
  RoomKind,
} from '../../catalog-schema';
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
  HubFountainAddress,
  IncomingRewardAddress,
  InfernalContractPedestalAddress,
  PhantomExitAddress,
  LocalVisitSlotAddress,
  LocalRewardAddress,
  OccurrenceAddress,
  RewardWheelAddress,
  RewardWheelOfferAddress,
  ShopOfferAddress,
  StartingRewardAddress,
  TargetAddress,
} from '../../authored-project/addresses';
import type {
  AuthoredEncounterCustomization,
  OccurrenceId,
  RoomActionState,
  RoomEncounterState,
  FieldsSpatialState,
  RouteLoadout,
} from '../../authored-project/model';
import type { EncounterCustomizationDecision } from '../../catalog-schema';
import type {
  AuthoredLevelResolution,
  AuthoredTraitOffer,
} from '../../authored-project/traits/state';
import type { TraitOfferSourceContext } from '../traits/offer-domain';
import type { ResolvedRewardOffer } from '../../reward-kernel/model';
import type { MaterializedEncounterPhase } from '../encounters/model';
import type { StygianWellGenerationKey } from '../../authored-project/model';
import type { StygianWellEffect } from '../commerce/stygian-well';

export type BiomeMaterializationLoadout = Pick<
  RouteLoadout,
  'weaponKey' | 'aspectKey' | 'fearRanks' | 'startingReward'
>;

/**
 * A rerolled owner's effective reward: `offer` and its acquisition are the
 * reward after the last reroll, while generation offers the first draw.
 */
export interface CanonicalRewardReroll {
  readonly generatedOffer: ResolvedRewardOffer;
}

/** Fields a rerollable reward owner carries beside its offer. */
export interface CanonicalRerollableReward {
  readonly reroll?: CanonicalRewardReroll;
  /**
   * The authored rerolled acquisition does not match the effective offer, or
   * no reroll remains for it; kept for repair and reported.
   */
  readonly rerolledRewardMismatch?: true;
}

/**
 * The owner as its own generation sees it: a rerolled owner offers its first
 * draw. Acquisition reads the owner itself.
 */
export function forGeneration<
  T extends { readonly offer: ResolvedRewardOffer; readonly reroll?: CanonicalRewardReroll },
>(reward: T): T {
  return reward.reroll === undefined
    ? reward
    : Object.freeze({ ...reward, offer: reward.reroll.generatedOffer });
}

export interface CanonicalResolvedIncomingReward extends CanonicalRerollableReward {
  readonly origin: IncomingRewardAddress | LocalRewardAddress;
  /** Offer ownership can remain route-start while its acquisition remains room-local. */
  readonly offerOrigin?: StartingRewardAddress;
  readonly kind: 'resolved';
  readonly producerKind: 'countedChoice' | 'fixed' | 'freeReward' | 'shop';
  /** Concrete source provenance is required by acquisition effects such as Time Piece. */
  readonly instanceProvenance: 'free' | 'paid';
  readonly producerLifecycleKey: string;
  readonly offer: ResolvedRewardOffer;
  readonly traitOffersByAcquisitionRole?: Readonly<Record<string, AuthoredTraitOffer | null>>;
  readonly levelResolutionsByAcquisitionRole?:
    Readonly<Record<string, AuthoredLevelResolution>> | undefined;
  readonly hexActivationsByAcquisitionRole?:
    import('../../authored-project/model').HexActivationsByAcquisitionRole | undefined;
  readonly dispositionByAcquisitionRole?: import('../../authored-project/model').AuthoredRewardState['dispositionByAcquisitionRole'];
  readonly traitContext?: TraitOfferSourceContext;
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
  readonly optionKey: string | null;
  readonly offer: ResolvedRewardOffer;
  readonly traitOffersByAcquisitionRole?: Readonly<Record<string, AuthoredTraitOffer | null>>;
  readonly levelResolutionsByAcquisitionRole?:
    Readonly<Record<string, AuthoredLevelResolution>> | undefined;
  readonly dispositionByAcquisitionRole?: import('../../authored-project/model').AuthoredRewardState['dispositionByAcquisitionRole'];
  readonly anvilResultsByAcquisitionRole?:
    import('../../authored-project/model').AnvilResultsByAcquisitionRole | undefined;
  readonly hexActivationsByAcquisitionRole?:
    import('../../authored-project/model').HexActivationsByAcquisitionRole | undefined;
  readonly traitContext?: TraitOfferSourceContext;
}

/** The entered Preboss's Contract pedestal item, drawn from its own one-slot store profile. */
export interface CanonicalInfernalContractPedestal extends Omit<
  CanonicalShopOffer,
  'offerKey' | 'offerOrigin'
> {
  readonly offerKey: 'infernalContractReward';
  readonly offerOrigin: InfernalContractPedestalAddress;
}

/** An entered room's hidden return door; null fields are settled where its doors unlock. */
export interface CanonicalPhantomExit {
  readonly origin: PhantomExitAddress;
  readonly placeholderRoomGameName: string | null;
  readonly rewardType: string | null;
}

export interface CanonicalShopEntryState {
  readonly kind: 'shop';
  readonly profileKey: string;
  readonly offers: readonly CanonicalShopOffer[];
  readonly unresolvedOffers: readonly {
    readonly offerKey: string;
    readonly offerOrigin: ShopOfferAddress;
  }[];
  /** Dynamic Travel inventory is not a profile slot but uses the ordinary Shop offer owner. */
  readonly travelDealRefill?: CanonicalShopOffer | null;
}

export interface CanonicalLocalReward extends CanonicalRerollableReward {
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
  readonly traitContext?: TraitOfferSourceContext;
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
  readonly traitContext?: TraitOfferSourceContext;
  readonly resolvedStoreKey: 'FieldsOptionalRewards';
}

/** Declaration-paired entry points completed from the authored start point. */
export interface CanonicalFieldsEntryPair {
  readonly startPointId: number;
  readonly endPointId: number;
}

export interface CanonicalRewardWheelOffer extends CanonicalRerollableReward {
  readonly origin: RewardWheelOfferAddress;
  readonly offerKey: string;
  readonly offer: ResolvedRewardOffer;
  readonly traitOffersByAcquisitionRole?: Readonly<Record<string, AuthoredTraitOffer | null>>;
  readonly levelResolutionsByAcquisitionRole?:
    Readonly<Record<string, AuthoredLevelResolution>> | undefined;
  readonly dispositionByAcquisitionRole?: import('../../authored-project/model').AuthoredRewardState['dispositionByAcquisitionRole'];
  readonly traitContext?: TraitOfferSourceContext;
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
  /** Context-resolved incoming producer binding retained for reward generation. */
  readonly incomingRewardBinding: import('../../reward-kernel/bindings').RewardProducerBinding;
  /** Declaration-owned room classification retained for downstream products. */
  readonly roomKind: RoomKind;
  /**
   * An Anomaly replacement still evaluates the normal G target it displaced.
   * Keep that authored provenance on the canonical room rather than asking a
   * later simulation stage to rediscover topology ownership from a game name.
   */
  readonly anomalyReplacement?: {
    readonly replacedRoomGameName: string;
    /** Authored result of the one closed Anomaly capture-point encounter. */
    readonly success: boolean;
  };
  readonly encounters: RoomEncounterState;
  readonly encounterEnvelopeKey: string;
  readonly encounterPhases: readonly MaterializedEncounterPhase[];
  /** Exact known structural identities for unentered execution projection; no lifecycle behaviour. */
  readonly structuralEncounterIdentities?: readonly {
    readonly slotKey: string;
    readonly encounterKey: string;
    readonly kind: import('../../catalog-schema').EncounterPhaseKind;
    /** Resolved concrete customization product for execution publication. */
    readonly customization?: readonly (EncounterCustomizationDecision & {
      readonly value?: AuthoredEncounterCustomization;
      readonly valueSupported: boolean;
    })[];
  }[];
  /** Native Encounter carriers intentionally omitted from simulated phases. */
  readonly unmodeledEncounterKeys?: readonly string[];
  readonly lifecycleProfileKey: string;
  readonly counterEffects: RoomCounterEffects;
  readonly entered: boolean;
  /** True only for the route topology's active entry occurrence. */
  readonly entry: boolean;
  /** Declaration-owned required pickup that does not mutate simulated state. */
  readonly effectNeutralRequiredReward: boolean;
  /** Declaration-fixed completion rooms inherit selected Preboss reward-store provenance. */
  readonly enteredRewardStoreKey?: string;
  /** Persisted occurrence chronology and its sole derived roster product. */
  readonly roomActions: RoomActionState;
  /** Declaration-owned physical rack presence, independent of an authored replacement. */
  readonly hasKeepsakeRack: boolean;
  /** Declaration-owned physical fountain presence, independent of Aromatic Phial. */
  readonly hasRequiredFountain: boolean;
  /** The rack's replacement keepsake; absent when the rack leaves the keepsake unchanged. */
  readonly keepsakeRack?: import('../../authored-project/model').AuthoredKeepsakeRack & {
    readonly keepsakeKey: string;
  };
  readonly fountainRarityResult?: import('../../authored-project/model').AuthoredFountainRarityResult;
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
  /** Normalized catalog effects for the authored Well generations only. */
  readonly stygianWellOfferEffects?: Readonly<
    Partial<Record<StygianWellGenerationKey, StygianWellEffect>>
  >;
  /** Normalized catalog whitelist consumed by an Extended Well purchase. */
  readonly stygianWellExtendedDirectPurchaseItemKeys?: readonly string[];
  readonly roomActionRoster: import('../room-actions').RoomActionRoster;
  /** Fields combat rooms only: the room-action domain's cage order state. */
  readonly fieldsCageOrder?: import('../../authored-project/room-actions/domain').FieldsCageOrderState;
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
  readonly fieldsSpatial?: FieldsSpatialState;
  /** Canonical Fields entry pair; the authored state stores only its start. */
  readonly fieldsEntryPair?: CanonicalFieldsEntryPair;
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
  /** An entered pedestal-declaring Preboss's item; null leaves it unauthored. */
  readonly infernalContractPedestal?: CanonicalInfernalContractPedestal | null;
  /** An entered Ephyra combat, Mini-Boss or side room's hidden return door. */
  readonly phantomExit?: CanonicalPhantomExit;
  /** Active producer instances feeding the shared acquisition-site pipeline. */
  readonly pickupProducers?: readonly import('../../authored-project/acquisition/pickup-producers').SelectedPickupProducer[];
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
  readonly encounterPhases: readonly MaterializedEncounterPhase[];
  /** Native Encounter carriers intentionally omitted from simulated phases. */
  readonly unmodeledEncounterKeys?: readonly string[];
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
      /** Declaration-owned visibility/automatic-continuation behavior. */
      readonly behavior: import('../../catalog-schema').ExitBehavior;
      /** Native door `AllowReroll`; the destination's `ForceDoorAllowReroll` can still grant it. */
      readonly allowReroll: boolean;
    }
  | { readonly kind: 'unavailable'; readonly exitKey: string; readonly index: number };

export type CanonicalTargetContinuation = 'continuesSpine' | 'deadLeaf';

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
  readonly spawnPointIndex?: number;
  readonly origin: AdditionalExitAddress;
  readonly key: 'zagreusContract' | 'chaos';
  readonly chaosOrigin?: import('../../authored-project/model').IxionGeneratedChaosOrigin;
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
  /** Present once the fountain use is placed; absent while it is unplanned. */
  readonly fountain?: CanonicalHubFountainUse;
  /** Board rerolls in authored order, each pressed in the Hub stay it is authored in. */
  readonly rerolls: readonly CanonicalHubReroll[];
}

/** One Hub board reroll, pressed in the Hub after its preceding room visits returned. */
export interface CanonicalHubReroll {
  readonly origin: import('../../authored-project/addresses').HubRerollAddress;
  readonly hubSlotKey: string;
  readonly reward: ResolvedRewardOffer;
  /** Room visits completed, including their Hub returns, before the press. */
  readonly precedingVisitCount: number;
  /** Whether the Hub fountain use precedes the press in the same stay. */
  readonly afterFountain: boolean;
  /** Whether its slot's room was entered before the press; that door is closed. */
  readonly slotEntered: boolean;
}

/** The Hub fountain use, settled in the Hub after its preceding room visits. */
export interface CanonicalHubFountainUse {
  readonly origin: HubFountainAddress;
  /** Room visits completed, including their Hub returns, before the use. */
  readonly precedingVisitCount: number;
  readonly fountainRarityResult?: import('../../authored-project/model').AuthoredFountainRarityResult;
}

export type CanonicalDecision = CanonicalBatch | CanonicalHubDecision;

export interface CanonicalFixedRoomLink {
  readonly kind: 'fixedRoomLink';
  readonly source: CanonicalAuthoredRoom;
  readonly target: CanonicalAuthoredRoom;
  /**
   * The boss-door store decision carried through materialization so the reward
   * chronology reaches it at the source room's exit boundary, exactly as an
   * ordinary batch's store is reached. Present on every door that takes an
   * authored store; `storeKey` is absent while that store is unauthored.
   */
  readonly bossDoorRewardStore?: {
    readonly origin: import('../../authored-project/addresses').BatchRewardStoreAddress;
    readonly storeKey?: string;
  };
}

export type CanonicalBiomeState = Readonly<Record<string, boolean | number | string>>;

export interface CanonicalBiome {
  readonly kind: 'biome';
  readonly routeKey: string;
  readonly biomeKey: string;
  readonly entryRoom: CanonicalAuthoredRoom;
  readonly decisions: readonly CanonicalDecision[];
  readonly fixedRoomLinks: readonly CanonicalFixedRoomLink[];
  readonly biomeState: CanonicalBiomeState;
  readonly echoKeepsakeReplayResults?: Pick<
    import('../../authored-project/model').AuthoredKeepsakeEquipResults,
    'experimentalHammer' | 'transcendentEmbryo' | 'transcendentEmbryoTransformations'
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
 * A stopped Hub visit as its block reached it: the entered target, its side
 * doors once they open, and the side rooms and restores before the stop. The
 * completed visit list never contains this visit. It is a published
 * assessment structure and is never composed.
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
  /** Every preceding visit is retained; the fountain use is unplanned or blocked. */
  | { readonly kind: 'hubFountain'; readonly origin: HubFountainAddress }
  | MaterializedHubVisitFrontier;

export interface MaterializedBiomePrefix {
  readonly kind: 'biomePrefix';
  readonly routeKey: string;
  readonly biomeKey: string;
  readonly entryRoom?: CanonicalAuthoredRoom;
  readonly decisions: readonly CanonicalDecision[];
  /** Realized declaration-fixed room links after a selected Preboss. */
  readonly fixedRoomLinks?: readonly CanonicalFixedRoomLink[];
  readonly frontier?: MaterializedExitDecisionFrontier | MaterializedHubDecisionFrontier;
  readonly biomeState: CanonicalBiomeState;
  readonly echoKeepsakeReplayResults?: Pick<
    import('../../authored-project/model').AuthoredKeepsakeEquipResults,
    'experimentalHammer' | 'transcendentEmbryo' | 'transcendentEmbryoTransformations'
  >;
}

export type BiomeMaterialization = CanonicalBiome | MaterializedBiomePrefix;

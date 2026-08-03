import type {
  EncounterPhase,
  RequiredRoomObjectDescriptor,
  RoomCounterEffects,
} from '../../catalog-schema';
import type {
  BatchRewardStoreAddress,
  CompletionRoomAddress,
  ExitDecisionAddress,
  ExitDecisionSourceAddress,
  ExitSelectionAddress,
  HubDecisionAddress,
  HubOpenSetAddress,
  HubRoomAddress,
  HubSlotAddress,
  HubVisitAddress,
  IncomingRewardAddress,
  LocalChildAddress,
  LocalRewardAddress,
  OccurrenceAddress,
  RewardWheelAddress,
  RewardWheelOfferAddress,
  ShopOfferAddress,
  ShopPurchaseAddress,
  TargetAddress,
} from '../../authored-project/addresses';
import type { OccurrenceId } from '../../authored-project/model';
import type { ResolvedRewardOffer } from '../../reward-kernel/model';

export interface CanonicalResolvedIncomingReward {
  readonly origin: IncomingRewardAddress | LocalRewardAddress;
  readonly kind: 'resolved';
  readonly producerKind: 'countedChoice' | 'fixed' | 'freeReward' | 'shop';
  readonly producerLifecycleKey: string;
  readonly offer: ResolvedRewardOffer;
  readonly resolvedStoreKey?: string;
}

export interface CanonicalShopOffer {
  readonly offerKey: string;
  readonly offerOrigin: ShopOfferAddress;
  readonly purchaseOrigin: ShopPurchaseAddress;
  readonly offer: ResolvedRewardOffer;
  readonly purchased: boolean;
}

export interface CanonicalShopEntryState {
  readonly kind: 'shop';
  readonly profileKey: string;
  readonly offers: readonly CanonicalShopOffer[];
}

export interface CanonicalLocalReward {
  readonly origin: LocalRewardAddress;
  readonly groupKey: string;
  readonly slotKey: string;
  readonly encounterPhaseKey: string;
  readonly producerLifecycleKey: string;
  readonly offer: ResolvedRewardOffer;
  readonly resolvedStoreKey: string;
}

export interface CanonicalRewardWheelOffer {
  readonly origin: RewardWheelOfferAddress;
  readonly offerKey: string;
  readonly offer: ResolvedRewardOffer;
  readonly picked: boolean;
}

export interface CanonicalRewardWheel {
  readonly origin: RewardWheelAddress;
  readonly wheelKey: string;
  readonly encounterPhaseKey: string;
  readonly producerLifecycleKey: string;
  readonly storeKey: string;
  readonly offers: readonly CanonicalRewardWheelOffer[];
  readonly pickedOfferIndex: number;
}

export interface CanonicalAuthoredRoom {
  readonly kind: 'authored';
  readonly origin: OccurrenceAddress;
  readonly occurrenceId: OccurrenceId;
  readonly gameName: string;
  readonly encounterProfileKey: string;
  readonly encounterPhases: readonly EncounterPhase[];
  readonly lifecycleProfileKey: string;
  readonly counterEffects: RoomCounterEffects;
  readonly entered: boolean;
  readonly requiredObjects?: readonly RequiredRoomObjectDescriptor[];
  readonly clockworkReward?: 'goal' | 'nonGoal';
  readonly incomingReward?: CanonicalResolvedIncomingReward;
  readonly localRewards?: readonly CanonicalLocalReward[];
  readonly rewardWheels?: readonly CanonicalRewardWheel[];
  readonly entryState?: CanonicalShopEntryState;
}

export interface CanonicalCompletionRoom {
  readonly kind: 'completion';
  readonly origin: CompletionRoomAddress;
  readonly role: CompletionRoomAddress['role'];
  readonly gameName: string;
  readonly encounterProfileKey: string;
  readonly encounterPhases: readonly EncounterPhase[];
  readonly lifecycleProfileKey: string;
  readonly counterEffects: RoomCounterEffects;
  readonly enteredRewardStoreKey?: string;
  readonly entered: true;
}

export interface CanonicalHubRoom {
  readonly kind: 'hub';
  readonly origin: HubRoomAddress;
  readonly gameName: string;
  readonly encounterProfileKey: string;
  readonly encounterPhases: readonly EncounterPhase[];
  readonly lifecycleProfileKey: string;
  readonly counterEffects: RoomCounterEffects;
  readonly entered: true;
}

export interface CanonicalLocalChildRoom {
  readonly kind: 'localChild';
  readonly origin: LocalChildAddress;
  readonly groupKey: string;
  readonly slotKey: string;
  readonly gameName: string;
  readonly physicalDoorId: number;
  readonly availabilityRank: number;
  readonly generation: 'generated' | 'notGenerated';
  readonly enteredOrdinal: number | null;
  readonly encounterProfileKey: string;
  readonly encounterPhases: readonly EncounterPhase[];
  readonly lifecycleProfileKey: string;
  readonly counterEffects: RoomCounterEffects;
  readonly entered: boolean;
  readonly requiredObjects?: readonly RequiredRoomObjectDescriptor[];
  readonly incomingReward?: CanonicalResolvedIncomingReward;
}

export type CanonicalRoom = CanonicalAuthoredRoom | CanonicalCompletionRoom;

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
  readonly after: HubVisitAddress | LocalChildAddress;
  readonly room: CanonicalHubRoomReference | CanonicalRoomReference;
}

export interface CanonicalHubVisit {
  readonly origin: HubVisitAddress;
  readonly visitIndex: number;
  readonly target: CanonicalHubTarget;
  readonly localSlots: readonly CanonicalLocalChildRoom[];
  readonly enteredLocalRooms: readonly CanonicalLocalChildRoom[];
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
  readonly completionRooms: readonly CanonicalCompletionRoom[];
  readonly biomeState: CanonicalBiomeState;
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
  readonly localSlots: readonly CanonicalLocalChildRoom[];
  readonly enteredLocalRooms: readonly CanonicalLocalChildRoom[];
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
  readonly frontier?: MaterializedExitDecisionFrontier | MaterializedHubDecisionFrontier;
  readonly biomeState: CanonicalBiomeState;
}

export type BiomeMaterialization = CanonicalBiome | MaterializedBiomePrefix;

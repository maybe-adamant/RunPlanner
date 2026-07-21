import type { EncounterPhase, RoomCounterEffects } from '../../catalog';
import type {
  BatchRewardStoreAddress,
  CompletionRoomAddress,
  ContinuationAddress,
  FixedEntryRewardAddress,
  FixedEntryRoomAddress,
  IncomingRewardAddress,
  LocalRewardAddress,
  OccurrenceAddress,
  PickedAddress,
  ShopOfferAddress,
  ShopPurchaseAddress,
  TargetAddress,
} from '../../project/addresses';
import type { OccurrenceId } from '../../project/model';
import type { ResolvedRewardOffer } from '../../rewardKernel/model';

export interface CanonicalResolvedIncomingReward {
  readonly origin: FixedEntryRewardAddress | IncomingRewardAddress;
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
  readonly clockworkReward?: 'goal' | 'nonGoal';
  readonly incomingReward?: CanonicalResolvedIncomingReward;
  readonly localRewards?: readonly CanonicalLocalReward[];
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

export interface CanonicalFixedEntryRoom {
  readonly kind: 'fixedEntry';
  readonly origin: FixedEntryRoomAddress;
  readonly role: string;
  readonly gameName: string;
  readonly encounterProfileKey: string;
  readonly encounterPhases: readonly EncounterPhase[];
  readonly lifecycleProfileKey: string;
  readonly counterEffects: RoomCounterEffects;
  readonly entered: true;
  readonly incomingReward?: CanonicalResolvedIncomingReward;
}

export type CanonicalRoom =
  CanonicalAuthoredRoom | CanonicalCompletionRoom | CanonicalFixedEntryRoom;

export interface CanonicalRoomReference {
  readonly origin: FixedEntryRoomAddress | OccurrenceAddress;
  readonly occurrenceId?: OccurrenceId;
  readonly gameName: string;
}

export type CanonicalPhysicalExit =
  | {
      readonly kind: 'available';
      readonly index: number;
      readonly type: string;
      readonly compatibilityPolicyKey: string;
    }
  | {
      readonly kind: 'unavailable';
      readonly index: number;
    };

export type CanonicalTargetContinuation = 'continuesSpine' | 'deadLeaf' | 'entersTerminal';

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
  readonly origin: ContinuationAddress;
  readonly parent: CanonicalRoomReference;
  readonly rewardStore: CanonicalBatchRewardStore;
  readonly batchState: CanonicalBatchState;
  readonly targets: readonly CanonicalTarget[];
  readonly pickedExitIndex: number;
  readonly pickedOrigin: PickedAddress;
}

export interface CanonicalTerminalEntry {
  readonly origin: ContinuationAddress;
  readonly predecessor: CanonicalRoomReference;
  readonly targets: readonly CanonicalTarget[];
  readonly pickedExitIndex: number;
  readonly pickedOrigin: PickedAddress;
  readonly rewardStore?: CanonicalBatchRewardStore;
  readonly batchState?: CanonicalBatchState;
}

export type CanonicalBiomeState = Readonly<Record<string, boolean | number | string>>;

export interface CanonicalLinearBiome {
  readonly kind: 'LinearBiome';
  readonly routeKey: string;
  readonly biomeKey: string;
  readonly entryRooms: readonly (CanonicalAuthoredRoom | CanonicalFixedEntryRoom)[];
  readonly batches: readonly CanonicalBatch[];
  readonly terminalEntry: CanonicalTerminalEntry;
  readonly completionRooms: readonly CanonicalCompletionRoom[];
  readonly biomeState: CanonicalBiomeState;
}

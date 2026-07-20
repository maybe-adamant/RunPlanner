import type { EncounterPhase, RoomCounterEffects } from '../../catalog';
import type {
  BatchRewardStoreAddress,
  CompletionRoomAddress,
  ContinuationAddress,
  IncomingRewardAddress,
  OccurrenceAddress,
  PickedAddress,
  ShopOfferAddress,
  ShopPurchaseAddress,
  TargetAddress,
} from '../../project/addresses';
import type { AuthoredBatchState, OccurrenceId } from '../../project/model';
import type { ResolvedRewardOffer } from '../../rewardKernel/model';

export interface CanonicalResolvedIncomingReward {
  readonly origin: IncomingRewardAddress;
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
  readonly incomingReward?: CanonicalResolvedIncomingReward;
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
  readonly entered: true;
}

export type CanonicalRoom = CanonicalAuthoredRoom | CanonicalCompletionRoom;

export interface CanonicalRoomReference {
  readonly origin: OccurrenceAddress;
  readonly occurrenceId: OccurrenceId;
  readonly gameName: string;
}

export interface CanonicalPhysicalExit {
  readonly index: number;
  readonly type: string;
  readonly compatibilityPolicyKey: string;
}

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

export interface CanonicalBatch {
  readonly origin: ContinuationAddress;
  readonly parent: CanonicalRoomReference;
  readonly rewardStore: CanonicalBatchRewardStore;
  readonly batchState: AuthoredBatchState;
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
}

export type CanonicalBiomeState = Readonly<Record<string, boolean | number | string>>;

export interface CanonicalLinearBiome {
  readonly kind: 'LinearBiome';
  readonly routeKey: string;
  readonly biomeKey: string;
  readonly entryRooms: readonly CanonicalAuthoredRoom[];
  readonly batches: readonly CanonicalBatch[];
  readonly terminalEntry: CanonicalTerminalEntry;
  readonly completionRooms: readonly CanonicalCompletionRoom[];
  readonly biomeState: CanonicalBiomeState;
}

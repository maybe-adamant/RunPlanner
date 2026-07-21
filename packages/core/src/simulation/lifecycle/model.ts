import type {
  EncounterPhaseKind,
  RequiredRoomObjectDescriptor,
  RoomCounterEffects,
} from '../../catalog';
import type {
  CompletionRoomAddress,
  FixedEntryRoomAddress,
  HubRoomAddress,
  LocalChildAddress,
  OccurrenceAddress,
} from '../../project/addresses';
import type { ProducerLifecyclePointKey, ResolvedRewardOffer } from '../../rewardKernel/model';

export type RoomHistoryOrigin =
  | CompletionRoomAddress
  | FixedEntryRoomAddress
  | HubRoomAddress
  | LocalChildAddress
  | OccurrenceAddress;

interface RoomLifecycleEventBase {
  readonly sequence: number;
  readonly operationIndex: number;
  readonly origin: RoomHistoryOrigin;
}

export type RoomLifecycleEvent =
  | (RoomLifecycleEventBase & { readonly kind: 'roomPrepared' })
  | (RoomLifecycleEventBase & {
      readonly kind: 'offerPointMaterialized';
      readonly offerPoint: string;
    })
  | (RoomLifecycleEventBase & { readonly kind: 'roomEntered' })
  | (RoomLifecycleEventBase & {
      readonly kind: 'requiredObjectSpawned';
      readonly objectKey: RequiredRoomObjectDescriptor['key'];
      readonly completionRequirement: RequiredRoomObjectDescriptor['completionRequirement'];
    })
  | (RoomLifecycleEventBase & {
      readonly kind: 'encounterStarted';
      readonly phaseKey: string;
      readonly phaseKind: EncounterPhaseKind;
      readonly baselineEncounterKey?: string;
    })
  | (RoomLifecycleEventBase & {
      readonly kind: 'encounterDepthAdvanced';
      readonly phaseKey: string;
      readonly roomEncounterDepthDelta: 1;
      readonly biomeEncounterDepthDelta: 1;
      readonly routeEncounterDepthDelta: 1;
    })
  | (RoomLifecycleEventBase & {
      readonly kind: 'encounterCompleted';
      readonly phaseKey: string;
    })
  | (RoomLifecycleEventBase & {
      readonly kind: 'requiredObjectCompleted';
      readonly objectKey: RequiredRoomObjectDescriptor['key'];
    })
  | (RoomLifecycleEventBase & {
      readonly kind: 'producerRoleAdvanced';
      readonly producerLifecycleKey: string;
      readonly rewardType: string;
      readonly role: string;
      readonly lifecyclePoint: ProducerLifecyclePointKey;
    })
  | (RoomLifecycleEventBase & { readonly kind: 'outgoingGenerationCheckpoint' })
  | (RoomLifecycleEventBase & {
      readonly kind: 'shopPurchasesApplied';
      readonly offerPoint: string;
    })
  | (RoomLifecycleEventBase & { readonly kind: 'roomCommitted' })
  | (RoomLifecycleEventBase & {
      readonly kind: 'roomCountersAdvanced';
      readonly biomeDepthCacheDelta: number;
      readonly roomHistoryOrdinalDelta: number;
    })
  | (RoomLifecycleEventBase & {
      readonly kind: 'enteredRewardStoreRecorded';
      readonly storeKey: string;
    })
  | (RoomLifecycleEventBase & { readonly kind: 'roomExited' });

export interface RoomLifecycleProducerInput {
  readonly lifecycleProfileKey: string;
  readonly offer: ResolvedRewardOffer;
}

export interface RoomLifecycleExecutionInput {
  readonly origin: RoomHistoryOrigin;
  readonly lifecycleProfileKey: string;
  readonly encounterProfileKey: string;
  readonly producer?: RoomLifecycleProducerInput;
  readonly counterEffects: RoomCounterEffects;
  readonly requiredObjects?: readonly RequiredRoomObjectDescriptor[];
  readonly enteredRewardStoreKey?: string;
}

export interface RoomHistoryFragment {
  readonly origin: RoomHistoryOrigin;
  readonly lifecycleProfileKey: string;
  readonly encounterProfileKey: string;
  readonly events: readonly RoomLifecycleEvent[];
}

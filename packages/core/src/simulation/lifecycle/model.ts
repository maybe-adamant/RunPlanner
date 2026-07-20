import type { EncounterPhaseKind, RoomCounterEffects } from '../../catalog';
import type { OccurrenceAddress } from '../../project/addresses';
import type { ProducerLifecyclePointKey, ResolvedRewardOffer } from '../../rewardKernel/model';

interface RoomLifecycleEventBase {
  readonly sequence: number;
  readonly operationIndex: number;
  readonly origin: OccurrenceAddress;
}

export type RoomLifecycleEvent =
  | (RoomLifecycleEventBase & { readonly kind: 'roomPrepared' })
  | (RoomLifecycleEventBase & {
      readonly kind: 'offerPointMaterialized';
      readonly offerPoint: string;
    })
  | (RoomLifecycleEventBase & { readonly kind: 'roomEntered' })
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
  | (RoomLifecycleEventBase & { readonly kind: 'roomExited' });

export interface RoomLifecycleProducerInput {
  readonly lifecycleProfileKey: string;
  readonly offer: ResolvedRewardOffer;
}

export interface RoomLifecycleExecutionInput {
  readonly origin: OccurrenceAddress;
  readonly lifecycleProfileKey: string;
  readonly encounterProfileKey: string;
  readonly producer?: RoomLifecycleProducerInput;
  readonly counterEffects: RoomCounterEffects;
}

export interface RoomHistoryFragment {
  readonly origin: OccurrenceAddress;
  readonly lifecycleProfileKey: string;
  readonly encounterProfileKey: string;
  readonly events: readonly RoomLifecycleEvent[];
}

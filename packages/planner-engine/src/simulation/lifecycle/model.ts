import type {
  EncounterPhaseKind,
  RequiredRoomObjectDescriptor,
  RoomCounterEffects,
} from '../../catalog-schema';
import type {
  HubRoomAddress,
  OccurrenceAddress,
  RoomActionSemanticAddress,
} from '../../authored-project/addresses';
import type { ProducerLifecyclePointKey, ResolvedRewardOffer } from '../../reward-kernel/model';
import type { ResolvedEncounterPhase } from '../encounters';
import type { RoomActionRoster } from '../room-actions';

export type RoomHistoryOrigin = HubRoomAddress | OccurrenceAddress;

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
  | (RoomLifecycleEventBase & {
      readonly kind: 'offerPointAcquired';
      readonly offerPoint: string;
      readonly enteredRewardStoreKey?: string;
    })
  | (RoomLifecycleEventBase & { readonly kind: 'roomEntered' })
  | (RoomLifecycleEventBase & {
      readonly kind: 'fountainUsed';
      readonly owner: import('../../authored-project/addresses').RoomActionSemanticAddress;
    })
  | (RoomLifecycleEventBase & {
      readonly kind: 'keepsakeRackUsed';
      readonly owner: import('../../authored-project/addresses').RoomActionSemanticAddress;
    })
  | (RoomLifecycleEventBase & {
      readonly kind: 'requiredObjectSpawned';
      readonly objectKey: RequiredRoomObjectDescriptor['key'];
      readonly completionRequirement: RequiredRoomObjectDescriptor['completionRequirement'];
    })
  | (RoomLifecycleEventBase & {
      readonly kind: 'encounterRecorded';
      readonly phaseKey: string;
      readonly encounterEnvelopeKey: string;
      readonly encounterKey: string;
      readonly phaseKind: EncounterPhaseKind;
    })
  | (RoomLifecycleEventBase & {
      readonly kind: 'encounterStarted';
      readonly phaseKey: string;
      readonly encounterEnvelopeKey: string;
      readonly encounterKey: string;
      readonly phaseKind: EncounterPhaseKind;
      readonly execution: 'normal' | 'skippedByFigLeaf';
      readonly figLeafSkipOwner: boolean;
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
      readonly execution: 'normal' | 'skippedByFigLeaf';
      readonly figLeafSkipOwner: boolean;
    })
  | (RoomLifecycleEventBase & {
      /**
       * The resolved encounter's EndEncounterEffects completed. Noncombat and
       * source-declared skip-end-effect phases deliberately do not emit it.
       */
      readonly kind: 'encounterEndEffectsApplied';
      readonly phaseKey: string;
      readonly execution: 'normal' | 'skippedByFigLeaf';
      readonly figLeafSkipOwner: boolean;
    })
  | (RoomLifecycleEventBase & {
      /** Fixed automatic-Boss seam after defeat, before encounter-end effects. */
      readonly kind: 'bossDefeated';
      readonly phaseKey: string;
      readonly execution: 'normal' | 'skippedByFigLeaf';
      readonly figLeafSkipOwner: boolean;
    })
  | (RoomLifecycleEventBase & {
      readonly kind: 'encounterInteractionReached';
      readonly phaseKey: string;
      readonly interaction: 'encounter' | 'gorgon';
    })
  | (RoomLifecycleEventBase & {
      readonly kind: 'requiredObjectCompleted';
      readonly objectKey: RequiredRoomObjectDescriptor['key'];
    })
  | (RoomLifecycleEventBase & {
      readonly kind: 'producerPointReached';
      readonly point: ProducerLifecyclePointKey;
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
      readonly kind: 'acquisitionPointReached';
      readonly point: string;
      /** Exact persisted site identity for one chronology-owned acquisition entry. */
      readonly siteKey?: string;
      readonly entryKey?: string;
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
  /**
   * A materialized room may expose an offer without reaching its producer
   * acquisition point. Oceanus Anomaly failure is the current closed case.
   */
  readonly acquisitionEnabled?: boolean;
}

export interface RoomLifecycleExecutionInput {
  readonly origin: RoomHistoryOrigin;
  readonly lifecycleProfileKey: string;
  readonly encounterEnvelopeKey: string;
  readonly encounterPhases?: readonly ResolvedEncounterPhase[];
  readonly producer?: RoomLifecycleProducerInput;
  readonly counterEffects: RoomCounterEffects;
  readonly requiredObjects?: readonly RequiredRoomObjectDescriptor[];
  readonly enteredRewardStoreKey?: string;
  readonly offerPointRewardStores?: Readonly<Record<string, string>>;
  /** Present for occurrence rooms, including automatic Boss and Postboss rooms. */
  readonly roomActionRoster?: RoomActionRoster;
}

export interface RoomHistoryFragment {
  readonly origin: RoomHistoryOrigin;
  readonly lifecycleProfileKey: string;
  readonly encounterEnvelopeKey: string;
  readonly events: readonly RoomLifecycleEvent[];
  readonly blockedAt?: RoomActionSemanticAddress;
}

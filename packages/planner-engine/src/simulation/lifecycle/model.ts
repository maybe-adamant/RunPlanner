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
  | (RoomLifecycleEventBase & {
      readonly kind: 'roomEntered';
      readonly surfaceShopPresent?: boolean;
      readonly roomShopPresent?: boolean;
      /** An observed challenge switch; native records its depth at entry (`LastChallengeDepth`). */
      readonly challengeSwitchPresent?: true;
      /** A NextRoomSet room's map load recomputes the biome depth cache to 1 after the run's first room. */
      readonly biomeDepthCacheReset?: true;
      /** Native StartRoom RunOverrides then set the biome depth cache to this value. */
      readonly enteredBiomeDepthCache?: number;
    })
  | (RoomLifecycleEventBase & {
      readonly kind: 'fountainUsed';
      readonly owner: import('../../authored-project/addresses').RoomActionSemanticAddress;
    })
  | (RoomLifecycleEventBase & {
      readonly kind: 'keepsakeRackUsed';
      readonly owner: import('../../authored-project/addresses').RoomActionSemanticAddress;
    })
  | (RoomLifecycleEventBase & {
      /** One door, cage or wheel reroll press at its authored rank. */
      readonly kind: 'rewardRerolled';
      readonly owner: import('../../authored-project/addresses').RoomActionSemanticAddress;
      readonly target: import('../../authored-project/model').RerollTarget;
    })
  | (RoomLifecycleEventBase & {
      /** One Well or Pool reroll at its authored rank. */
      readonly kind: 'featureRerolled';
      readonly owner: import('../../authored-project/addresses').RoomActionSemanticAddress;
      readonly feature: import('../../authored-project/feature-rolls').RollFeature;
      readonly rerollId: string;
    })
  | (RoomLifecycleEventBase & {
      readonly kind: 'erisInteracted';
      readonly owner: import('../../authored-project/addresses').RoomActionSemanticAddress;
    })
  | (RoomLifecycleEventBase & {
      /** Starting and claiming the challenge switch; neither an encounter end nor a store draw. */
      readonly kind: 'challengeSwitchInteracted';
      readonly owner: import('../../authored-project/addresses').RoomActionSemanticAddress;
      /**
       * The switch's encounter, recorded, started and completed by the press
       * (`StartChallengeEncounter`, EncounterLogic.lua:2073-2113); history
       * composition attaches it from the room's entry preparation.
       */
      readonly encounter?: ChallengeSwitchEncounterRun;
    })
  | (RoomLifecycleEventBase & {
      /**
       * Pressing a locked door: its fight starts at the press (`AttemptUseDoor`
       * generates and starts it) and is fought out, opening the door. Neither a
       * recorded encounter nor an encounter end, and it spawns no reward.
       */
      readonly kind: 'exitUnlocked';
      readonly owner: import('../../authored-project/addresses').RoomActionSemanticAddress;
      readonly exitKey: string;
      /** The fight; history composition attaches it from the press's view. */
      readonly encounter?: UnlockExitEncounterRun;
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
      readonly generatedCustomization?: import('../encounters/model').ResolvedEncounterPhase['generatedCustomization'];
    })
  | (RoomLifecycleEventBase & {
      readonly kind: 'encounterStarted';
      readonly aetos?: import('../encounters/aetos').AetosPhaseSupport;
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
      readonly routeEncounterDepthDelta: 1;
    })
  | (RoomLifecycleEventBase & {
      readonly kind: 'encounterCompleted';
      readonly phaseKey: string;
      readonly execution: 'normal' | 'skippedByFigLeaf';
      readonly figLeafSkipOwner: boolean;
      /**
       * Whether the phase's EndEncounterEffects follow at once, wait for its
       * Ship wheel's post-combat actions, or do not run at all.
       */
      readonly endEffects: 'applied' | 'deferred' | 'none';
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
      /** Fixed Boss seam after defeat, before encounter-end effects. */
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
      /** Shrine purchases are scheduled at the source-room cleanup boundary. */
      readonly kind: 'hermesShrineDeliveriesScheduled';
      readonly deliveries: readonly {
        readonly generationKey: import('../../authored-project/model').HermesShrineGenerationKey;
        readonly rewardType: string;
        readonly delay: number;
        readonly rushed: boolean;
      }[];
    })
  | (RoomLifecycleEventBase & {
      /** One ranked Shrine purchase, where its rush can trigger the Travel Deal refill. */
      readonly kind: 'hermesShrinePurchaseReached';
      readonly generationKey: import('../../authored-project/model').HermesShrineGenerationKey;
      readonly rushed: boolean;
    })
  | (RoomLifecycleEventBase & {
      readonly kind: 'acquisitionPointReached';
      readonly point: string;
      /** Exact persisted site identity for one chronology-owned acquisition entry. */
      readonly siteKey?: string;
      readonly entryKey?: string;
    })
  | (RoomLifecycleEventBase & {
      readonly kind: 'wellPurchase';
      readonly generationKey: import('../../authored-project/model').StygianWellGenerationKey;
    })
  | (RoomLifecycleEventBase & { readonly kind: 'roomCommitted' })
  | (RoomLifecycleEventBase & {
      readonly kind: 'roomCountersAdvanced';
      /** Leaving a NextRoomSet room leaves the biome depth cache at 1. */
      readonly biomeDepthCacheReset?: true;
    })
  | (RoomLifecycleEventBase & {
      readonly kind: 'enteredRewardStoreRecorded';
      readonly storeKey: string;
    })
  | (RoomLifecycleEventBase & { readonly kind: 'roomExited' });

/** One run of a switch's encounter, outside the room's envelope. */
export interface ChallengeSwitchEncounterRun {
  readonly encounterKey: string;
  readonly phaseKind: EncounterPhaseKind;
  /** Native StartEncounter applies the inherited `CountsForRoomEncounterDepth`. */
  readonly countsEncounterDepth: boolean;
  /** False when the player left mid-fight (`EndedEarly`): started, never completed. */
  readonly completed: boolean;
  readonly generatedCustomization?: import('../encounters/model').ResolvedEncounterPhase['generatedCustomization'];
}

/** One locked door's fight, outside the room's envelope. */
export interface UnlockExitEncounterRun {
  readonly encounterKey: string;
  readonly phaseKind: EncounterPhaseKind;
  /** Native StartEncounter applies the inherited `CountsForRoomEncounterDepth`. */
  readonly countsEncounterDepth: boolean;
  readonly generatedCustomization?: import('../encounters/model').ResolvedEncounterPhase['generatedCustomization'];
}

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
  /** Exact feature presence recorded with the physical room-entry ledger. */
  readonly surfaceShopPresent?: boolean;
  readonly roomShopPresent?: boolean;
  readonly challengeSwitchPresent?: true;
  readonly requiredObjects?: readonly RequiredRoomObjectDescriptor[];
  readonly enteredRewardStoreKey?: string;
  readonly offerPointRewardStores?: Readonly<Record<string, string>>;
  /** Present for occurrence rooms, including fixed Boss and Postboss rooms. */
  readonly roomActionRoster?: RoomActionRoster;
  /** Feature-local Shrine purchases, consumed only by the Shrine scheduling checkpoint. */
  readonly hermesShrine?: import('../../authored-project/model').HermesShrineState;
  /** The rack swaps the keepsake; an unchanged rack's action is a no-op. */
  readonly keepsakeRackReplaces?: true;
}

/**
 * A ranked room action the walk reached, settled or stopped at, by local
 * sequence. One that settles with its own events (an incoming reward with its
 * producer point's) spans them from `sequence` through `through`; one that
 * emits none settles with the next event the walk emitted, or one past the
 * last when none followed.
 */
export interface ReachedRoomAction {
  readonly actionKey: string;
  readonly sequence: number;
  readonly through?: number;
}

export interface RoomHistoryFragment {
  readonly origin: RoomHistoryOrigin;
  readonly lifecycleProfileKey: string;
  readonly encounterEnvelopeKey: string;
  readonly events: readonly RoomLifecycleEvent[];
  /** Every ranked action the walk reached, in walk order. */
  readonly reachedActions: readonly ReachedRoomAction[];
  readonly blockedAt?: RoomActionSemanticAddress;
}

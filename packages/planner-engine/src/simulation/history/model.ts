import type { BiomeTransitionCounterAxis, EncounterPhaseKind } from '../../catalog-schema';
import type {
  AdditionalExitAddress,
  BiomeAddress,
  ExitDecisionAddress,
  HubDecisionAddress,
  HubSlotAddress,
  HubVisitAddress,
  LocalVisitSlotAddress,
  TargetAddress,
} from '../../authored-project/addresses';
import type { RoomHistoryOrigin, RoomLifecycleEvent } from '../lifecycle';

interface HistoryEventBase {
  readonly sequence: number;
}

export type RoomCreationSource =
  | 'additionalExit'
  | 'biomeEntry'
  | 'generatedTarget'
  | 'hubTarget'
  | 'hubDecision'
  | 'layoutCompletion'
  | 'localVisit';

export interface BiomeStartedHistoryEvent extends HistoryEventBase {
  readonly kind: 'biomeStarted';
  readonly origin: BiomeAddress;
  readonly counters: HistoryCounters;
}

interface RoomCreatedHistoryEventBase extends HistoryEventBase {
  readonly kind: 'roomCreated';
  readonly origin: RoomHistoryOrigin;
  readonly gameName: string;
  readonly encounterEnvelopeKey: string;
}

export interface FieldsBatchOutcomeHistoryEvent extends HistoryEventBase {
  readonly kind: 'fieldsBatchOutcomeRecorded';
  readonly origin: ExitDecisionAddress;
  readonly cageOutcome: 'min' | 'max';
  readonly batchCapacity: number;
  readonly cageTargetCount: number;
  readonly doorCageRewardCount: number;
}

export interface ClockworkBatchStateHistoryEvent extends HistoryEventBase {
  readonly kind: 'clockworkBatchStateRecorded';
  readonly origin: ExitDecisionAddress;
  readonly goalsRemaining: number;
  readonly nonGoalRewardsAcquired: number;
  readonly maxNonGoalRewards: number;
}

export interface ClockworkGoalAcquiredHistoryEvent extends HistoryEventBase {
  readonly kind: 'clockworkGoalAcquired';
  readonly origin: RoomHistoryOrigin;
}

export interface ClockworkNonGoalRewardSpawnedHistoryEvent extends HistoryEventBase {
  readonly kind: 'clockworkNonGoalRewardSpawned';
  readonly origin: RoomHistoryOrigin;
}

export type RoomCreatedHistoryEvent =
  | (RoomCreatedHistoryEventBase & {
      readonly source: 'biomeEntry' | 'layoutCompletion';
      readonly picked: true;
    })
  | (RoomCreatedHistoryEventBase & {
      readonly source: 'generatedTarget';
      readonly picked: boolean;
      readonly parentOrigin: RoomHistoryOrigin;
      readonly targetOrigin: TargetAddress;
      readonly generationIndex: number;
      readonly generationCount: number;
    })
  | (RoomCreatedHistoryEventBase & {
      /** A Midshop contract is created at the entered source's room-start checkpoint. */
      readonly source: 'additionalExit';
      readonly picked: boolean;
      readonly parentOrigin: RoomHistoryOrigin;
      readonly additionalOrigin: AdditionalExitAddress;
    })
  | (RoomCreatedHistoryEventBase & {
      readonly source: 'hubTarget';
      readonly picked: boolean;
      readonly parentOrigin: RoomHistoryOrigin;
      readonly targetOrigin: HubSlotAddress;
      readonly generationIndex: number;
      readonly generationCount: number;
    })
  | (RoomCreatedHistoryEventBase & {
      readonly source: 'localVisit';
      readonly picked: boolean;
      readonly parentOrigin: RoomHistoryOrigin;
      readonly targetOrigin: LocalVisitSlotAddress;
      readonly generationIndex: number;
      readonly generationCount: number;
    })
  | (RoomCreatedHistoryEventBase & {
      readonly source: 'hubDecision';
      readonly picked: true;
      readonly parentOrigin: RoomHistoryOrigin;
      readonly targetOrigin: HubDecisionAddress;
      readonly generationIndex: 1;
      readonly generationCount: 1;
    });

export interface BiomeCompletedHistoryEvent extends HistoryEventBase {
  readonly kind: 'biomeCompleted';
  readonly origin: BiomeAddress;
}

export interface BiomeCounterResetHistoryEvent extends HistoryEventBase {
  readonly kind: 'biomeCounterReset';
  readonly origin: BiomeAddress;
  readonly axis: BiomeTransitionCounterAxis;
  readonly value: 0;
}

export interface TargetGenerationCompletedHistoryEvent extends HistoryEventBase {
  readonly kind: 'targetGenerationCompleted';
  readonly origin: HubDecisionAddress | HubSlotAddress | LocalVisitSlotAddress | TargetAddress;
  readonly roomOrigin: RoomHistoryOrigin;
  readonly parentOrigin: RoomHistoryOrigin;
  readonly generationIndex: number;
  readonly generationCount: number;
}

export interface EmptyOutgoingGenerationHistoryEvent extends HistoryEventBase {
  readonly kind: 'emptyOutgoingGenerationCompleted';
  readonly origin: RoomHistoryOrigin;
}

export interface RoomRestoredHistoryEvent extends HistoryEventBase {
  readonly kind: 'roomRestored';
  readonly origin: RoomHistoryOrigin;
  readonly after: HubVisitAddress | LocalVisitSlotAddress;
  readonly restoreKind: 'hub' | 'parent';
  readonly biomeDepthCacheDelta: number;
  readonly roomHistoryOrdinalDelta: number;
  readonly surfaceShopPresent?: boolean;
  readonly roomShopPresent?: boolean;
}

export type HistoryEvent =
  | BiomeCompletedHistoryEvent
  | BiomeCounterResetHistoryEvent
  | BiomeStartedHistoryEvent
  | ClockworkBatchStateHistoryEvent
  | ClockworkGoalAcquiredHistoryEvent
  | ClockworkNonGoalRewardSpawnedHistoryEvent
  | EmptyOutgoingGenerationHistoryEvent
  | FieldsBatchOutcomeHistoryEvent
  | RoomCreatedHistoryEvent
  | RoomRestoredHistoryEvent
  | TargetGenerationCompletedHistoryEvent
  | RoomLifecycleEvent;

export interface RoomAppearanceHistoryEntry {
  readonly sequence: number;
  readonly origin: RoomHistoryOrigin;
  readonly gameName: string;
  readonly surfaceShopPresent?: boolean;
  readonly roomShopPresent?: boolean;
}

export interface EncounterHistoryEntry {
  readonly sequence: number;
  readonly origin: RoomHistoryOrigin;
  readonly gameName: string;
  readonly encounterEnvelopeKey: string;
  readonly slotKey: string;
  readonly encounterKey: string;
  readonly phaseKind: EncounterPhaseKind;
}

export interface EnteredRewardStoreHistoryEntry {
  readonly sequence: number;
  readonly origin: RoomHistoryOrigin;
  readonly gameName: string;
  readonly storeKey: string;
}

export interface RequiredObjectHistoryEntry {
  readonly sequence: number;
  readonly origin: RoomHistoryOrigin;
  readonly gameName: string;
  readonly objectKey: 'SoulPylon';
}

export interface RoomRestoreHistoryEntry {
  readonly sequence: number;
  readonly origin: RoomHistoryOrigin;
  readonly gameName: string;
  readonly after: HubVisitAddress | LocalVisitSlotAddress;
  readonly restoreKind: 'hub' | 'parent';
}

export interface HistoryCounters {
  readonly biomeDepthCache: number;
  readonly biomeEncounterDepth: number;
  readonly routeEncounterDepth: number;
  readonly roomHistoryOrdinal: number;
  readonly fieldsMaxDoorsRolled?: number;
  readonly clockworkGoalsRemaining?: number;
  readonly clockworkNonGoalRewardsAcquired?: number;
  readonly clockworkMaxNonGoalRewards?: number;
  readonly numSubRoomsSpawned?: number;
  readonly soulPylonsSpawned?: number;
  readonly soulPylonsCompleted?: number;
}

export interface HistoryLedgers {
  readonly roomCreations: readonly RoomCreatedHistoryEvent[];
  readonly roomAppearances: readonly RoomAppearanceHistoryEntry[];
  readonly encounterRecords: readonly EncounterHistoryEntry[];
  readonly encounterStarts: readonly EncounterHistoryEntry[];
  readonly encounterCompletions: readonly EncounterHistoryEntry[];
  readonly enteredRewardStores: readonly EnteredRewardStoreHistoryEntry[];
  readonly requiredObjectSpawns: readonly RequiredObjectHistoryEntry[];
  readonly requiredObjectCompletions: readonly RequiredObjectHistoryEntry[];
  readonly roomRestores: readonly RoomRestoreHistoryEntry[];
  readonly counters: HistoryCounters;
}

export interface HistoryStateView {
  readonly sequence: number;
  readonly ledgers: HistoryLedgers;
}

export interface TargetGenerationView {
  readonly targetOrigin:
    HubDecisionAddress | HubSlotAddress | LocalVisitSlotAddress | TargetAddress;
  readonly roomOrigin: RoomHistoryOrigin;
  /** Sequence occupied by the target's room-created event. */
  readonly roomCreationSequence: number;
  readonly before: HistoryStateView;
  readonly after: HistoryStateView;
}

export interface OfferPointView {
  readonly offerPoint: string;
  readonly before: HistoryStateView;
  readonly after: HistoryStateView;
  readonly acquisitionBefore?: HistoryStateView;
  readonly acquisitionAfter?: HistoryStateView;
}

export interface AcquisitionPointView {
  readonly point: string;
  readonly before: HistoryStateView;
  readonly after: HistoryStateView;
}

export interface EncounterStartView {
  readonly phaseKey: string;
  readonly before: HistoryStateView;
}

export interface ProgressiveRoomHistoryViews {
  readonly origin: RoomHistoryOrigin;
  readonly preparation: HistoryStateView;
  readonly entry: HistoryStateView;
  readonly encounterStarts: readonly EncounterStartView[];
  readonly offerPoints?: readonly OfferPointView[];
  readonly acquisitionPoints?: readonly AcquisitionPointView[];
  readonly preOutgoing?: HistoryStateView;
  readonly targetGenerations: readonly TargetGenerationView[];
  readonly outgoingGeneration?: HistoryStateView;
  readonly postCommit?: HistoryStateView;
  readonly exit?: HistoryStateView;
}

export interface RoomHistoryViews extends ProgressiveRoomHistoryViews {
  readonly postCommit: HistoryStateView;
  readonly exit: HistoryStateView;
}

export interface CanonicalBiomeHistory {
  readonly routeKey: string;
  readonly biomeKey: string;
  readonly events: readonly HistoryEvent[];
  readonly ledgers: HistoryLedgers;
  readonly rooms: readonly RoomHistoryViews[];
  readonly biomeCompletion: HistoryStateView;
  readonly afterTransition: HistoryStateView;
}

export interface BiomeHistoryPrefix {
  readonly routeKey: string;
  readonly biomeKey: string;
  readonly events: readonly HistoryEvent[];
  readonly ledgers: HistoryLedgers;
  readonly rooms: readonly ProgressiveRoomHistoryViews[];
  readonly current: HistoryStateView;
}

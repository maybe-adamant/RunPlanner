import type { BiomeTransitionCounterAxis, EncounterPhaseKind } from '../../catalog-schema';
import type {
  BiomeAddress,
  ContinuationAddress,
  FixedEntryTargetAddress,
  HubSlotAddress,
  HubVisitAddress,
  LocalChildAddress,
  TargetAddress,
} from '../../authored-project/addresses';
import type { RoomHistoryOrigin, RoomLifecycleEvent } from '../lifecycle';

interface LinearHistoryEventBase {
  readonly sequence: number;
}

export type RoomCreationSource =
  | 'biomeEntry'
  | 'generatedTarget'
  | 'hubTarget'
  | 'layoutCompletion'
  | 'layoutEntry'
  | 'layoutTerminal'
  | 'localChild';

export interface BiomeStartedHistoryEvent extends LinearHistoryEventBase {
  readonly kind: 'biomeStarted';
  readonly origin: BiomeAddress;
  readonly counters: LinearHistoryCounters;
}

interface RoomCreatedHistoryEventBase extends LinearHistoryEventBase {
  readonly kind: 'roomCreated';
  readonly origin: RoomHistoryOrigin;
  readonly gameName: string;
  readonly encounterProfileKey: string;
}

export interface FieldsBatchOutcomeHistoryEvent extends LinearHistoryEventBase {
  readonly kind: 'fieldsBatchOutcomeRecorded';
  readonly origin: ContinuationAddress;
  readonly cageOutcome: 'min' | 'max';
  readonly batchCapacity: number;
  readonly cageTargetCount: number;
  readonly doorCageRewardCount: number;
}

export interface ClockworkBatchStateHistoryEvent extends LinearHistoryEventBase {
  readonly kind: 'clockworkBatchStateRecorded';
  readonly origin: ContinuationAddress;
  readonly goalsRemaining: number;
  readonly nonGoalRewardsAcquired: number;
  readonly maxNonGoalRewards: number;
}

export interface ClockworkGoalAcquiredHistoryEvent extends LinearHistoryEventBase {
  readonly kind: 'clockworkGoalAcquired';
  readonly origin: RoomHistoryOrigin;
}

export interface ClockworkNonGoalRewardSpawnedHistoryEvent extends LinearHistoryEventBase {
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
      readonly source: 'hubTarget';
      readonly picked: boolean;
      readonly parentOrigin: RoomHistoryOrigin;
      readonly targetOrigin: HubSlotAddress;
      readonly generationIndex: number;
      readonly generationCount: number;
    })
  | (RoomCreatedHistoryEventBase & {
      readonly source: 'localChild';
      readonly picked: boolean;
      readonly parentOrigin: RoomHistoryOrigin;
      readonly targetOrigin: LocalChildAddress;
      readonly generationIndex: number;
      readonly generationCount: number;
    })
  | (RoomCreatedHistoryEventBase & {
      readonly source: 'layoutEntry';
      readonly picked: true;
      readonly parentOrigin: RoomHistoryOrigin;
      readonly targetOrigin: FixedEntryTargetAddress;
      readonly generationIndex: 1;
      readonly generationCount: 1;
    })
  | (RoomCreatedHistoryEventBase & {
      readonly source: 'layoutTerminal';
      readonly picked: true;
      readonly parentOrigin: RoomHistoryOrigin;
      readonly targetOrigin: FixedEntryTargetAddress;
    });

export interface BiomeCompletedHistoryEvent extends LinearHistoryEventBase {
  readonly kind: 'biomeCompleted';
  readonly origin: BiomeAddress;
}

export interface BiomeCounterResetHistoryEvent extends LinearHistoryEventBase {
  readonly kind: 'biomeCounterReset';
  readonly origin: BiomeAddress;
  readonly axis: BiomeTransitionCounterAxis;
  readonly value: 0;
}

export interface TargetGenerationCompletedHistoryEvent extends LinearHistoryEventBase {
  readonly kind: 'targetGenerationCompleted';
  readonly origin: FixedEntryTargetAddress | HubSlotAddress | LocalChildAddress | TargetAddress;
  readonly roomOrigin: RoomHistoryOrigin;
  readonly parentOrigin: RoomHistoryOrigin;
  readonly generationIndex: number;
  readonly generationCount: number;
}

export interface EmptyOutgoingGenerationHistoryEvent extends LinearHistoryEventBase {
  readonly kind: 'emptyOutgoingGenerationCompleted';
  readonly origin: RoomHistoryOrigin;
}

export interface RoomRestoredHistoryEvent extends LinearHistoryEventBase {
  readonly kind: 'roomRestored';
  readonly origin: RoomHistoryOrigin;
  readonly after: HubVisitAddress | LocalChildAddress;
  readonly restoreKind: 'hub' | 'parent';
  readonly biomeDepthCacheDelta: number;
  readonly roomHistoryOrdinalDelta: number;
}

export type LinearHistoryEvent =
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
}

export interface EncounterHistoryEntry {
  readonly sequence: number;
  readonly origin: RoomHistoryOrigin;
  readonly gameName: string;
  readonly encounterProfileKey: string;
  readonly phaseKey: string;
  readonly phaseKind: EncounterPhaseKind;
  readonly baselineEncounterKey?: string;
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
  readonly after: HubVisitAddress | LocalChildAddress;
  readonly restoreKind: 'hub' | 'parent';
}

export interface LinearHistoryCounters {
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

export interface LinearHistoryLedgers {
  readonly roomCreations: readonly RoomCreatedHistoryEvent[];
  readonly roomAppearances: readonly RoomAppearanceHistoryEntry[];
  readonly encounterStarts: readonly EncounterHistoryEntry[];
  readonly encounterCompletions: readonly EncounterHistoryEntry[];
  readonly enteredRewardStores: readonly EnteredRewardStoreHistoryEntry[];
  readonly requiredObjectSpawns: readonly RequiredObjectHistoryEntry[];
  readonly requiredObjectCompletions: readonly RequiredObjectHistoryEntry[];
  readonly roomRestores: readonly RoomRestoreHistoryEntry[];
  readonly counters: LinearHistoryCounters;
}

export interface LinearHistoryStateView {
  readonly sequence: number;
  readonly ledgers: LinearHistoryLedgers;
}

export interface LinearTargetGenerationView {
  readonly targetOrigin:
    FixedEntryTargetAddress | HubSlotAddress | LocalChildAddress | TargetAddress;
  readonly roomOrigin: RoomHistoryOrigin;
  readonly before: LinearHistoryStateView;
  readonly after: LinearHistoryStateView;
}

export interface LinearOfferPointView {
  readonly offerPoint: string;
  readonly before: LinearHistoryStateView;
  readonly after: LinearHistoryStateView;
  readonly acquisitionBefore?: LinearHistoryStateView;
  readonly acquisitionAfter?: LinearHistoryStateView;
}

export interface LinearRoomHistoryViews {
  readonly origin: RoomHistoryOrigin;
  readonly preparation: LinearHistoryStateView;
  readonly entry: LinearHistoryStateView;
  readonly offerPoints?: readonly LinearOfferPointView[];
  readonly preOutgoing?: LinearHistoryStateView;
  readonly targetGenerations: readonly LinearTargetGenerationView[];
  readonly outgoingGeneration?: LinearHistoryStateView;
  readonly postCommit: LinearHistoryStateView;
  readonly exit: LinearHistoryStateView;
}

export type HistoryEvent = LinearHistoryEvent;
export type HistoryCounters = LinearHistoryCounters;
export type HistoryLedgers = LinearHistoryLedgers;
export type HistoryStateView = LinearHistoryStateView;
export type TargetGenerationView = LinearTargetGenerationView;
export type RoomHistoryViews = LinearRoomHistoryViews;

export interface CanonicalBiomeHistory {
  readonly routeKey: string;
  readonly biomeKey: string;
  readonly events: readonly HistoryEvent[];
  readonly ledgers: HistoryLedgers;
  readonly rooms: readonly RoomHistoryViews[];
  readonly biomeCompletion: HistoryStateView;
  readonly afterTransition: HistoryStateView;
}

export type CanonicalLinearHistory = CanonicalBiomeHistory;
export type CanonicalHubHistory = CanonicalBiomeHistory;

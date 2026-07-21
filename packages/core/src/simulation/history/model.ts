import type { BiomeTransitionCounterAxis, EncounterPhaseKind } from '../../catalog';
import type {
  BiomeAddress,
  ContinuationAddress,
  FixedEntryTargetAddress,
  TargetAddress,
} from '../../project/addresses';
import type { RoomHistoryOrigin, RoomLifecycleEvent } from '../lifecycle';

interface LinearHistoryEventBase {
  readonly sequence: number;
}

export type RoomCreationSource =
  'biomeEntry' | 'generatedTarget' | 'layoutCompletion' | 'layoutEntry';

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
  readonly activeCageCount: number;
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
      readonly source: 'layoutEntry';
      readonly picked: true;
      readonly parentOrigin: RoomHistoryOrigin;
      readonly targetOrigin: FixedEntryTargetAddress;
      readonly generationIndex: 1;
      readonly generationCount: 1;
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
  readonly origin: FixedEntryTargetAddress | TargetAddress;
  readonly roomOrigin: RoomHistoryOrigin;
  readonly parentOrigin: RoomHistoryOrigin;
  readonly generationIndex: number;
  readonly generationCount: number;
}

export type LinearHistoryEvent =
  | BiomeCompletedHistoryEvent
  | BiomeCounterResetHistoryEvent
  | BiomeStartedHistoryEvent
  | ClockworkBatchStateHistoryEvent
  | ClockworkGoalAcquiredHistoryEvent
  | ClockworkNonGoalRewardSpawnedHistoryEvent
  | FieldsBatchOutcomeHistoryEvent
  | RoomCreatedHistoryEvent
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

export interface LinearHistoryCounters {
  readonly biomeDepthCache: number;
  readonly biomeEncounterDepth: number;
  readonly routeEncounterDepth: number;
  readonly roomHistoryOrdinal: number;
  readonly fieldsMaxDoorsRolled?: number;
  readonly clockworkGoalsRemaining?: number;
  readonly clockworkNonGoalRewardsAcquired?: number;
  readonly clockworkMaxNonGoalRewards?: number;
}

export interface LinearHistoryLedgers {
  readonly roomCreations: readonly RoomCreatedHistoryEvent[];
  readonly roomAppearances: readonly RoomAppearanceHistoryEntry[];
  readonly encounterStarts: readonly EncounterHistoryEntry[];
  readonly encounterCompletions: readonly EncounterHistoryEntry[];
  readonly enteredRewardStores: readonly EnteredRewardStoreHistoryEntry[];
  readonly counters: LinearHistoryCounters;
}

export interface LinearHistoryStateView {
  readonly sequence: number;
  readonly ledgers: LinearHistoryLedgers;
}

export interface LinearTargetGenerationView {
  readonly targetOrigin: FixedEntryTargetAddress | TargetAddress;
  readonly roomOrigin: RoomHistoryOrigin;
  readonly before: LinearHistoryStateView;
  readonly after: LinearHistoryStateView;
}

export interface LinearRoomHistoryViews {
  readonly origin: RoomHistoryOrigin;
  readonly preparation: LinearHistoryStateView;
  readonly entry: LinearHistoryStateView;
  readonly preOutgoing?: LinearHistoryStateView;
  readonly targetGenerations: readonly LinearTargetGenerationView[];
  readonly outgoingGeneration?: LinearHistoryStateView;
  readonly postCommit: LinearHistoryStateView;
  readonly exit: LinearHistoryStateView;
}

export interface CanonicalLinearHistory {
  readonly routeKey: string;
  readonly biomeKey: string;
  readonly events: readonly LinearHistoryEvent[];
  readonly ledgers: LinearHistoryLedgers;
  readonly rooms: readonly LinearRoomHistoryViews[];
  readonly biomeCompletion: LinearHistoryStateView;
  readonly afterTransition: LinearHistoryStateView;
}

export type FHistoryEvent = LinearHistoryEvent;
export type FHistoryCounters = LinearHistoryCounters;
export type FHistoryLedgers = LinearHistoryLedgers;
export type FHistoryStateView = LinearHistoryStateView;
export type FTargetGenerationView = LinearTargetGenerationView;
export type FRoomHistoryViews = LinearRoomHistoryViews;
export type CanonicalFHistory = CanonicalLinearHistory;

import type { BiomeTransitionCounterAxis, EncounterPhaseKind } from '../../catalog';
import type { BiomeAddress, OccurrenceAddress, TargetAddress } from '../../project/addresses';
import type { RoomHistoryOrigin, RoomLifecycleEvent } from '../lifecycle';

interface FHistoryEventBase {
  readonly sequence: number;
}

export type RoomCreationSource = 'biomeEntry' | 'generatedTarget' | 'layoutCompletion';

export interface BiomeStartedHistoryEvent extends FHistoryEventBase {
  readonly kind: 'biomeStarted';
  readonly origin: BiomeAddress;
  readonly counters: FHistoryCounters;
}

interface RoomCreatedHistoryEventBase extends FHistoryEventBase {
  readonly kind: 'roomCreated';
  readonly origin: RoomHistoryOrigin;
  readonly gameName: string;
}

export type RoomCreatedHistoryEvent =
  | (RoomCreatedHistoryEventBase & {
      readonly source: 'biomeEntry' | 'layoutCompletion';
      readonly picked: true;
    })
  | (RoomCreatedHistoryEventBase & {
      readonly source: 'generatedTarget';
      readonly picked: boolean;
      readonly parentOrigin: OccurrenceAddress;
      readonly targetOrigin: TargetAddress;
      readonly generationIndex: number;
      readonly generationCount: number;
    });

export interface BiomeCompletedHistoryEvent extends FHistoryEventBase {
  readonly kind: 'biomeCompleted';
  readonly origin: BiomeAddress;
}

export interface BiomeCounterResetHistoryEvent extends FHistoryEventBase {
  readonly kind: 'biomeCounterReset';
  readonly origin: BiomeAddress;
  readonly axis: BiomeTransitionCounterAxis;
  readonly value: 0;
}

export interface TargetGenerationCompletedHistoryEvent extends FHistoryEventBase {
  readonly kind: 'targetGenerationCompleted';
  readonly origin: TargetAddress;
  readonly roomOrigin: RoomHistoryOrigin;
  readonly parentOrigin: OccurrenceAddress;
  readonly generationIndex: number;
  readonly generationCount: number;
}

export type FHistoryEvent =
  | BiomeCompletedHistoryEvent
  | BiomeCounterResetHistoryEvent
  | BiomeStartedHistoryEvent
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

export interface FHistoryCounters {
  readonly biomeDepthCache: number;
  readonly biomeEncounterDepth: number;
  readonly routeEncounterDepth: number;
  readonly roomHistoryOrdinal: number;
}

export interface FHistoryLedgers {
  readonly roomCreations: readonly RoomCreatedHistoryEvent[];
  readonly roomAppearances: readonly RoomAppearanceHistoryEntry[];
  readonly encounterStarts: readonly EncounterHistoryEntry[];
  readonly encounterCompletions: readonly EncounterHistoryEntry[];
  readonly enteredRewardStores: readonly EnteredRewardStoreHistoryEntry[];
  readonly counters: FHistoryCounters;
}

export interface FHistoryStateView {
  readonly sequence: number;
  readonly ledgers: FHistoryLedgers;
}

export interface FTargetGenerationView {
  readonly targetOrigin: TargetAddress;
  readonly roomOrigin: RoomHistoryOrigin;
  readonly before: FHistoryStateView;
  readonly after: FHistoryStateView;
}

export interface FRoomHistoryViews {
  readonly origin: RoomHistoryOrigin;
  readonly preparation: FHistoryStateView;
  readonly entry: FHistoryStateView;
  readonly preOutgoing?: FHistoryStateView;
  readonly targetGenerations: readonly FTargetGenerationView[];
  readonly outgoingGeneration?: FHistoryStateView;
  readonly postCommit: FHistoryStateView;
  readonly exit: FHistoryStateView;
}

export interface CanonicalFHistory {
  readonly routeKey: string;
  readonly biomeKey: 'F';
  readonly events: readonly FHistoryEvent[];
  readonly ledgers: FHistoryLedgers;
  readonly rooms: readonly FRoomHistoryViews[];
  readonly biomeCompletion: FHistoryStateView;
  readonly afterTransition: FHistoryStateView;
}

import type { BiomeTransitionCounterAxis, EncounterPhaseKind } from '../../catalog';
import type { BiomeAddress, OccurrenceAddress, TargetAddress } from '../../project/addresses';
import type { RoomHistoryOrigin, RoomLifecycleEvent } from '../lifecycle';

interface LinearHistoryEventBase {
  readonly sequence: number;
}

export type RoomCreationSource = 'biomeEntry' | 'generatedTarget' | 'layoutCompletion';

export interface BiomeStartedHistoryEvent extends LinearHistoryEventBase {
  readonly kind: 'biomeStarted';
  readonly origin: BiomeAddress;
  readonly counters: LinearHistoryCounters;
}

interface RoomCreatedHistoryEventBase extends LinearHistoryEventBase {
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
  readonly origin: TargetAddress;
  readonly roomOrigin: RoomHistoryOrigin;
  readonly parentOrigin: OccurrenceAddress;
  readonly generationIndex: number;
  readonly generationCount: number;
}

export type LinearHistoryEvent =
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

export interface LinearHistoryCounters {
  readonly biomeDepthCache: number;
  readonly biomeEncounterDepth: number;
  readonly routeEncounterDepth: number;
  readonly roomHistoryOrdinal: number;
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
  readonly targetOrigin: TargetAddress;
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

import type {
  ContinuationAddress,
  HubOpenSetAddress,
  LocalChildAddress,
  TargetAddress,
} from '../../project/addresses';
import type { SemanticFinding } from '../model';

export type RoomGenerationExclusionReason =
  | 'currentRoomRepeat'
  | 'eligibilityRequirement'
  | 'exitIncompatible'
  | 'forceMinimum'
  | 'forcedPool'
  | 'maxAppearancesThisBiome'
  | 'maxCreationsPerRoom'
  | 'maxCreationsThisRun'
  | 'notCandidate'
  | 'physicalExitUnavailable';

export interface LinearForcePressureLedgerEntry {
  readonly targetOrigin: TargetAddress;
  readonly beforeSequence: number;
  readonly sourceGameName: string;
  readonly selectedGameName: string;
  readonly exitIndex: number;
  readonly biomeDepthCache: number;
  readonly biomeEncounterDepth: number;
  readonly selectedCreationCount: number;
  readonly selectedAppearanceCount: number;
  readonly selectedParentCreationCount: number;
  readonly eligibleRoomGameNames: readonly string[];
  readonly optionalForcedRoomGameNames: readonly string[];
  readonly requiredForcedRoomGameNames: readonly string[];
  readonly supportRoomGameNames: readonly string[];
  readonly selectedPossible: boolean;
  readonly selectedExclusionReasons: readonly RoomGenerationExclusionReason[];
}

export type FieldsCageOutcome = 'min' | 'max';

export interface FieldsCageOutcomeSupportEntry {
  readonly origin: ContinuationAddress;
  readonly beforeSequence: number;
  readonly biomeDepthCache: number;
  readonly fieldsMaxDoorsRolled: number;
  readonly maxDoorCageCeiling: number;
  readonly selectedOutcome: FieldsCageOutcome;
  readonly supportOutcomes: readonly FieldsCageOutcome[];
  readonly selectedPossible: boolean;
}

export interface LinearRoomGenerationValidation {
  readonly biomeKey: string;
  readonly validity: 'invalid' | 'valid';
  readonly forcePressure: readonly LinearForcePressureLedgerEntry[];
  readonly fieldsCageOutcomes: readonly FieldsCageOutcomeSupportEntry[];
  readonly findings: readonly SemanticFinding[];
}

export interface LinearRoomTargetCandidateValidation {
  readonly pressure: LinearForcePressureLedgerEntry;
  readonly findings: readonly SemanticFinding[];
}

export interface HubOpenSlotConstraintSupportEntry {
  readonly origin: HubOpenSetAddress;
  readonly constraintIndex: number;
  readonly constrainedSlotKeys: readonly string[];
  readonly openSlotKeys: readonly string[];
  readonly maximumOpenCount: number;
  readonly selectedPossible: boolean;
}

export type SideRoomGenerationOutcome = 'generated' | 'notGenerated';

export interface HubSideRoomGenerationSupportEntry {
  readonly origin: LocalChildAddress;
  readonly visitIndex: number;
  readonly availabilityRank: number;
  readonly generatedBefore: number;
  readonly requiredGeneratedCount: number;
  readonly selectedOutcome: SideRoomGenerationOutcome;
  readonly supportOutcomes: readonly SideRoomGenerationOutcome[];
  readonly selectedPossible: boolean;
}

export interface HubRoomGenerationValidation {
  readonly biomeKey: string;
  readonly validity: 'invalid' | 'valid';
  readonly openSlotConstraints: readonly HubOpenSlotConstraintSupportEntry[];
  readonly sideRoomGenerations: readonly HubSideRoomGenerationSupportEntry[];
  readonly findings: readonly SemanticFinding[];
}

export type FForcePressureLedgerEntry = LinearForcePressureLedgerEntry;
export type FRoomGenerationValidation = LinearRoomGenerationValidation;
export type FRoomTargetCandidateValidation = LinearRoomTargetCandidateValidation;

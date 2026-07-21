import type { ContinuationAddress, TargetAddress } from '../../project/addresses';
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

export type FForcePressureLedgerEntry = LinearForcePressureLedgerEntry;
export type FRoomGenerationValidation = LinearRoomGenerationValidation;
export type FRoomTargetCandidateValidation = LinearRoomTargetCandidateValidation;

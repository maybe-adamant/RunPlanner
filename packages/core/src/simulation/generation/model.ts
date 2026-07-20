import type { TargetAddress } from '../../project/addresses';
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

export interface FForcePressureLedgerEntry {
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

export interface FRoomGenerationValidation {
  readonly biomeKey: 'F';
  readonly validity: 'invalid' | 'valid';
  readonly forcePressure: readonly FForcePressureLedgerEntry[];
  readonly findings: readonly SemanticFinding[];
}

export interface FRoomTargetCandidateValidation {
  readonly pressure: FForcePressureLedgerEntry;
  readonly findings: readonly SemanticFinding[];
}

import type {
  ContinuationAddress,
  HubOpenSetAddress,
  LocalChildAddress,
  OccurrenceAddress,
  TargetAddress,
} from '../../authored-project/addresses';
import type { CounterAxis, HistoryRecord, NumericRange } from '../../requirements/model';
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

export type RequirementEvaluationEvidence =
  | {
      readonly kind: 'all' | 'any';
      readonly satisfied: boolean;
      readonly children: readonly RequirementEvaluationEvidence[];
    }
  | {
      readonly kind: 'not';
      readonly satisfied: boolean;
      readonly child: RequirementEvaluationEvidence;
    }
  | {
      readonly kind: 'counterRange';
      readonly satisfied: boolean;
      readonly axis: CounterAxis;
      readonly actual: number;
      readonly expected: NumericRange;
    }
  | {
      readonly kind: 'recordCount' | 'distinctRecordKeyCount';
      readonly satisfied: boolean;
      readonly record: HistoryRecord;
      readonly keys: readonly string[];
      readonly actual: number;
      readonly expected: NumericRange;
    }
  | {
      readonly kind: 'recentEncounterPhaseCount';
      readonly satisfied: boolean;
      readonly profileKey: string;
      readonly phaseKey: string;
      readonly roomWindow: number;
      readonly actual: number;
      readonly expected: NumericRange;
    }
  | {
      readonly kind: 'minExits';
      readonly satisfied: boolean;
      readonly actual: number;
      readonly minimum: number;
    }
  | {
      readonly kind: 'currentBatchTargetCount';
      readonly satisfied: boolean;
      readonly actual: number;
      readonly expected: NumericRange;
    }
  | {
      readonly kind: 'currentBatchRoomCount';
      readonly satisfied: boolean;
      readonly roomGameNames: readonly string[];
      readonly actual: number;
      readonly expected: NumericRange;
    }
  | {
      readonly kind: 'clockworkGoalsRemaining';
      readonly satisfied: boolean;
      readonly actual: number;
      readonly expected: NumericRange;
    }
  | {
      readonly kind: 'clockworkNonGoalCapacity';
      readonly satisfied: boolean;
      readonly acquired: number;
      readonly maximum: number;
      readonly reserve: number;
    };

export type RoomGenerationExclusionEvidence =
  | { readonly kind: 'notCandidate' }
  | { readonly kind: 'physicalExitUnavailable'; readonly exitIndex: number }
  | {
      readonly kind: 'exitIncompatible';
      readonly compatibilityPolicyKey: string;
      readonly sourceGameName: string;
      readonly candidateGameName: string;
    }
  | { readonly kind: 'currentRoomRepeat'; readonly sourceGameName: string }
  | {
      readonly kind: 'forceMinimum';
      readonly axis: 'biomeDepthCache' | 'biomeEncounterDepth';
      readonly actual: number;
      readonly minimum: number;
    }
  | {
      readonly kind: 'eligibilityRequirement';
      readonly evaluation: RequirementEvaluationEvidence;
    }
  | {
      readonly kind: 'maxCreationsThisRun' | 'maxCreationsPerRoom' | 'maxAppearancesThisBiome';
      readonly actual: number;
      readonly maximum: number;
    }
  | {
      readonly kind: 'forcedPool';
      readonly requiredRoomGameNames: readonly string[];
    };

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
  readonly selectedExclusions: readonly RoomGenerationExclusionEvidence[];
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

export interface EncounterCountSupportEntry {
  readonly origin: OccurrenceAddress;
  readonly beforeSequence: number;
  readonly selectedEncounterCount: number;
  readonly supportEncounterCounts: readonly number[];
  readonly selectedPossible: boolean;
}

export interface LinearRoomGenerationValidation {
  readonly biomeKey: string;
  readonly validity: 'invalid' | 'valid';
  readonly forcePressure: readonly LinearForcePressureLedgerEntry[];
  readonly encounterCounts: readonly EncounterCountSupportEntry[];
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

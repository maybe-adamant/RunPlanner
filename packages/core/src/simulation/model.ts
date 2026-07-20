import type { SemanticAddress } from '../project/addresses';

export type FindingSeverity = 'error' | 'warning';

export type SimulationPhase = 'completeness' | 'roomGeneration';

export type CompletenessFindingCode =
  | 'biomeTopologyMissing'
  | 'continuationMissing'
  | 'pickedShopStateMissing'
  | 'pickedTargetMissing'
  | 'targetMissing';

export type RoomGenerationFindingCode = 'targetRoomSupportEmpty' | 'targetRoomUnavailable';

export type FindingCode = CompletenessFindingCode | RoomGenerationFindingCode;

export type FindingEvidenceValue =
  | boolean
  | number
  | string
  | null
  | readonly FindingEvidenceValue[]
  | { readonly [key: string]: FindingEvidenceValue };

export type FindingEvidence = Readonly<Record<string, FindingEvidenceValue>>;

export interface SemanticFinding {
  readonly code: FindingCode;
  readonly severity: FindingSeverity;
  readonly phase: SimulationPhase;
  readonly origin: SemanticAddress;
  readonly evidence: FindingEvidence;
}

export interface IncompleteBiomeEvaluation {
  readonly completion: 'incomplete';
  readonly findings: readonly SemanticFinding[];
}

export interface CompleteBiomeEvaluation<Snapshot> {
  readonly completion: 'complete';
  readonly validity: 'invalid' | 'valid';
  readonly snapshot: Snapshot;
  readonly findings: readonly SemanticFinding[];
}

export type BiomeEvaluation<Snapshot> =
  CompleteBiomeEvaluation<Snapshot> | IncompleteBiomeEvaluation;

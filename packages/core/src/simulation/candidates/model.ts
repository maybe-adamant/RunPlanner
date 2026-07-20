import type { TargetAddress } from '../../project/addresses';
import type { RoomGenerationExclusionReason } from '../generation';
import type { SemanticFinding } from '../model';

export type CandidateSupport = 'forced' | 'impossible' | 'possible';

export type CandidateContextUnavailableReason =
  'biomeIncomplete' | 'simulatorUnavailable' | 'upstreamIncomplete' | 'upstreamInvalid';

export interface RoomTargetCandidateQuery {
  readonly kind: 'roomTarget';
  readonly target: TargetAddress;
  readonly gameName: string;
}

export type ProjectCandidateQuery = RoomTargetCandidateQuery;

export interface UnavailableCandidateEvaluation {
  readonly context: 'unavailable';
  readonly query: ProjectCandidateQuery;
  readonly reason: CandidateContextUnavailableReason;
}

export interface RoomTargetCandidateEvidence {
  readonly beforeSequence: number;
  readonly sourceGameName: string;
  readonly candidateGameName: string;
  readonly exitIndex: number;
  readonly biomeDepthCache: number;
  readonly biomeEncounterDepth: number;
  readonly candidateCreationCount: number;
  readonly candidateAppearanceCount: number;
  readonly candidateParentCreationCount: number;
  readonly eligibleRoomGameNames: readonly string[];
  readonly optionalForcedRoomGameNames: readonly string[];
  readonly requiredForcedRoomGameNames: readonly string[];
  readonly supportRoomGameNames: readonly string[];
  readonly exclusionReasons: readonly RoomGenerationExclusionReason[];
}

export interface EvaluatedRoomTargetCandidate {
  readonly context: 'evaluated';
  readonly query: RoomTargetCandidateQuery;
  readonly support: CandidateSupport;
  readonly findings: readonly SemanticFinding[];
  readonly evidence: RoomTargetCandidateEvidence;
}

export type ProjectCandidateEvaluation =
  EvaluatedRoomTargetCandidate | UnavailableCandidateEvaluation;

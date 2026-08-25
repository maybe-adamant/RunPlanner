import type { SemanticAddress } from '../../authored-project/addresses';
import type {
  GeneratedRoomGenerationValidation,
  HubRoomGenerationValidation,
} from '../generation/model';
import type { BiomeHistoryPrefix } from '../history';
import type { MaterializedBiomePrefix } from '../materialization';
import type { SemanticFinding } from '../model';
import type { BiomeRewardSimulation } from '../rewards';
import type { BiomeCandidateArtifacts } from '../candidate-artifacts';

/** The complete generation result published by progressive biome evaluation. */
export interface BiomeGenerationValidation {
  readonly validity: 'invalid' | 'valid';
  readonly ordinary: GeneratedRoomGenerationValidation;
  readonly hub: HubRoomGenerationValidation;
  readonly findings: readonly SemanticFinding[];
}

/** The evaluated prefix and its progressive simulation products. */
export interface ProgressiveBiomeEvaluation {
  readonly materializedPrefix: MaterializedBiomePrefix;
  /**
   * The bounded structural slice whose ordinary lifecycle products reached a
   * canonical checkpoint. An encounter block keeps the larger authored
   * prefix visible while this slice prevents assessed-state leakage beyond
   * the failed room.
   */
  readonly assessmentPrefix?: MaterializedBiomePrefix;
  readonly history: BiomeHistoryPrefix;
  readonly roomGeneration: BiomeGenerationValidation;
  readonly rewards: BiomeRewardSimulation;
  readonly findings: readonly SemanticFinding[];
  readonly blockedAt?: SemanticAddress;
}

/** The progressive evaluation plus the candidate artifacts it publishes. */
export interface ProgressiveBiomeEvaluationAssembly {
  readonly evaluation: ProgressiveBiomeEvaluation;
  readonly candidateArtifacts: BiomeCandidateArtifacts;
}

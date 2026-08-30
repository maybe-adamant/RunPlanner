import type { BiomeAddress, SemanticAddress } from '../authored-project/addresses';
import type { ProjectDocument } from '../authored-project/model';
import type { CanonicalBiome, MaterializedBiomePrefix } from './materialization';
import type { BiomeHistoryPrefix, CanonicalBiomeHistory } from './history';
import type { BiomeGenerationValidation } from './progressive/products';
import type { BiomeRewardSimulation } from './rewards/model';
import type { SemanticFinding } from './model';

export interface BiomeEvaluationBase {
  readonly biomeKey: string;
  readonly origin: BiomeAddress;
  readonly authoring: 'incomplete' | 'complete';
  readonly coverage: BiomeEvaluationCoverage;
  readonly findings: readonly SemanticFinding[];
}

interface IncompleteBiomeProjectEvaluationBase extends BiomeEvaluationBase {
  readonly authoring: 'incomplete';
  /** A reached contextual block is invalid even when authored completion is pending. */
  readonly validity?: 'invalid';
  readonly frontier: SemanticAddress;
  readonly coverage: IncompleteBiomeEvaluationCoverage;
}

export interface UnevaluatedIncompleteBiomeProjectEvaluation extends IncompleteBiomeProjectEvaluationBase {
  readonly coverage: NoBiomeEvaluationCoverage;
}

export interface PrefixIncompleteBiomeProjectEvaluation extends IncompleteBiomeProjectEvaluationBase {
  readonly coverage: PrefixBiomeEvaluationCoverage;
  readonly materializedPrefix: MaterializedBiomePrefix;
  readonly assessmentPrefix?: MaterializedBiomePrefix;
  readonly history: BiomeHistoryPrefix;
  readonly roomGeneration: BiomeGenerationValidation;
  readonly rewards: BiomeRewardSimulation;
}

export type IncompleteBiomeProjectEvaluation =
  UnevaluatedIncompleteBiomeProjectEvaluation | PrefixIncompleteBiomeProjectEvaluation;

interface CompleteBiomeProjectEvaluationBase extends BiomeEvaluationBase {
  readonly authoring: 'complete';
  readonly validity: 'invalid' | 'valid';
  readonly roomGeneration: BiomeGenerationValidation;
  readonly rewards: BiomeRewardSimulation;
}

export interface CompleteValidBiomeProjectEvaluation extends CompleteBiomeProjectEvaluationBase {
  readonly validity: 'valid';
  readonly coverage: CompleteBiomeEvaluationCoverage;
  readonly snapshot: CanonicalBiome;
  readonly history: CanonicalBiomeHistory;
}

/**
 * Any complete authored biome that cannot be assessed to a valid checkpoint
 * publishes one bounded invalid result. The authored materialized prefix is
 * retained for editing, while assessment products stop at the first blocking
 * atomic region. No canonical snapshot/history is published for this branch.
 */
export interface CompleteBlockedBiomeProjectEvaluation extends CompleteBiomeProjectEvaluationBase {
  readonly validity: 'invalid';
  readonly coverage: PrefixBiomeEvaluationCoverage;
  readonly materializedPrefix: MaterializedBiomePrefix;
  readonly assessmentPrefix?: MaterializedBiomePrefix;
  readonly history: BiomeHistoryPrefix;
}

export type CompleteBiomeProjectEvaluation =
  CompleteValidBiomeProjectEvaluation | CompleteBlockedBiomeProjectEvaluation;

export type ProjectBiomeEvaluation =
  IncompleteBiomeProjectEvaluation | CompleteBiomeProjectEvaluation;

export type BiomeAuthoring = ProjectBiomeEvaluation['authoring'];

export type BiomeEvaluationCheckpoint =
  'beforeTargetGeneration' | 'afterTargetGeneration' | 'afterRoomLifecycle';

export interface BiomeEvaluationPoint {
  readonly owner: SemanticAddress;
  readonly checkpoint: BiomeEvaluationCheckpoint;
}

export interface NoBiomeEvaluationCoverage {
  readonly kind: 'none';
  readonly reason: 'notEvaluated';
}

export interface PrefixBiomeEvaluationCoverage {
  readonly kind: 'prefix';
  readonly through: BiomeEvaluationPoint;
  readonly blockedAt?: SemanticAddress;
}

export interface CompleteBiomeEvaluationCoverage {
  readonly kind: 'complete';
}

export type IncompleteBiomeEvaluationCoverage =
  NoBiomeEvaluationCoverage | PrefixBiomeEvaluationCoverage;
export type BiomeEvaluationCoverage =
  IncompleteBiomeEvaluationCoverage | CompleteBiomeEvaluationCoverage;

export interface ActiveRouteBiome {
  readonly kind: 'incomplete' | 'invalid';
  readonly biomeKey: string;
}

export interface RouteProcessingRegions {
  readonly completeValidPrefix: readonly string[];
  readonly active: ActiveRouteBiome | null;
  readonly blockedSuffix: readonly string[];
}

export interface RouteEvaluationSummary {
  readonly configuredBiomeCount: number;
  readonly evaluatedBiomeCount: number;
  readonly validatedBiomeCount: number;
  readonly incompleteBiomeCount: number;
  readonly invalidBiomeCount: number;
  readonly blockedBiomeCount: number;
  readonly eligibleForExecutionPlan: boolean;
}

export interface ProjectRouteEvaluation {
  readonly routeKey: string;
  readonly status: 'empty' | 'incomplete' | 'invalid' | 'valid';
  readonly configuredBiomeKeys: readonly string[];
  readonly biomes: readonly ProjectBiomeEvaluation[];
  readonly processing: RouteProcessingRegions;
  readonly findings: readonly SemanticFinding[];
  readonly summary: RouteEvaluationSummary;
}

export interface ProjectEvaluation {
  readonly status: 'empty' | 'incomplete' | 'invalid' | 'valid';
  readonly projectId: string;
  readonly catalogVersion: string;
  readonly route: ProjectRouteEvaluation;
  readonly findings: readonly SemanticFinding[];
  readonly summary: RouteEvaluationSummary;
}

export interface ProjectEvaluationAssembly {
  readonly project: ProjectDocument;
  readonly evaluation: ProjectEvaluation;
}

export function routeStatus(
  configuredBiomeCount: number,
  evaluations: readonly ProjectBiomeEvaluation[],
  routeStartBlock: 'incomplete' | 'invalid' | null,
): ProjectRouteEvaluation['status'] {
  if (configuredBiomeCount === 0) return 'empty';
  if (routeStartBlock !== null) return routeStartBlock;
  if (evaluations.some((evaluation) => evaluation.validity === 'invalid')) {
    return 'invalid';
  }
  return evaluations.some((evaluation) => evaluation.authoring === 'incomplete')
    ? 'incomplete'
    : 'valid';
}

export function summarizeRoute(
  configuredBiomeCount: number,
  evaluations: readonly ProjectBiomeEvaluation[],
  processing: RouteProcessingRegions,
): RouteEvaluationSummary {
  const incompleteBiomeCount = evaluations.filter(
    (evaluation) => evaluation.authoring === 'incomplete',
  ).length;
  const invalidBiomeCount = evaluations.filter(
    (evaluation) => evaluation.validity === 'invalid',
  ).length;
  return Object.freeze({
    configuredBiomeCount,
    evaluatedBiomeCount: evaluations.length,
    validatedBiomeCount: processing.completeValidPrefix.length,
    incompleteBiomeCount,
    invalidBiomeCount,
    blockedBiomeCount: processing.blockedSuffix.length,
    eligibleForExecutionPlan:
      configuredBiomeCount > 0 && processing.completeValidPrefix.length === configuredBiomeCount,
  });
}

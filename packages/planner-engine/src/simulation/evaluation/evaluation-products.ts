import type {
  BiomeAddress,
  OccurrenceAddress,
  SemanticAddress,
} from '../../authored-project/addresses';
import type { ProjectDocument } from '../../authored-project/model';
import type { CanonicalBiome, MaterializedBiomePrefix } from '../materialization';
import type { BiomeHistoryPrefix, CanonicalBiomeHistory } from '../history';
import type { BiomeGenerationValidation } from '../progressive/products';
import type { BiomeRewardSimulation } from '../rewards/model';
import type { SemanticFinding } from '../model';
import type { ResourceExecutionPolicy } from '../resources';
import type { NpcShoppingExecutionPolicy } from '../encounters/npc-shopping';
import type { AssessmentIssue } from '../assessment-issue';

export interface BiomeEvaluationBase {
  readonly issue?: AssessmentIssue;
  readonly biomeKey: string;
  readonly origin: BiomeAddress;
  readonly authoring: 'incomplete' | 'complete' | 'ended';
  readonly coverage: BiomeEvaluationCoverage;
  readonly findings: readonly SemanticFinding[];
  /** Present only when this biome owns the active required-input horizon. */
  readonly requiredInput?: SemanticAddress;
  readonly requiredInputRegion?: string;
  readonly requiredInputLocation?: import('../progressive/finding-location').OwnerLocation;
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

/**
 * A biome the plan ends in before its completion: authored and valid through
 * the end room, which settles and exits but generates no doors and departs
 * nowhere. Later authored structure is retained but dormant. Its snapshot is
 * the selected structure through the end room; it seeds no later biome.
 */
export interface EndedBiomeProjectEvaluation extends BiomeEvaluationBase {
  readonly authoring: 'ended';
  readonly validity: 'valid';
  readonly roomGeneration: BiomeGenerationValidation;
  readonly rewards: BiomeRewardSimulation;
  readonly planEnd: OccurrenceAddress;
  readonly snapshot: CanonicalBiome;
  readonly coverage: PrefixBiomeEvaluationCoverage;
  readonly materializedPrefix: MaterializedBiomePrefix;
  readonly assessmentPrefix?: MaterializedBiomePrefix;
  readonly history: BiomeHistoryPrefix;
}

export type CompleteBiomeProjectEvaluation =
  CompleteValidBiomeProjectEvaluation | CompleteBlockedBiomeProjectEvaluation;

/** A biome whose selected structure publishes: complete and valid, or valid through the plan end. */
export type PublishedBiomeEvaluation =
  CompleteValidBiomeProjectEvaluation | EndedBiomeProjectEvaluation;

export type ProjectBiomeEvaluation =
  IncompleteBiomeProjectEvaluation | CompleteBiomeProjectEvaluation | EndedBiomeProjectEvaluation;

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

/**
 * Coverage through a block inside an entered room's Timeline, doors opening
 * or exit work: the room is assessed up to its blocking product.
 */
export interface RoomTimelineCoverage {
  readonly room: OccurrenceAddress;
  /** Room action keys of the blocking product's Timeline rows, in Timeline order. */
  readonly blockingRowKeys: readonly string[];
}

export interface PrefixBiomeEvaluationCoverage {
  readonly kind: 'prefix';
  readonly through: BiomeEvaluationPoint;
  readonly blockedAt?: SemanticAddress;
  readonly roomTimeline?: RoomTimelineCoverage;
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
  /** Present when the plan ends: the configured biomes after it, retained and never assessed. */
  readonly afterPlanEnd?: readonly string[];
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
  /** The sole selected assessment stop; findings retain local repair evidence. */
  readonly issue?: AssessmentIssue;
  readonly routeKey: string;
  readonly status: 'empty' | 'incomplete' | 'invalid' | 'valid';
  readonly configuredBiomeKeys: readonly string[];
  readonly biomes: readonly ProjectBiomeEvaluation[];
  readonly processing: RouteProcessingRegions;
  readonly findings: readonly SemanticFinding[];
  readonly summary: RouteEvaluationSummary;
  /** Complete route-owned resource point envelope and post-exit counters. */
  readonly resources: ResourceExecutionPolicy;
  readonly npcShopping: NpcShoppingExecutionPolicy;
}

export interface ProjectEvaluation {
  /** The sole selected assessment stop; findings retain local repair evidence. */
  readonly issue?: AssessmentIssue;
  readonly status: 'empty' | 'incomplete' | 'invalid' | 'valid';
  readonly projectId: string;
  readonly catalogVersion: string;
  readonly route: ProjectRouteEvaluation;
  readonly findings: readonly SemanticFinding[];
  readonly summary: RouteEvaluationSummary;
  readonly authoringHorizon: AuthoringHorizon;
}

export type AuthoringHorizon =
  | { readonly kind: 'open' }
  | {
      readonly kind: 'incomplete';
      /** The first locked authoring region begins immediately after this repairable region. */
      readonly blockedAfter: SemanticAddress;
    }
  | {
      readonly kind: 'ended';
      /** The plan's end room: its interior stays editable, its exit and everything after are locked. */
      readonly blockedAfter: OccurrenceAddress;
    };

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
  if (evaluations.some((evaluation) => evaluation.requiredInput !== undefined)) {
    return 'incomplete';
  }
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
  /** The plan end is reached validly: the route publishes through it. */
  endedValid = false,
): RouteEvaluationSummary {
  const incompleteBiomeCount = evaluations.filter(
    (evaluation) => evaluation.authoring === 'incomplete' || evaluation.requiredInput !== undefined,
  ).length;
  const invalidBiomeCount = evaluations.filter(
    (evaluation) => evaluation.validity === 'invalid' && evaluation.requiredInput === undefined,
  ).length;
  return Object.freeze({
    configuredBiomeCount,
    evaluatedBiomeCount: evaluations.length,
    validatedBiomeCount: processing.completeValidPrefix.length,
    incompleteBiomeCount,
    invalidBiomeCount,
    blockedBiomeCount: processing.blockedSuffix.length,
    eligibleForExecutionPlan:
      configuredBiomeCount > 0 &&
      (endedValid || processing.completeValidPrefix.length === configuredBiomeCount),
  });
}

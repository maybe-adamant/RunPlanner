import type { Catalog } from '../catalog-schema';
import {
  createBiomeAddress,
  type BiomeAddress,
  type SemanticAddress,
} from '../authored-project/addresses';
import type {
  AuthoredRoutePlan,
  HubBiomePlan,
  LinearBiomePlan,
  ProjectDocument,
} from '../authored-project/model';
import { evaluateHubCompleteness, evaluateLinearCompleteness } from './completeness';
import {
  evaluateHubRoomGeneration,
  evaluateLinearRoomGeneration,
  type HubRoomGenerationValidation,
  type LinearRoomGenerationValidation,
} from './generation';
import {
  composeHubHistory,
  composeLinearHistory,
  type CanonicalHubHistory,
  type CanonicalLinearHistory,
} from './history';
import {
  materializeHubBiome,
  materializeLinearBiome,
  type CanonicalHubBiome,
  type CanonicalLinearBiome,
} from './materialization';
import type { SemanticFinding } from './model';
import {
  evaluateHubRewards,
  evaluateLinearRewards,
  type HubRewardSimulation,
  type LinearRewardSimulation,
} from './rewards';

export interface IncompleteLinearProjectEvaluation {
  readonly kind: 'LinearBiome';
  readonly biomeKey: string;
  readonly origin: BiomeAddress;
  readonly authoring: 'incomplete';
  readonly frontier: SemanticAddress;
  readonly coverage: IncompleteBiomeEvaluationCoverage;
  readonly findings: readonly SemanticFinding[];
}

export interface CompleteLinearProjectEvaluation {
  readonly kind: 'LinearBiome';
  readonly biomeKey: string;
  readonly origin: BiomeAddress;
  readonly authoring: 'complete';
  readonly coverage: CompleteBiomeEvaluationCoverage;
  readonly validity: 'invalid' | 'valid';
  readonly snapshot: CanonicalLinearBiome;
  readonly history: CanonicalLinearHistory;
  readonly roomGeneration: LinearRoomGenerationValidation;
  readonly rewards: LinearRewardSimulation;
  readonly findings: readonly SemanticFinding[];
}

export type LinearBiomeProjectEvaluation =
  IncompleteLinearProjectEvaluation | CompleteLinearProjectEvaluation;

export interface IncompleteHubProjectEvaluation {
  readonly kind: 'HubBiome';
  readonly biomeKey: string;
  readonly origin: BiomeAddress;
  readonly authoring: 'incomplete';
  readonly frontier: SemanticAddress;
  readonly coverage: IncompleteBiomeEvaluationCoverage;
  readonly findings: readonly SemanticFinding[];
}

export interface CompleteHubProjectEvaluation {
  readonly kind: 'HubBiome';
  readonly biomeKey: string;
  readonly origin: BiomeAddress;
  readonly authoring: 'complete';
  readonly coverage: CompleteBiomeEvaluationCoverage;
  readonly validity: 'invalid' | 'valid';
  readonly snapshot: CanonicalHubBiome;
  readonly history: CanonicalHubHistory;
  readonly roomGeneration: HubRoomGenerationValidation;
  readonly rewards: HubRewardSimulation;
  readonly findings: readonly SemanticFinding[];
}

export type HubBiomeProjectEvaluation =
  CompleteHubProjectEvaluation | IncompleteHubProjectEvaluation;

export type ProjectBiomeEvaluation = LinearBiomeProjectEvaluation | HubBiomeProjectEvaluation;

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

export interface ProjectEvaluationSummary {
  readonly configuredBiomeCount: number;
  readonly evaluatedBiomeCount: number;
  readonly validatedBiomeCount: number;
  readonly incompleteBiomeCount: number;
  readonly invalidBiomeCount: number;
  readonly blockedBiomeCount: number;
  readonly eligibleForExecutionPlan: boolean;
}

export interface ProjectEvaluation {
  readonly status: 'empty' | 'incomplete' | 'invalid' | 'valid';
  readonly projectId: string;
  readonly catalogVersion: string;
  readonly routes: readonly ProjectRouteEvaluation[];
  readonly findings: readonly SemanticFinding[];
  readonly summary: ProjectEvaluationSummary;
}

const evaluationSourceProjects = new WeakMap<ProjectEvaluation, ProjectDocument>();

export class ProjectSimulationContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'ProjectSimulationContractError';
  }
}

export function assertProjectEvaluationSource(
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
): void {
  if (evaluationSourceProjects.get(evaluation) !== project) {
    throw new ProjectSimulationContractError(
      'prepared project evaluation does not belong to the authored project identity',
    );
  }
}

export function evaluateLinearBiome(
  catalog: Catalog,
  routeKey: string,
  plan: LinearBiomePlan,
  enteredBiomeCount: number,
  previous?: CompleteLinearProjectEvaluation | CompleteHubProjectEvaluation,
): LinearBiomeProjectEvaluation {
  const origin = createBiomeAddress(routeKey, plan.biomeKey);
  const completeness = evaluateLinearCompleteness(catalog, origin, plan);
  if (completeness.completion === 'incomplete') {
    return Object.freeze({
      kind: 'LinearBiome',
      biomeKey: plan.biomeKey,
      origin,
      authoring: 'incomplete',
      frontier: completeness.frontier,
      coverage: Object.freeze({ kind: 'none', reason: 'notEvaluated' }),
      findings: completeness.findings,
    });
  }

  const snapshot = materializeLinearBiome(catalog, origin, completeness);
  const history = composeLinearHistory(catalog, snapshot, previous?.history);
  const rewards = evaluateLinearRewards(
    catalog,
    snapshot,
    history,
    enteredBiomeCount,
    previous?.rewards.branches,
  );
  const roomGeneration = evaluateLinearRoomGeneration(
    catalog,
    snapshot,
    history,
    enteredBiomeCount,
    rewards.targetHistory,
  );
  const findings = Object.freeze([...roomGeneration.findings, ...rewards.findings]);

  return Object.freeze({
    kind: 'LinearBiome',
    biomeKey: plan.biomeKey,
    origin,
    authoring: 'complete',
    coverage: Object.freeze({ kind: 'complete' }),
    validity:
      roomGeneration.validity === 'valid' && rewards.validity === 'valid' ? 'valid' : 'invalid',
    snapshot,
    history,
    roomGeneration,
    rewards,
    findings,
  });
}

export function evaluateHubBiome(
  catalog: Catalog,
  routeKey: string,
  plan: HubBiomePlan,
): HubBiomeProjectEvaluation {
  const origin = createBiomeAddress(routeKey, plan.biomeKey);
  const completeness = evaluateHubCompleteness(catalog, origin, plan);
  if (completeness.completion === 'incomplete') {
    return Object.freeze({
      kind: 'HubBiome',
      biomeKey: plan.biomeKey,
      origin,
      authoring: 'incomplete',
      frontier: completeness.frontier,
      coverage: Object.freeze({ kind: 'none', reason: 'notEvaluated' }),
      findings: completeness.findings,
    });
  }

  const snapshot = materializeHubBiome(catalog, origin, completeness);
  const history = composeHubHistory(catalog, snapshot);
  const roomGeneration = evaluateHubRoomGeneration(catalog, snapshot, history);
  const rewards = evaluateHubRewards(catalog, snapshot, history);
  const findings = Object.freeze([...roomGeneration.findings, ...rewards.findings]);
  return Object.freeze({
    kind: 'HubBiome',
    biomeKey: plan.biomeKey,
    origin,
    authoring: 'complete',
    coverage: Object.freeze({ kind: 'complete' }),
    validity:
      roomGeneration.validity === 'valid' && rewards.validity === 'valid' ? 'valid' : 'invalid',
    snapshot,
    history,
    roomGeneration,
    rewards,
    findings,
  });
}

function assertProjectMatchesCatalog(catalog: Catalog, project: ProjectDocument): void {
  if (project.catalogVersion !== catalog.version) {
    throw new ProjectSimulationContractError(
      `project catalog ${project.catalogVersion} does not match ${catalog.version}`,
    );
  }
  if (project.routes.length !== catalog.routes.values.length) {
    throw new ProjectSimulationContractError('project routes do not match the catalog');
  }
  for (const [routeIndex, declaration] of catalog.routes.values.entries()) {
    const route = project.routes[routeIndex];
    if (route?.routeKey !== declaration.key) {
      throw new ProjectSimulationContractError(
        `project route ${routeIndex} does not match ${declaration.key}`,
      );
    }
    for (const [biomeIndex, plan] of route.biomes.entries()) {
      if (plan.biomeKey !== declaration.biomeKeys[biomeIndex]) {
        throw new ProjectSimulationContractError(
          `${route.routeKey} biome ${biomeIndex} is not the declared route prefix`,
        );
      }
    }
  }
}

function routeStatus(
  configuredBiomeCount: number,
  evaluations: readonly ProjectBiomeEvaluation[],
): ProjectRouteEvaluation['status'] {
  if (configuredBiomeCount === 0) {
    return 'empty';
  }
  if (evaluations.some((evaluation) => evaluation.authoring === 'incomplete')) {
    return 'incomplete';
  }
  if (
    evaluations.some(
      (evaluation) => evaluation.authoring === 'complete' && evaluation.validity === 'invalid',
    )
  ) {
    return 'invalid';
  }
  return 'valid';
}

function summarizeRoute(
  configuredBiomeCount: number,
  evaluations: readonly ProjectBiomeEvaluation[],
  processing: RouteProcessingRegions,
): RouteEvaluationSummary {
  const incompleteBiomeCount = evaluations.filter(
    (evaluation) => evaluation.authoring === 'incomplete',
  ).length;
  const invalidBiomeCount = evaluations.filter(
    (evaluation) => evaluation.authoring === 'complete' && evaluation.validity === 'invalid',
  ).length;
  const blockedBiomeCount = processing.blockedSuffix.length;
  return Object.freeze({
    configuredBiomeCount,
    evaluatedBiomeCount: evaluations.length,
    validatedBiomeCount: processing.completeValidPrefix.length,
    incompleteBiomeCount,
    invalidBiomeCount,
    blockedBiomeCount,
    eligibleForExecutionPlan:
      configuredBiomeCount > 0 && processing.completeValidPrefix.length === configuredBiomeCount,
  });
}

function evaluateRoute(catalog: Catalog, route: AuthoredRoutePlan): ProjectRouteEvaluation {
  const evaluations: ProjectBiomeEvaluation[] = [];
  const completeValidPrefix: string[] = [];
  const findings: SemanticFinding[] = [];
  let active: ActiveRouteBiome | null = null;
  let blockedSuffix: readonly string[] = Object.freeze([]);

  for (const [index, plan] of route.biomes.entries()) {
    let evaluation: ProjectBiomeEvaluation;
    if (plan.kind === 'HubBiome') {
      evaluation = evaluateHubBiome(catalog, route.routeKey, plan);
    } else {
      const previous = evaluations.at(-1);
      if (previous?.authoring === 'incomplete') {
        throw new ProjectSimulationContractError('incomplete biome cannot seed route continuation');
      }
      const previousComplete = previous?.authoring === 'complete' ? previous : undefined;
      evaluation = evaluateLinearBiome(catalog, route.routeKey, plan, index + 1, previousComplete);
    }
    evaluations.push(evaluation);
    findings.push(...evaluation.findings);
    if (evaluation.authoring === 'incomplete') {
      active = Object.freeze({
        kind: 'incomplete',
        biomeKey: evaluation.biomeKey,
      });
      blockedSuffix = Object.freeze(route.biomes.slice(index + 1).map((biome) => biome.biomeKey));
      break;
    }
    if (evaluation.validity === 'invalid') {
      active = Object.freeze({
        kind: 'invalid',
        biomeKey: evaluation.biomeKey,
      });
      blockedSuffix = Object.freeze(route.biomes.slice(index + 1).map((biome) => biome.biomeKey));
      break;
    }
    completeValidPrefix.push(evaluation.biomeKey);
  }

  const frozenEvaluations = Object.freeze(evaluations);
  const processing = Object.freeze({
    completeValidPrefix: Object.freeze(completeValidPrefix),
    active,
    blockedSuffix,
  });
  const summary = summarizeRoute(route.biomes.length, frozenEvaluations, processing);
  return Object.freeze({
    routeKey: route.routeKey,
    status: routeStatus(route.biomes.length, frozenEvaluations),
    configuredBiomeKeys: Object.freeze(route.biomes.map((biome) => biome.biomeKey)),
    biomes: frozenEvaluations,
    processing,
    findings: Object.freeze(findings),
    summary,
  });
}

function summarizeProject(routes: readonly ProjectRouteEvaluation[]): ProjectEvaluationSummary {
  const totals = routes.reduce(
    (result, route) => ({
      configuredBiomeCount: result.configuredBiomeCount + route.summary.configuredBiomeCount,
      evaluatedBiomeCount: result.evaluatedBiomeCount + route.summary.evaluatedBiomeCount,
      validatedBiomeCount: result.validatedBiomeCount + route.summary.validatedBiomeCount,
      incompleteBiomeCount: result.incompleteBiomeCount + route.summary.incompleteBiomeCount,
      invalidBiomeCount: result.invalidBiomeCount + route.summary.invalidBiomeCount,
      blockedBiomeCount: result.blockedBiomeCount + route.summary.blockedBiomeCount,
    }),
    {
      configuredBiomeCount: 0,
      evaluatedBiomeCount: 0,
      validatedBiomeCount: 0,
      incompleteBiomeCount: 0,
      invalidBiomeCount: 0,
      blockedBiomeCount: 0,
    },
  );
  return Object.freeze({
    ...totals,
    eligibleForExecutionPlan:
      totals.configuredBiomeCount > 0 &&
      routes.every(
        (route) =>
          route.summary.configuredBiomeCount === 0 || route.summary.eligibleForExecutionPlan,
      ),
  });
}

export function simulateProject(catalog: Catalog, project: ProjectDocument): ProjectEvaluation {
  assertProjectMatchesCatalog(catalog, project);
  const routes = Object.freeze(project.routes.map((route) => evaluateRoute(catalog, route)));
  const findings = Object.freeze(routes.flatMap((route) => route.findings));
  const summary = summarizeProject(routes);
  const status: ProjectEvaluation['status'] =
    summary.configuredBiomeCount === 0
      ? 'empty'
      : summary.invalidBiomeCount > 0
        ? 'invalid'
        : summary.incompleteBiomeCount > 0
          ? 'incomplete'
          : 'valid';

  const evaluation = Object.freeze({
    status,
    projectId: project.projectId,
    catalogVersion: project.catalogVersion,
    routes,
    findings,
    summary,
  });
  evaluationSourceProjects.set(evaluation, project);
  return evaluation;
}

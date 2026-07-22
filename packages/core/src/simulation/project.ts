import type { Catalog } from '../catalog';
import { createBiomeAddress, type BiomeAddress } from '../project/addresses';
import type {
  AuthoredRoutePlan,
  HubBiomePlan,
  LinearBiomePlan,
  ProjectDocument,
} from '../project/model';
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
  readonly completion: 'incomplete';
  readonly findings: readonly SemanticFinding[];
}

export interface CompleteLinearProjectEvaluation {
  readonly kind: 'LinearBiome';
  readonly biomeKey: string;
  readonly origin: BiomeAddress;
  readonly completion: 'complete';
  readonly validity: 'invalid' | 'valid';
  readonly snapshot: CanonicalLinearBiome;
  readonly history: CanonicalLinearHistory;
  readonly roomGeneration: LinearRoomGenerationValidation;
  readonly rewards: LinearRewardSimulation;
  readonly findings: readonly SemanticFinding[];
}

export type LinearBiomeProjectEvaluation =
  IncompleteLinearProjectEvaluation | CompleteLinearProjectEvaluation;
export type IncompleteFProjectEvaluation = IncompleteLinearProjectEvaluation & {
  readonly biomeKey: 'F';
};
export type CompleteFProjectEvaluation = CompleteLinearProjectEvaluation & {
  readonly biomeKey: 'F';
};
export type FProjectEvaluation = IncompleteFProjectEvaluation | CompleteFProjectEvaluation;

export interface IncompleteHubProjectEvaluation {
  readonly kind: 'HubBiome';
  readonly biomeKey: string;
  readonly origin: BiomeAddress;
  readonly completion: 'incomplete';
  readonly findings: readonly SemanticFinding[];
}

export interface CompleteHubProjectEvaluation {
  readonly kind: 'HubBiome';
  readonly biomeKey: string;
  readonly origin: BiomeAddress;
  readonly completion: 'complete';
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

export type RouteProcessingHorizon =
  | { readonly kind: 'routeEnd' }
  | {
      readonly kind: 'simulatorBoundary';
      readonly biomeKey: string;
      readonly blockedBiomeKeys: readonly string[];
    }
  | {
      readonly kind: 'incomplete' | 'invalid';
      readonly biomeKey: string;
      readonly blockedBiomeKeys: readonly string[];
    };

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
  readonly status: 'blocked' | 'empty' | 'incomplete' | 'invalid' | 'valid';
  readonly configuredBiomeKeys: readonly string[];
  readonly biomes: readonly ProjectBiomeEvaluation[];
  readonly validatedPrefix: readonly string[];
  readonly horizon: RouteProcessingHorizon;
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
  readonly status: 'blocked' | 'empty' | 'incomplete' | 'invalid' | 'valid';
  readonly projectId: string;
  readonly catalogVersion: string;
  readonly routes: readonly ProjectRouteEvaluation[];
  readonly findings: readonly SemanticFinding[];
  readonly summary: ProjectEvaluationSummary;
}

const evaluationSourceProjects = new WeakMap<ProjectEvaluation, ProjectDocument>();

export interface ProjectSimulationScope {
  readonly simulatableBiomeKeys: readonly string[];
}

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
      completion: 'incomplete',
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
    completion: 'complete',
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
      completion: 'incomplete',
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
    completion: 'complete',
    validity:
      roomGeneration.validity === 'valid' && rewards.validity === 'valid' ? 'valid' : 'invalid',
    snapshot,
    history,
    roomGeneration,
    rewards,
    findings,
  });
}

export function evaluateNBiome(
  catalog: Catalog,
  routeKey: string,
  plan: HubBiomePlan,
): HubBiomeProjectEvaluation {
  if (plan.biomeKey !== 'N') {
    throw new ProjectSimulationContractError('N biome evaluation requires biome N');
  }
  return evaluateHubBiome(catalog, routeKey, plan);
}

const implementedBiomeKeys = new Set(['F', 'G', 'H', 'I', 'N', 'O', 'P']);

function hasRegisteredSimulator(
  biomeKey: string,
  simulatableBiomeKeys?: ReadonlySet<string>,
): boolean {
  if (simulatableBiomeKeys !== undefined && !simulatableBiomeKeys.has(biomeKey)) {
    return false;
  }
  return implementedBiomeKeys.has(biomeKey);
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
  horizon: RouteProcessingHorizon,
): ProjectRouteEvaluation['status'] {
  if (configuredBiomeCount === 0) {
    return 'empty';
  }
  if (evaluations.some((evaluation) => evaluation.completion === 'incomplete')) {
    return 'incomplete';
  }
  if (
    evaluations.some(
      (evaluation) => evaluation.completion === 'complete' && evaluation.validity === 'invalid',
    )
  ) {
    return 'invalid';
  }
  if (horizon.kind === 'simulatorBoundary') {
    return 'blocked';
  }
  return 'valid';
}

function summarizeRoute(
  configuredBiomeCount: number,
  evaluations: readonly ProjectBiomeEvaluation[],
  validatedPrefix: readonly string[],
  horizon: RouteProcessingHorizon,
): RouteEvaluationSummary {
  const incompleteBiomeCount = evaluations.filter(
    (evaluation) => evaluation.completion === 'incomplete',
  ).length;
  const invalidBiomeCount = evaluations.filter(
    (evaluation) => evaluation.completion === 'complete' && evaluation.validity === 'invalid',
  ).length;
  const blockedBiomeCount =
    horizon.kind === 'incomplete' ||
    horizon.kind === 'invalid' ||
    horizon.kind === 'simulatorBoundary'
      ? horizon.blockedBiomeKeys.length
      : 0;
  return Object.freeze({
    configuredBiomeCount,
    evaluatedBiomeCount: evaluations.length,
    validatedBiomeCount: validatedPrefix.length,
    incompleteBiomeCount,
    invalidBiomeCount,
    blockedBiomeCount,
    eligibleForExecutionPlan:
      configuredBiomeCount > 0 && validatedPrefix.length === configuredBiomeCount,
  });
}

function evaluateRoute(
  catalog: Catalog,
  route: AuthoredRoutePlan,
  simulatableBiomeKeys?: ReadonlySet<string>,
): ProjectRouteEvaluation {
  const evaluations: ProjectBiomeEvaluation[] = [];
  const validatedPrefix: string[] = [];
  const findings: SemanticFinding[] = [];
  let horizon: RouteProcessingHorizon = Object.freeze({ kind: 'routeEnd' });

  for (const [index, plan] of route.biomes.entries()) {
    if (!hasRegisteredSimulator(plan.biomeKey, simulatableBiomeKeys)) {
      horizon = Object.freeze({
        kind: 'simulatorBoundary',
        biomeKey: plan.biomeKey,
        blockedBiomeKeys: Object.freeze(route.biomes.slice(index).map((biome) => biome.biomeKey)),
      });
      break;
    }
    let evaluation: ProjectBiomeEvaluation;
    if (plan.kind === 'HubBiome') {
      evaluation = evaluateHubBiome(catalog, route.routeKey, plan);
    } else {
      const previous = evaluations.at(-1);
      if (previous?.completion === 'incomplete') {
        throw new ProjectSimulationContractError('incomplete biome cannot seed route continuation');
      }
      const previousComplete = previous?.completion === 'complete' ? previous : undefined;
      evaluation = evaluateLinearBiome(catalog, route.routeKey, plan, index + 1, previousComplete);
    }
    evaluations.push(evaluation);
    findings.push(...evaluation.findings);
    if (evaluation.completion === 'incomplete') {
      horizon = Object.freeze({
        kind: 'incomplete',
        biomeKey: evaluation.biomeKey,
        blockedBiomeKeys: Object.freeze(
          route.biomes.slice(index + 1).map((biome) => biome.biomeKey),
        ),
      });
      break;
    }
    if (evaluation.validity === 'invalid') {
      horizon = Object.freeze({
        kind: 'invalid',
        biomeKey: evaluation.biomeKey,
        blockedBiomeKeys: Object.freeze(
          route.biomes.slice(index + 1).map((biome) => biome.biomeKey),
        ),
      });
      break;
    }
    validatedPrefix.push(evaluation.biomeKey);
  }

  const frozenEvaluations = Object.freeze(evaluations);
  const frozenValidatedPrefix = Object.freeze(validatedPrefix);
  const summary = summarizeRoute(
    route.biomes.length,
    frozenEvaluations,
    frozenValidatedPrefix,
    horizon,
  );
  return Object.freeze({
    routeKey: route.routeKey,
    status: routeStatus(route.biomes.length, frozenEvaluations, horizon),
    configuredBiomeKeys: Object.freeze(route.biomes.map((biome) => biome.biomeKey)),
    biomes: frozenEvaluations,
    validatedPrefix: frozenValidatedPrefix,
    horizon,
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

export function simulateProject(
  catalog: Catalog,
  project: ProjectDocument,
  scope?: ProjectSimulationScope,
): ProjectEvaluation {
  assertProjectMatchesCatalog(catalog, project);
  const simulatableBiomeKeys =
    scope === undefined ? undefined : new Set(scope.simulatableBiomeKeys);
  const routes = Object.freeze(
    project.routes.map((route) => evaluateRoute(catalog, route, simulatableBiomeKeys)),
  );
  const findings = Object.freeze(routes.flatMap((route) => route.findings));
  const summary = summarizeProject(routes);
  const status: ProjectEvaluation['status'] =
    summary.configuredBiomeCount === 0
      ? 'empty'
      : summary.invalidBiomeCount > 0
        ? 'invalid'
        : summary.incompleteBiomeCount > 0
          ? 'incomplete'
          : summary.blockedBiomeCount > 0
            ? 'blocked'
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

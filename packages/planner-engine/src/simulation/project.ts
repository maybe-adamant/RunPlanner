import type { Catalog } from '../catalog-schema';
import {
  createBiomeAddress,
  type BiomeAddress,
  type SemanticAddress,
} from '../authored-project/addresses';
import type { CountedRewardBinding } from '../reward-kernel';
import type {
  AuthoredBiomePlan,
  AuthoredRoutePlan,
  ProjectDocument,
} from '../authored-project/model';
import { evaluateBiomeCompleteness } from './completeness';
import { evaluateBiomeRoomGenerationAssembly, evaluateHubDecisionGeneration } from './generation';
import {
  createBiomeCandidateArtifacts,
  createEmptyBiomeCandidateArtifacts,
  createProjectCandidateArtifacts,
  type BiomeCandidateArtifacts,
  type ProjectCandidateArtifacts,
} from './candidate-artifacts';
import {
  composeBiomeHistory,
  type BiomeHistoryPrefix,
  type CanonicalBiomeHistory,
  type HistoryStateView,
} from './history';
import {
  materializeBiome,
  type CanonicalAuthoredRoom,
  type CanonicalBiome,
  type MaterializedBiomePrefix,
} from './materialization';
import type { SemanticFinding } from './model';
import {
  evaluateProgressiveBiomeAssembly,
  type BiomeGenerationValidation,
} from './progressive/biome';
import { evaluateBiomeRewardsAssembly } from './rewards/biome';
import type { BiomeRewardSimulation } from './rewards/model';
import {
  resolveCountedRewardTypeDomain,
  type CountedRewardOwnerAddress,
} from './rewards/authoring-domain';
import type { RewardProducerCandidateArtifacts } from './rewards/producer-frontiers';
import type { RoomLifecycleCandidateArtifacts } from './rewards/lifecycle-artifacts';

export interface BiomeEvaluationBase {
  readonly biomeKey: string;
  readonly origin: BiomeAddress;
  readonly authoring: 'incomplete' | 'complete';
  readonly coverage: BiomeEvaluationCoverage;
  readonly findings: readonly SemanticFinding[];
}

interface IncompleteBiomeProjectEvaluationBase extends BiomeEvaluationBase {
  readonly authoring: 'incomplete';
  readonly frontier: SemanticAddress;
  readonly coverage: IncompleteBiomeEvaluationCoverage;
}

export interface UnevaluatedIncompleteBiomeProjectEvaluation extends IncompleteBiomeProjectEvaluationBase {
  readonly coverage: NoBiomeEvaluationCoverage;
}

export interface PrefixIncompleteBiomeProjectEvaluation extends IncompleteBiomeProjectEvaluationBase {
  readonly coverage: PrefixBiomeEvaluationCoverage;
  readonly materializedPrefix: MaterializedBiomePrefix;
  readonly history: BiomeHistoryPrefix;
  readonly roomGeneration: BiomeGenerationValidation;
  readonly rewards: BiomeRewardSimulation;
}

export type IncompleteBiomeProjectEvaluation =
  UnevaluatedIncompleteBiomeProjectEvaluation | PrefixIncompleteBiomeProjectEvaluation;

export type { BiomeGenerationValidation } from './progressive/biome';

export interface CompleteBiomeProjectEvaluation extends BiomeEvaluationBase {
  readonly authoring: 'complete';
  readonly coverage: CompleteBiomeEvaluationCoverage;
  readonly validity: 'invalid' | 'valid';
  readonly snapshot: CanonicalBiome;
  readonly history: CanonicalBiomeHistory;
  readonly roomGeneration: BiomeGenerationValidation;
  readonly rewards: BiomeRewardSimulation;
}

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

export interface ProjectEvaluationAssembly {
  readonly project: ProjectDocument;
  readonly evaluation: ProjectEvaluation;
}

const evaluationSourceProjects = new WeakMap<ProjectEvaluation, ProjectDocument>();
const exactProjectEvaluationAssemblyConstructionToken = Symbol(
  'exactProjectEvaluationAssemblyConstructionToken',
);
let exactProjectEvaluationAssemblyArtifacts:
  ((assembly: ProjectEvaluationAssembly) => ProjectCandidateArtifacts) | undefined;
let isExactProjectEvaluationAssembly:
  ((assembly: ProjectEvaluationAssembly) => boolean) | undefined;

class ExactProjectEvaluationAssembly implements ProjectEvaluationAssembly {
  readonly #candidateArtifacts: ProjectCandidateArtifacts;
  readonly project: ProjectDocument;
  readonly evaluation: ProjectEvaluation;

  constructor(
    project: ProjectDocument,
    evaluation: ProjectEvaluation,
    candidateArtifacts: ProjectCandidateArtifacts,
    constructionToken: typeof exactProjectEvaluationAssemblyConstructionToken,
  ) {
    if (constructionToken !== exactProjectEvaluationAssemblyConstructionToken) {
      throw new ProjectSimulationContractError(
        'exact project evaluation assemblies may only be constructed by project simulation',
      );
    }
    this.project = project;
    this.evaluation = evaluation;
    this.#candidateArtifacts = candidateArtifacts;
    Object.freeze(this);
  }

  static {
    exactProjectEvaluationAssemblyArtifacts = (
      assembly: ProjectEvaluationAssembly,
    ): ProjectCandidateArtifacts => {
      if (!(assembly instanceof ExactProjectEvaluationAssembly)) {
        throw new ProjectSimulationContractError(
          'prepared project evaluation assembly was not produced by this simulator execution',
        );
      }
      return assembly.#candidateArtifacts;
    };
    isExactProjectEvaluationAssembly = (assembly: ProjectEvaluationAssembly): boolean => {
      const candidateArtifacts = exactProjectEvaluationAssemblyArtifacts;
      if (candidateArtifacts === undefined) return false;
      try {
        candidateArtifacts(assembly);
        return true;
      } catch {
        return false;
      }
    };
  }
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

function requireExactProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
): ProjectEvaluationAssembly {
  if (isExactProjectEvaluationAssembly?.(assembly) !== true) {
    throw new ProjectSimulationContractError(
      'prepared project evaluation assembly was not produced by this simulator execution',
    );
  }
  assertProjectEvaluationSource(assembly.project, assembly.evaluation);
  return assembly;
}

export function assertProjectEvaluationAssembly(assembly: ProjectEvaluationAssembly): void {
  requireExactProjectEvaluationAssembly(assembly);
}

/** Engine-internal capability access; the public assembly surface stays data-only. */
export function candidateArtifactsForProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
): ProjectCandidateArtifacts {
  const candidateArtifacts = exactProjectEvaluationAssemblyArtifacts;
  if (candidateArtifacts === undefined) {
    throw new ProjectSimulationContractError('candidate artifact access is not initialized');
  }
  return candidateArtifacts(requireExactProjectEvaluationAssembly(assembly));
}

/** Exact-assembly entry point for one synchronous counted-reward authoring domain. */
export function countedRewardTypeDomain(
  catalog: Catalog,
  assembly: ProjectEvaluationAssembly,
  owner: CountedRewardOwnerAddress,
  binding: CountedRewardBinding,
): readonly string[] {
  const candidateArtifacts = candidateArtifactsForProjectEvaluationAssembly(assembly);
  const evaluatedProducer = candidateArtifacts
    .biomeAt(createBiomeAddress(owner.routeKey, owner.biomeKey))
    ?.rewardProducers.at(owner);
  return resolveCountedRewardTypeDomain(
    catalog,
    assembly.project,
    owner,
    binding,
    evaluatedProducer,
  );
}

interface BiomeProjectEvaluationAssembly {
  readonly evaluation: ProjectBiomeEvaluation;
  readonly candidateArtifacts: BiomeCandidateArtifacts;
}

interface BiomeGenerationAssembly {
  readonly validation: BiomeGenerationValidation;
  readonly candidateArtifacts: BiomeCandidateArtifacts;
}

function generation(
  catalog: Catalog,
  snapshot:
    CanonicalBiome | (MaterializedBiomePrefix & { readonly entryRoom: CanonicalAuthoredRoom }),
  history: CanonicalBiomeHistory | BiomeHistoryPrefix,
  enteredBiomeCount: number,
  rewards: BiomeRewardSimulation,
  rewardProducers: RewardProducerCandidateArtifacts,
  roomLifecycles: RoomLifecycleCandidateArtifacts,
): BiomeGenerationAssembly {
  const ordinary = evaluateBiomeRoomGenerationAssembly(
    catalog,
    snapshot,
    history,
    enteredBiomeCount,
    rewards.targetHistory,
  );
  const hub = evaluateHubDecisionGeneration(catalog, snapshot, history);
  const validation: BiomeGenerationValidation = Object.freeze({
    validity:
      ordinary.validation.validity === 'valid' && hub.validity === 'valid' ? 'valid' : 'invalid',
    ordinary: ordinary.validation,
    hub,
    findings: Object.freeze([...ordinary.validation.findings, ...hub.findings]),
  });
  return Object.freeze({
    validation,
    candidateArtifacts: createBiomeCandidateArtifacts(
      createBiomeAddress(snapshot.routeKey, snapshot.biomeKey),
      ordinary.candidateArtifacts,
      rewardProducers,
      roomLifecycles,
    ),
  });
}

function prefixCoveragePoint(prefix: MaterializedBiomePrefix): BiomeEvaluationPoint {
  if (prefix.frontier?.kind === 'exitDecision') {
    const lastTarget = prefix.frontier.targets.at(-1);
    return lastTarget === undefined
      ? Object.freeze({ owner: prefix.frontier.origin, checkpoint: 'beforeTargetGeneration' })
      : Object.freeze({ owner: lastTarget.origin, checkpoint: 'afterTargetGeneration' });
  }
  if (prefix.frontier?.kind === 'hubBoard' || prefix.frontier?.kind === 'hubVisit') {
    if (prefix.frontier.kind === 'hubVisit' && 'phase' in prefix.frontier) {
      if (prefix.frontier.phase === 'targetLifecycle') {
        return Object.freeze({
          owner: prefix.frontier.origin,
          checkpoint: 'beforeTargetGeneration',
        });
      }
      if (prefix.frontier.phase === 'sideGeneration') {
        return Object.freeze({
          owner: prefix.frontier.origin,
          checkpoint: 'afterTargetGeneration',
        });
      }
      const lastLocal = prefix.frontier.enteredLocalRooms.at(-1);
      return Object.freeze({
        owner: lastLocal?.origin ?? prefix.frontier.origin,
        checkpoint: 'afterRoomLifecycle',
      });
    }
    const hub = [...prefix.decisions].reverse().find((decision) => decision.kind === 'hub');
    if (hub?.kind === 'hub') {
      const lastVisit = hub.visits.at(-1);
      if (lastVisit !== undefined) {
        const lastLocal = lastVisit.enteredLocalRooms.at(-1);
        return Object.freeze({
          owner: lastLocal?.origin ?? lastVisit.origin,
          checkpoint: 'afterRoomLifecycle',
        });
      }
      const lastTarget = hub.board.targets.at(-1);
      if (lastTarget !== undefined) {
        return Object.freeze({ owner: lastTarget.origin, checkpoint: 'afterTargetGeneration' });
      }
    }
    return Object.freeze({ owner: prefix.frontier.origin, checkpoint: 'beforeTargetGeneration' });
  }
  const last = prefix.decisions.at(-1);
  if (last === undefined) {
    if (prefix.entryRoom === undefined) {
      throw new ProjectSimulationContractError(`${prefix.biomeKey} has no prefix coverage owner`);
    }
    return Object.freeze({ owner: prefix.entryRoom.origin, checkpoint: 'beforeTargetGeneration' });
  }
  if (last.kind === 'batch') {
    return Object.freeze({ owner: last.selectedOrigin, checkpoint: 'afterTargetGeneration' });
  }
  if (last.kind === 'linkedExit') {
    return Object.freeze({ owner: last.target.origin, checkpoint: 'afterTargetGeneration' });
  }
  return Object.freeze({ owner: last.origin, checkpoint: 'afterTargetGeneration' });
}

export function evaluateBiome(
  catalog: Catalog,
  routeKey: string,
  plan: AuthoredBiomePlan,
  enteredBiomeCount: number,
  previous?: CompleteBiomeProjectEvaluation,
): ProjectBiomeEvaluation {
  return evaluateBiomeAssembly(catalog, routeKey, plan, enteredBiomeCount, previous).evaluation;
}

function evaluateBiomeAssembly(
  catalog: Catalog,
  routeKey: string,
  plan: AuthoredBiomePlan,
  enteredBiomeCount: number,
  previous?: CompleteBiomeProjectEvaluation,
): BiomeProjectEvaluationAssembly {
  const origin = createBiomeAddress(routeKey, plan.biomeKey);
  const completeness = evaluateBiomeCompleteness(catalog, origin, plan);
  if (completeness.completion === 'incomplete') {
    const progressive = evaluateProgressiveBiomeAssembly(
      catalog,
      origin,
      plan,
      enteredBiomeCount,
      previous === undefined
        ? undefined
        : { history: previous.history, rewardBranches: previous.rewards.branches },
    );
    if (progressive === null) {
      return Object.freeze({
        evaluation: Object.freeze({
          biomeKey: plan.biomeKey,
          origin,
          authoring: 'incomplete',
          frontier: completeness.frontier,
          coverage: Object.freeze({ kind: 'none', reason: 'notEvaluated' }),
          findings: completeness.findings,
        }),
        candidateArtifacts: createEmptyBiomeCandidateArtifacts(origin),
      });
    }
    return Object.freeze({
      evaluation: Object.freeze({
        biomeKey: plan.biomeKey,
        origin,
        authoring: 'incomplete',
        frontier: completeness.frontier,
        coverage: Object.freeze({
          kind: 'prefix',
          through: prefixCoveragePoint(progressive.evaluation.materializedPrefix),
          ...(progressive.evaluation.blockedAt === undefined
            ? {}
            : { blockedAt: progressive.evaluation.blockedAt }),
        }),
        materializedPrefix: progressive.evaluation.materializedPrefix,
        history: progressive.evaluation.history,
        roomGeneration: progressive.evaluation.roomGeneration,
        rewards: progressive.evaluation.rewards,
        findings: Object.freeze([...completeness.findings, ...progressive.evaluation.findings]),
      }),
      candidateArtifacts: progressive.candidateArtifacts,
    });
  }
  const snapshot = materializeBiome(catalog, origin, completeness);
  const seed: HistoryStateView | undefined = previous?.history.afterTransition;
  const history = composeBiomeHistory(catalog, snapshot, seed);
  const rewards = evaluateBiomeRewardsAssembly(
    catalog,
    snapshot,
    history,
    enteredBiomeCount,
    previous?.rewards.branches,
  );
  const roomGeneration = generation(
    catalog,
    snapshot,
    history,
    enteredBiomeCount,
    rewards.simulation,
    rewards.producerArtifacts,
    rewards.lifecycleArtifacts,
  );
  const findings = Object.freeze([
    ...roomGeneration.validation.findings,
    ...rewards.simulation.findings,
  ]);
  return Object.freeze({
    evaluation: Object.freeze({
      biomeKey: plan.biomeKey,
      origin,
      authoring: 'complete',
      coverage: Object.freeze({ kind: 'complete' }),
      validity:
        roomGeneration.validation.validity === 'valid' && rewards.simulation.validity === 'valid'
          ? 'valid'
          : 'invalid',
      snapshot,
      history,
      roomGeneration: roomGeneration.validation,
      rewards: rewards.simulation,
      findings,
    }),
    candidateArtifacts: roomGeneration.candidateArtifacts,
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
  if (configuredBiomeCount === 0) return 'empty';
  if (evaluations.some((evaluation) => evaluation.authoring === 'incomplete')) return 'incomplete';
  return evaluations.some(
    (evaluation) => evaluation.authoring === 'complete' && evaluation.validity === 'invalid',
  )
    ? 'invalid'
    : 'valid';
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

interface RouteProjectEvaluationAssembly {
  readonly evaluation: ProjectRouteEvaluation;
  readonly candidateArtifacts: readonly BiomeCandidateArtifacts[];
}

function evaluateRouteAssembly(
  catalog: Catalog,
  route: AuthoredRoutePlan,
): RouteProjectEvaluationAssembly {
  const evaluations: ProjectBiomeEvaluation[] = [];
  const candidateArtifacts: BiomeCandidateArtifacts[] = [];
  const completeValidPrefix: string[] = [];
  const findings: SemanticFinding[] = [];
  let active: ActiveRouteBiome | null = null;
  let blockedSuffix: readonly string[] = Object.freeze([]);
  for (const [index, plan] of route.biomes.entries()) {
    const previous = evaluations.at(-1);
    if (previous?.authoring === 'incomplete') {
      throw new ProjectSimulationContractError('incomplete biome cannot seed route continuation');
    }
    const assembled = evaluateBiomeAssembly(
      catalog,
      route.routeKey,
      plan,
      index + 1,
      previous?.authoring === 'complete' ? previous : undefined,
    );
    const evaluation = assembled.evaluation;
    evaluations.push(evaluation);
    candidateArtifacts.push(assembled.candidateArtifacts);
    findings.push(...evaluation.findings);
    if (evaluation.authoring === 'incomplete' || evaluation.validity === 'invalid') {
      active = Object.freeze({
        kind: evaluation.authoring === 'incomplete' ? 'incomplete' : 'invalid',
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
  return Object.freeze({
    evaluation: Object.freeze({
      routeKey: route.routeKey,
      status: routeStatus(route.biomes.length, frozenEvaluations),
      configuredBiomeKeys: Object.freeze(route.biomes.map((biome) => biome.biomeKey)),
      biomes: frozenEvaluations,
      processing,
      findings: Object.freeze(findings),
      summary: summarizeRoute(route.biomes.length, frozenEvaluations, processing),
    }),
    candidateArtifacts: Object.freeze(candidateArtifacts),
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
  return simulateProjectAssembly(catalog, project).evaluation;
}

export function simulateProjectAssembly(
  catalog: Catalog,
  project: ProjectDocument,
): ProjectEvaluationAssembly {
  assertProjectMatchesCatalog(catalog, project);
  const assembledRoutes = project.routes.map((route) => evaluateRouteAssembly(catalog, route));
  const routes = Object.freeze(assembledRoutes.map((route) => route.evaluation));
  const summary = summarizeProject(routes);
  const evaluation = Object.freeze({
    status:
      summary.configuredBiomeCount === 0
        ? 'empty'
        : summary.invalidBiomeCount > 0
          ? 'invalid'
          : summary.incompleteBiomeCount > 0
            ? 'incomplete'
            : 'valid',
    projectId: project.projectId,
    catalogVersion: project.catalogVersion,
    routes,
    findings: Object.freeze(routes.flatMap((route) => route.findings)),
    summary,
  });
  evaluationSourceProjects.set(evaluation, project);
  return new ExactProjectEvaluationAssembly(
    project,
    evaluation,
    createProjectCandidateArtifacts(assembledRoutes.flatMap((route) => route.candidateArtifacts)),
    exactProjectEvaluationAssemblyConstructionToken,
  );
}

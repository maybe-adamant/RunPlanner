import type { OccurrenceId } from '../../authored-project/model';
import type { Catalog } from '../../catalog-schema';
import { deriveNpcShoppingExecutionPolicy } from '../encounters/npc-shopping';
import {
  createBiomeAddress,
  createOccurrenceAddress,
  createRouteAddress,
  createKeepsakeEquipResultAddress,
  createStartingRewardAddress,
  createRouteStartKeepsakeSelectionAddress,
  semanticAddressKey,
  type SemanticAddress,
} from '../../authored-project/addresses';
import type {
  AuthoredBiomePlan,
  AuthoredRoutePlan,
  ProjectDocument,
  RouteLoadout,
} from '../../authored-project/model';
import { resolveRoutePosition } from '../../authored-project/route-context';
import { routeBindsRunStartReward } from '../../authored-project/route-profile';
import { forcedChaosOccurrenceKeysForRoute } from '../../authored-project/chaos-gate-reconciliation';
import {
  createProjectCandidateArtifacts,
  type BiomeCandidateArtifacts,
} from './candidate-artifacts';
import { type KeepsakeSelectionCandidateCapability } from '../keepsakes/candidate-artifacts';
import {
  assessExperimentalHammerEquipResult,
  assessJeweledPomEquipResult,
  assessTranscendentEmbryoBlessing,
} from '../keepsakes/trait-effects';
import { createKeepsakeState } from '../keepsakes/state';
import { createArcanaFearState } from '../arcana-fear';
import { createStartingRewardCandidateCapability } from '../candidates/reward-producer';
import { createInitialSimulationState } from '../state/construction';
import { createRouteStartHistoryView } from '../history/fold';
import type { SemanticFinding } from '../model';
import { createAssessmentIssue, type AssessmentIssue } from '../assessment-issue';
import { assessAuthoredHexTree } from '../../authored-project/traits/hex-tree';
import { hexTreeFindings } from '../rewards/trait-settlement/hex-settlement';
import { authoringRegion } from '../finding-regions';
import { resolveAuthoringBoundary } from '../progressive/authoring-boundary';
import {
  deriveResourceExecutionPolicy,
  effectiveRouteResourcePlacements,
  routeResourceAuthoring,
  resourcePlacementFindings,
} from '../resources';
import {
  createExactProjectEvaluationAssembly,
  ProjectSimulationContractError,
} from './project-evaluation-assembly';
import { evaluateBiomeAssembly } from './biome-evaluation';
import {
  routeStatus,
  summarizeRoute,
  type ActiveRouteBiome,
  type ProjectBiomeEvaluation,
  type ProjectEvaluation,
  type ProjectEvaluationAssembly,
  type AuthoringHorizon,
  type ProjectRouteEvaluation,
} from './evaluation-products';

function assertProjectMatchesCatalog(catalog: Catalog, project: ProjectDocument): void {
  if (project.catalogVersion !== catalog.version) {
    throw new ProjectSimulationContractError(
      `project catalog ${project.catalogVersion} does not match ${catalog.version}`,
    );
  }
  const declaration = catalog.routes.byKey[project.route.routeKey];
  if (declaration === undefined) {
    throw new ProjectSimulationContractError(`project route ${project.route.routeKey} is unknown`);
  }
  for (const [biomeIndex, plan] of project.route.biomes.entries()) {
    if (plan.biomeKey !== project.route.itineraryBiomeKeys[biomeIndex]) {
      throw new ProjectSimulationContractError(
        `${project.route.routeKey} biome ${biomeIndex} is not the authored route prefix`,
      );
    }
  }
}

interface RouteProjectEvaluationAssembly {
  readonly evaluation: ProjectRouteEvaluation;
  readonly candidateArtifacts: readonly BiomeCandidateArtifacts[];
  readonly routeStartKeepsakes: ReadonlyMap<string, KeepsakeSelectionCandidateCapability>;
  readonly routeStartKeepsakeEquipResults: ReadonlyMap<
    string,
    import('../keepsakes/candidate-artifacts').KeepsakeEquipResultCandidateCapability
  >;
  readonly routeStartRewards: ReadonlyMap<
    string,
    import('../candidates/reward-producer').StartingRewardCandidateCapability
  >;
  readonly authoringHorizon: AuthoringHorizon;
}

function normalizeAuthoringHorizonPredecessor(evaluation: ProjectBiomeEvaluation): SemanticAddress {
  const input = evaluation.requiredInput;
  if (input === undefined) {
    throw new ProjectSimulationContractError(
      `${evaluation.biomeKey} incomplete evaluation has no repair target`,
    );
  }

  const prefix = 'materializedPrefix' in evaluation ? evaluation.materializedPrefix : undefined;
  if (prefix !== undefined)
    return resolveAuthoringBoundary(prefix, landedOutcomeOccurrence(evaluation) ?? input);
  if (input.kind === 'biome' || input.kind === 'biomeField') return input;
  return createBiomeAddress(evaluation.origin.routeKey, evaluation.origin.biomeKey);
}

/** An automatic outcome is addressed by its source; it blocks where its cycle landed. */
function landedOutcomeOccurrence(evaluation: ProjectBiomeEvaluation): SemanticAddress | undefined {
  const input = evaluation.requiredInput;
  const occurrenceId = evaluation.requiredInputLocation?.roomOccurrenceId;
  return (input?.kind === 'steadyGrowthOutcome' || input?.kind === 'transcendentEmbryoOutcome') &&
    occurrenceId !== undefined
    ? createOccurrenceAddress(evaluation.origin, occurrenceId as OccurrenceId)
    : undefined;
}

type BiomeAssembly = ReturnType<typeof evaluateBiomeAssembly>;

// Completed biomes by predecessor evaluation (the catalog for the first biome),
// then plan, loadout and the route-wide inputs this biome reads.
const biomeAssemblies = new WeakMap<
  object,
  WeakMap<AuthoredBiomePlan, WeakMap<RouteLoadout, Map<string, BiomeAssembly>>>
>();

function evaluateCachedBiomeAssembly(
  catalog: Catalog,
  routeKey: string,
  plan: AuthoredBiomePlan,
  predecessor: ProjectBiomeEvaluation | undefined,
  context: Parameters<typeof evaluateBiomeAssembly>[3],
): BiomeAssembly {
  const biome = createBiomeAddress(routeKey, plan.biomeKey);
  const forcedChaos = (plan.topology?.occurrences ?? [])
    .map((occurrence) =>
      semanticAddressKey(createOccurrenceAddress(biome, occurrence.occurrenceId)),
    )
    .filter((key) => context.forcedChaosOccurrenceKeys?.has(key) === true)
    .sort();
  const placements = Object.entries(context.resourcePlacements).filter(
    ([, placement]) => placement?.biomeKey === plan.biomeKey,
  );
  const findings = (context.resourceFindings ?? []).filter(
    (finding) => finding.origin.kind === 'roomFeature' && finding.origin.biomeKey === plan.biomeKey,
  );
  const key = JSON.stringify([context.routePosition, forcedChaos, placements, findings]);
  const owner = predecessor ?? catalog;
  let byPlan = biomeAssemblies.get(owner);
  if (byPlan === undefined) biomeAssemblies.set(owner, (byPlan = new WeakMap()));
  let byLoadout = byPlan.get(plan);
  if (byLoadout === undefined) byPlan.set(plan, (byLoadout = new WeakMap()));
  let byInputs = byLoadout.get(context.loadout);
  if (byInputs === undefined) byLoadout.set(context.loadout, (byInputs = new Map()));
  const cached = byInputs.get(key);
  if (cached !== undefined) return cached;
  const assembled = evaluateBiomeAssembly(catalog, routeKey, plan, context);
  byInputs.set(key, assembled);
  return assembled;
}

function evaluateRouteAssembly(
  catalog: Catalog,
  route: AuthoredRoutePlan,
): RouteProjectEvaluationAssembly {
  const forcedChaos = forcedChaosOccurrenceKeysForRoute(route, catalog);
  const evaluations: ProjectBiomeEvaluation[] = [];
  const candidateArtifacts: BiomeCandidateArtifacts[] = [];
  const completeValidPrefix: string[] = [];
  const findings: SemanticFinding[] = [];
  let active: ActiveRouteBiome | null = null;
  let blockedSuffix: readonly string[] = Object.freeze([]);
  let routeStartBlock: 'incomplete' | 'invalid' | null = null;
  let routeStartIssue: AssessmentIssue | undefined;
  let authoringHorizon: AuthoringHorizon = Object.freeze({ kind: 'open' });
  const routeStartKeepsakes = new Map<string, KeepsakeSelectionCandidateCapability>();
  const routeStartKeepsakeEquipResults = new Map<
    string,
    import('../keepsakes/candidate-artifacts').KeepsakeEquipResultCandidateCapability
  >();
  const routeStartRewards = new Map<
    string,
    import('../candidates/reward-producer').StartingRewardCandidateCapability
  >();
  const resourceAuthoring = routeResourceAuthoring(catalog, route);
  const resourceFindings = resourcePlacementFindings(route.routeKey, resourceAuthoring);
  const startingReward = createStartingRewardAddress(route.routeKey);
  const routeStart = createRouteStartKeepsakeSelectionAddress(route.routeKey);
  const runStartReward = routeBindsRunStartReward(catalog, route.routeKey);
  const startArcanaFear = createArcanaFearState(catalog, route.loadout);
  const routeStartKeepsake =
    route.loadout.startingKeepsakeKey === null
      ? undefined
      : catalog.keepsakes.byKey[route.loadout.startingKeepsakeKey];
  const declaredEffect = routeStartKeepsake?.effect;
  const routeStartEffect =
    declaredEffect?.kind === 'jeweledPom' ||
    declaredEffect?.kind === 'experimentalHammer' ||
    declaredEffect?.kind === 'transcendentEmbryo'
      ? declaredEffect
      : undefined;
  // The reached route-start snapshot: declared loadout identity and the
  // configured Arcana/Fear frontier, before any equip result is applied.
  const routeStartState =
    routeStartKeepsake === undefined || routeStartEffect === undefined
      ? undefined
      : createInitialSimulationState(
          catalog,
          route.loadout,
          routeStartKeepsake.key,
          startArcanaFear,
          Object.freeze({
            routePosition: resolveRoutePosition(catalog, route, route.itineraryBiomeKeys[0]!),
            historyView: createRouteStartHistoryView(),
          }),
        );
  routeStartKeepsakes.set(
    semanticAddressKey(routeStart),
    Object.freeze({
      state:
        routeStartState?.keepsakes ??
        createKeepsakeState(catalog, route.loadout.startingKeepsakeKey, startArcanaFear),
      encounterBlockedKeepsakeKeys: Object.freeze([]),
    }),
  );
  // Aspect of Selene's Sky Fall tree is installed before any route-start effect.
  const aspectHexTree = route.loadout.aspectHexTree;
  const aspectHexFindings =
    aspectHexTree === undefined
      ? []
      : hexTreeFindings(
          createRouteAddress(route.routeKey),
          'SpellMoonBeamTrait',
          assessAuthoredHexTree(catalog, 'SpellMoonBeamTrait', aspectHexTree),
          'routeStart',
        );
  if (aspectHexFindings.length > 0) {
    findings.push(...aspectHexFindings);
    routeStartBlock = 'invalid';
    const origin = aspectHexFindings[0]!.origin;
    routeStartIssue = createAssessmentIssue(origin, authoringRegion(origin), findings);
  }
  if (
    routeStartKeepsake !== undefined &&
    routeStartEffect !== undefined &&
    routeStartState !== undefined
  ) {
    const result = createKeepsakeEquipResultAddress(routeStart, routeStartEffect.kind);
    const authoredResult = route.loadout.keepsakeEquipResults?.[routeStartEffect.kind];
    if (authoredResult === undefined) {
      if (routeStartBlock === null) {
        routeStartBlock = 'incomplete';
        authoringHorizon = Object.freeze({
          kind: 'incomplete',
          blockedAfter: result,
        });
      }
      findings.push(
        Object.freeze({
          code: 'keepsakeEquipResultMissing',
          phase: 'rewardGeneration',
          origin: result,
          evidence: Object.freeze({ keepsakeKey: routeStartKeepsake.key }),
        }),
      );
    } else if (
      !(routeStartEffect.kind === 'jeweledPom'
        ? assessJeweledPomEquipResult(
            catalog,
            route.loadout.keepsakeEquipResults!.jeweledPom!,
            routeStartState,
            routeStartState.keepsakes.fatedStatus,
          ).legal
        : routeStartEffect.kind === 'experimentalHammer'
          ? assessExperimentalHammerEquipResult(
              catalog,
              route.loadout.keepsakeEquipResults!.experimentalHammer!,
              routeStartState,
            ).legal
          : assessTranscendentEmbryoBlessing(
              catalog,
              route.loadout.keepsakeEquipResults!.transcendentEmbryo!,
              routeStartState.traitHistory,
              routeStartEffect.blessingRarityByRank[routeStartKeepsake.rank],
              {
                aspectKey: routeStartState.equipment.aspectKey,
                routeKey: routeStartState.reached.routePosition.routeKey,
              },
            ).legal)
    ) {
      if (routeStartBlock === null) routeStartBlock = 'invalid';
      findings.push(
        Object.freeze({
          code: 'keepsakeEquipResultUnavailable',
          phase: 'rewardGeneration',
          origin: result,
          evidence: Object.freeze({ keepsakeKey: routeStartKeepsake.key }),
        }),
      );
    }
    if (routeStartBlock !== null && routeStartIssue === undefined)
      routeStartIssue = createAssessmentIssue(result, authoringRegion(result), findings);
    routeStartKeepsakeEquipResults.set(
      semanticAddressKey(result),
      Object.freeze({
        frontiers: Object.freeze([
          Object.freeze({
            state: routeStartState,
            ...(routeStartEffect.kind === 'transcendentEmbryo'
              ? {
                  transcendentEmbryoRarity:
                    routeStartEffect.blessingRarityByRank[routeStartKeepsake.rank],
                }
              : {}),
          }),
        ]),
      }),
    );
  }
  if (runStartReward && routeStartBlock === null) {
    routeStartRewards.set(
      semanticAddressKey(startingReward),
      createStartingRewardCandidateCapability(
        catalog,
        route.routeKey,
        startingReward,
        route.loadout,
        resolveRoutePosition(catalog, route, route.itineraryBiomeKeys[0]!),
      ),
    );
  }
  if (runStartReward && route.biomes.length > 0 && route.loadout.startingReward === null) {
    findings.push(
      Object.freeze({
        code: 'rewardMissing',
        phase: 'rewardGeneration',
        origin: startingReward,
        evidence: Object.freeze({ source: 'runStart' }),
      }),
    );
    if (routeStartBlock === null) {
      routeStartBlock = 'incomplete';
      authoringHorizon = Object.freeze({ kind: 'incomplete', blockedAfter: startingReward });
      routeStartIssue = createAssessmentIssue(
        startingReward,
        authoringRegion(startingReward),
        findings,
      );
    }
  }
  if (routeStartBlock !== null) {
    blockedSuffix = Object.freeze(route.biomes.map((biome) => biome.biomeKey));
  }
  for (const [index, plan] of routeStartBlock === null ? route.biomes.entries() : []) {
    const previous = evaluations.at(-1);
    if (previous?.authoring === 'incomplete' && previous.validity !== 'invalid') {
      throw new ProjectSimulationContractError('incomplete biome cannot seed route continuation');
    }
    if (previous?.validity === 'invalid') {
      throw new ProjectSimulationContractError('invalid biome cannot seed route continuation');
    }
    const seed =
      previous?.authoring === 'complete' && previous.validity === 'valid'
        ? Object.freeze({
            history: previous.history,
            rewardBranches: previous.rewards.branches,
          })
        : undefined;
    const routePosition = resolveRoutePosition(catalog, route, plan.biomeKey);
    const context = Object.freeze({
      routePosition,
      forcedChaosOccurrenceKeys: forcedChaos,
      loadout: route.loadout,
      resourcePlacements: effectiveRouteResourcePlacements(resourceAuthoring),
      resourceFindings,
      ...(seed === undefined ? {} : { seed }),
    });
    const assembled = evaluateCachedBiomeAssembly(catalog, route.routeKey, plan, previous, context);
    const evaluation = assembled.evaluation;
    evaluations.push(evaluation);
    candidateArtifacts.push(assembled.candidateArtifacts);
    findings.push(...evaluation.findings);
    if (evaluation.authoring === 'incomplete' || evaluation.validity === 'invalid') {
      if (evaluation.requiredInput !== undefined) {
        const blockedAfter = normalizeAuthoringHorizonPredecessor(evaluation);
        authoringHorizon = Object.freeze({
          kind: 'incomplete',
          blockedAfter,
        });
      }
      active = Object.freeze({
        kind:
          evaluation.requiredInput !== undefined || evaluation.validity !== 'invalid'
            ? 'incomplete'
            : 'invalid',
        biomeKey: evaluation.biomeKey,
      });
      blockedSuffix = Object.freeze(route.biomes.slice(index + 1).map((biome) => biome.biomeKey));
      break;
    }
    completeValidPrefix.push(evaluation.biomeKey);
  }
  const frozenEvaluations = Object.freeze(evaluations);
  const completeValidEvaluations = frozenEvaluations.filter(
    (evaluation): evaluation is Extract<ProjectBiomeEvaluation, { validity: 'valid' }> =>
      evaluation.authoring === 'complete' && evaluation.validity === 'valid',
  );
  const resources = deriveResourceExecutionPolicy(
    catalog,
    completeValidEvaluations,
    resourceAuthoring,
  );
  const processing = Object.freeze({
    completeValidPrefix: Object.freeze(completeValidPrefix),
    active,
    blockedSuffix,
  });
  const status = routeStatus(route.biomes.length, frozenEvaluations, routeStartBlock);
  const issue = status === 'empty' ? undefined : (routeStartIssue ?? evaluations.at(-1)?.issue);
  if ((status === 'incomplete' || status === 'invalid') && issue === undefined)
    throw new ProjectSimulationContractError('blocked route has no selected assessment issue');
  return Object.freeze({
    evaluation: Object.freeze({
      routeKey: route.routeKey,
      status,
      configuredBiomeKeys: Object.freeze(route.biomes.map((biome) => biome.biomeKey)),
      biomes: frozenEvaluations,
      processing,
      ...(issue === undefined ? {} : { issue }),
      findings: Object.freeze(findings),
      summary: summarizeRoute(route.biomes.length, frozenEvaluations, processing),
      resources,
      npcShopping: deriveNpcShoppingExecutionPolicy(
        catalog,
        frozenEvaluations.flatMap((biome) => ('history' in biome ? [biome.history] : [])),
      ),
    }),
    candidateArtifacts: Object.freeze(candidateArtifacts),
    routeStartKeepsakes,
    routeStartKeepsakeEquipResults,
    routeStartRewards,
    authoringHorizon,
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
  const assembledRoute = evaluateRouteAssembly(catalog, project.route);
  const route = assembledRoute.evaluation;
  const evaluation = Object.freeze({
    status: route.status,
    projectId: project.projectId,
    catalogVersion: project.catalogVersion,
    route,
    ...(route.issue === undefined ? {} : { issue: route.issue }),
    findings: Object.freeze(route.findings),
    summary: route.summary,
    authoringHorizon: assembledRoute.authoringHorizon,
  });
  return createExactProjectEvaluationAssembly(
    project,
    evaluation,
    createProjectCandidateArtifacts(
      assembledRoute.candidateArtifacts,
      assembledRoute.routeStartKeepsakes,
      assembledRoute.routeStartKeepsakeEquipResults,
      assembledRoute.routeStartRewards,
    ),
  );
}

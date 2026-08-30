import type { Catalog } from '../catalog-schema';
import {
  createBiomeAddress,
  createKeepsakeEquipResultAddress,
  createOccurrenceAddress,
  createRouteStartKeepsakeSelectionAddress,
  semanticAddressKey,
} from '../authored-project/addresses';
import type { AuthoredRoutePlan, ProjectDocument } from '../authored-project/model';
import { forcedChaosOccurrenceKeysForRoute } from '../authored-project/chaos-gate-reconciliation';
import {
  createProjectCandidateArtifacts,
  type BiomeCandidateArtifacts,
  type KeepsakeSelectionCandidateCapability,
} from './candidate-artifacts';
import {
  assessExperimentalHammerEquipResult,
  assessJeweledPomEquipResult,
  assessTranscendentEmbryoBlessing,
  createKeepsakeState,
} from './keepsakes';
import { createArcanaFearState } from './arcana-fear';
import { createTraitHistoryState } from './trait-history';
import type { BiomeHistoryPrefix } from './history';
import type { MaterializedBiomePrefix } from './materialization';
import type { SemanticFinding } from './model';
import { effectiveRouteResourcePlacements, routeResourceAuthoring } from './resources';
import {
  createExactProjectEvaluationAssembly,
  ProjectSimulationContractError,
} from './project-evaluation-assembly';
import { evaluateBiomeAssembly, materializedBiomePrefixCoveragePoint } from './biome-evaluation';
import {
  routeStatus,
  summarizeRoute,
  type ActiveRouteBiome,
  type ProjectBiomeEvaluation,
  type ProjectEvaluation,
  type ProjectEvaluationAssembly,
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
    if (plan.biomeKey !== declaration.biomeKeys[biomeIndex]) {
      throw new ProjectSimulationContractError(
        `${project.route.routeKey} biome ${biomeIndex} is not the declared route prefix`,
      );
    }
  }
}

function retainInvalidResourceEvaluation(
  evaluation: ProjectBiomeEvaluation,
  resourceFindings: readonly SemanticFinding[],
): ProjectBiomeEvaluation {
  const findings = Object.freeze([...evaluation.findings, ...resourceFindings]);
  if (evaluation.authoring === 'incomplete' || evaluation.validity === 'invalid') {
    return Object.freeze({ ...evaluation, validity: 'invalid' as const, findings });
  }
  const materializedPrefix: MaterializedBiomePrefix = Object.freeze({
    kind: 'biomePrefix',
    routeKey: evaluation.snapshot.routeKey,
    biomeKey: evaluation.snapshot.biomeKey,
    entryRoom: evaluation.snapshot.entryRoom,
    decisions: evaluation.snapshot.decisions,
    fixedRoomLinks: evaluation.snapshot.fixedRoomLinks,
    biomeState: evaluation.snapshot.biomeState,
    ...(evaluation.snapshot.echoKeepsakeReplayResults === undefined
      ? {}
      : { echoKeepsakeReplayResults: evaluation.snapshot.echoKeepsakeReplayResults }),
  });
  const history: BiomeHistoryPrefix = Object.freeze({
    routeKey: evaluation.history.routeKey,
    biomeKey: evaluation.history.biomeKey,
    events: evaluation.history.events,
    ledgers: evaluation.history.ledgers,
    rooms: evaluation.history.rooms,
    current: evaluation.history.biomeCompletion,
  });
  return Object.freeze({
    biomeKey: evaluation.biomeKey,
    origin: evaluation.origin,
    authoring: 'complete',
    validity: 'invalid',
    coverage: Object.freeze({
      kind: 'prefix',
      through: materializedBiomePrefixCoveragePoint(materializedPrefix),
    }),
    materializedPrefix,
    history,
    roomGeneration: evaluation.roomGeneration,
    rewards: evaluation.rewards,
    findings,
  });
}

interface RouteProjectEvaluationAssembly {
  readonly evaluation: ProjectRouteEvaluation;
  readonly candidateArtifacts: readonly BiomeCandidateArtifacts[];
  readonly routeStartKeepsakes: ReadonlyMap<string, KeepsakeSelectionCandidateCapability>;
  readonly routeStartKeepsakeEquipResults: ReadonlyMap<
    string,
    import('./candidate-artifacts').KeepsakeEquipResultCandidateCapability
  >;
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
  const routeStartKeepsakes = new Map<string, KeepsakeSelectionCandidateCapability>();
  const routeStartKeepsakeEquipResults = new Map<
    string,
    import('./candidate-artifacts').KeepsakeEquipResultCandidateCapability
  >();
  const resourceAuthoring = routeResourceAuthoring(catalog, route);
  const resourceFindingsByBiome = new Map<string, SemanticFinding[]>();
  for (const family of ['Pickaxe', 'Exorcism', 'Shovel', 'Fishing'] as const) {
    const placement = resourceAuthoring.placements[family];
    const assessment = resourceAuthoring.assessmentByFamily[family];
    if (placement === null || assessment?.legal === true) continue;
    const finding = Object.freeze({
      code: 'resourcePlacementUnavailable' as const,
      severity: 'error' as const,
      phase: 'roomGeneration' as const,
      origin: createOccurrenceAddress(
        createBiomeAddress(route.routeKey, placement.biomeKey),
        placement.occurrenceId,
      ),
      evidence: Object.freeze({ family, reasons: assessment?.reasons ?? [] }),
    });
    const atBiome = resourceFindingsByBiome.get(placement.biomeKey) ?? [];
    atBiome.push(finding);
    resourceFindingsByBiome.set(placement.biomeKey, atBiome);
  }
  const routeStart = createRouteStartKeepsakeSelectionAddress(route.routeKey);
  routeStartKeepsakes.set(
    semanticAddressKey(routeStart),
    Object.freeze({
      state: createKeepsakeState(
        catalog,
        route.loadout.startingKeepsakeKey,
        createArcanaFearState(catalog, route.loadout),
      ),
      encounterBlockedKeepsakeKeys: Object.freeze([]),
    }),
  );
  const routeStartEffect = catalog.keepsakes.byKey[route.loadout.startingKeepsakeKey]?.effect;
  if (
    routeStartEffect !== undefined &&
    (routeStartEffect.kind === 'jeweledPom' ||
      routeStartEffect.kind === 'experimentalHammer' ||
      routeStartEffect.kind === 'transcendentEmbryo')
  ) {
    const result = createKeepsakeEquipResultAddress(routeStart, routeStartEffect.kind);
    const startArcanaFear = createArcanaFearState(catalog, route.loadout);
    const startKeepsakes = createKeepsakeState(
      catalog,
      route.loadout.startingKeepsakeKey,
      startArcanaFear,
    );
    const authoredResult = route.loadout.keepsakeEquipResults?.[routeStartEffect.kind];
    if (authoredResult === undefined) {
      routeStartBlock = 'incomplete';
      findings.push(
        Object.freeze({
          code: 'keepsakeEquipResultMissing',
          severity: 'error',
          phase: 'rewardGeneration',
          origin: result,
          evidence: Object.freeze({ keepsakeKey: route.loadout.startingKeepsakeKey }),
        }),
      );
    } else if (
      !(routeStartEffect.kind === 'jeweledPom'
        ? assessJeweledPomEquipResult(
            catalog,
            route.loadout.keepsakeEquipResults!.jeweledPom!,
            createTraitHistoryState(),
            startKeepsakes.fatedStatus,
          ).legal
        : routeStartEffect.kind === 'experimentalHammer'
          ? assessExperimentalHammerEquipResult(
              catalog,
              route.loadout.keepsakeEquipResults!.experimentalHammer!,
              createTraitHistoryState(),
              route.loadout,
            ).legal
          : assessTranscendentEmbryoBlessing(
              catalog,
              route.loadout.keepsakeEquipResults!.transcendentEmbryo!,
              createTraitHistoryState(),
              routeStartEffect.blessingRarityByRank[
                catalog.keepsakes.byKey[route.loadout.startingKeepsakeKey]?.rank ?? 'Epic'
              ],
              route.loadout,
            ).legal)
    ) {
      routeStartBlock = 'invalid';
      findings.push(
        Object.freeze({
          code: 'keepsakeEquipResultUnavailable',
          severity: 'error',
          phase: 'rewardGeneration',
          origin: result,
          evidence: Object.freeze({ keepsakeKey: route.loadout.startingKeepsakeKey }),
        }),
      );
    }
    routeStartKeepsakeEquipResults.set(
      semanticAddressKey(result),
      Object.freeze({
        frontiers: Object.freeze([
          Object.freeze({
            before: createTraitHistoryState(),
            arcanaFear: startArcanaFear,
            fatedStatus: startKeepsakes.fatedStatus,
            loadout: route.loadout,
            ...(routeStartEffect.kind === 'transcendentEmbryo'
              ? {
                  transcendentEmbryoRarity:
                    routeStartEffect.blessingRarityByRank[
                      catalog.keepsakes.byKey[route.loadout.startingKeepsakeKey]?.rank ?? 'Epic'
                    ],
                }
              : {}),
          }),
        ]),
      }),
    );
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
        ? Object.freeze({ history: previous.history, rewardBranches: previous.rewards.branches })
        : undefined;
    const context = Object.freeze({
      enteredBiomeCount: index + 1,
      forcedChaosOccurrenceKeys: forcedChaos,
      loadout: route.loadout,
      resourcePlacements: effectiveRouteResourcePlacements(catalog, route),
      ...(seed === undefined ? {} : { seed }),
    });
    const assembled = evaluateBiomeAssembly(catalog, route.routeKey, plan, context);
    const resourceFindings = resourceFindingsByBiome.get(plan.biomeKey) ?? [];
    const evaluation =
      resourceFindings.length === 0
        ? assembled.evaluation
        : retainInvalidResourceEvaluation(assembled.evaluation, resourceFindings);
    evaluations.push(evaluation);
    candidateArtifacts.push(assembled.candidateArtifacts);
    findings.push(...evaluation.findings);
    if (evaluation.authoring === 'incomplete' || evaluation.validity === 'invalid') {
      active = Object.freeze({
        kind: evaluation.validity === 'invalid' ? 'invalid' : 'incomplete',
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
      status: routeStatus(route.biomes.length, frozenEvaluations, routeStartBlock),
      configuredBiomeKeys: Object.freeze(route.biomes.map((biome) => biome.biomeKey)),
      biomes: frozenEvaluations,
      processing,
      findings: Object.freeze(findings),
      summary: summarizeRoute(route.biomes.length, frozenEvaluations, processing),
    }),
    candidateArtifacts: Object.freeze(candidateArtifacts),
    routeStartKeepsakes,
    routeStartKeepsakeEquipResults,
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
    findings: Object.freeze(route.findings),
    summary: route.summary,
  });
  return createExactProjectEvaluationAssembly(
    project,
    evaluation,
    createProjectCandidateArtifacts(
      assembledRoute.candidateArtifacts,
      assembledRoute.routeStartKeepsakes,
      assembledRoute.routeStartKeepsakeEquipResults,
    ),
  );
}

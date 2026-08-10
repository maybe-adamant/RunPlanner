import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAdditionalExitAddress,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createLocalChildAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createShopPurchaseAddress,
  createTargetAddress,
  semanticAddressKey,
  type AuthoredBiomePlan,
  type ProjectDocument,
  type TraitOfferAddress,
} from '@run-planner/engine/authored-project';
import {
  encounterPhaseCandidateSupportForProjectEvaluationAssembly,
  simulateProject,
  simulateProjectAssembly,
  type CanonicalBatch,
  type CanonicalBiome,
  type CanonicalHubDecision,
  type MaterializedBiomePrefix,
  type ProjectEvaluation,
  type ProjectEvaluationAssembly,
  type SemanticFinding,
} from '@run-planner/engine/simulation';
import { describe, expect, it, vi } from 'vitest';

import {
  authorLegalTraitOffers,
  createGoldenFGHIProject,
  goldenFBiome,
} from '@run-planner/test-fixtures';
import {
  appendNEntry,
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceId,
  oBiome,
  oOccurrenceIds,
} from '@run-planner/test-fixtures';
import {
  expectedWorkspaceEncounterPhaseLeafRequirements,
  expectedWorkspaceLeafRequirements,
  type ExpectedWorkspaceLeafInteraction,
} from '@planner-test/support/structured-workspace/expected-leaves';
import {
  expectedWorkspaceStructuralControls,
  type ExpectedWorkspaceStructuralControl,
} from '@planner-test/support/structured-workspace/expected-structural-controls';
import { expectedWorkspaceTopologyManifest } from '@planner-test/support/structured-workspace/expected-topology';
import { assertExpectedWorkspaceLeafClosure } from '@planner-test/support/structured-workspace/leaf-closure';
import { observeWorkspaceProducts } from '@planner-test/support/structured-workspace/observed-workspace';
import { assertObservedOwner } from '@planner-test/support/structured-workspace/closure-primitives';
import {
  assertExpectedWorkspaceStructuralControlClosure,
  assertRenderedWorkspaceStructuralControlClosure,
} from '@planner-test/support/structured-workspace/structural-control-closure';
import { assertExpectedWorkspaceTopologyClosure } from '@planner-test/support/structured-workspace/topology-closure';
import { unsafeOmitWorkspaceProperty } from '@planner-test/support/structured-workspace/unsafe-product-mutation';
import { createCandidateSessionFactory } from './candidateProjection';
import type { CandidateProjectionSession, CandidateSessionFactory } from './candidateProjection';
import { createContextualOptionResolver } from './contextualOptions';
import { createContextualPickerProjection } from './contextualPicker';
import { createRewardPickerProjection } from './rewardPicker';
import { createTraitDomainProjection } from './traitDomainProjection';
import { StructuredWorkspaceProjectionContractError } from './structured-workspace/contract';
import {
  createStructuredWorkspaceProjection,
  type WorkspaceInteractionCatalog,
  type WorkspaceMixedBatchNode,
  type WorkspaceOrdinaryBatchNode,
  type WorkspaceTakeoverBatchNode,
} from './structured-workspace';

type WorkspaceBatchNode =
  WorkspaceMixedBatchNode | WorkspaceOrdinaryBatchNode | WorkspaceTakeoverBatchNode;

/**
 * These tests deliberately bypass only assembly provenance. Production still
 * rejects foreign assemblies; the seam lets this adapter prove it rejects a
 * malformed evaluator overlay before React can render it.
 */
vi.mock('@run-planner/engine/simulation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@run-planner/engine/simulation')>();
  return {
    ...actual,
    assertProjectEvaluationAssembly: () => undefined,
    encounterPhaseCandidateSupportForProjectEvaluationAssembly: (
      ...args: Parameters<typeof actual.encounterPhaseCandidateSupportForProjectEvaluationAssembly>
    ) => {
      try {
        return actual.encounterPhaseCandidateSupportForProjectEvaluationAssembly(...args);
      } catch {
        // A deliberately forged evaluator overlay has no exact candidate
        // capability. Withhold phase controls so the overlay guard under test
        // can reject its malformed evaluator product first.
        return undefined;
      }
    },
  };
});

function withMalformedAuthoredBiome(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  transform: (plan: AuthoredBiomePlan) => AuthoredBiomePlan,
): ProjectDocument {
  let replaced = false;
  const routes = project.routes.map((route) => {
    if (route.routeKey !== routeKey) return route;
    return {
      ...route,
      biomes: route.biomes.map((plan) => {
        if (plan.biomeKey !== biomeKey) return plan;
        replaced = true;
        return transform(plan);
      }),
    };
  });
  if (!replaced) throw new Error('authored biome is missing');
  return { ...project, routes };
}

const inertCandidateSessions: CandidateSessionFactory = Object.freeze({
  bind(assembly: ProjectEvaluationAssembly) {
    // Malformed-overlay tests never activate candidate loaders. Their inert
    // session prevents the real exact-session boundary from accepting a
    // deliberately forged assembly while preserving projection guard coverage.
    return Object.freeze({
      project: assembly.project,
      evaluation: assembly.evaluation,
    }) as CandidateProjectionSession;
  },
});

function projection(
  candidateSessions: CandidateSessionFactory = createCandidateSessionFactory(catalog),
) {
  const contextualPicker = createContextualPickerProjection(
    createContextualOptionResolver(catalog),
  );
  return createStructuredWorkspaceProjection(
    catalog,
    {
      candidateSessions,
      contextualPicker,
      rewardPicker: createRewardPickerProjection(catalog, contextualPicker),
      traitDomain: createTraitDomainProjection(catalog, contextualPicker),
    },
    () => createOccurrenceId('structured-workspace-contract-start'),
  );
}

function projectWorkspace(project: ProjectDocument, evaluation?: ProjectEvaluation) {
  const assembly = simulateProjectAssembly(catalog, project);
  if (evaluation === undefined) return projection().project(assembly);
  return projection(inertCandidateSessions).project(Object.freeze({ ...assembly, evaluation }));
}

function fBatch(snapshot: CanonicalBiome): CanonicalBatch {
  const batch = snapshot.decisions.find(
    (decision): decision is CanonicalBatch => decision.kind === 'batch',
  );
  if (batch === undefined) throw new Error('complete F fixture has no canonical batch');
  return batch;
}

function withMalformedFSnapshot(
  evaluation: ProjectEvaluation,
  transform: (snapshot: CanonicalBiome) => CanonicalBiome,
): ProjectEvaluation {
  let replaced = false;
  const routes = evaluation.routes.map((route) => {
    if (route.routeKey !== 'Underworld') return route;
    return {
      ...route,
      biomes: route.biomes.map((biome) => {
        if (biome.biomeKey !== 'F') return biome;
        if (biome.authoring !== 'complete' || biome.validity !== 'valid') {
          throw new Error('F fixture must be complete-valid');
        }
        replaced = true;
        return { ...biome, snapshot: transform(biome.snapshot) };
      }),
    };
  });
  if (!replaced) throw new Error('complete F fixture was not evaluated');
  return { ...evaluation, routes };
}

function withMalformedPrefix(
  evaluation: ProjectEvaluation,
  routeKey: string,
  biomeKey: string,
  transform: (prefix: MaterializedBiomePrefix) => MaterializedBiomePrefix,
): ProjectEvaluation {
  let replaced = false;
  const routes = evaluation.routes.map((route) => {
    if (route.routeKey !== routeKey) return route;
    return {
      ...route,
      biomes: route.biomes.map((biome) => {
        if (biome.biomeKey !== biomeKey) return biome;
        if (!('materializedPrefix' in biome))
          throw new Error(`${biomeKey} fixture must have a prefix`);
        replaced = true;
        return {
          ...biome,
          materializedPrefix: transform(biome.materializedPrefix),
          ...(biome.assessmentPrefix === undefined
            ? {}
            : { assessmentPrefix: transform(biome.assessmentPrefix) }),
        };
      }),
    };
  });
  if (!replaced) throw new Error(`${biomeKey} prefix fixture was not evaluated`);
  return { ...evaluation, routes };
}

function withMalformedNSnapshot(
  evaluation: ProjectEvaluation,
  transform: (snapshot: CanonicalBiome) => CanonicalBiome,
): ProjectEvaluation {
  let replaced = false;
  const routes = evaluation.routes.map((route) => {
    if (route.routeKey !== 'Surface') return route;
    return {
      ...route,
      biomes: route.biomes.map((biome) => {
        if (biome.biomeKey !== 'N') return biome;
        if (biome.authoring !== 'complete' || biome.validity !== 'valid') {
          throw new Error('N fixture must be complete-valid');
        }
        replaced = true;
        return { ...biome, snapshot: transform(biome.snapshot) };
      }),
    };
  });
  if (!replaced) throw new Error('complete N fixture was not evaluated');
  return { ...evaluation, routes };
}

function nHub(snapshot: CanonicalBiome): CanonicalHubDecision {
  const hub = snapshot.decisions.find(
    (decision): decision is CanonicalHubDecision => decision.kind === 'hub',
  );
  if (hub === undefined) throw new Error('complete N fixture has no canonical Hub');
  return hub;
}

function withoutLeafInteraction(
  interactions: WorkspaceInteractionCatalog,
  expected: ExpectedWorkspaceLeafInteraction,
): WorkspaceInteractionCatalog {
  const without = <T>(source: ReadonlyMap<string, T>) => {
    const result = new Map(source);
    result.delete(expected.key);
    return result;
  };
  switch (expected.kind) {
    case 'encounterPhase':
      return { ...interactions, encounterPhases: without(interactions.encounterPhases) };
    case 'reward':
      return { ...interactions, rewards: without(interactions.rewards) };
    case 'rewardWheelOfferCount':
      return {
        ...interactions,
        rewardWheelOfferCounts: without(interactions.rewardWheelOfferCounts),
      };
    case 'rewardWheelPick':
      return { ...interactions, rewardWheelPicks: without(interactions.rewardWheelPicks) };
    case 'rewardWheelStore':
      return { ...interactions, rewardWheelStores: without(interactions.rewardWheelStores) };
    case 'shipCombatPhaseCount':
      return {
        ...interactions,
        shipCombatPhaseCounts: without(interactions.shipCombatPhaseCounts),
      };
    case 'shopPurchase':
      return {
        ...interactions,
        shopPurchaseOrders: without(interactions.shopPurchaseOrders),
      };
    case 'sideRoomEntryOrder':
      return { ...interactions, sideRoomEntryOrders: without(interactions.sideRoomEntryOrders) };
    case 'sideRoomGeneration':
      return { ...interactions, sideRoomGenerations: without(interactions.sideRoomGenerations) };
    case 'traitOffer':
      return { ...interactions, traitOffers: without(interactions.traitOffers) };
  }
}

function withoutStructuralInteraction(
  interactions: WorkspaceInteractionCatalog,
  expected: ExpectedWorkspaceStructuralControl,
): WorkspaceInteractionCatalog {
  const without = <T>(source: ReadonlyMap<string, T>) => {
    const result = new Map(source);
    result.delete(expected.key);
    return result;
  };
  switch (expected.kind) {
    case 'batchRewardStore':
      return { ...interactions, batchRewardStores: without(interactions.batchRewardStores) };
    case 'decisionEntryRoomPicker':
      return { ...interactions, rooms: without(interactions.rooms) };
    case 'exitFrontierCapability':
      return {
        ...interactions,
        exitFrontierCapabilities: without(interactions.exitFrontierCapabilities),
      };
    case 'exitSelection':
      return { ...interactions, exitSelections: without(interactions.exitSelections) };
    case 'fieldsCageOutcome':
      return { ...interactions, fieldsCageOutcomes: without(interactions.fieldsCageOutcomes) };
    case 'hubTakeover':
      return { ...interactions, hubTakeovers: without(interactions.hubTakeovers) };
    case 'hubSlot':
      return { ...interactions, hubSlots: without(interactions.hubSlots) };
    case 'hubVisitOrder':
      return { ...interactions, hubVisitOrders: without(interactions.hubVisitOrders) };
    case 'roomPicker':
      return { ...interactions, rooms: without(interactions.rooms) };
    case 'start':
      return { ...interactions, starts: without(interactions.starts) };
    case 'structural':
      return { ...interactions, structural: without(interactions.structural) };
    case 'takeoverBatch':
      return { ...interactions, takeoverBatches: without(interactions.takeoverBatches) };
    case 'topologyRemoval':
      return { ...interactions, topologyRemovals: without(interactions.topologyRemovals) };
    case 'zagreusSpawn':
      return { ...interactions, zagreusSpawns: without(interactions.zagreusSpawns) };
    case 'naturalChaosSpawn':
      return { ...interactions, naturalChaosSpawns: without(interactions.naturalChaosSpawns) };
  }
}

/*
 * A15.2 ownership inventory for this suite:
 * overlay owns duplicate authored identities, evaluator-only decisions/targets, and the mismatched
 * Hub visit; exact finding routing owns missing and dormant fine-grained destinations; leaf closure
 * owns omitted markers/destinations/interactions; topology closure owns route-wide reachability,
 * nested occurrence packages, and target/Hub sub-owner mutations; structural-control closure owns
 * exhaustive control handoff and omission mutations. The former Ephyra expectation-policy case is
 * deleted here because `expected-leaves.test.ts` is now its sole owner.
 */

describe('structured workspace overlay contract', () => {
  it('rejects duplicate authored topology identities before materialization', () => {
    const fProject = createGoldenFGHIProject();
    const fEvaluation = simulateProject(catalog, fProject);
    const duplicateOccurrence = withMalformedAuthoredBiome(fProject, 'Underworld', 'F', (plan) => {
      const topology = plan.topology;
      if (topology === null) throw new Error('F topology is missing');
      const occurrence = topology.occurrences[0];
      if (occurrence === undefined) throw new Error('F occurrence is missing');
      return {
        ...plan,
        topology: {
          ...topology,
          occurrences: [...topology.occurrences, occurrence],
        },
      };
    });
    const duplicateExit = withMalformedAuthoredBiome(fProject, 'Underworld', 'F', (plan) => {
      const topology = plan.topology;
      if (topology === null) throw new Error('F topology is missing');
      const exit = topology.decisions.find((decision) => decision.kind === 'exit');
      if (exit === undefined) throw new Error('F exit decision is missing');
      return {
        ...plan,
        topology: { ...topology, decisions: [...topology.decisions, exit] },
      };
    });

    const nProject = createRepresentativeNOPQProject();
    const nEvaluation = simulateProject(catalog, nProject);
    const duplicateHub = withMalformedAuthoredBiome(nProject, 'Surface', 'N', (plan) => {
      const topology = plan.topology;
      if (topology === null) throw new Error('N topology is missing');
      const hub = topology.decisions.find((decision) => decision.kind === 'hub');
      if (hub === undefined) throw new Error('N Hub decision is missing');
      return {
        ...plan,
        topology: { ...topology, decisions: [...topology.decisions, hub] },
      };
    });

    for (const { project, evaluation, message } of [
      {
        project: duplicateOccurrence,
        evaluation: fEvaluation,
        message: /duplicate authored occurrence identity/,
      },
      {
        project: duplicateExit,
        evaluation: fEvaluation,
        message: /duplicate authored exit-decision owner/,
      },
      {
        project: duplicateHub,
        evaluation: nEvaluation,
        message: /duplicate authored Hub-decision owner/,
      },
    ]) {
      expect(() => projectWorkspace(project, evaluation)).toThrow(message);
    }
  }, 10_000);

  it('rejects an evaluator-only decision instead of rendering it as authored UI', () => {
    const project = createGoldenFGHIProject();
    const evaluation = simulateProject(catalog, project);
    const malformed = withMalformedFSnapshot(evaluation, (snapshot) => {
      const batch = fBatch(snapshot);
      return {
        ...snapshot,
        decisions: [
          ...snapshot.decisions,
          {
            ...batch,
            origin: createExitDecisionAddress(goldenFBiome, {
              kind: 'occurrence',
              occurrenceId: createOccurrenceId('evaluator-only-decision'),
            }),
          },
        ],
      };
    });

    expect(() => projectWorkspace(project, malformed)).toThrow(
      StructuredWorkspaceProjectionContractError,
    );
    expect(() => projectWorkspace(project, malformed)).toThrow(
      /evaluated batch without an authored batch decision/,
    );
  });

  it('rejects an evaluator-only target instead of adding an extra editable room', () => {
    const project = createGoldenFGHIProject();
    const evaluation = simulateProject(catalog, project);
    const malformed = withMalformedFSnapshot(evaluation, (snapshot) => {
      const batch = fBatch(snapshot);
      const target = batch.targets[0];
      if (target === undefined) throw new Error('complete F batch has no canonical target');
      return {
        ...snapshot,
        decisions: snapshot.decisions.map((decision) =>
          decision !== batch
            ? decision
            : {
                ...batch,
                targets: [
                  ...batch.targets,
                  {
                    ...target,
                    exit: { ...target.exit, exitKey: 'exit999' },
                    origin: createTargetAddress(goldenFBiome, batch.source, 'exit999'),
                  },
                ],
              },
        ),
      };
    });

    expect(() => projectWorkspace(project, malformed)).toThrow(
      /evaluated targets with no authored target/,
    );
  });

  it('rejects a Hub visit whose evaluator room disagrees with its authored occurrence', () => {
    const project = createRepresentativeNOPQProject();
    const evaluation = simulateProject(catalog, project);
    const malformed = withMalformedNSnapshot(evaluation, (snapshot) => {
      const hub = nHub(snapshot);
      const visit = hub.visits[0];
      if (visit === undefined) throw new Error('complete N Hub has no visit');
      return {
        ...snapshot,
        decisions: snapshot.decisions.map((decision) =>
          decision !== hub
            ? decision
            : {
                ...hub,
                visits: hub.visits.map((candidate) =>
                  candidate !== visit
                    ? candidate
                    : {
                        ...visit,
                        target: {
                          ...visit.target,
                          room: { ...visit.target.room, gameName: 'N_Combat999' },
                        },
                      },
                ),
              },
        ),
      };
    });

    expect(() => projectWorkspace(project, malformed)).toThrow(
      /evaluated Hub visit that does not match authored order/,
    );
  });

  it('rejects a fine-grained finding without an exact workspace destination', () => {
    const project = createGoldenFGHIProject();
    const evaluation = simulateProject(catalog, project);
    const finding = {
      code: 'shopPurchaseUnavailable',
      evidence: {},
      origin: createShopPurchaseAddress(
        goldenFBiome,
        createOccurrenceId('evaluator-only-shop'),
        'offer1',
      ),
      phase: 'rewardGeneration',
      severity: 'error',
    } as const satisfies SemanticFinding;
    const malformed: ProjectEvaluation = {
      ...evaluation,
      findings: [...evaluation.findings, finding],
    };

    expect(() => projectWorkspace(project, malformed)).toThrow(
      /finding has no exact workspace destination/,
    );
  });

  it('rejects a fine-grained finding on a withheld dormant Ephyra side leaf', () => {
    const project = createRepresentativeNOPQProject();
    const evaluation = simulateProject(catalog, project);
    const finding = {
      code: 'sideRoomGenerationUnavailable',
      evidence: {},
      origin: createLocalChildAddress(nBiome, nOccurrenceId('combat10'), 'sideRooms', 'sideDoor1'),
      phase: 'rewardGeneration',
      severity: 'error',
    } as const satisfies SemanticFinding;
    const malformed: ProjectEvaluation = {
      ...evaluation,
      findings: [...evaluation.findings, finding],
    };

    expect(() => projectWorkspace(project, malformed)).toThrow(
      /finding has no exact workspace destination/,
    );
  });

  it('does not publish an ungenerated Ephyra reward as a current workspace leaf', () => {
    const sideRoom = createLocalChildAddress(
      nBiome,
      nOccurrenceId('combat02'),
      'sideRooms',
      'sideDoor2',
    );
    const reward = createLocalRewardAddress(
      nBiome,
      nOccurrenceId('combat02'),
      'sideRooms',
      'sideDoor2',
    );
    const project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceSideRoomGeneration',
      sideRoom,
      generation: 'notGenerated',
    });
    const projected = projectWorkspace(project);

    expect(projected.focusByOwner.get(semanticAddressKey(reward))).toBeUndefined();
    expect(projected.interactions.rewards.get(semanticAddressKey(reward))).toBeUndefined();
    expect(
      projected.interactions.sideRoomGenerations.get(semanticAddressKey(sideRoom)),
    ).toBeDefined();
  });

  it('rejects an independently expected editable leaf omitted from projection products', () => {
    const project = createRepresentativeNOPQProject();
    const plan = project.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N');
    if (plan?.topology === null || plan === undefined) {
      throw new Error('complete N topology is missing');
    }
    const address = createLocalRewardAddress(
      nBiome,
      nOccurrenceId('combat05'),
      'sideRooms',
      'sideDoor2',
    );
    const requirement = expectedWorkspaceLeafRequirements(catalog, nBiome, plan).find(
      (candidate) => semanticAddressKey(candidate.address) === semanticAddressKey(address),
    );
    if (requirement === undefined) throw new Error('N side-room reward requirement is missing');

    const projected = projectWorkspace(project);
    const n = projected.routes
      .flatMap((route) => route.biomes)
      .find((biome) => biome.biomeKey === 'N');
    if (n === undefined) throw new Error('projected N biome is missing');

    // The Hub node owns main reward focus, but its room-local reward exists
    // only in the occurrence workbench. Removing that package simulates the
    // exact class of projector omission that a self-confirming marker scan
    // could not catch.
    expect(() =>
      assertExpectedWorkspaceLeafClosure({
        expected: [requirement],
        observed: observeWorkspaceProducts({
          focusByOwner: projected.focusByOwner,
          interactions: projected.interactions,
          nodes: n.nodes.filter((node) => node.kind !== 'occurrenceWorkbench'),
        }),
      }),
    ).toThrow(/required authored leaf has no workspace marker/);

    const containingNode = n.nodes.find(
      (node): node is Extract<(typeof n.nodes)[number], { readonly kind: 'occurrenceWorkbench' }> =>
        node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === nOccurrenceId('combat05'),
    );
    const wrongNode = n.nodes.find((node) => node.key !== containingNode?.key);
    const originalDestination = projected.focusByOwner.get(semanticAddressKey(address));
    if (
      containingNode === undefined ||
      wrongNode === undefined ||
      originalDestination === undefined
    ) {
      throw new Error('N side-room containment fixture is missing');
    }
    const wrongDestination = new Map(projected.focusByOwner);
    wrongDestination.set(
      semanticAddressKey(address),
      Object.freeze({
        ...originalDestination,
        inspectorSubject: { kind: 'node' as const, nodeKey: wrongNode.key },
        nodeKey: wrongNode.key,
      }),
    );
    expect(() =>
      assertExpectedWorkspaceLeafClosure({
        expected: [requirement],
        observed: observeWorkspaceProducts({
          focusByOwner: wrongDestination,
          interactions: projected.interactions,
          nodes: n.nodes,
        }),
      }),
    ).toThrow(/required authored leaf .* has no exact workspace inspector destination/);

    const withoutRewardInteraction = {
      ...projected.interactions,
      rewards: new Map(projected.interactions.rewards),
    };
    withoutRewardInteraction.rewards.delete(semanticAddressKey(address));
    expect(() =>
      assertExpectedWorkspaceLeafClosure({
        expected: [requirement],
        observed: observeWorkspaceProducts({
          focusByOwner: projected.focusByOwner,
          interactions: withoutRewardInteraction,
          nodes: n.nodes,
        }),
      }),
    ).toThrow(/authored reward leaf .* has no exact workspace interaction/);
  });

  it('makes every independently expected editable-leaf interaction family observable', () => {
    const examples = new Map<
      ExpectedWorkspaceLeafInteraction['kind'],
      {
        expected: ReturnType<typeof expectedWorkspaceLeafRequirements>[number];
        interaction: ExpectedWorkspaceLeafInteraction;
        nodes: Parameters<typeof observeWorkspaceProducts>[0]['nodes'];
        projected: ReturnType<ReturnType<typeof projection>['project']>;
      }
    >();
    for (const project of [createGoldenFGHIProject(), createRepresentativeNOPQProject()]) {
      const assembly = simulateProjectAssembly(catalog, project);
      const projected = projection().project(assembly);
      for (const route of project.routes) {
        for (const plan of route.biomes) {
          const nodes = projected.routes
            .find((candidate) => candidate.routeKey === route.routeKey)
            ?.biomes.find((candidate) => candidate.biomeKey === plan.biomeKey)?.nodes;
          if (nodes === undefined) throw new Error(`${plan.biomeKey} workspace biome is missing`);
          const biome = createBiomeAddress(route.routeKey, plan.biomeKey);
          const requirements = [
            ...expectedWorkspaceLeafRequirements(catalog, biome, plan),
            ...expectedWorkspaceEncounterPhaseLeafRequirements(catalog, biome, plan, (phase) =>
              encounterPhaseCandidateSupportForProjectEvaluationAssembly(assembly, phase),
            ),
          ];
          for (const expected of requirements) {
            for (const interaction of expected.interactions) {
              if (!examples.has(interaction.kind)) {
                examples.set(interaction.kind, { expected, interaction, nodes, projected });
              }
            }
          }
        }
      }
    }
    expect([...examples.keys()].sort()).toEqual(
      [
        'encounterPhase',
        'reward',
        'rewardWheelOfferCount',
        'rewardWheelPick',
        'rewardWheelStore',
        'shipCombatPhaseCount',
        'shopPurchase',
        'sideRoomEntryOrder',
        'sideRoomGeneration',
        'traitOffer',
      ].sort(),
    );

    for (const { expected, interaction, nodes, projected } of examples.values()) {
      expect(() =>
        assertExpectedWorkspaceLeafClosure({
          expected: [expected],
          observed: observeWorkspaceProducts({
            focusByOwner: projected.focusByOwner,
            interactions: withoutLeafInteraction(projected.interactions, interaction),
            nodes,
          }),
        }),
      ).toThrow(/has no exact workspace interaction/);
    }
  });

  it('closes persisted trait children for every representative reward owner', () => {
    const ownerKinds = new Set<string>();
    for (const project of [createGoldenFGHIProject(), createRepresentativeNOPQProject()]) {
      const projected = projection().project(simulateProjectAssembly(catalog, project));
      for (const route of project.routes) {
        for (const plan of route.biomes) {
          const biome = createBiomeAddress(route.routeKey, plan.biomeKey);
          const workspaceBiome = projected.routes
            .find((candidate) => candidate.routeKey === route.routeKey)
            ?.biomes.find((candidate) => candidate.biomeKey === plan.biomeKey);
          if (workspaceBiome === undefined)
            throw new Error(`${plan.biomeKey} workspace is missing`);
          const observed = observeWorkspaceProducts({
            focusByOwner: projected.focusByOwner,
            interactions: projected.interactions,
            nodes: workspaceBiome.nodes,
          });
          for (const requirement of expectedWorkspaceLeafRequirements(catalog, biome, plan).filter(
            (candidate) => candidate.address.kind === 'traitOffer',
          )) {
            const traitAddress = requirement.address as TraitOfferAddress;
            ownerKinds.add(traitAddress.owner.kind);
            assertExpectedWorkspaceLeafClosure({ expected: [requirement], observed });

            const missingMarker = new Map(observed.markersByOwner);
            missingMarker.delete(semanticAddressKey(traitAddress));
            expect(() =>
              assertExpectedWorkspaceLeafClosure({
                expected: [requirement],
                observed: { ...observed, markersByOwner: missingMarker },
              }),
            ).toThrow(/required authored leaf has no workspace marker/);

            const missingDestination = new Map(observed.focusByOwner);
            missingDestination.delete(semanticAddressKey(traitAddress));
            expect(() =>
              assertExpectedWorkspaceLeafClosure({
                expected: [requirement],
                observed: { ...observed, focusByOwner: missingDestination },
              }),
            ).toThrow(/destination is missing|has no workspace destination/);

            const missingTraitInteraction = new Map(observed.interactions.traitOffers);
            const traitInteraction = missingTraitInteraction.get(semanticAddressKey(traitAddress));
            if (traitInteraction === undefined) {
              throw new Error('expected trait interaction is missing from the observed workspace');
            }
            missingTraitInteraction.delete(traitInteraction.key);
            expect(() =>
              assertExpectedWorkspaceLeafClosure({
                expected: [requirement],
                observed: {
                  ...observed,
                  interactions: {
                    ...observed.interactions,
                    traitOffers: missingTraitInteraction,
                  },
                },
              }),
            ).toThrow(/authored trait offer leaf .* has no exact workspace interaction/);
          }
        }
      }
    }
    expect([...ownerKinds].sort()).toEqual(
      ['incomingReward', 'localReward', 'rewardWheelOffer', 'shopOffer'].sort(),
    );
  });

  it('closes exact top-level, local-child, and invalid active multi-choice Ship encounter phase leaves', () => {
    const valid = createRepresentativeNOPQProject();
    const validAssembly = simulateProjectAssembly(catalog, valid);
    const nPlan = valid.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N');
    if (nPlan === undefined) throw new Error('N plan is missing');
    const topLevelN = createEncounterPhaseAddress(
      nBiome,
      { kind: 'occurrence', occurrenceId: nOccurrenceId('combat05') },
      'Encounter',
    );
    const localN = createEncounterPhaseAddress(
      nBiome,
      {
        kind: 'localChild',
        occurrenceId: nOccurrenceId('combat05'),
        groupKey: 'sideRooms',
        slotKey: 'sideDoor2',
      },
      'Encounter',
    );
    const nExpected = expectedWorkspaceEncounterPhaseLeafRequirements(
      catalog,
      nBiome,
      nPlan,
      (phase) => encounterPhaseCandidateSupportForProjectEvaluationAssembly(validAssembly, phase),
    );
    expect(nExpected.map((requirement) => semanticAddressKey(requirement.address))).toEqual(
      expect.arrayContaining([semanticAddressKey(topLevelN), semanticAddressKey(localN)]),
    );

    const invalid = applyProjectCommand(valid, catalog, {
      encounterCount: 3,
      kind: 'ReplaceShipEncounterCount',
      occurrence: createOccurrenceAddress(oBiome, oOccurrenceIds.combat04),
    });
    const invalidAssembly = simulateProjectAssembly(catalog, invalid);
    const projected = projection().project(invalidAssembly);
    const oPlan = invalid.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'O');
    const oWorkspace = projected.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'O');
    if (oPlan === undefined || oWorkspace === undefined)
      throw new Error('O phase fixture is missing');
    const combat2 = createEncounterPhaseAddress(
      oBiome,
      { kind: 'occurrence', occurrenceId: oOccurrenceIds.combat04 },
      'Combat2',
    );
    const expected = expectedWorkspaceEncounterPhaseLeafRequirements(
      catalog,
      oBiome,
      oPlan,
      (phase) => encounterPhaseCandidateSupportForProjectEvaluationAssembly(invalidAssembly, phase),
    ).find(
      (requirement) => semanticAddressKey(requirement.address) === semanticAddressKey(combat2),
    );
    if (expected === undefined)
      throw new Error('invalid active Ship Combat2 phase is not expected');
    expect(expected.interactions).toHaveLength(1);
    expect(expected.interactions[0]).toMatchObject({ kind: 'encounterPhase' });
    expect(projected.interactions.encounterPhases.has(semanticAddressKey(combat2))).toBe(true);

    const observed = observeWorkspaceProducts({
      focusByOwner: projected.focusByOwner,
      interactions: projected.interactions,
      nodes: oWorkspace.nodes,
    });
    expect(() =>
      assertExpectedWorkspaceLeafClosure({ expected: [expected], observed }),
    ).not.toThrow();

    const phaseNodeKeys = observed.markerNodeKeys.get(semanticAddressKey(combat2));
    if (phaseNodeKeys === undefined || phaseNodeKeys.size === 0) {
      throw new Error('invalid active Ship phase has no containing workspace package');
    }
    const withoutPhaseMarker = oWorkspace.nodes.filter((node) => !phaseNodeKeys.has(node.key));
    expect(() =>
      assertExpectedWorkspaceLeafClosure({
        expected: [expected],
        observed: observeWorkspaceProducts({
          focusByOwner: projected.focusByOwner,
          interactions: projected.interactions,
          nodes: withoutPhaseMarker,
        }),
      }),
    ).toThrow(/required authored leaf has no workspace marker/);

    const originalDestination = projected.focusByOwner.get(semanticAddressKey(combat2));
    const wrongNode = oWorkspace.nodes.find((node) => !phaseNodeKeys.has(node.key));
    if (originalDestination === undefined || wrongNode === undefined) {
      throw new Error('invalid active Ship phase destination fixture is missing');
    }
    const wrongDestination = new Map(projected.focusByOwner);
    wrongDestination.set(
      semanticAddressKey(combat2),
      Object.freeze({
        ...originalDestination,
        inspectorSubject: { kind: 'node' as const, nodeKey: wrongNode.key },
        nodeKey: wrongNode.key,
      }),
    );
    expect(() =>
      assertExpectedWorkspaceLeafClosure({
        expected: [expected],
        observed: observeWorkspaceProducts({
          focusByOwner: wrongDestination,
          interactions: projected.interactions,
          nodes: oWorkspace.nodes,
        }),
      }),
    ).toThrow(/required authored leaf .* has no exact workspace inspector destination/);
  });

  it('independently closes persisted decisions, targets, occurrences, and Hub ownership', () => {
    for (const project of [createGoldenFGHIProject(), createRepresentativeNOPQProject()]) {
      const projected = projectWorkspace(project);
      for (const route of project.routes) {
        for (const plan of route.biomes) {
          if (plan.topology === null) continue;
          const biome = projected.routes
            .find((candidate) => candidate.routeKey === route.routeKey)
            ?.biomes.find((candidate) => candidate.biomeKey === plan.biomeKey);
          if (biome === undefined) throw new Error(`${plan.biomeKey} workspace biome is missing`);
          const address = {
            biomeKey: plan.biomeKey,
            kind: 'biome' as const,
            routeKey: route.routeKey,
          };
          assertExpectedWorkspaceTopologyClosure({
            expected: expectedWorkspaceTopologyManifest(address, plan),
            observed: observeWorkspaceProducts({
              focusByOwner: projected.focusByOwner,
              interactions: projected.interactions,
              nodes: biome.nodes,
            }),
          });
        }
      }
    }
  });

  it('closes the selected Midshop Zagreus sibling through its containing workbench', () => {
    const base = createGoldenFGHIProject();
    const declaration = base.routes.flatMap((route) =>
      route.biomes.flatMap((plan) =>
        expectedWorkspaceStructuralControls(
          catalog,
          createBiomeAddress(route.routeKey, plan.biomeKey),
          plan,
        ).filter((control) => control.kind === 'zagreusSpawn'),
      ),
    )[0];
    if (declaration?.kind !== 'zagreusSpawn' || declaration.owner.kind !== 'additionalExit') {
      throw new Error('selected Midshop contract declaration is missing');
    }
    const additional = declaration.owner;
    const authored = applyProjectCommand(base, catalog, {
      kind: 'AddZagreusContract',
      additional,
      occurrenceId: createOccurrenceId('workspace-zagreus-contract'),
    });
    const projected = projectWorkspace(authored);
    const workspace = projected.routes
      .find((route) => route.routeKey === additional.routeKey)
      ?.biomes.find((biome) => biome.biomeKey === additional.biomeKey);
    if (workspace === undefined) throw new Error('selected Midshop workspace is missing');
    const observed = observeWorkspaceProducts({
      focusByOwner: projected.focusByOwner,
      interactions: projected.interactions,
      nodes: workspace.nodes,
    });
    expect(() =>
      assertExpectedWorkspaceTopologyClosure({
        expected: expectedWorkspaceTopologyManifest(
          createBiomeAddress(additional.routeKey, additional.biomeKey),
          authored.routes
            .find((route) => route.routeKey === additional.routeKey)!
            .biomes.find((biome) => biome.biomeKey === additional.biomeKey)!,
        ),
        observed,
      }),
    ).not.toThrow();
    expect(
      projected.interactions.zagreusContracts.get(semanticAddressKey(additional))?.owner,
    ).toEqual(additional);
    expect(projected.interactions.zagreusSpawns.has(semanticAddressKey(additional))).toBe(false);
  });

  it('routes an authored natural Chaos gate and its fixed room package to the source decision', () => {
    const base = createGoldenFGHIProject();
    const available = projectWorkspace(base);
    const located = base.routes.flatMap((route) =>
      route.biomes.flatMap((plan) =>
        (plan.topology?.occurrences ?? []).flatMap((occurrence) => {
          const room = catalog.rooms.byKey[occurrence.gameName];
          return room?.additionalExits.some((exit) => exit.kind === 'naturalChaos')
            ? [{ occurrence, plan, route }]
            : [];
        }),
      ),
    )[0];
    if (located === undefined) throw new Error('selected natural Chaos source is missing');
    const biome = createBiomeAddress(located.route.routeKey, located.plan.biomeKey);
    const source = { kind: 'occurrence' as const, occurrenceId: located.occurrence.occurrenceId };
    const decision = createExitDecisionAddress(biome, source);
    const additional = createAdditionalExitAddress(biome, source.occurrenceId, 'naturalChaos');
    expect(
      available.interactions.naturalChaosSpawns.get(semanticAddressKey(additional))?.owner,
    ).toEqual(additional);
    const chaosId = createOccurrenceId('workspace-natural-chaos');
    const authored = applyProjectCommand(base, catalog, {
      kind: 'AddNaturalChaos',
      additional,
      occurrenceId: chaosId,
    });
    const projected = projectWorkspace(authored);
    const workspace = projected.routes
      .find((route) => route.routeKey === biome.routeKey)
      ?.biomes.find((candidate) => candidate.biomeKey === biome.biomeKey);
    const batch = workspace?.nodes.find(
      (node): node is WorkspaceBatchNode =>
        (node.kind === 'ordinaryBatch' ||
          node.kind === 'mixedBatch' ||
          node.kind === 'takeoverBatch') &&
        semanticAddressKey(node.owner) === semanticAddressKey(decision),
    );
    if (batch?.naturalChaos === undefined)
      throw new Error('natural Chaos decision card is missing');
    expect(() =>
      assertExpectedWorkspaceTopologyClosure({
        expected: expectedWorkspaceTopologyManifest(
          biome,
          authored.routes
            .find((route) => route.routeKey === biome.routeKey)!
            .biomes.find((candidate) => candidate.biomeKey === biome.biomeKey)!,
        ),
        observed: observeWorkspaceProducts({
          focusByOwner: projected.focusByOwner,
          interactions: projected.interactions,
          nodes: workspace?.nodes ?? [],
        }),
      }),
    ).not.toThrow();
    const interaction = projected.interactions.naturalChaosExits.get(
      semanticAddressKey(additional),
    );
    expect(interaction?.owner).toEqual(additional);
    expect(interaction?.selectIntent.command).toMatchObject({
      kind: 'SetExitSelection',
      value: { kind: 'additional', additionalExitKey: 'naturalChaos' },
    });
    expect(interaction?.removeIntent.command).toEqual({ kind: 'RemoveNaturalChaos', additional });
    expect(interaction?.mapIntent(batch.naturalChaos.chaosRoom.gameName).command).toEqual({
      kind: 'ReplaceNaturalChaosMap',
      occurrence: createOccurrenceAddress(biome, chaosId),
      gameName: batch.naturalChaos.chaosRoom.gameName,
    });
    expect(batch.naturalChaos.chaosRoom.occurrenceId).toBe(chaosId);
    for (const address of [
      additional,
      createOccurrenceAddress(biome, chaosId),
      ...batch.naturalChaos.chaosRoom.rewardControls.map((control) => control.owner.address),
    ]) {
      expect(projected.focusByOwner.get(semanticAddressKey(address))?.nodeKey).toBe(batch.key);
    }
    const expected = expectedWorkspaceTopologyManifest(
      biome,
      authored.routes
        .find((route) => route.routeKey === biome.routeKey)!
        .biomes.find((candidate) => candidate.biomeKey === biome.biomeKey)!,
    );
    const missingDestination = new Map(projected.focusByOwner);
    missingDestination.delete(semanticAddressKey(additional));
    expect(() =>
      assertExpectedWorkspaceTopologyClosure({
        expected,
        observed: observeWorkspaceProducts({
          focusByOwner: missingDestination,
          interactions: projected.interactions,
          nodes: workspace?.nodes ?? [],
        }),
      }),
    ).toThrow(/additional exit/);
    const naturalChaosExits = new Map(projected.interactions.naturalChaosExits);
    naturalChaosExits.delete(semanticAddressKey(additional));
    expect(() =>
      assertRenderedWorkspaceStructuralControlClosure({
        interactions: { ...projected.interactions, naturalChaosExits },
        routes: projected.routes,
      }),
    ).toThrow(/natural Chaos .* exact workspace interaction/);
  });

  it('keeps selected-contract and automatic-return packages in their respective decisions', () => {
    const base = createGoldenFGHIProject();
    const located = base.routes.flatMap((route) =>
      route.biomes.flatMap((plan) =>
        (plan.topology?.occurrences ?? []).flatMap((occurrence) => {
          const room = catalog.rooms.byKey[occurrence.gameName];
          return room?.additionalExits.some((exit) => exit.kind === 'zagreusContract')
            ? [{ occurrence, plan, route }]
            : [];
        }),
      ),
    )[0];
    if (located === undefined) throw new Error('selected Midshop is missing');
    const biome = createBiomeAddress(located.route.routeKey, located.plan.biomeKey);
    const source = { kind: 'occurrence' as const, occurrenceId: located.occurrence.occurrenceId };
    const decision = createExitDecisionAddress(biome, source);
    const additional = createAdditionalExitAddress(biome, source.occurrenceId, 'zagreusContract');
    const contractId = createOccurrenceId('workspace-zagreus-selected-contract');
    const returnId = createOccurrenceId('workspace-zagreus-selected-return');
    const normalId = createOccurrenceId('workspace-zagreus-normal-peer');
    const combat = `${located.plan.biomeKey}_Combat01`;
    const returnedCombat = `${located.plan.biomeKey}_Combat02`;
    let project = applyProjectCommand(base, catalog, { kind: 'RemoveExitDecision', decision });
    project = applyProjectCommand(project, catalog, {
      kind: 'AddZagreusContract',
      additional,
      occurrenceId: contractId,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(biome, source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, source, 'exit1'),
      occurrenceId: normalId,
      gameName: combat,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(biome, source),
      value: { kind: 'additional', additionalExitKey: 'zagreusContract' },
    });
    const contractSource = { kind: 'occurrence' as const, occurrenceId: contractId };
    const contractDecision = createExitDecisionAddress(biome, contractSource);
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: contractDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(biome, contractSource),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, contractSource, 'exit1'),
      occurrenceId: returnId,
      gameName: returnedCombat,
    });
    project = authorLegalTraitOffers(project);

    const projected = projectWorkspace(project);
    const workspace = projected.routes
      .find((route) => route.routeKey === biome.routeKey)
      ?.biomes.find((candidate) => candidate.biomeKey === biome.biomeKey);
    if (workspace === undefined) throw new Error('Midshop workspace is missing');
    const observed = observeWorkspaceProducts({
      focusByOwner: projected.focusByOwner,
      interactions: projected.interactions,
      nodes: workspace.nodes,
    });
    const selectedContract = workspace.nodes.find(
      (node): node is WorkspaceBatchNode =>
        (node.kind === 'ordinaryBatch' ||
          node.kind === 'mixedBatch' ||
          node.kind === 'takeoverBatch') &&
        semanticAddressKey(node.owner) === semanticAddressKey(decision),
    );
    expect(selectedContract?.zagreusContract?.contractRoom.entered).toBe(true);
    const contractPackages = observed.roomPackagesByOccurrence.get(contractId);
    expect(contractPackages).toHaveLength(1);
    expect(contractPackages?.[0]?.nodeKey).toBe(`batch:${semanticAddressKey(decision)}`);
    const returnPackages = observed.roomPackagesByOccurrence.get(returnId);
    expect(returnPackages?.length).toBeGreaterThanOrEqual(1);
    expect(
      returnPackages?.every((roomPackage) => roomPackage.room === returnPackages[0]?.room),
    ).toBe(true);
    expect(
      returnPackages?.some(
        (roomPackage) => roomPackage.nodeKey === `batch:${semanticAddressKey(contractDecision)}`,
      ),
    ).toBe(true);
    expect(
      projected.interactions.zagreusContracts.get(semanticAddressKey(additional))?.owner,
    ).toEqual(additional);

    const malformed = withMalformedPrefix(
      simulateProject(catalog, project),
      biome.routeKey,
      biome.biomeKey,
      (prefix) => {
        const frontier = prefix.frontier;
        const additionalContinuation =
          frontier?.kind === 'exitDecision' &&
          semanticAddressKey(frontier.origin) === semanticAddressKey(decision)
            ? frontier.additional[0]
            : undefined;
        if (frontier?.kind !== 'exitDecision' || additionalContinuation === undefined) {
          throw new Error('selected Midshop canonical contract continuation is missing');
        }
        return {
          ...prefix,
          frontier: {
            ...frontier,
            additional: [
              {
                ...additionalContinuation,
                room: { ...additionalContinuation.room, occurrenceId: normalId },
              },
            ],
          },
        };
      },
    );
    expect(() => projectWorkspace(project, malformed)).toThrow(
      /evaluated additional exit does not match its authored occurrence/,
    );
  });

  it('closes structural occurrence packages without requiring standalone workbench nodes', () => {
    const project = createGoldenFGHIProject();
    const projected = projectWorkspace(project);
    const plan = project.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F');
    const f = projected.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F');
    if (plan?.topology === null || plan === undefined || f === undefined) {
      throw new Error('complete F topology fixture is missing');
    }
    const batch = f.nodes.find(
      (
        node,
      ): node is Extract<
        (typeof f.nodes)[number],
        { readonly kind: 'ordinaryBatch' | 'mixedBatch' | 'takeoverBatch' }
      > =>
        node.kind === 'ordinaryBatch' ||
        node.kind === 'mixedBatch' ||
        node.kind === 'takeoverBatch',
    );
    const target = batch?.targets[0];
    const workbench = f.nodes.find(
      (node): node is Extract<(typeof f.nodes)[number], { readonly kind: 'occurrenceWorkbench' }> =>
        node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === target?.room.occurrenceId,
    );
    const detached = plan.topology.occurrences[0];
    if (
      batch === undefined ||
      target === undefined ||
      workbench === undefined ||
      detached === undefined
    ) {
      throw new Error('complete F nested target fixture is missing');
    }
    const nestedDestinations = new Map(projected.focusByOwner);
    for (const address of [
      createOccurrenceAddress(goldenFBiome, target.room.occurrenceId),
      createTargetAddress(goldenFBiome, batch.source, target.exitKey),
    ]) {
      const destination = nestedDestinations.get(semanticAddressKey(address));
      if (destination === undefined) throw new Error('complete F target destination is missing');
      nestedDestinations.set(
        semanticAddressKey(address),
        Object.freeze({
          ...destination,
          inspectorSubject: Object.freeze({ kind: 'node' as const, nodeKey: batch.key }),
          nodeKey: batch.key,
        }),
      );
    }
    const planWithDetachedRecord: AuthoredBiomePlan = {
      ...plan,
      topology: {
        ...plan.topology,
        occurrences: Object.freeze([
          ...plan.topology.occurrences,
          Object.freeze({
            ...detached,
            occurrenceId: createOccurrenceId('topology-closure-detached-record'),
          }),
        ]),
      },
    };

    expect(() =>
      assertExpectedWorkspaceTopologyClosure({
        expected: expectedWorkspaceTopologyManifest(goldenFBiome, planWithDetachedRecord),
        observed: observeWorkspaceProducts({
          focusByOwner: nestedDestinations,
          interactions: projected.interactions,
          nodes: f.nodes.filter((node) => node.key !== workbench.key),
        }),
      }),
    ).not.toThrow();
  });

  it('makes target and authored Hub sub-owner markers and exact destinations observable', () => {
    const fProject = createGoldenFGHIProject();
    const fProjected = projectWorkspace(fProject);
    const fPlan = fProject.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F');
    const f = fProjected.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F');
    if (fPlan?.topology === null || fPlan === undefined || f === undefined) {
      throw new Error('complete F topology fixture is missing');
    }
    const batch = f.nodes.find(
      (
        node,
      ): node is Extract<
        (typeof f.nodes)[number],
        { readonly kind: 'ordinaryBatch' | 'mixedBatch' | 'takeoverBatch' }
      > =>
        node.kind === 'ordinaryBatch' ||
        node.kind === 'mixedBatch' ||
        node.kind === 'takeoverBatch',
    );
    const target = batch?.targets[0];
    if (batch === undefined || target === undefined) {
      throw new Error('complete F target fixture is missing');
    }
    const targetAddress = createTargetAddress(goldenFBiome, batch.source, target.exitKey);
    const expectedF = expectedWorkspaceTopologyManifest(goldenFBiome, fPlan);
    const assertF = (nodes: typeof f.nodes, focusByOwner: typeof fProjected.focusByOwner) =>
      assertExpectedWorkspaceTopologyClosure({
        expected: expectedF,
        observed: observeWorkspaceProducts({
          focusByOwner,
          interactions: fProjected.interactions,
          nodes,
        }),
      });
    const missingTargetDestination = new Map(fProjected.focusByOwner);
    missingTargetDestination.delete(semanticAddressKey(targetAddress));
    expect(() => assertF(f.nodes, missingTargetDestination)).toThrow(/target .* destination/);

    const unrelatedFNode = f.nodes.find((node) => node.kind === 'completion');
    const targetDestination = fProjected.focusByOwner.get(semanticAddressKey(targetAddress));
    if (unrelatedFNode === undefined || targetDestination === undefined) {
      throw new Error('complete F unrelated target destination fixture is missing');
    }
    const misroutedTarget = new Map(fProjected.focusByOwner);
    misroutedTarget.set(
      semanticAddressKey(targetAddress),
      Object.freeze({
        ...targetDestination,
        inspectorSubject: Object.freeze({ kind: 'node' as const, nodeKey: unrelatedFNode.key }),
        nodeKey: unrelatedFNode.key,
      }),
    );
    expect(() => assertF(f.nodes, misroutedTarget)).toThrow(
      /target .* no exact workspace inspector destination/,
    );
    const withoutTargetMarker = f.nodes.map((node) => {
      if (
        (node.kind === 'ordinaryBatch' ||
          node.kind === 'mixedBatch' ||
          node.kind === 'takeoverBatch') &&
        node.key === batch.key
      ) {
        return Object.freeze({
          ...node,
          targets: Object.freeze(
            node.targets.map((candidate) =>
              candidate.exitKey === target.exitKey
                ? unsafeOmitWorkspaceProperty(candidate, 'marker')
                : candidate,
            ),
          ),
        });
      }
      if (
        node.kind === 'occurrenceWorkbench' &&
        node.room.occurrenceId === target.room.occurrenceId
      ) {
        return unsafeOmitWorkspaceProperty(node, 'railMarker');
      }
      return node;
    });
    expect(() => assertF(withoutTargetMarker, fProjected.focusByOwner)).toThrow(
      /target .* has no workspace marker/,
    );

    const nProject = createRepresentativeNOPQProject();
    const nProjected = projectWorkspace(nProject);
    const nPlan = nProject.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N');
    const n = nProjected.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N');
    if (nPlan?.topology === null || nPlan === undefined || n === undefined) {
      throw new Error('complete N topology fixture is missing');
    }
    const decision = nPlan.topology.decisions.find(
      (
        candidate,
      ): candidate is Extract<
        (typeof nPlan.topology.decisions)[number],
        { readonly kind: 'hub' }
      > => candidate.kind === 'hub',
    );
    const hub = n.nodes.find(
      (node): node is Extract<(typeof n.nodes)[number], { readonly kind: 'hubDecision' }> =>
        node.kind === 'hubDecision',
    );
    const slotTarget = decision?.openTargets[0];
    const firstVisitSlotKey = decision?.visitOrder[0];
    if (
      decision === undefined ||
      hub === undefined ||
      slotTarget === undefined ||
      firstVisitSlotKey === undefined
    ) {
      throw new Error('complete N Hub sub-owner fixture is missing');
    }
    const slotAddress = createHubSlotAddress(nBiome, decision.hubKey, slotTarget.hubSlotKey);
    const visitAddress = createHubVisitAddress(nBiome, decision.hubKey, 1);
    const expectedN = expectedWorkspaceTopologyManifest(nBiome, nPlan);
    const assertN = (nodes: typeof n.nodes, focusByOwner: typeof nProjected.focusByOwner) =>
      assertExpectedWorkspaceTopologyClosure({
        expected: expectedN,
        observed: observeWorkspaceProducts({
          focusByOwner,
          interactions: nProjected.interactions,
          nodes,
        }),
      });
    for (const [address, detail] of [
      [slotAddress, 'slot'],
      [visitAddress, 'visit 1'],
    ] as const) {
      const withoutDestination = new Map(nProjected.focusByOwner);
      withoutDestination.delete(semanticAddressKey(address));
      expect(() => assertN(n.nodes, withoutDestination)).toThrow(
        new RegExp(`${detail} .* destination`),
      );
    }
    const unrelatedNNode = n.nodes.find(
      (node) =>
        node.kind === 'occurrenceWorkbench' && node.room.occurrenceId !== slotTarget.occurrenceId,
    );
    const slotDestination = nProjected.focusByOwner.get(semanticAddressKey(slotAddress));
    if (unrelatedNNode === undefined || slotDestination === undefined) {
      throw new Error('complete N unrelated slot destination fixture is missing');
    }
    const misroutedSlot = new Map(nProjected.focusByOwner);
    misroutedSlot.set(
      semanticAddressKey(slotAddress),
      Object.freeze({
        ...slotDestination,
        inspectorSubject: Object.freeze({ kind: 'node' as const, nodeKey: unrelatedNNode.key }),
        nodeKey: unrelatedNNode.key,
      }),
    );
    expect(() => assertN(n.nodes, misroutedSlot)).toThrow(
      /slot .* no exact workspace inspector destination/,
    );
    const withoutSlotMarker = n.nodes.map((node) => {
      if (node.kind === 'hubDecision' && node.key === hub.key) {
        return Object.freeze({
          ...node,
          slots: Object.freeze(
            node.slots.map((slot) =>
              slot.hubSlotKey === slotTarget.hubSlotKey
                ? unsafeOmitWorkspaceProperty(slot, 'marker')
                : slot,
            ),
          ),
        });
      }
      if (
        node.kind === 'occurrenceWorkbench' &&
        node.room.occurrenceId === slotTarget.occurrenceId
      ) {
        return unsafeOmitWorkspaceProperty(node, 'railMarker');
      }
      return node;
    });
    expect(() => assertN(withoutSlotMarker, nProjected.focusByOwner)).toThrow(
      /slot .* has no workspace marker/,
    );
    const withoutVisitMarker = n.nodes.map((node) =>
      node.kind !== 'hubDecision' || node.key !== hub.key
        ? node
        : Object.freeze({
            ...node,
            visits: Object.freeze(
              node.visits.map((visit) =>
                visit.visitIndex === 1 ? unsafeOmitWorkspaceProperty(visit, 'marker') : visit,
              ),
            ),
          }),
    );
    expect(() => assertN(withoutVisitMarker, nProjected.focusByOwner)).toThrow(
      /visit 1 has no workspace marker/,
    );
  });

  it('independently closes structural control identities and rendered interaction handoff', () => {
    const emptyN = createProjectDocument(catalog, {
      configuredBiomeCounts: { Surface: 1 },
      name: 'Structural oracle empty N',
      projectId: 'structural-oracle-empty-n',
    });
    const emptyF = createProjectDocument(catalog, {
      configuredBiomeCounts: { Underworld: 1 },
      name: 'Structural oracle frontier F',
      projectId: 'structural-oracle-frontier-f',
    });
    const fFrontier = applyProjectCommand(emptyF, catalog, {
      biome: goldenFBiome,
      gameName: 'F_Opening01',
      kind: 'CreateStart',
      occurrenceId: createOccurrenceId('structural-oracle-f-opening'),
    });
    const fEmptyDecision = applyProjectCommand(fFrontier, catalog, {
      decision: createExitDecisionAddress(goldenFBiome, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('structural-oracle-f-opening'),
      }),
      kind: 'CreateBatch',
    });
    const nTerminal = appendNEntry(emptyN);
    for (const project of [
      createGoldenFGHIProject(),
      createRepresentativeNOPQProject(),
      emptyN,
      fFrontier,
      fEmptyDecision,
      nTerminal,
    ]) {
      const projected = projectWorkspace(project);
      assertRenderedWorkspaceStructuralControlClosure({
        interactions: projected.interactions,
        routes: projected.routes,
      });
      for (const route of project.routes) {
        for (const plan of route.biomes) {
          assertExpectedWorkspaceStructuralControlClosure({
            expected: expectedWorkspaceStructuralControls(
              catalog,
              { biomeKey: plan.biomeKey, kind: 'biome', routeKey: route.routeKey },
              plan,
            ),
            interactions: projected.interactions,
          });
        }
      }
    }
  });

  it('makes every independently expected structural interaction family observable', () => {
    const emptyN = createProjectDocument(catalog, {
      configuredBiomeCounts: { Surface: 1 },
      name: 'Structural mutation empty N',
      projectId: 'structural-mutation-empty-n',
    });
    const emptyF = createProjectDocument(catalog, {
      configuredBiomeCounts: { Underworld: 1 },
      name: 'Structural mutation F',
      projectId: 'structural-mutation-f',
    });
    const fFrontier = applyProjectCommand(emptyF, catalog, {
      biome: goldenFBiome,
      gameName: 'F_Opening01',
      kind: 'CreateStart',
      occurrenceId: createOccurrenceId('structural-mutation-f-opening'),
    });
    const fEmptyDecision = applyProjectCommand(fFrontier, catalog, {
      decision: createExitDecisionAddress(goldenFBiome, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('structural-mutation-f-opening'),
      }),
      kind: 'CreateBatch',
    });
    const nTerminal = appendNEntry(emptyN);
    const examples = new Map<
      ExpectedWorkspaceStructuralControl['kind'],
      {
        control: ExpectedWorkspaceStructuralControl;
        interactions: WorkspaceInteractionCatalog;
      }
    >();
    for (const project of [
      createGoldenFGHIProject(),
      createRepresentativeNOPQProject(),
      emptyN,
      fFrontier,
      fEmptyDecision,
      nTerminal,
    ]) {
      const projected = projectWorkspace(project);
      for (const route of project.routes) {
        for (const plan of route.biomes) {
          const controls = expectedWorkspaceStructuralControls(
            catalog,
            { biomeKey: plan.biomeKey, kind: 'biome', routeKey: route.routeKey },
            plan,
          );
          for (const control of controls) {
            if (!examples.has(control.kind)) {
              examples.set(control.kind, { control, interactions: projected.interactions });
            }
          }
        }
      }
    }
    expect([...examples.keys()].sort()).toEqual(
      [
        'batchRewardStore',
        'decisionEntryRoomPicker',
        'exitFrontierCapability',
        'exitSelection',
        'fieldsCageOutcome',
        'hubTakeover',
        'hubSlot',
        'hubVisitOrder',
        'naturalChaosSpawn',
        'roomPicker',
        'start',
        'structural',
        'takeoverBatch',
        'topologyRemoval',
        'zagreusSpawn',
      ].sort(),
    );

    for (const { control, interactions } of examples.values()) {
      expect(() =>
        assertExpectedWorkspaceStructuralControlClosure({
          expected: [control],
          interactions: withoutStructuralInteraction(interactions, control),
        }),
      ).toThrow(/has no exact workspace interaction/);
    }

    const surface = createRepresentativeNOPQProject();
    const projected = projectWorkspace(surface);
    const hub = projected.routes
      .flatMap((route) => route.biomes)
      .flatMap((biome) => biome.nodes)
      .find((node) => node.kind === 'hubDecision');
    const closable =
      hub?.kind === 'hubDecision' ? hub.slots.find((slot) => slot.canClose) : undefined;
    const slotInteraction =
      closable === undefined
        ? undefined
        : projected.interactions.hubSlots.get(closable.marker.focusKey);
    if (
      closable === undefined ||
      slotInteraction?.selected !== true ||
      slotInteraction.close === undefined
    ) {
      throw new Error('closable Hub mutation fixture is missing');
    }
    const hubSlots = new Map(projected.interactions.hubSlots);
    hubSlots.set(closable.marker.focusKey, unsafeOmitWorkspaceProperty(slotInteraction, 'close'));
    expect(() =>
      assertRenderedWorkspaceStructuralControlClosure({
        interactions: { ...projected.interactions, hubSlots },
        routes: projected.routes,
      }),
    ).toThrow(/closable Hub slot has no exact close interaction/);

    const visitOrderInteraction =
      hub?.kind === 'hubDecision'
        ? projected.interactions.hubVisitOrders.get(hub.marker.focusKey)
        : undefined;
    if (hub?.kind !== 'hubDecision' || visitOrderInteraction === undefined) {
      throw new Error('Hub visit-order mutation fixture is missing');
    }
    const hubVisitOrders = new Map(projected.interactions.hubVisitOrders);
    hubVisitOrders.delete(hub.marker.focusKey);
    expect(() =>
      assertRenderedWorkspaceStructuralControlClosure({
        interactions: { ...projected.interactions, hubVisitOrders },
        routes: projected.routes,
      }),
    ).toThrow(/Hub visit order .* has no exact workspace interaction/);

    const base = createGoldenFGHIProject();
    const declaration = base.routes.flatMap((route) =>
      route.biomes.flatMap((plan) =>
        expectedWorkspaceStructuralControls(
          catalog,
          createBiomeAddress(route.routeKey, plan.biomeKey),
          plan,
        ).filter((control) => control.kind === 'zagreusSpawn'),
      ),
    )[0];
    if (declaration?.kind !== 'zagreusSpawn' || declaration.owner.kind !== 'additionalExit') {
      throw new Error('Zagreus structural mutation declaration is missing');
    }
    const withContract = applyProjectCommand(base, catalog, {
      kind: 'AddZagreusContract',
      additional: declaration.owner,
      occurrenceId: createOccurrenceId('structural-mutation-zagreus-contract'),
    });
    const contractProjected = projectWorkspace(withContract);
    const contractNode = contractProjected.routes
      .flatMap((route) => route.biomes)
      .flatMap((biome) => biome.nodes)
      .find(
        (node): node is WorkspaceBatchNode =>
          (node.kind === 'ordinaryBatch' ||
            node.kind === 'mixedBatch' ||
            node.kind === 'takeoverBatch') &&
          node.zagreusContract !== undefined,
      );
    if (contractNode?.zagreusContract === undefined) {
      throw new Error('Zagreus structural mutation node is missing');
    }
    const zagreusContracts = new Map(contractProjected.interactions.zagreusContracts);
    zagreusContracts.delete(contractNode.zagreusContract.marker.focusKey);
    expect(() =>
      assertRenderedWorkspaceStructuralControlClosure({
        interactions: { ...contractProjected.interactions, zagreusContracts },
        routes: contractProjected.routes,
      }),
    ).toThrow(/Zagreus contract .* has no exact workspace interaction/);
  });

  it('independently closes Door 1 and decision-owner routes for an empty decision entry', () => {
    const startId = createOccurrenceId('decision-entry-closure-start');
    const decision = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: startId,
    });
    const started = applyProjectCommand(
      createProjectDocument(catalog, {
        configuredBiomeCounts: { Underworld: 1 },
        name: 'Decision entry closure',
        projectId: 'decision-entry-closure',
      }),
      catalog,
      { biome: goldenFBiome, gameName: 'F_Opening01', kind: 'CreateStart', occurrenceId: startId },
    );
    const project = applyProjectCommand(started, catalog, { decision, kind: 'CreateBatch' });
    const projected = projectWorkspace(project);
    const f = projected.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F');
    if (f === undefined) throw new Error('empty F decision entry biome is missing');
    const workbench = f.nodes.find(
      (node): node is Extract<(typeof f.nodes)[number], { readonly kind: 'ordinaryBatch' }> =>
        node.kind === 'ordinaryBatch' &&
        semanticAddressKey(node.owner) === semanticAddressKey(decision),
    );
    const target = workbench?.missingTargets[0];
    if (workbench === undefined || target === undefined) {
      throw new Error('empty F decision entry fixture is missing');
    }
    const interaction = projected.interactions.rooms.get(target.marker.focusKey);
    if (interaction?.kind !== 'decisionEntryRoom') {
      throw new Error('empty F Door 1 decision-entry room interaction is missing');
    }
    expect(interaction.owner).toEqual(target.marker.address);
    expect(interaction.decisionOwner).toEqual(decision);

    const observe = (
      focusByOwner: typeof projected.focusByOwner,
      nodes: typeof f.nodes = f.nodes,
    ) =>
      observeWorkspaceProducts({
        focusByOwner,
        interactions: projected.interactions,
        nodes,
      });
    const assertRoutes = (
      focusByOwner: typeof projected.focusByOwner,
      nodes: typeof f.nodes = f.nodes,
    ) => {
      const observed = observe(focusByOwner, nodes);
      assertObservedOwner(target.marker.address, observed, 'Door 1 target', true);
      assertObservedOwner(decision, observed, 'decision-owned takeover route', true);
    };

    expect(() => assertRoutes(projected.focusByOwner)).not.toThrow();
    const withoutDoorOne = new Map(projected.focusByOwner);
    withoutDoorOne.delete(semanticAddressKey(target.marker.address));
    expect(() => assertRoutes(withoutDoorOne)).toThrow(/Door 1 target .*destination is missing/);
    const withoutDecision = new Map(projected.focusByOwner);
    withoutDecision.delete(semanticAddressKey(decision));
    expect(() => assertRoutes(withoutDecision)).toThrow(
      /decision-owned takeover route .*destination is missing/,
    );
    const withoutDoorOneMarker = f.nodes.map((node) =>
      node !== workbench
        ? node
        : Object.freeze({
            ...node,
            missingTargets: Object.freeze(
              node.missingTargets.map((candidate) =>
                candidate.exitKey === target.exitKey
                  ? unsafeOmitWorkspaceProperty(candidate, 'marker')
                  : candidate,
              ),
            ),
          }),
    );
    expect(() => assertRoutes(projected.focusByOwner, withoutDoorOneMarker)).toThrow(
      /Door 1 target has no workspace marker/,
    );
    const withoutDecisionMarker = f.nodes.map((node) =>
      node !== workbench ? node : unsafeOmitWorkspaceProperty(node, 'marker'),
    );
    expect(() => assertRoutes(projected.focusByOwner, withoutDecisionMarker)).toThrow(
      /decision-owned takeover route has no workspace marker/,
    );
  });
});

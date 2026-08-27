import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAdditionalExitAddress,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  createKeepsakeEquipResultAddress,
  createLocalVisitSlotAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPostbossKeepsakeSelectionAddress,
  createRouteStartKeepsakeSelectionAddress,
  createProjectDocument,
  createRewardWheelOfferAddress,
  createTargetAddress,
  createTraitOfferAddress,
  semanticAddressKey,
  type AuthoredBiomePlan,
  type ProjectDocument,
  type TraitOfferAddress,
} from '@run-planner/engine/authored-project';
import {
  encounterPhaseCandidateSupportForProjectEvaluationAssembly,
  keepsakeEquipResultCandidateForProjectEvaluationAssembly,
  levelResolutionCandidateForProjectEvaluationAssembly,
  simulateProject,
  simulateProjectAssembly,
  type CanonicalBatch,
  type CanonicalBiome,
  type CanonicalHubDecision,
  type MaterializedBiomePrefix,
  type ProjectEvaluation,
  type SemanticFinding,
} from '@run-planner/engine/simulation';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import { createGoldenFGHIProject, goldenFBiome } from '@run-planner/test-fixtures/underworld';
import {
  loadSurfaceNEntryFrontierProject,
  loadSurfaceNOPQProject,
  nBiome,
  nLocalOccurrenceId,
  nOccurrenceId,
  oBiome,
  oOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
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
import {
  createGoldenEchoGiftEmbryoPendingProject,
  createGoldenEchoGiftHammerPendingProject,
  echoGiftEmbryoReplayAddress,
  echoGiftHammerReplayAddress,
} from '@planner-test/fixtures/echoGiftHammer';
import { createCandidateSessionFactory } from './candidateProjection';
import type { CandidateSessionFactory } from './candidateProjection';
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

let goldenFGHIContractProject: ProjectDocument;
let representativeNOPQContractProject: ProjectDocument;

beforeAll(() => {
  goldenFGHIContractProject = createGoldenFGHIProject();
  representativeNOPQContractProject = loadSurfaceNOPQProject();
});

type WorkspaceBatchNode =
  WorkspaceMixedBatchNode | WorkspaceOrdinaryBatchNode | WorkspaceTakeoverBatchNode;

function createStructuralFrontierProject(biomeKey: 'G' | 'H' | 'P'): ProjectDocument {
  const routeKey = biomeKey === 'P' ? 'Surface' : 'Underworld';
  const project = createProjectDocument(catalog, {
    configuredBiomeCounts:
      routeKey === 'Surface' ? { Surface: 3 } : { Underworld: biomeKey === 'G' ? 2 : 3 },
    projectId: `structural-frontier-${biomeKey.toLowerCase()}`,
  });
  return applyProjectCommand(project, catalog, {
    biome: createBiomeAddress(routeKey, biomeKey),
    kind: 'CreateStart',
    occurrenceId: createOccurrenceId(`structural-${biomeKey.toLowerCase()}-start`),
  });
}

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
    candidateArtifactsForProjectEvaluationAssembly: () =>
      Object.freeze({ biomeAt: () => undefined }),
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
    encounterPhaseSequenceStatusForProjectEvaluationAssembly: (
      ...args: Parameters<typeof actual.encounterPhaseSequenceStatusForProjectEvaluationAssembly>
    ) => {
      try {
        return actual.encounterPhaseSequenceStatusForProjectEvaluationAssembly(...args);
      } catch {
        // The forged overlay intentionally has no exact preparation status.
        // Preserve the production provenance guard while this test-only seam
        // lets the projection reject the malformed evaluator overlay first.
        return undefined;
      }
    },
    encounterPhaseFigLeafSupportForProjectEvaluationAssembly: (
      ...args: Parameters<typeof actual.encounterPhaseFigLeafSupportForProjectEvaluationAssembly>
    ) => {
      try {
        return actual.encounterPhaseFigLeafSupportForProjectEvaluationAssembly(...args);
      } catch {
        // The forged overlay has no exact Fig Leaf capability. Preserve the
        // production provenance guard while allowing malformed-overlay tests
        // to reach their intended source/evaluator contract assertion.
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

function postbossOccurrence(routeKey: string, biomeKey: string) {
  return createOccurrenceAddress(
    createBiomeAddress(routeKey, biomeKey),
    createOccurrenceId(`completion:${biomeKey}:postboss`),
  );
}

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
  // The malformed-overlay tests exercise projection guards, not candidate
  // recovery. Keep the genuine, callable candidate capabilities from the
  // matching assembly so newly projected dormant/settlement controls do not
  // fail before the intended malformed-evaluation assertion is reached.
  const matchingCandidates = createCandidateSessionFactory(catalog).bind(assembly);
  return projection(
    Object.freeze({
      bind: () => matchingCandidates,
    }),
  ).project(Object.freeze({ ...assembly, evaluation }));
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
    case 'roomActions':
      return {
        ...interactions,
        roomActions: without(interactions.roomActions),
      };
    case 'localVisitOrder':
      return { ...interactions, localVisitOrders: without(interactions.localVisitOrders) };
    case 'localVisitGeneration':
      return {
        ...interactions,
        localVisitGenerations: without(interactions.localVisitGenerations),
      };
    case 'levelResolution':
      return { ...interactions, levelResolutions: without(interactions.levelResolutions) };
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
    case 'exitSelection':
      return { ...interactions, exitSelections: without(interactions.exitSelections) };
    case 'fieldsCageOutcome':
      return { ...interactions, fieldsCageOutcomes: without(interactions.fieldsCageOutcomes) };
    case 'hubSlot':
      return { ...interactions, hubSlots: without(interactions.hubSlots) };
    case 'hubVisitOrder':
      return { ...interactions, hubVisitOrders: without(interactions.hubVisitOrders) };
    case 'roomPicker':
      return { ...interactions, rooms: without(interactions.rooms) };
    case 'start':
      return { ...interactions, starts: without(interactions.starts) };
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
    const fProject = goldenFGHIContractProject;
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

    const nProject = representativeNOPQContractProject;
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
    const project = loadSurfaceNOPQProject();
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
      origin: createAcquisitionEntryAddress(
        createAcquisitionSiteAddress(
          createOccurrenceAddress(goldenFBiome, createOccurrenceId('evaluator-only-shop')),
          'roomExit',
        ),
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

  it('publishes equip-result controls and destinations only for engine-supported owners', () => {
    const fPostboss = createPostbossKeepsakeSelectionAddress(postbossOccurrence('Underworld', 'F'));
    const fHammerResult = createKeepsakeEquipResultAddress(fPostboss, 'experimentalHammer');
    let invalidHammer = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: fPostboss,
      value: { kind: 'replace', keepsakeKey: 'TempHammerKeepsake' },
    });
    invalidHammer = withMalformedAuthoredBiome(invalidHammer, 'Underworld', 'F', (plan) => ({
      ...plan,
      completionOccurrences: plan.completionOccurrences.map((occurrence) =>
        occurrence.occurrenceId === createOccurrenceId('completion:F:postboss')
          ? {
              ...occurrence,
              keepsakeRack: {
                ...occurrence.keepsakeRack!,
                equipResults: {
                  experimentalHammer: { kind: 'selected', traitKey: 'ApolloWeaponBoon' },
                },
              },
            }
          : occurrence,
      ),
    }));
    const invalidAssembly = simulateProjectAssembly(catalog, invalidHammer);
    expect(invalidAssembly.evaluation.findings).toContainEqual(
      expect.objectContaining({
        code: 'keepsakeEquipResultUnavailable',
        origin: fHammerResult,
      }),
    );
    expect(
      keepsakeEquipResultCandidateForProjectEvaluationAssembly(invalidAssembly, fHammerResult),
    ).toBeDefined();
    const invalidProjected = projection().project(invalidAssembly);
    const invalidKey = semanticAddressKey(fHammerResult);
    const invalidInteraction = invalidProjected.interactions.keepsakeEquipResults.get(invalidKey);
    if (invalidInteraction?.owner.resultKind !== 'experimentalHammer')
      throw new Error('invalid Experimental Hammer interaction is missing');
    const invalidModel = invalidInteraction.load();
    expect(invalidModel.picker.selected).toMatchObject({
      value: 'ApolloWeaponBoon',
      state: 'impossible',
      selected: true,
      explanation: 'This option is not available with the current route.',
    });
    expect(invalidModel.picker.sections).toContainEqual(
      expect.objectContaining({
        kind: 'selectedInvalid',
        items: expect.arrayContaining([
          expect.objectContaining({ value: 'ApolloWeaponBoon', state: 'impossible' }),
        ]),
      }),
    );
    const fCompletion = invalidProjected.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F')
      ?.nodes.find((node) => node.kind === 'occurrenceWorkbench' && node.room.kind === 'PostBoss');
    if (
      fCompletion?.kind !== 'occurrenceWorkbench' ||
      fCompletion.room.keepsakeSelection === undefined
    )
      throw new Error('reached F Postboss completion is missing');

    expect(invalidProjected.interactions.keepsakeEquipResults.has(invalidKey)).toBe(true);
    expect(fCompletion.room.keepsakeSelection.equipResult?.address).toEqual(fHammerResult);
    expect(invalidProjected.focusByOwner.get(invalidKey)).toMatchObject({
      focusAddress: fPostboss,
      focusKey: semanticAddressKey(fPostboss),
      inspectorSubject: { kind: 'node', nodeKey: fCompletion.key },
      nodeKey: fCompletion.key,
      ownerAddress: fHammerResult,
    });

    const gPostboss = createPostbossKeepsakeSelectionAddress(postbossOccurrence('Underworld', 'G'));
    const hPostboss = createPostbossKeepsakeSelectionAddress(postbossOccurrence('Underworld', 'H'));
    const hHammerResult = createKeepsakeEquipResultAddress(hPostboss, 'experimentalHammer');
    let unavailableHammer = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: fPostboss,
      value: { kind: 'replace', keepsakeKey: 'TempHammerKeepsake' },
    });
    unavailableHammer = applyProjectCommand(unavailableHammer, catalog, {
      kind: 'ReplaceExperimentalHammerEquipResult',
      result: fHammerResult,
      value: { kind: 'selected', traitKey: 'StaffJumpSpecialTrait' },
    });
    unavailableHammer = applyProjectCommand(unavailableHammer, catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: gPostboss,
      value: { kind: 'replace', keepsakeKey: 'BossPreDamageKeepsake' },
    });
    unavailableHammer = applyProjectCommand(unavailableHammer, catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: hPostboss,
      value: { kind: 'replace', keepsakeKey: 'TempHammerKeepsake' },
    });
    const unavailableAssembly = simulateProjectAssembly(catalog, unavailableHammer);
    expect(unavailableAssembly.evaluation.findings).toContainEqual(
      expect.objectContaining({ code: 'keepsakeUnavailable', origin: hPostboss }),
    );
    expect(
      keepsakeEquipResultCandidateForProjectEvaluationAssembly(unavailableAssembly, hHammerResult),
    ).toBeUndefined();
    const unavailableProjected = projection().project(unavailableAssembly);
    const unavailableKey = semanticAddressKey(hHammerResult);
    const hCompletion = unavailableProjected.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'H')
      ?.nodes.find((node) => node.kind === 'occurrenceWorkbench' && node.room.kind === 'PostBoss');
    if (hCompletion?.kind !== 'occurrenceWorkbench')
      throw new Error('reached H Postboss completion is missing');

    expect(unavailableProjected.interactions.keepsakeEquipResults.has(unavailableKey)).toBe(false);
    expect(hCompletion.room.keepsakeSelection?.equipResult).toBeUndefined();
    expect(unavailableProjected.focusByOwner.has(unavailableKey)).toBe(false);

    const routeStart = createRouteStartKeepsakeSelectionAddress('Underworld');
    const startHammerResult = createKeepsakeEquipResultAddress(routeStart, 'experimentalHammer');
    let missingStartHammer = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      keepsakeKey: 'TempHammerKeepsake',
      selection: routeStart,
    });
    missingStartHammer = {
      ...missingStartHammer,
      routes: missingStartHammer.routes.map((route) => {
        if (route.routeKey !== 'Underworld') return route;
        const { keepsakeEquipResults: _discarded, ...loadout } = route.loadout;
        void _discarded;
        return { ...route, loadout };
      }),
    };
    const startProjected = projectWorkspace(missingStartHammer);
    const startKey = semanticAddressKey(startHammerResult);
    expect(startProjected.interactions.keepsakeEquipResults.has(startKey)).toBe(true);
    expect(startProjected.focusByOwner.get(startKey)).toMatchObject({
      ownerAddress: startHammerResult,
      region: 'routeRail',
      routeKey: 'Underworld',
    });
  }, 20_000);

  it('projects the reached I Gift Hammer repair through its biome-owned control and destination', () => {
    const project = createGoldenEchoGiftHammerPendingProject();
    const assembly = simulateProjectAssembly(catalog, project);
    expect(assembly.evaluation.findings).toContainEqual(
      expect.objectContaining({
        code: 'keepsakeEquipResultMissing',
        origin: echoGiftHammerReplayAddress,
      }),
    );

    const projected = projection().project(assembly);
    const i = projected.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'I');
    if (i === undefined) throw new Error('reached I workspace is missing');
    expect(i.echoKeepsakeReplay?.address).toEqual(echoGiftHammerReplayAddress);

    const key = semanticAddressKey(echoGiftHammerReplayAddress);
    const interaction = projected.interactions.keepsakeEquipResults.get(key);
    if (interaction?.owner.resultKind !== 'experimentalHammer')
      throw new Error('I Gift Hammer interaction is missing');
    expect(interaction.owner).toEqual(echoGiftHammerReplayAddress);
    expect(interaction.value).toBeUndefined();
    expect(
      interaction
        .load()
        .picker.sections.flatMap((section) => section.items)
        .some((candidate) => candidate.value !== '__exhausted' && candidate.state === 'possible'),
    ).toBe(true);
    expect(projected.focusByOwner.get(key)).toMatchObject({
      ownerAddress: echoGiftHammerReplayAddress,
      region: 'structure',
      nodeKey: i.entry?.key,
    });
  }, 20_000);

  it('publishes immediate Embryo result interactions at route start, F Postboss, and I Echo', () => {
    const fOnlyProject = (): ProjectDocument => {
      const base = createGoldenFGHIProject();
      return {
        ...base,
        routes: base.routes.map((route) =>
          route.routeKey !== 'Underworld'
            ? route
            : { ...route, biomes: route.biomes.filter((biome) => biome.biomeKey === 'F') },
        ),
      };
    };
    const start = createRouteStartKeepsakeSelectionAddress('Underworld');
    const startResult = createKeepsakeEquipResultAddress(start, 'transcendentEmbryo');
    const routeStartProject = applyProjectCommand(fOnlyProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: start,
      keepsakeKey: 'RandomBlessingKeepsake',
    });
    const routeStart = projectWorkspace(routeStartProject);
    const startInteraction = routeStart.interactions.keepsakeEquipResults.get(
      semanticAddressKey(startResult),
    );
    if (startInteraction?.owner.resultKind !== 'transcendentEmbryo')
      throw new Error('route-start Embryo interaction is missing');
    expect(startInteraction.owner).toEqual(startResult);
    expect(startInteraction.value).toBeUndefined();
    const epicStart = startInteraction
      .load()
      .picker.sections.flatMap((section) => section.items)
      .find((candidate) => candidate.value === 'ChaosWeaponBlessing');
    expect(epicStart?.state).toBe('possible');
    expect(
      (
        startInteraction as Extract<
          typeof startInteraction,
          { readonly owner: { readonly resultKind: 'transcendentEmbryo' } }
        >
      ).load({ blessingKey: 'ChaosWeaponBlessing' }).transcendentEmbryoSummary,
    ).toMatchObject({ rarity: 'Epic' });
    expect(routeStart.focusByOwner.get(semanticAddressKey(startResult))).toMatchObject({
      ownerAddress: startResult,
      region: 'routeRail',
    });

    const fPostboss = createPostbossKeepsakeSelectionAddress(
      createOccurrenceAddress(
        createBiomeAddress('Underworld', 'F'),
        createOccurrenceId('completion:F:postboss'),
      ),
    );
    const postbossResult = createKeepsakeEquipResultAddress(fPostboss, 'transcendentEmbryo');
    const postbossProject = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: fPostboss,
      value: { kind: 'replace', keepsakeKey: 'RandomBlessingKeepsake' },
    });
    const postboss = projectWorkspace(postbossProject);
    const postbossInteraction = postboss.interactions.keepsakeEquipResults.get(
      semanticAddressKey(postbossResult),
    );
    if (postbossInteraction?.owner.resultKind !== 'transcendentEmbryo')
      throw new Error('F Postboss Embryo interaction is missing');
    expect(postbossInteraction.owner).toEqual(postbossResult);
    expect(postbossInteraction.value).toBeUndefined();
    const epicPostboss = postbossInteraction
      .load()
      .picker.sections.flatMap((section) => section.items)
      .find((candidate) => candidate.value === 'ChaosWeaponBlessing');
    expect(epicPostboss?.state).toBe('possible');
    expect(
      (
        postbossInteraction as Extract<
          typeof postbossInteraction,
          { readonly owner: { readonly resultKind: 'transcendentEmbryo' } }
        >
      ).load({ blessingKey: 'ChaosWeaponBlessing' }).transcendentEmbryoSummary,
    ).toMatchObject({ rarity: 'Epic' });

    const echoAssembly = simulateProjectAssembly(
      catalog,
      createGoldenEchoGiftEmbryoPendingProject(),
    );
    const echo = projection().project(echoAssembly);
    const echoInteraction = echo.interactions.keepsakeEquipResults.get(
      semanticAddressKey(echoGiftEmbryoReplayAddress),
    );
    if (echoInteraction?.owner.resultKind !== 'transcendentEmbryo')
      throw new Error('I Echo Embryo interaction is missing');
    expect(echoInteraction.owner).toEqual(echoGiftEmbryoReplayAddress);
    expect(echoInteraction.value).toBeUndefined();
    const common = echoInteraction
      .load()
      .picker.sections.flatMap((section) => section.items)
      .find((candidate) => candidate.value === 'ChaosWeaponBlessing');
    expect(common?.state).toBe('possible');
    expect(
      (
        echoInteraction as Extract<
          typeof echoInteraction,
          { readonly owner: { readonly resultKind: 'transcendentEmbryo' } }
        >
      ).load({ blessingKey: 'ChaosWeaponBlessing' }).transcendentEmbryoSummary,
    ).toMatchObject({ rarity: 'Common' });
    expect(echo.focusByOwner.get(semanticAddressKey(echoGiftEmbryoReplayAddress))).toMatchObject({
      ownerAddress: echoGiftEmbryoReplayAddress,
      region: 'structure',
    });
  }, 20_000);

  it('rejects a fine-grained finding on a withheld dormant Ephyra side leaf', () => {
    const project = loadSurfaceNOPQProject();
    const evaluation = simulateProject(catalog, project);
    const finding = {
      code: 'sideRoomGenerationUnavailable',
      evidence: {},
      origin: createLocalVisitSlotAddress(
        nBiome,
        nOccurrenceId('combat10'),
        'sideRooms',
        'sideDoor1',
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

  it('does not publish an ungenerated Ephyra reward as a current workspace leaf', () => {
    const localVisitSlot = createLocalVisitSlotAddress(
      nBiome,
      nOccurrenceId('combat02'),
      'sideRooms',
      'sideDoor2',
    );
    const reward = createIncomingRewardAddress(nBiome, nLocalOccurrenceId('combat02', 'sideDoor2'));
    const project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'SetLocalVisitGeneration',
      slot: localVisitSlot,
      generation: 'notGenerated',
    });
    const projected = projectWorkspace(project);

    expect(projected.focusByOwner.get(semanticAddressKey(reward))).toBeUndefined();
    expect(projected.interactions.rewards.get(semanticAddressKey(reward))).toBeUndefined();
    expect(
      projected.interactions.localVisitGenerations.get(semanticAddressKey(localVisitSlot)),
    ).toBeDefined();
  });

  it('rejects an independently expected editable leaf omitted from projection products', () => {
    const project = loadSurfaceNOPQProject();
    const plan = project.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N');
    if (plan?.topology === null || plan === undefined) {
      throw new Error('complete N topology is missing');
    }
    const address = createIncomingRewardAddress(
      nBiome,
      nLocalOccurrenceId('combat05', 'sideDoor2'),
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
    for (const project of [createGoldenFGHIProject(), loadSurfaceNOPQProject()]) {
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
            ...expectedWorkspaceLeafRequirements(catalog, biome, plan, (resolution) =>
              levelResolutionCandidateForProjectEvaluationAssembly(assembly, resolution),
            ),
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
        'roomActions',
        'localVisitOrder',
        'localVisitGeneration',
        'levelResolution',
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
    const wheelOwner = createRewardWheelOfferAddress(
      oBiome,
      oOccurrenceIds.combat04,
      'wheel1',
      'offer1',
    );
    let surface = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: wheelOwner,
      value: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
      },
    });
    surface = applyProjectCommand(surface, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(wheelOwner, 'source'),
      value: {
        kind: 'traits',
        giverKey: 'Apollo',
        options: [
          { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
          { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
          { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    for (const project of [createGoldenFGHIProject(), surface]) {
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
    const valid = loadSurfaceNOPQProject();
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
      { kind: 'occurrence', occurrenceId: nLocalOccurrenceId('combat05', 'sideDoor2') },
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
    for (const project of [createGoldenFGHIProject(), loadSurfaceNOPQProject()]) {
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
    expect(interaction?.mapIntent(batch.naturalChaos.door.room.gameName).command).toEqual({
      kind: 'ReplaceNaturalChaosMap',
      occurrence: createOccurrenceAddress(biome, chaosId),
      gameName: batch.naturalChaos.door.room.gameName,
    });
    expect(batch.naturalChaos.door.room.occurrenceId).toBe(chaosId);
    expect(batch.naturalChaos.door.rewardPreview).toEqual({
      kind: 'hidden',
      authoringRewards: [],
    });
    expect(projected.focusByOwner.get(semanticAddressKey(additional))?.nodeKey).toBe(batch.key);
    const chaosWorkbench = workspace?.nodes.find(
      (node) => node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === chaosId,
    );
    if (chaosWorkbench?.kind !== 'occurrenceWorkbench') {
      throw new Error('natural Chaos occurrence workbench is missing');
    }
    for (const address of [
      createOccurrenceAddress(biome, chaosId),
      ...batch.naturalChaos.door.room.rewardControls.map((control) => control.owner.address),
    ]) {
      expect(projected.focusByOwner.get(semanticAddressKey(address))?.nodeKey).toBe(
        chaosWorkbench.key,
      );
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
    expect(selectedContract?.zagreusContract?.door.room.entered).toBe(true);
    expect(selectedContract?.zagreusContract?.door.rewardPreview).toEqual({
      kind: 'hidden',
      authoringRewards: [],
    });
    const contractPackages = observed.roomPackagesByOccurrence.get(contractId);
    expect(contractPackages).toHaveLength(1);
    expect(contractPackages?.[0]?.nodeKey).toBe(
      `occurrence:${semanticAddressKey(createOccurrenceAddress(biome, contractId))}`,
    );
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
    const automaticReturn = workspace.nodes.find(
      (node): node is WorkspaceBatchNode =>
        (node.kind === 'ordinaryBatch' ||
          node.kind === 'mixedBatch' ||
          node.kind === 'takeoverBatch') &&
        semanticAddressKey(node.owner) === semanticAddressKey(contractDecision),
    );
    const automaticReturnPreview = automaticReturn?.targets[0]?.door.rewardPreview;
    expect(automaticReturnPreview?.kind).toBe('hidden');
    if (automaticReturnPreview?.kind !== 'hidden') {
      throw new Error('Zagreus automatic return must retain a hidden reward preview');
    }
    expect(automaticReturnPreview.authoringRewards).toHaveLength(1);
    expect(automaticReturnPreview.authoringRewards[0]?.control).toBeDefined();
    expect(automaticReturnPreview.authoringRewards[0]?.offer).toBeNull();
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

    const unrelatedFNode = f.nodes.find(
      (node) => node.kind === 'occurrenceWorkbench' && node.room.kind === 'PostBoss',
    );
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

    const nProject = loadSurfaceNOPQProject();
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
      projectId: 'structural-oracle-empty-n',
    });
    const emptyF = createProjectDocument(catalog, {
      configuredBiomeCounts: { Underworld: 1 },
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
    const gFrontier = createStructuralFrontierProject('G');
    const hFrontier = createStructuralFrontierProject('H');
    const pFrontier = createStructuralFrontierProject('P');
    const nTerminal = loadSurfaceNEntryFrontierProject();
    for (const project of [
      createGoldenFGHIProject(),
      loadSurfaceNOPQProject(),
      emptyN,
      fFrontier,
      gFrontier,
      hFrontier,
      pFrontier,
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

    for (const [project, routeKey, biomeKey, expectedKinds] of [
      [fFrontier, 'Underworld', 'F', ['batchRewardStore', 'decisionEntryRoomPicker']],
      [gFrontier, 'Underworld', 'G', ['batchRewardStore', 'decisionEntryRoomPicker']],
      [hFrontier, 'Underworld', 'H', ['fieldsCageOutcome', 'decisionEntryRoomPicker']],
      [pFrontier, 'Surface', 'P', ['batchRewardStore', 'decisionEntryRoomPicker']],
    ] as const) {
      const plan = project.routes
        .find((route) => route.routeKey === routeKey)
        ?.biomes.find((biome) => biome.biomeKey === biomeKey);
      if (plan === undefined) throw new Error(`missing ${biomeKey} structural frontier`);
      const projected = projectWorkspace(project);
      const projectedBiome = projected.routes
        .find((route) => route.routeKey === routeKey)
        ?.biomes.find((biome) => biome.biomeKey === biomeKey);
      if (
        projectedBiome?.frontier?.kind !== 'exitDecision' ||
        projectedBiome.frontier.provisionalBatch === undefined
      ) {
        throw new Error(`${biomeKey} has no provisional outgoing workbench`);
      }
      const controls = expectedWorkspaceStructuralControls(
        catalog,
        createBiomeAddress(routeKey, biomeKey),
        plan,
      );
      expect(controls.map((control) => control.kind)).toEqual(
        expect.arrayContaining([...expectedKinds]),
      );
      const provisional = projectedBiome.frontier.provisionalBatch;
      expect(projected.interactions.exitSelections.has(provisional.selection.focusKey)).toBe(false);
      expect(projected.interactions.topologyRemovals.has(provisional.marker.focusKey)).toBe(false);
    }
  });

  it('makes every independently expected structural interaction family observable', () => {
    const emptyN = createProjectDocument(catalog, {
      configuredBiomeCounts: { Surface: 1 },
      projectId: 'structural-mutation-empty-n',
    });
    const emptyF = createProjectDocument(catalog, {
      configuredBiomeCounts: { Underworld: 1 },
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
    const gFrontier = createStructuralFrontierProject('G');
    const hFrontier = createStructuralFrontierProject('H');
    const pFrontier = createStructuralFrontierProject('P');
    const nTerminal = loadSurfaceNEntryFrontierProject();
    const examples = new Map<
      ExpectedWorkspaceStructuralControl['kind'],
      {
        control: ExpectedWorkspaceStructuralControl;
        interactions: WorkspaceInteractionCatalog;
      }
    >();
    for (const project of [
      createGoldenFGHIProject(),
      loadSurfaceNOPQProject(),
      emptyN,
      fFrontier,
      gFrontier,
      hFrontier,
      pFrontier,
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
        'exitSelection',
        'fieldsCageOutcome',
        'hubSlot',
        'hubVisitOrder',
        'naturalChaosSpawn',
        'roomPicker',
        'start',
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

    const surface = loadSurfaceNOPQProject();
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

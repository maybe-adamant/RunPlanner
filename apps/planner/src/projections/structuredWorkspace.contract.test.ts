import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createExitDecisionAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
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
} from '@run-planner/engine/authored-project';
import {
  simulateProject,
  type CanonicalBatch,
  type CanonicalBiome,
  type CanonicalHubDecision,
  type ProjectEvaluation,
  type SemanticFinding,
} from '@run-planner/engine/simulation';
import { describe, expect, it, vi } from 'vitest';

import { createGoldenFGHIProject, goldenFBiome } from '../../../../test/fixtures/authored-project';
import {
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceId,
} from '../../../../test/fixtures/authored-project';
import {
  assertAuthoredWorkspaceTopologyClosure,
  assertExpectedWorkspaceLeafClosure,
  assertExpectedWorkspaceStructuralControlClosure,
  assertRenderedWorkspaceStructuralControlClosure,
} from '../../test/support/structuredWorkspaceClosure';
import { expectedWorkspaceLeafRequirements } from '../../test/support/structuredWorkspaceExpectations';
import { expectedWorkspaceStructuralControls } from '../../test/support/structuredWorkspaceStructuralControls';
import { createCandidateSessionFactory } from './candidateProjection';
import { createContextualOptionResolver } from './contextualOptions';
import { createContextualPickerProjection } from './contextualPicker';
import { createRewardPickerProjection } from './rewardPicker';
import { StructuredWorkspaceProjectionContractError } from './structured-workspace/contract';
import { createStructuredWorkspaceProjection } from './structured-workspace';

/**
 * These tests deliberately bypass only evaluator provenance. Production still
 * rejects foreign evaluations; the seam lets this adapter prove it rejects a
 * malformed evaluator overlay before React can render it.
 */
vi.mock('@run-planner/engine/simulation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@run-planner/engine/simulation')>();
  return { ...actual, assertProjectEvaluationSource: () => undefined };
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

function projection() {
  return createStructuredWorkspaceProjection(catalog, {
    candidateSessions: createCandidateSessionFactory(catalog),
    contextualPicker: createContextualPickerProjection(createContextualOptionResolver(catalog)),
    rewardPicker: createRewardPickerProjection(
      catalog,
      createContextualPickerProjection(createContextualOptionResolver(catalog)),
    ),
  });
}

function withoutProperty(value: object, property: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== property));
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
        if (biome.authoring !== 'complete') throw new Error('F fixture must be complete');
        replaced = true;
        return { ...biome, snapshot: transform(biome.snapshot) };
      }),
    };
  });
  if (!replaced) throw new Error('complete F fixture was not evaluated');
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
        if (biome.authoring !== 'complete') throw new Error('N fixture must be complete');
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
      expect(() => projection().project(project, evaluation)).toThrow(message);
    }
  });

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

    expect(() => projection().project(project, malformed)).toThrow(
      StructuredWorkspaceProjectionContractError,
    );
    expect(() => projection().project(project, malformed)).toThrow(
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

    expect(() => projection().project(project, malformed)).toThrow(
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

    expect(() => projection().project(project, malformed)).toThrow(
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

    expect(() => projection().project(project, malformed)).toThrow(
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

    expect(() => projection().project(project, malformed)).toThrow(
      /finding has no exact workspace destination/,
    );
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

    const projected = projection().project(project, simulateProject(catalog, project));
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
        focusByOwner: projected.focusByOwner,
        interactions: projected.interactions,
        nodes: n.nodes.filter((node) => node.kind !== 'occurrenceWorkbench'),
        requirements: [requirement],
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
        focusByOwner: wrongDestination,
        interactions: projected.interactions,
        nodes: n.nodes,
        requirements: [requirement],
      }),
    ).toThrow(/required authored leaf .* has no exact workspace inspector destination/);

    const withoutRewardInteraction = {
      ...projected.interactions,
      rewards: new Map(projected.interactions.rewards),
    };
    withoutRewardInteraction.rewards.delete(semanticAddressKey(address));
    expect(() =>
      assertExpectedWorkspaceLeafClosure({
        focusByOwner: projected.focusByOwner,
        interactions: withoutRewardInteraction,
        nodes: n.nodes,
        requirements: [requirement],
      }),
    ).toThrow(/authored reward leaf .* has no exact workspace interaction/);
  });

  it('independently closes persisted decisions, targets, occurrences, and Hub ownership', () => {
    for (const project of [createGoldenFGHIProject(), createRepresentativeNOPQProject()]) {
      const projected = projection().project(project, simulateProject(catalog, project));
      for (const route of project.routes) {
        for (const plan of route.biomes) {
          if (plan.topology === null) continue;
          const biome = projected.routes
            .find((candidate) => candidate.routeKey === route.routeKey)
            ?.biomes.find((candidate) => candidate.biomeKey === plan.biomeKey);
          if (biome === undefined) throw new Error(`${plan.biomeKey} workspace biome is missing`);
          assertAuthoredWorkspaceTopologyClosure({
            biome: { biomeKey: plan.biomeKey, kind: 'biome', routeKey: route.routeKey },
            focusByOwner: projected.focusByOwner,
            nodes: biome.nodes,
            plan,
          });
        }
      }
    }
  });

  it('closes structural occurrence packages without requiring standalone workbench nodes', () => {
    const project = createGoldenFGHIProject();
    const projected = projection().project(project, simulateProject(catalog, project));
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
      assertAuthoredWorkspaceTopologyClosure({
        biome: goldenFBiome,
        focusByOwner: nestedDestinations,
        nodes: f.nodes.filter((node) => node.key !== workbench.key),
        plan: planWithDetachedRecord,
      }),
    ).not.toThrow();
  });

  it('makes target and authored Hub sub-owner markers and exact destinations observable', () => {
    const fProject = createGoldenFGHIProject();
    const fProjected = projection().project(fProject, simulateProject(catalog, fProject));
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
    const assertF = (nodes: readonly unknown[], focusByOwner: ReadonlyMap<string, unknown>) =>
      assertAuthoredWorkspaceTopologyClosure({
        biome: goldenFBiome,
        focusByOwner,
        nodes,
        plan: fPlan,
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
                ? withoutProperty(candidate, 'marker')
                : candidate,
            ),
          ),
        });
      }
      if (
        node.kind === 'occurrenceWorkbench' &&
        node.room.occurrenceId === target.room.occurrenceId
      ) {
        return withoutProperty(node, 'railMarker');
      }
      return node;
    });
    expect(() => assertF(withoutTargetMarker, fProjected.focusByOwner)).toThrow(
      /target .* has no workspace marker/,
    );

    const nProject = createRepresentativeNOPQProject();
    const nProjected = projection().project(nProject, simulateProject(catalog, nProject));
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
    const assertN = (nodes: readonly unknown[], focusByOwner: ReadonlyMap<string, unknown>) =>
      assertAuthoredWorkspaceTopologyClosure({
        biome: nBiome,
        focusByOwner,
        nodes,
        plan: nPlan,
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
              slot.hubSlotKey === slotTarget.hubSlotKey ? withoutProperty(slot, 'marker') : slot,
            ),
          ),
        });
      }
      if (
        node.kind === 'occurrenceWorkbench' &&
        node.room.occurrenceId === slotTarget.occurrenceId
      ) {
        return withoutProperty(node, 'railMarker');
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
                visit.visitIndex === 1 ? withoutProperty(visit, 'marker') : visit,
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
    const nStarted = applyProjectCommand(emptyN, catalog, {
      biome: nBiome,
      kind: 'CreateStart',
      occurrenceId: nOccurrenceId('opening'),
    });
    const nHubFrontier = applyProjectCommand(nStarted, catalog, {
      decision: createExitDecisionAddress(nBiome, {
        kind: 'occurrence',
        occurrenceId: nOccurrenceId('opening'),
      }),
      kind: 'CreateLinkedExit',
      occurrenceId: nOccurrenceId('preHub'),
    });
    for (const project of [
      createGoldenFGHIProject(),
      createRepresentativeNOPQProject(),
      emptyN,
      fFrontier,
      nHubFrontier,
    ]) {
      const projected = projection().project(project, simulateProject(catalog, project));
      assertRenderedWorkspaceStructuralControlClosure({
        interactions: projected.interactions,
        routes: projected.routes,
      });
      for (const route of project.routes) {
        for (const plan of route.biomes) {
          assertExpectedWorkspaceStructuralControlClosure({
            controls: expectedWorkspaceStructuralControls(
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

  it('makes a missing independently expected structural interaction observable', () => {
    const project = createRepresentativeNOPQProject();
    const projected = projection().project(project, simulateProject(catalog, project));
    const plan = project.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N');
    if (plan === undefined) throw new Error('Surface/N plan is missing');
    const controls = expectedWorkspaceStructuralControls(catalog, nBiome, plan);
    const slot = controls.find((control) => control.kind === 'hubSlot');
    if (slot === undefined) throw new Error('Surface/N Hub slot control is missing');
    const interactions = {
      ...projected.interactions,
      hubSlots: new Map(projected.interactions.hubSlots),
    };
    interactions.hubSlots.delete(slot.key);

    expect(() =>
      assertExpectedWorkspaceStructuralControlClosure({ controls, interactions }),
    ).toThrow(/hubSlot .* has no exact workspace interaction/);
  });

  it('keeps Ephyra side details dormant until the authored Hub visit activates them', () => {
    const project = createRepresentativeNOPQProject();
    const plan = project.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N');
    if (plan?.topology === null || plan === undefined) {
      throw new Error('complete N topology is missing');
    }
    const incoming = createIncomingRewardAddress(nBiome, nOccurrenceId('combat10'));
    const sideReward = createLocalRewardAddress(
      nBiome,
      nOccurrenceId('combat10'),
      'sideRooms',
      'sideDoor1',
    );
    const sideChild = createLocalChildAddress(
      nBiome,
      nOccurrenceId('combat10'),
      'sideRooms',
      'sideDoor1',
    );
    const dormant = expectedWorkspaceLeafRequirements(catalog, nBiome, plan);
    expect(
      dormant.some(
        (requirement) => semanticAddressKey(requirement.address) === semanticAddressKey(incoming),
      ),
    ).toBe(true);
    expect(
      dormant.some(
        (requirement) => semanticAddressKey(requirement.address) === semanticAddressKey(sideReward),
      ),
    ).toBe(false);
    expect(
      dormant.some(
        (requirement) => semanticAddressKey(requirement.address) === semanticAddressKey(sideChild),
      ),
    ).toBe(false);

    const visited: AuthoredBiomePlan = {
      ...plan,
      topology: {
        ...plan.topology,
        decisions: plan.topology.decisions.map((decision) =>
          decision.kind !== 'hub'
            ? decision
            : {
                ...decision,
                visitOrder: Object.freeze([...decision.visitOrder.slice(0, -1), 'combat10']),
              },
        ),
      },
    };
    const activated = expectedWorkspaceLeafRequirements(catalog, nBiome, visited).find(
      (requirement) => semanticAddressKey(requirement.address) === semanticAddressKey(sideReward),
    );
    expect(activated?.interactions.map((interaction) => interaction.kind)).toEqual(['reward']);
    const activatedChild = expectedWorkspaceLeafRequirements(catalog, nBiome, visited).find(
      (requirement) => semanticAddressKey(requirement.address) === semanticAddressKey(sideChild),
    );
    expect(activatedChild?.interactions.map((interaction) => interaction.kind)).toEqual([
      'sideRoomGeneration',
      'sideRoomEntryOrder',
    ]);
  });
});

import { catalog } from '@run-planner/hades2-catalog';
import {
  createExitDecisionAddress,
  createIncomingRewardAddress,
  createLocalChildAddress,
  createLocalRewardAddress,
  createOccurrenceId,
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

import { createGoldenFGHIProject, goldenFBiome } from '../../test/fixtures/underworldProject';
import {
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceId,
} from '../../test/fixtures/surfaceProject';
import { createCandidateSessionFactory } from './candidateProjection';
import { createContextualOptionResolver } from './contextualOptions';
import { createContextualPickerProjection } from './contextualPicker';
import { createRewardPickerProjection } from './rewardPicker';
import {
  assertAuthoredWorkspaceLeafInteractionClosure,
  assertAuthoredWorkspaceLeafProjectionClosure,
  authoredWorkspaceLeafRequirements,
  createStructuredWorkspaceProjection,
  StructuredWorkspaceProjectionContractError,
} from './structured-workspace';

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
    const fProject = createGoldenFGHIProject(catalog);
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
    const project = createGoldenFGHIProject(catalog);
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
    const project = createGoldenFGHIProject(catalog);
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
    const project = createGoldenFGHIProject(catalog);
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
    const requirement = authoredWorkspaceLeafRequirements(catalog, nBiome, plan).find(
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
      assertAuthoredWorkspaceLeafProjectionClosure(
        [requirement],
        projected.focusByOwner,
        n.nodes.filter((node) => node.kind !== 'occurrenceWorkbench'),
      ),
    ).toThrow(/required authored leaf has no workspace marker/);

    const withoutRewardInteraction = {
      ...projected.interactions,
      rewards: new Map(projected.interactions.rewards),
    };
    withoutRewardInteraction.rewards.delete(semanticAddressKey(address));
    expect(() =>
      assertAuthoredWorkspaceLeafInteractionClosure([requirement], withoutRewardInteraction),
    ).toThrow(/authored reward leaf .* has no exact workspace interaction/);
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
    const dormant = authoredWorkspaceLeafRequirements(catalog, nBiome, plan);
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
    const activated = authoredWorkspaceLeafRequirements(catalog, nBiome, visited).find(
      (requirement) => semanticAddressKey(requirement.address) === semanticAddressKey(sideReward),
    );
    expect(activated?.interactions.map((interaction) => interaction.kind)).toEqual(['reward']);
    const activatedChild = authoredWorkspaceLeafRequirements(catalog, nBiome, visited).find(
      (requirement) => semanticAddressKey(requirement.address) === semanticAddressKey(sideChild),
    );
    expect(activatedChild?.interactions.map((interaction) => interaction.kind)).toEqual([
      'sideRoomGeneration',
      'sideRoomEntryOrder',
    ]);
  });
});

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createExitDecisionAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  createLocalChildAddress,
  createLocalRewardAddress,
  createOccurrenceId,
  createOccurrenceAddress,
  createTargetAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { simulateProject, type SemanticFinding } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
} from '@run-planner/test-fixtures';
import {
  createRepresentativeNProject,
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceId,
} from '@run-planner/test-fixtures';
import { createWorkspaceProjectSourceIndex } from './source-index';

function biomeSource(
  index: ReturnType<typeof createWorkspaceProjectSourceIndex>,
  routeKey: string,
  biomeKey: string,
) {
  const source = index.routes
    .find((route) => route.routeKey === routeKey)
    ?.biomes.find((biome) => biome.plan.biomeKey === biomeKey);
  if (source === undefined) throw new Error(`${routeKey}/${biomeKey} source is missing`);
  return source;
}

function reversedFDecisionSerialization() {
  const project = createGoldenFGHIProject();
  return {
    ...project,
    routes: project.routes.map((route) =>
      route.routeKey !== 'Underworld'
        ? route
        : {
            ...route,
            biomes: route.biomes.map((plan) =>
              plan.biomeKey !== 'F' || plan.topology === null
                ? plan
                : {
                    ...plan,
                    topology: {
                      ...plan.topology,
                      decisions: Object.freeze([...plan.topology.decisions].reverse()),
                    },
                  },
            ),
          },
    ),
  };
}

function clampedHubTargetLifecycleEvaluation(
  project: ReturnType<typeof createRepresentativeNProject>,
) {
  const evaluation = simulateProject(catalog, project);
  const route = evaluation.routes.find((candidate) => candidate.routeKey === 'Surface');
  const biome = route?.biomes.find((candidate) => candidate.biomeKey === 'N');
  if (
    route === undefined ||
    biome === undefined ||
    biome.authoring !== 'incomplete' ||
    biome.coverage.kind !== 'prefix' ||
    !('materializedPrefix' in biome)
  ) {
    throw new Error('source-index Hub fixture did not produce an incomplete N prefix');
  }
  const hub = biome.materializedPrefix.decisions.find((decision) => decision.kind === 'hub');
  const target = hub?.board.targets.find((candidate) => candidate.hubSlotKey === 'combat05');
  if (hub?.kind !== 'hub' || target === undefined) {
    throw new Error('source-index Hub fixture lost the first target');
  }
  const visit = createHubVisitAddress(nBiome, 'hub', 1);
  const targetReward = createIncomingRewardAddress(nBiome, nOccurrenceId('combat05'));
  const finding = Object.freeze({
    code: 'rewardAcquisitionUnavailable' as const,
    evidence: Object.freeze({}),
    origin: targetReward,
    phase: 'rewardGeneration' as const,
    severity: 'error' as const,
  }) satisfies SemanticFinding;
  const clampedHub = Object.freeze({ ...hub, visits: Object.freeze([]) });
  const materializedPrefix = Object.freeze({
    ...biome.materializedPrefix,
    decisions: Object.freeze(
      biome.materializedPrefix.decisions.map((decision) =>
        decision === hub ? clampedHub : decision,
      ),
    ),
    frontier: Object.freeze({
      enteredLocalRooms: Object.freeze([]),
      kind: 'hubVisit' as const,
      localSlots: Object.freeze([]),
      origin: visit,
      parentRestores: Object.freeze([]),
      phase: 'targetLifecycle' as const,
      target,
    }),
  });
  const clampedBiome = Object.freeze({
    ...biome,
    coverage: Object.freeze({
      kind: 'prefix' as const,
      through: Object.freeze({ checkpoint: 'beforeTargetGeneration' as const, owner: visit }),
    }),
    findings: Object.freeze([...biome.findings, finding]),
    materializedPrefix,
  });
  return Object.freeze({
    ...evaluation,
    findings: Object.freeze([...evaluation.findings, finding]),
    routes: Object.freeze(
      evaluation.routes.map((candidate) =>
        candidate !== route
          ? candidate
          : Object.freeze({
              ...candidate,
              biomes: Object.freeze(
                candidate.biomes.map((candidateBiome) =>
                  candidateBiome !== biome ? candidateBiome : clampedBiome,
                ),
              ),
            }),
      ),
    ),
  });
}

describe('structured workspace source index', () => {
  it('keeps authored source lookup and decision order independent of serialization order', () => {
    const project = createGoldenFGHIProject();
    const indexed = createWorkspaceProjectSourceIndex(
      catalog,
      project,
      simulateProject(catalog, project),
    );
    const reversed = reversedFDecisionSerialization();
    const reversedIndexed = createWorkspaceProjectSourceIndex(
      catalog,
      reversed,
      simulateProject(catalog, reversed),
    );
    const f = biomeSource(indexed, 'Underworld', 'F');
    const reversedF = biomeSource(reversedIndexed, 'Underworld', 'F');
    const startOwner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFStartId,
    });

    expect(f.occurrence(goldenFStartId)?.gameName).toBe('F_Opening01');
    expect(f.exitDecision(startOwner.source)).toBeDefined();
    expect(
      f.exitDecisions.map((decision) =>
        semanticAddressKey(createExitDecisionAddress(f.biome, decision.source)),
      ),
    ).toEqual(
      reversedF.exitDecisions.map((decision) =>
        semanticAddressKey(createExitDecisionAddress(reversedF.biome, decision.source)),
      ),
    );
  });

  it('orders the selected authored subtree before retained peers independently of serialization order', () => {
    const base = createGoldenFGHIProject();
    const forkSource = goldenFOccurrenceId(1, 1);
    const selectedChildSource = goldenFOccurrenceId(2, 2);
    const movedDecisionSource = goldenFOccurrenceId(3, 1);
    const withSelectedSpine = (reverse: boolean): typeof base =>
      ({
        ...base,
        routes: base.routes.map((route) =>
          route.routeKey !== 'Underworld'
            ? route
            : {
                ...route,
                biomes: route.biomes.map((plan) =>
                  plan.biomeKey !== 'F' || plan.topology === null
                    ? plan
                    : {
                        ...plan,
                        topology: {
                          ...plan.topology,
                          decisions: (reverse
                            ? [...plan.topology.decisions].reverse()
                            : plan.topology.decisions
                          ).map((decision) => {
                            if (decision.kind !== 'exit') return decision;
                            const normal =
                              decision.normal.kind !== 'batch' || !reverse
                                ? decision.normal
                                : {
                                    ...decision.normal,
                                    targets: [...decision.normal.targets].reverse(),
                                  };
                            if (
                              decision.source.kind === 'occurrence' &&
                              decision.source.occurrenceId === forkSource
                            ) {
                              return {
                                ...decision,
                                normal,
                                selection: { kind: 'normal' as const, exitKey: 'exit2' },
                              };
                            }
                            if (
                              decision.source.kind === 'occurrence' &&
                              decision.source.occurrenceId === movedDecisionSource
                            ) {
                              return {
                                ...decision,
                                normal,
                                source: {
                                  kind: 'occurrence' as const,
                                  occurrenceId: selectedChildSource,
                                },
                              };
                            }
                            return normal === decision.normal ? decision : { ...decision, normal };
                          }),
                        },
                      },
                ),
              },
        ),
      }) as typeof base;
    const orderedSources = (project: typeof base) =>
      biomeSource(
        createWorkspaceProjectSourceIndex(catalog, project, simulateProject(catalog, project)),
        'Underworld',
        'F',
      ).exitDecisions.map((decision) =>
        decision.source.kind === 'occurrence' ? decision.source.occurrenceId : decision.source.kind,
      );
    const ordered = orderedSources(withSelectedSpine(false));

    expect(ordered).toEqual([
      goldenFStartId,
      forkSource,
      selectedChildSource,
      goldenFOccurrenceId(4, 1),
      goldenFOccurrenceId(5, 1),
      goldenFOccurrenceId(6, 1),
      goldenFOccurrenceId(7, 1),
      goldenFOccurrenceId(8, 1),
      goldenFOccurrenceId(9, 1),
      goldenFOccurrenceId(10, 1),
      goldenFOccurrenceId(2, 1),
    ]);
    expect(orderedSources(withSelectedSpine(true))).toEqual(ordered);
  });

  it('retains downstream authored decisions when an unresolved prefix has no evaluated overlay', () => {
    const base = createGoldenFGHIProject();
    const incomplete = {
      ...base,
      routes: base.routes.map((route) =>
        route.routeKey !== 'Underworld'
          ? route
          : {
              ...route,
              biomes: route.biomes.map((plan) =>
                plan.biomeKey !== 'F' || plan.topology === null
                  ? plan
                  : {
                      ...plan,
                      topology: {
                        ...plan.topology,
                        decisions: plan.topology.decisions.map((decision) =>
                          decision.kind === 'exit' &&
                          decision.source.kind === 'occurrence' &&
                          decision.source.occurrenceId === goldenFStartId
                            ? { ...decision, selection: { kind: 'unresolved' as const } }
                            : decision,
                        ),
                      },
                    },
              ),
            },
      ),
    };
    const source = biomeSource(
      createWorkspaceProjectSourceIndex(catalog, incomplete, simulateProject(catalog, incomplete)),
      'Underworld',
      'F',
    );
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(1, 1),
    });

    expect(source.exitDecision(owner.source)).toBeDefined();
    expect(source.evaluatedBatch(owner)).toBeUndefined();
    expect(source.isAssessed(owner)).toBe(false);
    expect(
      source.isAssessed(
        createExitDecisionAddress(goldenFBiome, {
          kind: 'occurrence',
          occurrenceId: goldenFOccurrenceId(2, 1),
        }),
      ),
    ).toBe(false);
  });

  it('maps explicit ordinary prefix targets and their room-owned leaves without scanning the snapshot', () => {
    const complete = createGoldenFGHIProject();
    const project = {
      ...complete,
      routes: complete.routes.map((route) =>
        route.routeKey !== 'Underworld'
          ? route
          : {
              ...route,
              biomes: route.biomes.map((plan) =>
                plan.biomeKey !== 'F' || plan.topology === null
                  ? plan
                  : {
                      ...plan,
                      topology: {
                        ...plan.topology,
                        decisions: plan.topology.decisions.filter(
                          (decision) =>
                            decision.kind !== 'exit' ||
                            decision.source.kind !== 'occurrence' ||
                            decision.source.occurrenceId !== goldenFOccurrenceId(1, 1),
                        ),
                      },
                    },
              ),
            },
      ),
    };
    const decision = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFStartId,
    });
    const target = createTargetAddress(goldenFBiome, decision.source, 'exit1');
    const source = biomeSource(
      createWorkspaceProjectSourceIndex(catalog, project, simulateProject(catalog, project)),
      'Underworld',
      'F',
    );
    const targetOccurrence = createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
    const targetReward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1));

    expect(source.evaluation).toMatchObject({
      authoring: 'incomplete',
      coverage: {
        kind: 'prefix',
        through: {
          checkpoint: 'beforeTargetGeneration',
          owner: createExitDecisionAddress(goldenFBiome, {
            kind: 'occurrence',
            occurrenceId: goldenFOccurrenceId(1, 1),
          }),
        },
      },
    });
    expect(source.isAssessed(decision)).toBe(true);
    expect(source.isAssessed(target)).toBe(true);
    expect(source.isAssessed(targetOccurrence)).toBe(true);
    expect(source.isAssessed(targetReward)).toBe(true);
  });

  it('maps Hub board, visit, and local owners without treating dormant authored details as local coverage', () => {
    const project = createRepresentativeNOPQProject();
    const source = biomeSource(
      createWorkspaceProjectSourceIndex(catalog, project, simulateProject(catalog, project)),
      'Surface',
      'N',
    );
    const visited = nOccurrenceId('combat05');
    const dormant = nOccurrenceId('combat10');

    expect(source.isAssessed(createHubSlotAddress(nBiome, 'hub', 'combat05'))).toBe(true);
    expect(source.isAssessed(createHubVisitAddress(nBiome, 'hub', 1))).toBe(true);
    expect(source.isAssessed(createOccurrenceAddress(nBiome, visited))).toBe(true);
    expect(
      source.isAssessed(createLocalChildAddress(nBiome, visited, 'sideRooms', 'sideDoor1')),
    ).toBe(true);
    expect(
      source.isAssessed(createLocalRewardAddress(nBiome, visited, 'sideRooms', 'sideDoor1')),
    ).toBe(true);
    expect(source.isAssessed(createOccurrenceAddress(nBiome, dormant))).toBe(true);
    expect(source.isAssessed(createIncomingRewardAddress(nBiome, dormant))).toBe(true);
    expect(
      source.isAssessed(createLocalChildAddress(nBiome, dormant, 'sideRooms', 'sideDoor1')),
    ).toBe(false);
  });

  it('uses the clamped Hub lifecycle frontier rather than nested canonical target shape', () => {
    const targetOccurrenceId = nOccurrenceId('combat05');
    const visit = createHubVisitAddress(nBiome, 'hub', 1);
    const target = createHubSlotAddress(nBiome, 'hub', 'combat05');
    const targetOccurrence = createOccurrenceAddress(nBiome, targetOccurrenceId);
    const targetReward = createIncomingRewardAddress(nBiome, targetOccurrenceId);
    const project = createRepresentativeNProject({ includePreboss: false });
    const source = biomeSource(
      createWorkspaceProjectSourceIndex(
        catalog,
        project,
        clampedHubTargetLifecycleEvaluation(project),
      ),
      'Surface',
      'N',
    );

    expect(source.evaluation).toMatchObject({
      authoring: 'incomplete',
      coverage: {
        kind: 'prefix',
        through: { checkpoint: 'beforeTargetGeneration', owner: visit },
      },
    });
    expect(source.isAssessed(visit)).toBe(true);
    expect(source.isAssessed(target)).toBe(false);
    expect(source.isAssessed(targetOccurrence)).toBe(false);
    expect(source.isAssessed(targetReward)).toBe(false);
    expect(
      source.isAssessed(
        createLocalChildAddress(nBiome, targetOccurrenceId, 'sideRooms', 'sideDoor1'),
      ),
    ).toBe(false);
    expect(source.isAssessed(createOccurrenceAddress(nBiome, nOccurrenceId('combat10')))).toBe(
      true,
    );

    // Findings remain a separate feedback index. Assembly can use this exact
    // owner for a visible assessed marker without claiming evaluation reached it.
    expect(source.findingsFor(targetReward)).toHaveLength(1);
    expect(source.isAssessed(targetReward) || source.findingsFor(targetReward).length > 0).toBe(
      true,
    );
  });

  it('keeps evaluator products and findings addressed to authored owners', () => {
    const combat = nOccurrenceId('combat10');
    const project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, combat),
      value: { rewardType: 'WeaponUpgrade' },
    });
    const source = biomeSource(
      createWorkspaceProjectSourceIndex(catalog, project, simulateProject(catalog, project)),
      'Surface',
      'N',
    );
    const reward = createIncomingRewardAddress(nBiome, combat);
    const firstDecision = source.exitDecisions[0];
    if (firstDecision === undefined) throw new Error('N has no authored exit decision');
    const firstOwner = createExitDecisionAddress(source.biome, firstDecision.source);
    const missingOwner = createExitDecisionAddress(source.biome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('evaluator-only'),
    });

    expect(source.findingsFor(reward)).toHaveLength(1);
    expect(source.evaluatedLinkedExit(firstOwner)).toBeDefined();
    expect(source.evaluatedLinkedExit(missingOwner)).toBeUndefined();
    expect(source.occurrence(combat)?.gameName).toBe('N_Combat10');
  });
});

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAdditionalExitAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
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
import { simulateProject } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
} from '@run-planner/test-fixtures';
import { createRepresentativeNOPQProject, nBiome, nOccurrenceId } from '@run-planner/test-fixtures';
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

function selectedContractWithoutNormalTargets() {
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
  if (located === undefined) throw new Error('source-index selected contract is missing');
  const biome = createBiomeAddress(located.route.routeKey, located.plan.biomeKey);
  const source = { kind: 'occurrence' as const, occurrenceId: located.occurrence.occurrenceId };
  const owner = createExitDecisionAddress(biome, source);
  const additional = createAdditionalExitAddress(biome, source.occurrenceId, 'zagreusContract');
  let project = applyProjectCommand(base, catalog, { kind: 'RemoveExitDecision', decision: owner });
  project = applyProjectCommand(project, catalog, {
    kind: 'AddZagreusContract',
    additional,
    occurrenceId: createOccurrenceId('source-index-additional-only-contract'),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(biome, source),
    value: { kind: 'additional', additionalExitKey: 'zagreusContract' },
  });
  return { additional, biome, owner, project };
}

describe('structured workspace source index', () => {
  it('indexes an evaluated selected continuation without manufacturing a partial normal batch, and rejects an orphan continuation owner', () => {
    const fixture = selectedContractWithoutNormalTargets();
    const evaluation = simulateProject(catalog, fixture.project);
    const evaluatedBiome = evaluation.routes
      .find((route) => route.routeKey === fixture.biome.routeKey)
      ?.biomes.find((biome) => biome.biomeKey === fixture.biome.biomeKey);
    if (
      evaluatedBiome?.authoring !== 'incomplete' ||
      evaluatedBiome.coverage.kind !== 'prefix' ||
      !('materializedPrefix' in evaluatedBiome) ||
      evaluatedBiome.assessmentPrefix !== undefined ||
      evaluatedBiome.materializedPrefix.frontier?.kind !== 'exitDecision'
    ) {
      throw new Error('source-index additional-only fixture did not produce an ordinary prefix');
    }
    expect(evaluatedBiome.materializedPrefix.frontier.partialBatch).toBeUndefined();
    expect(evaluatedBiome.materializedPrefix.frontier.additional).toHaveLength(1);

    const source = biomeSource(
      createWorkspaceProjectSourceIndex(catalog, fixture.project, evaluation),
      fixture.biome.routeKey,
      fixture.biome.biomeKey,
    );
    expect(source.evaluatedBatch(fixture.owner)).toBeUndefined();
    expect(source.evaluatedAdditional(fixture.owner)).toEqual([
      expect.objectContaining({
        origin: fixture.additional,
        room: expect.objectContaining({ entered: true }),
      }),
    ]);

    const orphan = createExitDecisionAddress(fixture.biome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('evaluator-only-additional-owner'),
    });
    const malformedPrefix = Object.freeze({
      ...evaluatedBiome.materializedPrefix,
      frontier: Object.freeze({ ...evaluatedBiome.materializedPrefix.frontier, origin: orphan }),
    });
    const malformedBiome = Object.freeze({
      ...evaluatedBiome,
      coverage: Object.freeze({
        ...evaluatedBiome.coverage,
        through: Object.freeze({ ...evaluatedBiome.coverage.through, owner: orphan }),
      }),
      materializedPrefix: malformedPrefix,
    });
    const malformedEvaluation = Object.freeze({
      ...evaluation,
      routes: Object.freeze(
        evaluation.routes.map((route) =>
          route.routeKey !== fixture.biome.routeKey
            ? route
            : Object.freeze({
                ...route,
                biomes: Object.freeze(
                  route.biomes.map((biome) =>
                    biome.biomeKey === fixture.biome.biomeKey ? malformedBiome : biome,
                  ),
                ),
              }),
        ),
      ),
    });
    expect(() =>
      createWorkspaceProjectSourceIndex(catalog, fixture.project, malformedEvaluation),
    ).toThrow(/evaluated additional continuations without an authored batch decision/);
  });

  it('keeps complete authored suffixes while limiting evaluator overlays to the assessed prefix', () => {
    const base = createGoldenFGHIProject();
    const validF = simulateProject(catalog, base)
      .routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F');
    if (validF?.authoring !== 'complete' || validF.validity !== 'valid') {
      throw new Error('source-index F fixture did not complete-valid');
    }
    const selected = validF.rewards.selectedTraitOffers.find(
      (trace) => trace.offer.giverKey !== 'WeaponUpgrade',
    );
    const [first, second, third] = selected?.offer.options ?? [];
    if (
      selected === undefined ||
      first === undefined ||
      second === undefined ||
      third === undefined
    ) {
      throw new Error('source-index F fixture has no complete boon offer');
    }
    const project = applyProjectCommand(base, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: selected.address,
      value: {
        giverKey: selected.offer.giverKey,
        options: [{ ...first, rarity: 'Heroic' }, second, third],
        selectedOptionKey: 'option1',
      },
    });
    const evaluation = simulateProject(catalog, project);
    const invalidF = evaluation.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F');
    if (
      invalidF?.authoring !== 'complete' ||
      invalidF.validity !== 'invalid' ||
      invalidF.coverage.kind !== 'prefix'
    ) {
      throw new Error('source-index F fixture did not complete-block');
    }
    const source = biomeSource(
      createWorkspaceProjectSourceIndex(catalog, project, evaluation),
      'Underworld',
      'F',
    );
    const later = source.exitDecisions
      .map((decision) => createExitDecisionAddress(goldenFBiome, decision.source))
      .find((owner) => !source.isAssessed(owner));
    if (later === undefined) throw new Error('source-index F fixture has no retained suffix');
    if (invalidF.coverage.blockedAt === undefined) {
      throw new Error('source-index F fixture has no blocking owner');
    }

    expect(source.completeness.completion).toBe('complete');
    expect(source.exitDecisions).toHaveLength(
      project.routes
        .find((route) => route.routeKey === 'Underworld')!
        .biomes.find((biome) => biome.biomeKey === 'F')!
        .topology!.decisions.filter((decision) => decision.kind === 'exit').length,
    );
    expect(source.evaluatedBatch(later)).toBeUndefined();
    expect(source.isAssessed(invalidF.coverage.blockedAt)).toBe(false);
    expect(source.findingsFor(invalidF.coverage.blockedAt)).not.toHaveLength(0);

    if (!('materializedPrefix' in invalidF)) {
      throw new Error('source-index F fixture has no retained materialization');
    }
    const malformedF = Object.freeze({
      ...invalidF,
      assessmentPrefix: invalidF.materializedPrefix,
    });
    const malformedEvaluation = Object.freeze({
      ...evaluation,
      routes: Object.freeze(
        evaluation.routes.map((route) =>
          route.routeKey !== 'Underworld'
            ? route
            : Object.freeze({
                ...route,
                biomes: Object.freeze(
                  route.biomes.map((biome) => (biome.biomeKey === 'F' ? malformedF : biome)),
                ),
              }),
        ),
      ),
    });
    expect(() => createWorkspaceProjectSourceIndex(catalog, project, malformedEvaluation)).toThrow(
      /assessment prefix extends beyond declared coverage/,
    );
  });

  it('returns exact available and unavailable Run State products, and rejects an available owner without its snapshot', () => {
    const project = createGoldenFGHIProject();
    const evaluation = simulateProject(catalog, project);
    const indexed = createWorkspaceProjectSourceIndex(catalog, project, evaluation);
    const source = biomeSource(indexed, 'Underworld', 'F');
    const owner = createExitDecisionAddress(goldenFBiome, source.exitDecisions[0]!.source);
    const published = source.runState(owner);

    expect(published).toMatchObject({ availability: 'available', snapshot: { owner } });

    const fEvaluation = evaluation.routes
      .find((route) => route.routeKey === 'Underworld')!
      .biomes.find((biome) => biome.biomeKey === 'F')!;
    const unavailableEvaluation = Object.freeze({
      ...evaluation,
      routes: Object.freeze(
        evaluation.routes.map((route) =>
          route.routeKey !== 'Underworld'
            ? route
            : Object.freeze({
                ...route,
                biomes: Object.freeze(
                  route.biomes.map((biome) =>
                    biome !== fEvaluation || !('rewards' in biome)
                      ? biome
                      : Object.freeze({
                          ...biome,
                          rewards: Object.freeze({
                            ...biome.rewards,
                            runStateAvailability: Object.freeze([
                              {
                                availability: 'unavailable' as const,
                                owner,
                                reason: 'coverageNotReached' as const,
                              },
                            ]),
                            runStateSnapshots: Object.freeze([]),
                          }),
                        }),
                  ),
                ),
              }),
        ),
      ),
    });
    const unavailable = biomeSource(
      createWorkspaceProjectSourceIndex(catalog, project, unavailableEvaluation),
      'Underworld',
      'F',
    ).runState(owner);
    expect(unavailable).toEqual({ availability: 'unavailable', reason: 'coverageNotReached' });

    const malformedEvaluation = Object.freeze({
      ...unavailableEvaluation,
      routes: Object.freeze(
        unavailableEvaluation.routes.map((route) =>
          route.routeKey !== 'Underworld'
            ? route
            : Object.freeze({
                ...route,
                biomes: Object.freeze(
                  route.biomes.map((biome) =>
                    biome.biomeKey !== 'F' || !('rewards' in biome)
                      ? biome
                      : Object.freeze({
                          ...biome,
                          rewards: Object.freeze({
                            ...biome.rewards,
                            runStateAvailability: Object.freeze([
                              { availability: 'available' as const, owner },
                            ]),
                          }),
                        }),
                  ),
                ),
              }),
        ),
      ),
    });
    expect(() =>
      biomeSource(
        createWorkspaceProjectSourceIndex(catalog, project, malformedEvaluation),
        'Underworld',
        'F',
      ).runState(owner),
    ).toThrow(/publishes available Run State without a snapshot/);
  });

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
    expect(source.evaluatedBatch(firstOwner)).toBeDefined();
    expect(source.evaluatedBatch(missingOwner)).toBeUndefined();
    expect(source.occurrence(combat)?.gameName).toBe('N_Combat10');
  });
});

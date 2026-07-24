import type {
  LinearBiomePlan,
  LinearContinuation,
  ProjectDocument,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';

import {
  createGoldenFGHIProject,
  targetOccurrenceId,
} from '../../../../apps/planner/test/fixtures/underworldProject';
import { createRepresentativeNOPQProject } from '../../../../apps/planner/test/fixtures/surfaceProject';

function incompleteAtGeneratedBatch(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  batchIndex: number,
): ProjectDocument {
  return Object.freeze({
    ...project,
    routes: Object.freeze(
      project.routes.map((route) =>
        route.routeKey !== routeKey
          ? route
          : Object.freeze({
              ...route,
              biomes: Object.freeze(
                route.biomes.map((plan) => {
                  if (plan.biomeKey !== biomeKey || plan.kind !== 'LinearBiome') {
                    return plan;
                  }
                  const topology = plan.topology;
                  if (topology === null) {
                    throw new Error(`${biomeKey} has no topology`);
                  }
                  const selected = topology.continuations[batchIndex];
                  if (selected?.kind !== 'batch') {
                    throw new Error(`${biomeKey} continuation ${batchIndex} is not a batch`);
                  }
                  const continuation: LinearContinuation = Object.freeze({
                    ...selected,
                    pickedExitIndex: null,
                  });
                  const continuations = Object.freeze([
                    ...topology.continuations.slice(0, batchIndex),
                    continuation,
                  ]);
                  const retainedOccurrenceIds = new Set([
                    ...(topology.startOccurrenceId === null ? [] : [topology.startOccurrenceId]),
                    ...continuations.flatMap((candidate) =>
                      candidate.targets.map((target) => target.occurrenceId),
                    ),
                  ]);
                  return Object.freeze({
                    ...plan,
                    topology: Object.freeze({
                      ...topology,
                      occurrences: Object.freeze(
                        topology.occurrences.filter((occurrence) =>
                          retainedOccurrenceIds.has(occurrence.occurrenceId),
                        ),
                      ),
                      continuations,
                    }),
                  }) satisfies LinearBiomePlan;
                }),
              ),
            }),
      ),
    ),
  });
}

function expectGeneratedPrefix(project: ProjectDocument, routeKey: string, biomeKey: string) {
  const result = simulateProject(catalog, project);
  const route = result.routes.find((candidate) => candidate.routeKey === routeKey)!;
  const evaluation = route.biomes.find((candidate) => candidate.biomeKey === biomeKey)!;
  expect(route.processing.active).toEqual({ kind: 'incomplete', biomeKey });
  expect(evaluation.authoring).toBe('incomplete');
  if (evaluation.kind !== 'LinearBiome' || evaluation.authoring !== 'incomplete') {
    throw new Error(`${biomeKey} did not produce an incomplete Linear evaluation`);
  }
  expect(evaluation.coverage.kind).toBe('prefix');
  if (evaluation.coverage.kind !== 'prefix' || !('materializedPrefix' in evaluation)) {
    throw new Error(`${biomeKey} did not produce Linear prefix coverage`);
  }
  expect(evaluation.coverage.through.checkpoint).toBe('afterTargetGeneration');
  expect(evaluation.history.events.some((event) => event.kind === 'biomeCompleted')).toBe(false);
  const frontierGeneration = evaluation.materializedPrefix.frontierGeneration;
  expect(frontierGeneration?.targets.length).toBeGreaterThan(0);
  if (frontierGeneration === undefined) {
    throw new Error(`${biomeKey} lost its generated frontier`);
  }
  expect(evaluation.history.rooms.at(-1)?.targetGenerations).toHaveLength(
    frontierGeneration.targets.length,
  );
  expect(evaluation.roomGeneration.forcePressure).toHaveLength(
    evaluation.materializedPrefix.batches.flatMap((batch) => batch.targets).length +
      frontierGeneration.targets.length,
  );
  return evaluation;
}

function mapLinearPlan(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  map: (plan: LinearBiomePlan) => LinearBiomePlan,
): ProjectDocument {
  return Object.freeze({
    ...project,
    routes: Object.freeze(
      project.routes.map((route) =>
        route.routeKey !== routeKey
          ? route
          : Object.freeze({
              ...route,
              biomes: Object.freeze(
                route.biomes.map((plan) =>
                  plan.kind === 'LinearBiome' && plan.biomeKey === biomeKey ? map(plan) : plan,
                ),
              ),
            }),
      ),
    ),
  });
}

describe('Linear progressive biome evaluation', () => {
  const underworld = createGoldenFGHIProject(catalog);
  const surface = createRepresentativeNOPQProject();

  it.each([
    ['F', 1],
    ['G', 1],
    ['H', 1],
    ['I', 1],
  ] as const)('covers an authored Underworld %s batch before its pick', (biomeKey, batchIndex) => {
    const evaluation = expectGeneratedPrefix(
      incompleteAtGeneratedBatch(underworld, 'Underworld', biomeKey, batchIndex),
      'Underworld',
      biomeKey,
    );
    if (biomeKey === 'H') {
      expect(evaluation.materializedPrefix.frontierGeneration?.batchState?.kind).toBe('fields');
      expect(evaluation.roomGeneration.fieldsCageOutcomes.length).toBeGreaterThan(0);
    }
    if (biomeKey === 'I') {
      expect(
        evaluation.materializedPrefix.frontierGeneration?.targets.map(
          (target) => target.room.clockworkReward,
        ),
      ).toContain('goal');
    }
  });

  it('stops before a jointly generated batch whose required target set is incomplete', () => {
    const partial = incompleteAtGeneratedBatch(underworld, 'Underworld', 'G', 1);
    const missingExit = mapLinearPlan(partial, 'Underworld', 'G', (plan) => {
      if (plan.topology === null) {
        throw new Error('G has no topology');
      }
      const continuation = plan.topology.continuations[1];
      if (continuation?.kind !== 'batch') {
        throw new Error('G second continuation is not a batch');
      }
      const retainedTargets = continuation.targets.filter((target) => target.exitIndex !== 2);
      const retainedIds = new Set([
        plan.topology.startOccurrenceId,
        ...plan.topology.continuations[0]!.targets.map((target) => target.occurrenceId),
        ...retainedTargets.map((target) => target.occurrenceId),
      ]);
      return Object.freeze({
        ...plan,
        topology: Object.freeze({
          ...plan.topology,
          occurrences: Object.freeze(
            plan.topology.occurrences.filter((occurrence) =>
              retainedIds.has(occurrence.occurrenceId),
            ),
          ),
          continuations: Object.freeze([
            plan.topology.continuations[0]!,
            Object.freeze({ ...continuation, targets: Object.freeze(retainedTargets) }),
          ]),
        }),
      });
    });
    const result = simulateProject(catalog, missingExit);
    const evaluation = result.routes
      .find((route) => route.routeKey === 'Underworld')!
      .biomes.find((candidate) => candidate.biomeKey === 'G')!;
    if (
      evaluation.kind !== 'LinearBiome' ||
      evaluation.authoring !== 'incomplete' ||
      !('materializedPrefix' in evaluation)
    ) {
      throw new Error('G did not produce a materialized incomplete prefix');
    }

    expect(evaluation.frontier).toMatchObject({ kind: 'target', exitIndex: 2 });
    expect(evaluation.coverage).toMatchObject({
      kind: 'prefix',
      through: { checkpoint: 'beforeTargetGeneration' },
    });
    expect(evaluation.materializedPrefix.frontierGeneration).toBeUndefined();
    expect(evaluation.history.rooms.at(-1)?.targetGenerations).toEqual([]);
  });

  it.each([
    ['O', 1],
    ['P', 1],
    ['Q', 1],
  ] as const)('covers an authored Surface %s batch before its pick', (biomeKey, batchIndex) => {
    const evaluation = expectGeneratedPrefix(
      incompleteAtGeneratedBatch(surface, 'Surface', biomeKey, batchIndex),
      'Surface',
      biomeKey,
    );
    if (biomeKey === 'O') {
      expect(
        evaluation.materializedPrefix.batches.some((batch) =>
          batch.targets.some((target) => (target.room.rewardWheels?.length ?? 0) > 0),
        ),
      ).toBe(true);
      expect(
        evaluation.rewards.branches.some((branch) =>
          branch.events.some((event) => event.kind === 'concreteAcquisition'),
        ),
      ).toBe(true);
    }
  });

  it('stops at the first unsupported generated room and withholds later authored batches', () => {
    const partial = incompleteAtGeneratedBatch(underworld, 'Underworld', 'F', 1);
    const impossibleFirstRoom = mapLinearPlan(partial, 'Underworld', 'F', (plan) => {
      if (plan.topology === null) {
        throw new Error('F has no topology');
      }
      return Object.freeze({
        ...plan,
        topology: Object.freeze({
          ...plan.topology,
          occurrences: Object.freeze(
            plan.topology.occurrences.map((occurrence) =>
              occurrence.occurrenceId === targetOccurrenceId('F', 1, 1)
                ? Object.freeze({ ...occurrence, gameName: 'F_Combat14' })
                : occurrence,
            ),
          ),
        }),
      });
    });
    const evaluation = expectGeneratedPrefix(impossibleFirstRoom, 'Underworld', 'F');

    expect(evaluation.coverage.blockedAt).toEqual(
      expect.objectContaining({ kind: 'target', exitIndex: 1 }),
    );
    expect(evaluation.materializedPrefix.batches).toHaveLength(0);
    expect(evaluation.materializedPrefix.frontierGeneration?.targets[0]?.room.gameName).toBe(
      'F_Combat14',
    );
    expect(evaluation.roomGeneration.findings).toContainEqual(
      expect.objectContaining({ code: 'targetRoomUnavailable' }),
    );
  });

  it('blocks at an unsupported authored entry reward before the first generated batch', () => {
    const partial = incompleteAtGeneratedBatch(underworld, 'Underworld', 'F', 1);
    const sourcePlan = partial.routes
      .find((route) => route.routeKey === 'Underworld')!
      .biomes.find((plan) => plan.biomeKey === 'F');
    if (sourcePlan?.kind !== 'LinearBiome' || sourcePlan.topology?.startOccurrenceId == null) {
      throw new Error('F has no authored start');
    }
    const startOccurrenceId = sourcePlan.topology.startOccurrenceId;
    const invalidEntry = mapLinearPlan(partial, 'Underworld', 'F', (plan) => {
      if (plan.topology === null) {
        throw new Error('F has no authored start');
      }
      return Object.freeze({
        ...plan,
        topology: Object.freeze({
          ...plan.topology,
          occurrences: Object.freeze(
            plan.topology.occurrences.map((occurrence) =>
              occurrence.occurrenceId === startOccurrenceId && occurrence.state.kind === 'counted'
                ? Object.freeze({
                    ...occurrence,
                    state: Object.freeze({
                      ...occurrence.state,
                      offer: Object.freeze({ rewardType: 'Boon' }),
                    }),
                  })
                : occurrence,
            ),
          ),
        }),
      });
    });
    const result = simulateProject(catalog, invalidEntry);
    const evaluation = result.routes[0]!.biomes[0]!;
    if (
      evaluation.kind !== 'LinearBiome' ||
      evaluation.authoring !== 'incomplete' ||
      !('materializedPrefix' in evaluation)
    ) {
      throw new Error('F did not produce a materialized incomplete prefix');
    }

    expect(evaluation.coverage).toMatchObject({
      kind: 'prefix',
      through: { checkpoint: 'beforeTargetGeneration' },
      blockedAt: { kind: 'incomingReward', occurrenceId: startOccurrenceId },
    });
    expect(evaluation.materializedPrefix.batches).toHaveLength(0);
    expect(evaluation.materializedPrefix.frontierGeneration).toBeUndefined();
    expect(evaluation.rewards.findings).toContainEqual(
      expect.objectContaining({ code: 'rewardPayloadInvalid' }),
    );
  });

  it('covers a selected shop offer but does not enter it before its required shop state exists', () => {
    const partial = incompleteAtGeneratedBatch(underworld, 'Underworld', 'G', 4);
    const shopOccurrenceId = targetOccurrenceId('G', 5, 1);
    const missingShopState = mapLinearPlan(partial, 'Underworld', 'G', (plan) => {
      if (plan.topology === null) {
        throw new Error('G has no topology');
      }
      return Object.freeze({
        ...plan,
        topology: Object.freeze({
          ...plan.topology,
          continuations: Object.freeze(
            plan.topology.continuations.map((continuation, index) =>
              index === 4 ? Object.freeze({ ...continuation, pickedExitIndex: 1 }) : continuation,
            ),
          ),
          occurrences: Object.freeze(
            plan.topology.occurrences.map((occurrence) =>
              occurrence.occurrenceId === shopOccurrenceId
                ? Object.freeze({ ...occurrence, state: Object.freeze({ kind: 'shop' as const }) })
                : occurrence,
            ),
          ),
        }),
      });
    });
    const evaluation = expectGeneratedPrefix(missingShopState, 'Underworld', 'G');

    expect(evaluation.frontier).toEqual(
      expect.objectContaining({ kind: 'occurrence', occurrenceId: shopOccurrenceId }),
    );
    expect(evaluation.materializedPrefix.frontierGeneration?.targets[0]?.room.entered).toBe(false);
    expect(
      evaluation.history.events.some(
        (event) =>
          event.kind === 'roomEntered' &&
          event.origin.kind === 'occurrence' &&
          event.origin.occurrenceId === shopOccurrenceId,
      ),
    ).toBe(false);
  });

  it('retains an unsupported entered-shop finding and blocks before later generations', () => {
    const partial = incompleteAtGeneratedBatch(underworld, 'Underworld', 'G', 6);
    const shopOccurrenceId = targetOccurrenceId('G', 5, 1);
    const invalidShop = mapLinearPlan(partial, 'Underworld', 'G', (plan) => {
      if (plan.topology === null) {
        throw new Error('G has no topology');
      }
      return Object.freeze({
        ...plan,
        topology: Object.freeze({
          ...plan.topology,
          occurrences: Object.freeze(
            plan.topology.occurrences.map((occurrence) => {
              if (
                occurrence.occurrenceId !== shopOccurrenceId ||
                occurrence.state.kind !== 'shop' ||
                occurrence.state.shop === undefined
              ) {
                return occurrence;
              }
              const firstOfferKey = Object.keys(occurrence.state.shop.offers)[0];
              if (firstOfferKey === undefined) {
                throw new Error('G shop has no offers');
              }
              const firstOffer = occurrence.state.shop.offers[firstOfferKey];
              if (firstOffer === undefined) {
                throw new Error('G shop lost its first offer');
              }
              return Object.freeze({
                ...occurrence,
                state: Object.freeze({
                  ...occurrence.state,
                  shop: Object.freeze({
                    ...occurrence.state.shop,
                    offers: Object.freeze({
                      ...occurrence.state.shop.offers,
                      [firstOfferKey]: Object.freeze({
                        purchased: firstOffer.purchased,
                        offer: Object.freeze({ rewardType: 'UnknownRewardType' }),
                      }),
                    }),
                  }),
                }),
              });
            }),
          ),
        }),
      });
    });
    const result = simulateProject(catalog, invalidShop);
    const evaluation = result.routes
      .find((route) => route.routeKey === 'Underworld')!
      .biomes.find((candidate) => candidate.biomeKey === 'G')!;
    if (
      evaluation.kind !== 'LinearBiome' ||
      evaluation.authoring !== 'incomplete' ||
      !('materializedPrefix' in evaluation)
    ) {
      throw new Error('G did not produce a materialized incomplete prefix');
    }

    expect(evaluation.coverage).toMatchObject({
      kind: 'prefix',
      through: { checkpoint: 'beforeTargetGeneration' },
      blockedAt: { kind: 'shopOffer', occurrenceId: shopOccurrenceId },
    });
    expect(evaluation.materializedPrefix.batches).toHaveLength(5);
    expect(evaluation.materializedPrefix.frontierGeneration).toBeUndefined();
    expect(evaluation.rewards.findings).toContainEqual(
      expect.objectContaining({ code: 'rewardPayloadInvalid' }),
    );
  });

  it('evaluates the fixed I entrance even before authored topology exists', () => {
    const noI = mapLinearPlan(underworld, 'Underworld', 'I', (plan) =>
      Object.freeze({ ...plan, topology: null }),
    );
    const result = simulateProject(catalog, noI);
    const evaluation = result.routes
      .find((route) => route.routeKey === 'Underworld')!
      .biomes.find((candidate) => candidate.biomeKey === 'I')!;
    if (evaluation.kind !== 'LinearBiome' || evaluation.authoring !== 'incomplete') {
      throw new Error('I did not produce an incomplete Linear evaluation');
    }
    expect(evaluation.coverage).toMatchObject({
      kind: 'prefix',
      through: { checkpoint: 'beforeTargetGeneration' },
    });
    if (!('materializedPrefix' in evaluation)) {
      throw new Error('I fixed entry was not materialized');
    }
    expect(evaluation.materializedPrefix.entryRooms.map((room) => room.gameName)).toEqual([
      'I_Intro',
    ]);
    expect(evaluation.history.rooms.at(-1)?.preOutgoing).toBeDefined();
    expect(evaluation.history.rooms.at(-1)?.outgoingGeneration).toBeUndefined();
  });

  it('strengthens the same fully authored Linear biomes to canonical complete evaluations', () => {
    const result = simulateProject(catalog, underworld);
    const route = result.routes.find((candidate) => candidate.routeKey === 'Underworld')!;
    expect(route.biomes).toHaveLength(4);
    for (const evaluation of route.biomes) {
      expect(evaluation).toMatchObject({ authoring: 'complete', coverage: { kind: 'complete' } });
      expect('materializedPrefix' in evaluation).toBe(false);
    }
  });

  it('is deterministic, deeply frozen, and leaves progressive authorship untouched', () => {
    const project = incompleteAtGeneratedBatch(underworld, 'Underworld', 'H', 1);
    const before = JSON.stringify(project);
    const first = simulateProject(catalog, project);
    const second = simulateProject(catalog, project);
    const evaluation = first.routes
      .find((route) => route.routeKey === 'Underworld')!
      .biomes.find((candidate) => candidate.biomeKey === 'H')!;
    if (
      evaluation.kind !== 'LinearBiome' ||
      evaluation.authoring !== 'incomplete' ||
      !('materializedPrefix' in evaluation)
    ) {
      throw new Error('H did not produce a materialized incomplete prefix');
    }

    expect(second).toEqual(first);
    expect(JSON.stringify(project)).toBe(before);
    expect(Object.isFrozen(evaluation)).toBe(true);
    expect(Object.isFrozen(evaluation.materializedPrefix)).toBe(true);
    expect(Object.isFrozen(evaluation.history.events)).toBe(true);
    expect(Object.isFrozen(evaluation.rewards.branches)).toBe(true);
  });
});

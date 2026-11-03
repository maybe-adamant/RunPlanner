import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createProjectDocument,
  deriveRouteLoadout,
  resolveRoutePosition,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { createRewardHistoryState } from '@run-planner/engine/reward-kernel';
import { assembleExecutionProduct } from '@run-planner/engine/execution-plan';
import {
  createArcanaFearState,
  simulateProject,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { loadUnderworldGeneratedCompositionCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  createFreshFileFProject,
  createFreshFileGeneratedComposition,
  createFreshFileRouteProject,
} from '@run-planner/test-fixtures/fresh-file';
import { createRouteStartHistoryView } from '../../src/simulation/history/fold';
import { createInitialSimulationState } from '../../src/simulation/state/construction';

function freshProject(): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: 'fresh-route-start',
    routeKey: 'FreshFile',
    configuredBiomeCount: 1,
  });
}

function routeStartState(project: ProjectDocument) {
  const { route } = project;
  return createInitialSimulationState(
    catalog,
    route.loadout,
    route.loadout.startingKeepsakeKey,
    createArcanaFearState(catalog, route.loadout),
    {
      routePosition: resolveRoutePosition(catalog, route, route.itineraryBiomeKeys[0]!),
      historyView: createRouteStartHistoryView(),
    },
  );
}

function freshFBiomeRewards() {
  const biome = simulateProject(catalog, createFreshFileFProject()).route.biomes[0]!;
  if (!('rewards' in biome) || biome.rewards === undefined) throw new Error('F was not evaluated');
  return biome.rewards;
}

describe('Fresh File opening roll', () => {
  const runProgress = catalog.rewards.stores.byKey.RunProgress!;
  const boonIndexes = runProgress.entries.flatMap((entry, index) =>
    entry.rewardType === 'Boon' ? [index] : [],
  );

  it('draws one Boon from RunProgress at the opening and spawns nothing', () => {
    const rewards = freshFBiomeRewards();
    const opening = rewards.runStateSnapshots.filter(
      (snapshot) =>
        snapshot.owner.kind === 'roomRunStateCheckpoint' &&
        snapshot.owner.occurrenceId === 'F:start',
    );
    expect(opening.length).toBeGreaterThan(0);
    for (const snapshot of opening) {
      const counts = snapshot.rewardStores.find(
        (store) => store.storeKey === 'RunProgress',
      )!.remainingEntryCounts;
      expect(boonIndexes.map((index) => counts[index])).toEqual([1, 1, 1, 0]);
      expect(
        counts.filter((_, index) => !boonIndexes.includes(index)).every((count) => count === 1),
      ).toBe(true);
    }
    const product = assembleExecutionProduct({
      assembly: simulateProjectAssembly(catalog, createFreshFileFProject()),
      catalog,
    });
    const published = product.occurrences[0]!;
    expect(published.gameName).toBe('F_Opening01');
    expect(published.overview).not.toHaveProperty('incomingReward');
    expect(published.timeline.transactions).toEqual([]);
  });

  it('counts the opening as a RunProgress room, so F_Combat01 rolls MetaProgress doors', () => {
    const support = (occurrenceId: string) =>
      freshFBiomeRewards().storeSupport.find(
        (entry) =>
          entry.origin.source.kind === 'occurrence' &&
          entry.origin.source.occurrenceId === occurrenceId,
      );
    expect(support('F:start')).toMatchObject({
      enteredStoreCount: 1,
      enteredMetaStoreCount: 0,
      supportStoreKeys: ['MetaProgress'],
    });
    // The captured first attempt left F_Combat01 into a MetaProgress F_Combat07.
    expect(support('fresh-0-0')).toMatchObject({
      enteredStoreCount: 2,
      enteredMetaStoreCount: 0,
      supportStoreKeys: ['MetaProgress'],
    });
  });
});

describe('Fresh File route start', () => {
  it('continues past the empty opening without a starting-reward finding', () => {
    const evaluation = simulateProject(catalog, freshProject());
    expect(evaluation.findings.map((finding) => finding.code)).toEqual(['batchRewardStoreMissing']);
    expect(evaluation.authoringHorizon).toMatchObject({
      kind: 'incomplete',
      blockedAfter: { kind: 'exitDecision', routeKey: 'FreshFile', biomeKey: 'F' },
    });
  });

  it('starts with the aspectless Staff, no keepsake, no Arcana and a closed save history', () => {
    const project = freshProject();
    const state = routeStartState(project);
    expect(state.equipment).toEqual({
      weaponKey: 'WeaponStaffSwing',
      aspectKey: null,
      familiarKey: null,
    });
    expect(state.keepsakes.currentKey).toBeNull();
    expect(state.keepsakes.history).toEqual([]);
    expect(state.arcanaFear.arcana.active).toEqual([]);
    expect(state.rewardHistory).toEqual(createRewardHistoryState(catalog.rewards, 'closed'));
    expect(deriveRouteLoadout(catalog, project.route.loadout)).toMatchObject({
      activeArcanaKeys: [],
      automaticArcanaKeys: [],
      fearTotal: 0,
    });
  });

  it('keeps the mature route start on its authored equipment and mature save history', () => {
    const mature = createProjectDocument(catalog, { projectId: 'mature', routeKey: 'Underworld' });
    const state = routeStartState(mature);
    expect(state.equipment).toEqual({
      weaponKey: mature.route.loadout.weaponKey,
      aspectKey: mature.route.loadout.aspectKey,
      familiarKey: mature.route.loadout.familiarKey,
    });
    expect(state.keepsakes.currentKey).toBe(mature.route.loadout.startingKeepsakeKey);
    expect(state.rewardHistory).toEqual(createRewardHistoryState(catalog.rewards, 'mature'));
  });

  it('assesses a composition carried from a mature save like any authored one', () => {
    const retained =
      loadUnderworldGeneratedCompositionCheckpoint().route.biomes[0]!.topology!.occurrences.find(
        (occurrence) => occurrence.occurrenceId === 'golden-f-b3-e1',
      )!.encounters.customizationByPhase;
    const project = createFreshFileGeneratedComposition();
    expect(
      project.route.biomes[0]!.topology!.occurrences.find(
        (occurrence) => occurrence.occurrenceId === 'golden-f-b3-e1',
      )?.encounters.customizationByPhase,
    ).toEqual(retained);
    const codes = simulateProject(catalog, project).findings.map((finding) => finding.code);
    for (const code of [
      'encounterCustomizationUnavailable',
      'encounterIntroductionRequired',
    ] as const)
      expect(codes).not.toContain(code);
  });

  it('publishes the aspectless Staff start with no installable familiar, ranks or keepsake', () => {
    const product = assembleExecutionProduct({
      assembly: simulateProjectAssembly(catalog, createFreshFileRouteProject()),
      catalog,
    });
    expect(product.startingLoadout).toMatchObject({ weaponKey: 'WeaponStaffSwing', arcana: [] });
    expect(product.startingLoadout).not.toHaveProperty('aspectKey');
    expect(product.startingLoadout).not.toHaveProperty('aspectRarity');
    expect(product.startingLoadout).not.toHaveProperty('familiar');
    expect(product.startingKeepsake).toEqual({});
    expect(product.occurrences[0]!.diagnostics?.roomEntered?.keepsakes).not.toHaveProperty(
      'currentKey',
    );
  });
});

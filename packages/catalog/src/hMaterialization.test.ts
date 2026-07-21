import {
  applyProjectCommand,
  createBiomeAddress,
  createContinuationAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPickedAddress,
  createProjectDocument,
  createTargetAddress,
  encodeProjectDocument,
  evaluateLinearCompleteness,
  materializeLinearBiome,
  projectLinearBatchState,
  semanticAddressKey,
  type CompleteLinearCompletenessResult,
  type LinearBiomePlan,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/core';
import { describe, expect, it } from 'vitest';

import { catalog } from './index';

const biome = createBiomeAddress('Underworld', 'H');

function plan(project: ProjectDocument): LinearBiomePlan {
  const result = project.routes
    .find((route) => route.routeKey === 'Underworld')
    ?.biomes.find((candidate) => candidate.biomeKey === 'H');
  if (result?.kind !== 'LinearBiome') {
    throw new Error('fixture has no H plan');
  }
  return result;
}

function appendBatch(
  project: ProjectDocument,
  parentOccurrenceId: OccurrenceId,
  targets: readonly {
    readonly occurrenceId: OccurrenceId;
    readonly gameName: string;
  }[],
  pickedExitIndex: number,
  cageOutcome: 'min' | 'max',
): ProjectDocument {
  let next = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    continuation: createContinuationAddress(biome, parentOccurrenceId),
  });
  if (cageOutcome === 'max') {
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceFieldsCageOutcome',
      continuation: createContinuationAddress(biome, parentOccurrenceId),
      cageOutcome,
    });
  }
  for (const [index, target] of targets.entries()) {
    next = applyProjectCommand(next, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, parentOccurrenceId, index + 1),
      occurrenceId: target.occurrenceId,
      gameName: target.gameName,
    });
  }
  return applyProjectCommand(next, catalog, {
    kind: 'SetPicked',
    picked: createPickedAddress(biome, parentOccurrenceId),
    exitIndex: pickedExitIndex,
  });
}

function completeProject(
  outcomes: readonly ['min' | 'max', 'min' | 'max', 'min' | 'max', 'min' | 'max'] = [
    'min',
    'max',
    'max',
    'min',
  ],
): ProjectDocument {
  const start = createOccurrenceId('h-materialized-start');
  const combat02 = createOccurrenceId('h-materialized-combat02');
  const combat09 = createOccurrenceId('h-materialized-combat09');
  const combat03 = createOccurrenceId('h-materialized-combat03');
  const combat04 = createOccurrenceId('h-materialized-combat04');
  const bridge = createOccurrenceId('h-materialized-bridge');
  const miniboss = createOccurrenceId('h-materialized-miniboss');
  const combat05 = createOccurrenceId('h-materialized-combat05');

  let project = createProjectDocument(catalog, {
    projectId: 'h-materialization',
    name: 'H Materialization',
    configuredBiomeCounts: { Underworld: 3 },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: start,
    gameName: 'H_Intro',
  });
  project = appendBatch(
    project,
    start,
    [{ occurrenceId: combat02, gameName: 'H_Combat02' }],
    1,
    outcomes[0],
  );
  project = appendBatch(
    project,
    combat02,
    [
      { occurrenceId: combat09, gameName: 'H_Combat09' },
      { occurrenceId: combat03, gameName: 'H_Combat03' },
    ],
    1,
    outcomes[1],
  );
  project = appendBatch(
    project,
    combat09,
    [
      { occurrenceId: bridge, gameName: 'H_Bridge01' },
      { occurrenceId: miniboss, gameName: 'H_MiniBoss01' },
    ],
    1,
    outcomes[2],
  );
  project = appendBatch(
    project,
    bridge,
    [
      { occurrenceId: combat05, gameName: 'H_Combat05' },
      { occurrenceId: combat04, gameName: 'H_Combat04' },
    ],
    1,
    outcomes[3],
  );
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTerminalTransition',
    continuation: createContinuationAddress(biome, combat05),
    targetOccurrenceIds: [
      createOccurrenceId('h-materialized-terminal-shop'),
      createOccurrenceId('h-materialized-terminal-free'),
    ],
  });
  return applyProjectCommand(project, catalog, {
    kind: 'SetTerminalPicked',
    picked: createPickedAddress(biome, combat05),
    exitIndex: 1,
  });
}

function complete(project: ProjectDocument): CompleteLinearCompletenessResult {
  const result = evaluateLinearCompleteness(catalog, biome, plan(project));
  if (result.completion !== 'complete') {
    throw new Error(`fixture is incomplete: ${result.findings.map((finding) => finding.code)}`);
  }
  return result;
}

describe('canonical H Fields materialization', () => {
  it('derives each Fields capacity and active local-reward prefix without mutating authorship', () => {
    const project = completeProject();
    const encodedBefore = encodeProjectDocument(project);
    const snapshot = materializeLinearBiome(catalog, biome, complete(project));

    expect(snapshot.batches.map((batch) => batch.batchState)).toEqual([
      {
        kind: 'fields',
        cageOutcome: 'min',
        batchCapacity: 3,
        cageTargetCount: 1,
        doorCageRewardCount: 2,
      },
      {
        kind: 'fields',
        cageOutcome: 'max',
        batchCapacity: 2,
        cageTargetCount: 2,
        doorCageRewardCount: 2,
      },
      {
        kind: 'fields',
        cageOutcome: 'max',
        batchCapacity: 3,
        cageTargetCount: 0,
        doorCageRewardCount: 3,
      },
      {
        kind: 'fields',
        cageOutcome: 'min',
        batchCapacity: 3,
        cageTargetCount: 2,
        doorCageRewardCount: 2,
      },
    ]);
    const topology = plan(project).topology;
    if (topology === null) {
      throw new Error('complete H fixture lost its topology');
    }
    expect(
      topology.continuations
        .filter((continuation) => continuation.kind === 'batch')
        .map((continuation) => projectLinearBatchState(catalog, biome, topology, continuation)),
    ).toEqual(snapshot.batches.map((batch) => batch.batchState));

    const minCombat = snapshot.batches[0]?.targets[0]?.room;
    expect(minCombat).toMatchObject({
      gameName: 'H_Combat02',
      lifecycleProfileKey: 'FieldsCombatRoom',
      encounterProfileKey: 'H_FieldsCombatCage2',
    });
    expect(minCombat?.localRewards?.map((reward) => reward.slotKey)).toEqual(['cage1', 'cage2']);

    expect(minCombat?.localRewards?.[1]).toMatchObject({
      groupKey: 'cages',
      encounterPhaseKey: 'Cage02',
      resolvedStoreKey: 'RunProgress',
    });
    expect(semanticAddressKey(minCombat!.localRewards![1]!.origin)).toBe(
      '["localReward","Underworld","H","h-materialized-combat02","cages","cage2"]',
    );

    const noCombatBatch = snapshot.batches[2];
    expect(noCombatBatch?.targets.every((target) => target.room.localRewards === undefined)).toBe(
      true,
    );
    const clampedTargets = snapshot.batches[1]?.targets;
    expect(clampedTargets?.map((target) => target.room.localRewards?.length)).toEqual([2, 2]);
    expect(clampedTargets?.map((target) => target.room.encounterProfileKey)).toEqual([
      'H_FieldsCombatCage2',
      'H_FieldsCombatCage2',
    ]);

    expect(encodeProjectDocument(project)).toBe(encodedBefore);
    expect(
      plan(project).topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === createOccurrenceId('h-materialized-combat02'),
      )?.state,
    ).toMatchObject({
      kind: 'fieldsCombat',
      cages: { cage1: expect.any(Object), cage2: expect.any(Object), cage3: expect.any(Object) },
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(minCombat?.localRewards)).toBe(true);
  });

  it('materializes a supported three-cage Max without changing dormant leaves', () => {
    const project = completeProject(['min', 'min', 'min', 'max']);
    const snapshot = materializeLinearBiome(catalog, biome, complete(project));
    const maxBatch = snapshot.batches[3];
    const maxCombat = maxBatch?.targets[0]?.room;

    expect(maxBatch?.batchState).toEqual({
      kind: 'fields',
      cageOutcome: 'max',
      batchCapacity: 3,
      cageTargetCount: 2,
      doorCageRewardCount: 3,
    });
    expect(maxCombat).toMatchObject({
      gameName: 'H_Combat05',
      lifecycleProfileKey: 'FieldsCombatRoom',
      encounterProfileKey: 'H_FieldsCombatCage3',
    });
    expect(maxCombat?.localRewards?.map((reward) => reward.slotKey)).toEqual([
      'cage1',
      'cage2',
      'cage3',
    ]);
    expect(semanticAddressKey(maxCombat!.localRewards![2]!.origin)).toBe(
      '["localReward","Underworld","H","h-materialized-combat05","cages","cage3"]',
    );
  });

  it('retains the door roll for all-special and mixed target batches', () => {
    const specialOnly = applyProjectCommand(completeProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(biome, createOccurrenceId('h-materialized-bridge')),
      gameName: 'H_MiniBoss02',
    });
    const specialTopology = plan(specialOnly).topology;
    if (specialTopology === null) {
      throw new Error('all-special Fields fixture lost its topology');
    }
    const specialBatch = specialTopology.continuations[2];
    if (specialBatch?.kind !== 'batch') {
      throw new Error('all-special Fields fixture lost its third batch');
    }
    expect(projectLinearBatchState(catalog, biome, specialTopology, specialBatch)).toEqual({
      kind: 'fields',
      cageOutcome: 'max',
      batchCapacity: 3,
      cageTargetCount: 0,
      doorCageRewardCount: 3,
    });

    const mixed = applyProjectCommand(completeProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(biome, createOccurrenceId('h-materialized-bridge')),
      gameName: 'H_Combat05',
    });
    const mixedTopology = plan(mixed).topology;
    if (mixedTopology === null) {
      throw new Error('mixed Fields fixture lost its topology');
    }
    const mixedBatch = mixedTopology.continuations[2];
    if (mixedBatch?.kind !== 'batch') {
      throw new Error('mixed Fields fixture lost its third batch');
    }
    expect(projectLinearBatchState(catalog, biome, mixedTopology, mixedBatch)).toEqual({
      kind: 'fields',
      cageOutcome: 'max',
      batchCapacity: 3,
      cageTargetCount: 1,
      doorCageRewardCount: 3,
    });
  });

  it('materializes the fixed entry, forked terminal, and H completion tail only once', () => {
    const snapshot = materializeLinearBiome(catalog, biome, complete(completeProject()));

    expect(snapshot.entryRooms).toHaveLength(1);
    expect(snapshot.entryRooms[0]).toMatchObject({
      gameName: 'H_Intro',
      lifecycleProfileKey: 'RewardlessRoom',
      entered: true,
    });
    expect(snapshot.terminalEntry.targets).toHaveLength(2);
    expect(snapshot.terminalEntry.targets[0]).toMatchObject({
      picked: true,
      continuation: 'entersTerminal',
      room: {
        gameName: 'H_PreBoss01',
        lifecycleProfileKey: 'TerminalWorldShopRoom',
        entryState: { kind: 'shop', profileKey: 'WorldShop' },
      },
    });
    expect(snapshot.terminalEntry.targets[1]).toMatchObject({
      picked: false,
      continuation: 'deadLeaf',
      room: {
        gameName: 'H_PreBoss01',
        lifecycleProfileKey: 'TerminalRewardRoom',
      },
    });
    expect(snapshot.completionRooms.map((room) => room.gameName)).toEqual([
      'H_Boss01',
      'H_PostBoss01',
    ]);
    expect(snapshot.completionRooms.map((room) => room.lifecycleProfileKey)).toEqual([
      'BossRoom',
      'PostBossRoom',
    ]);
    expect(snapshot.completionRooms[0]).toMatchObject({
      enteredRewardStoreKey: 'RunProgress',
    });
    expect(snapshot.batches).toHaveLength(4);
    expect(snapshot).not.toHaveProperty('history');
    expect(snapshot).not.toHaveProperty('findings');
  });
});

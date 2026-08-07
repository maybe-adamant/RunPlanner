import {
  applyProjectCommand,
  createBiomeAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createTargetAddress,
  encodeProjectDocument,
  semanticAddressKey,
  type ExitDecision,
  type OccurrenceId,
  type ProjectDocument,
  type RoomOccurrence,
} from '@run-planner/engine/authored-project';
import type { Catalog, RoomDeclaration } from '@run-planner/engine/catalog-schema';
import {
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
  evaluateBiomeCompleteness,
  fieldsBatchFacts,
  fieldsBatchOwnsCageOutcome,
  materializeBiome,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';

import { createGoldenFGHProject, goldenHStartId } from '@run-planner/test-fixtures';

const biome = createBiomeAddress('Underworld', 'H');

function plan(project: ProjectDocument) {
  const result = project.routes
    .find((route) => route.routeKey === 'Underworld')
    ?.biomes.find((candidate) => candidate.biomeKey === 'H');
  if (result === undefined) throw new Error('fixture has no H plan');
  return result;
}

function hLayout() {
  const layout = catalog.biomeLayouts.byKey.H;
  if (layout === undefined) throw new Error('catalog has no H layout');
  return layout;
}

function batchAt(project: ProjectDocument, sourceOccurrenceId: OccurrenceId) {
  const topology = plan(project).topology;
  if (topology === null) throw new Error(`H batch from ${sourceOccurrenceId} is missing`);
  const decision = topology.decisions.find(
    (
      candidate,
    ): candidate is ExitDecision & {
      readonly normal: Extract<ExitDecision['normal'], { readonly kind: 'batch' }>;
    } =>
      candidate.kind === 'exit' &&
      candidate.normal.kind === 'batch' &&
      candidate.source.kind === 'occurrence' &&
      candidate.source.occurrenceId === sourceOccurrenceId,
  );
  if (decision === undefined) {
    throw new Error(`H batch from ${sourceOccurrenceId} is missing`);
  }
  return { decision, topology };
}

function occurrenceLookup(occurrences: readonly RoomOccurrence[]) {
  return (occurrenceId: OccurrenceId) =>
    occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId);
}

function catalogWithNonFieldsBoundedRoom(gameName: string): Catalog {
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined) throw new Error(`catalog has no ${gameName}`);
  const replacement: RoomDeclaration = {
    ...room,
    mode: { kind: 'authored', templateKey: 'StandardCombat' },
  };
  return {
    ...catalog,
    rooms: {
      ...catalog.rooms,
      byKey: { ...catalog.rooms.byKey, [gameName]: replacement },
      values: catalog.rooms.values.map((candidate) =>
        candidate.gameName === gameName ? replacement : candidate,
      ),
    },
  };
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
  const decision = createExitDecisionAddress(biome, {
    kind: 'occurrence',
    occurrenceId: parentOccurrenceId,
  });
  let next = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
  next = applyProjectCommand(next, catalog, {
    kind: 'ReplaceFieldsCageOutcome',
    decision,
    cageOutcome,
  });
  for (const [index, target] of targets.entries()) {
    next = applyProjectCommand(next, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, decision.source, `exit${index + 1}`),
      occurrenceId: target.occurrenceId,
      gameName: target.gameName,
    });
  }
  return targets.length > 1
    ? applyProjectCommand(next, catalog, {
        kind: 'SetExitSelection',
        selection: createExitSelectionAddress(biome, decision.source),
        value: { kind: 'normal', exitKey: `exit${pickedExitIndex}` },
      })
    : next;
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
  const decision = createExitDecisionAddress(biome, {
    kind: 'occurrence',
    occurrenceId: combat05,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTakeoverBatch',
    decision,
    gameName: 'H_PreBoss01',
    targetOccurrenceIds: {
      exit1: createOccurrenceId('h-materialized-preboss-shop'),
      exit2: createOccurrenceId('h-materialized-preboss-free'),
    },
  });
  return applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(biome, decision.source),
    value: { kind: 'normal', exitKey: 'exit1' },
  });
}

function materialize(project: ProjectDocument) {
  const completeness = evaluateBiomeCompleteness(catalog, biome, plan(project));
  if (completeness.completion !== 'complete') {
    throw new Error(
      `fixture is incomplete: ${completeness.findings.map((finding) => finding.code)}`,
    );
  }
  return materializeBiome(catalog, biome, completeness);
}

function ordinaryBatches(snapshot: ReturnType<typeof materialize>) {
  return snapshot.decisions.filter(
    (
      decision,
    ): decision is Extract<(typeof snapshot.decisions)[number], { readonly kind: 'batch' }> =>
      decision.kind === 'batch' &&
      !decision.targets.some((target) => target.room.gameName === 'H_PreBoss01'),
  );
}

describe('H Fields materialization', () => {
  it('keeps Fields Min/Max and cage-local rewards as engine-owned candidate domains', () => {
    const project = createGoldenFGHProject();
    const start = goldenHStartId;
    const combat = createOccurrenceId('golden-h-combat02');
    const occurrence = plan(project).topology?.occurrences.find(
      (candidate) => candidate.occurrenceId === combat,
    );
    if (occurrence?.state.kind !== 'fieldsCombat') {
      throw new Error('H fixture must retain its first Fields combat state');
    }
    const reward = occurrence.state.cages.cage1;
    if (reward === undefined) throw new Error('H fixture must retain cage1');
    const candidates = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    ).evaluate([
      {
        kind: 'fieldsCageOutcome',
        decision: createExitDecisionAddress(biome, { kind: 'occurrence', occurrenceId: start }),
        cageOutcome: 'min',
      },
      {
        kind: 'fieldsCageOutcome',
        decision: createExitDecisionAddress(biome, { kind: 'occurrence', occurrenceId: start }),
        cageOutcome: 'max',
      },
      {
        kind: 'localReward',
        reward: createLocalRewardAddress(biome, combat, 'cages', 'cage1'),
        value: reward.offer,
      },
    ]);

    expect(candidates).toMatchObject([
      { kind: 'fieldsCageOutcome', result: { cageOutcome: 'min', selectedPossible: true } },
      { kind: 'fieldsCageOutcome', result: { cageOutcome: 'max' } },
      { kind: 'localReward', result: { supported: true, findings: [] } },
    ]);
  });

  it('does not assess a later Fields decision after an earlier cage reward is invalid', () => {
    const firstCombat = createOccurrenceId('golden-h-combat02');
    const laterCombat = createOccurrenceId('golden-h-combat09');
    const project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceLocalReward',
      reward: createLocalRewardAddress(biome, firstCombat, 'cages', 'cage1'),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HestiaUpgrade' } },
    });

    expect(
      createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, project),
      ).evaluate({
        kind: 'fieldsCageOutcome',
        decision: createExitDecisionAddress(biome, {
          kind: 'occurrence',
          occurrenceId: laterCombat,
        }),
        cageOutcome: 'max',
      }),
    ).toMatchObject({ kind: 'unavailable', reason: 'coverageNotReached' });
  });

  it('derives each Fields capacity and active local-reward prefix without mutating authorship', () => {
    const project = completeProject();
    const encodedBefore = encodeProjectDocument(project);
    const snapshot = materialize(project);
    const batches = ordinaryBatches(snapshot);

    expect(batches.map((batch) => batch.batchState)).toEqual([
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

    const minCombat = batches[0]?.targets[0]?.room;
    expect(minCombat).toMatchObject({
      gameName: 'H_Combat02',
      lifecycleProfileKey: 'FieldsCombatRoom',
      encounterEnvelopeKey: 'FieldsEncounter',
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

    expect(batches[2]?.targets.every((target) => target.room.localRewards === undefined)).toBe(
      true,
    );
    expect(batches[1]?.targets.map((target) => target.room.localRewards?.length)).toEqual([2, 2]);
    expect(batches[1]?.targets.map((target) => target.room.encounterEnvelopeKey)).toEqual([
      'FieldsEncounter',
      'FieldsEncounter',
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
    const snapshot = materialize(completeProject(['min', 'min', 'min', 'max']));
    const maxBatch = ordinaryBatches(snapshot)[3];
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
      encounterEnvelopeKey: 'FieldsEncounter',
      encounterPhases: [
        { slotKey: 'Passive', encounterKey: 'GeneratedH_Passive' },
        { slotKey: 'Cage01', encounterKey: 'GeneratedH' },
        { slotKey: 'Cage02', encounterKey: 'GeneratedH' },
        { slotKey: 'Cage03', encounterKey: 'GeneratedH' },
      ],
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
    expect(ordinaryBatches(materialize(specialOnly))[2]?.batchState).toEqual({
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
    expect(ordinaryBatches(materialize(mixed))[2]?.batchState).toEqual({
      kind: 'fields',
      cageOutcome: 'max',
      batchCapacity: 3,
      cageTargetCount: 1,
      doorCageRewardCount: 3,
    });
  });

  it('derives configured Fields facts from the template and any takeover target', () => {
    const project = completeProject();
    const { decision, topology } = batchAt(project, createOccurrenceId('h-materialized-combat02'));
    const lookup = occurrenceLookup(topology.occurrences);

    expect(fieldsBatchFacts(catalog, hLayout(), lookup, decision)).toEqual({
      cageOutcome: 'max',
      batchCapacity: 2,
      cageTargetCount: 2,
      doorCageRewardCount: 2,
    });

    const awaitingOutcome = {
      ...decision,
      normal: { ...decision.normal, batchState: null },
    };
    expect(fieldsBatchOwnsCageOutcome(catalog, hLayout(), lookup, awaitingOutcome)).toBe(true);
    expect(fieldsBatchFacts(catalog, hLayout(), lookup, awaitingOutcome)).toBeUndefined();

    const nonFieldsCatalog = catalogWithNonFieldsBoundedRoom('H_Combat09');
    expect(fieldsBatchFacts(nonFieldsCatalog, hLayout(), lookup, decision)).toEqual({
      cageOutcome: 'max',
      batchCapacity: 3,
      cageTargetCount: 1,
      doorCageRewardCount: 3,
    });

    const mixedOccurrences = topology.occurrences.map((occurrence) =>
      occurrence.occurrenceId === createOccurrenceId('h-materialized-combat03')
        ? { ...occurrence, gameName: 'H_PreBoss01' }
        : occurrence,
    );
    const mixedLookup = occurrenceLookup(mixedOccurrences);
    expect(fieldsBatchOwnsCageOutcome(catalog, hLayout(), mixedLookup, decision)).toBe(false);
    expect(fieldsBatchFacts(catalog, hLayout(), mixedLookup, decision)).toBeUndefined();
  });

  it('materializes the entry, selected Preboss batch, and H completion tail exactly once', () => {
    const snapshot = materialize(completeProject());
    const takeover = snapshot.decisions.at(-1);
    if (takeover?.kind !== 'batch') throw new Error('H fixture lost its takeover batch');

    expect(snapshot.entryRoom).toMatchObject({
      gameName: 'H_Intro',
      lifecycleProfileKey: 'RewardlessRoom',
      entered: true,
    });
    expect(takeover.targets).toHaveLength(2);
    expect(takeover.targets[0]).toMatchObject({
      picked: true,
      continuation: 'startsCompletion',
      room: {
        gameName: 'H_PreBoss01',
        lifecycleProfileKey: 'PrebossShopRoom',
        entryState: { kind: 'shop', profileKey: 'WorldShop' },
      },
    });
    expect(takeover.targets[1]).toMatchObject({
      picked: false,
      continuation: 'deadLeaf',
      room: {
        gameName: 'H_PreBoss01',
        lifecycleProfileKey: 'PrebossFreeRewardRoom',
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
    expect(snapshot.completionRooms[0]).toMatchObject({ enteredRewardStoreKey: 'RunProgress' });
    expect(ordinaryBatches(snapshot)).toHaveLength(4);
    expect(snapshot).not.toHaveProperty('history');
    expect(snapshot).not.toHaveProperty('findings');
  });
});

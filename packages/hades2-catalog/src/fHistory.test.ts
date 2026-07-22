import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createContinuationAddress,
  createOccurrenceId,
  createPickedAddress,
  createProjectDocument,
  createTargetAddress,
  semanticAddressKey,
  type LinearBiomePlan,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  composeFHistory,
  evaluateFCompleteness,
  foldFHistoryEvents,
  materializeLinearBiome,
  type CompleteFCompletenessResult,
  type FRoomHistoryViews,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { catalog } from './index';

const biome = createBiomeAddress('Underworld', 'F');
const startId = createOccurrenceId('history-start');
const firstCombatId = createOccurrenceId('history-combat-first');
const secondCombatId = createOccurrenceId('history-combat-second');
const unpickedShopId = createOccurrenceId('history-shop-unpicked');
const terminalShopId = createOccurrenceId('history-terminal-shop');
const terminalFreeId = createOccurrenceId('history-terminal-free');

function fPlan(project: ProjectDocument): LinearBiomePlan {
  const plan = project.routes.find((route) => route.routeKey === 'Underworld')?.biomes[0];
  if (plan?.kind !== 'LinearBiome' || plan.biomeKey !== 'F') {
    throw new Error('missing F history fixture plan');
  }
  return plan;
}

function historyProject(): ProjectDocument {
  let project = createProjectDocument(catalog, {
    projectId: 'f-history',
    name: 'F History',
    configuredBiomeCounts: { Underworld: 1 },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: startId,
    gameName: 'F_Opening01',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    continuation: createContinuationAddress(biome, startId),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(biome, startId),
    storeKey: 'MetaProgress',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, startId, 1),
    occurrenceId: firstCombatId,
    gameName: 'F_Combat04',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetPicked',
    picked: createPickedAddress(biome, startId),
    exitIndex: 1,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    continuation: createContinuationAddress(biome, firstCombatId),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, firstCombatId, 1),
    occurrenceId: secondCombatId,
    gameName: 'F_Combat11',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, firstCombatId, 2),
    occurrenceId: unpickedShopId,
    gameName: 'F_Shop01',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetPicked',
    picked: createPickedAddress(biome, firstCombatId),
    exitIndex: 1,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTerminalTransition',
    continuation: createContinuationAddress(biome, secondCombatId),
    targetOccurrenceIds: [terminalShopId, terminalFreeId],
  });
  return applyProjectCommand(project, catalog, {
    kind: 'SetTerminalPicked',
    picked: createPickedAddress(biome, secondCombatId),
    exitIndex: 1,
  });
}

function complete(project: ProjectDocument): CompleteFCompletenessResult {
  const result = evaluateFCompleteness(catalog, biome, fPlan(project));
  if (result.completion !== 'complete') {
    throw new Error(`history fixture is incomplete: ${result.findings[0]?.code}`);
  }
  return result;
}

function history() {
  const snapshot = materializeLinearBiome(catalog, biome, complete(historyProject()));
  return composeFHistory(catalog, snapshot);
}

function roomViews(rooms: readonly FRoomHistoryViews[], occurrenceId: string): FRoomHistoryViews {
  const views = rooms.find(
    (room) => room.origin.kind === 'occurrence' && room.origin.occurrenceId === occurrenceId,
  );
  if (views === undefined) {
    throw new Error(`missing history views for ${occurrenceId}`);
  }
  return views;
}

describe('F lifecycle composition and history ledgers', () => {
  it('inserts physical target creation at outgoing checkpoints without entering dead leaves', () => {
    const result = history();
    const firstCombat = roomViews(result.rooms, firstCombatId);

    expect(
      firstCombat.targetGenerations.map((view) => semanticAddressKey(view.targetOrigin)),
    ).toEqual([
      '["target","Underworld","F","history-combat-first",1]',
      '["target","Underworld","F","history-combat-first",2]',
    ]);
    expect(
      firstCombat.targetGenerations.map((view) => view.before.ledgers.roomCreations.length),
    ).toEqual([2, 3]);
    expect(
      firstCombat.targetGenerations.map((view) => view.after.ledgers.roomCreations.length),
    ).toEqual([3, 4]);
    expect(firstCombat.targetGenerations[0]?.before.ledgers).toEqual(
      firstCombat.preOutgoing?.ledgers,
    );
    expect(firstCombat.targetGenerations[1]?.before.ledgers).toEqual(
      firstCombat.targetGenerations[0]?.after.ledgers,
    );
    expect(firstCombat.outgoingGeneration?.ledgers).toEqual(
      firstCombat.targetGenerations[1]?.after.ledgers,
    );

    const createdNames = result.ledgers.roomCreations.map((entry) => entry.gameName);
    const appearedNames = result.ledgers.roomAppearances.map((entry) => entry.gameName);
    expect(createdNames).toContain('F_Shop01');
    expect(appearedNames).not.toContain('F_Shop01');
    expect(
      result.events.filter(
        (event) =>
          'origin' in event &&
          event.origin.kind === 'occurrence' &&
          event.origin.occurrenceId === unpickedShopId,
      ),
    ).toEqual([
      expect.objectContaining({ kind: 'roomCreated', source: 'generatedTarget', picked: false }),
    ]);
  });

  it('preserves encounter-start and commit-time counter visibility across rooms', () => {
    const result = history();
    const start = roomViews(result.rooms, startId);
    const firstCombat = roomViews(result.rooms, firstCombatId);
    const secondCombat = roomViews(result.rooms, secondCombatId);

    expect(result.events[0]).toEqual({
      kind: 'biomeStarted',
      sequence: 1,
      origin: biome,
      counters: {
        biomeDepthCache: 0,
        biomeEncounterDepth: 1,
        routeEncounterDepth: 1,
        roomHistoryOrdinal: 0,
      },
    });

    expect(start.preparation.ledgers.counters).toEqual({
      biomeDepthCache: 0,
      biomeEncounterDepth: 1,
      routeEncounterDepth: 1,
      roomHistoryOrdinal: 0,
    });
    expect(start.preOutgoing?.ledgers.counters).toMatchObject({
      biomeDepthCache: 0,
      biomeEncounterDepth: 2,
      routeEncounterDepth: 2,
    });
    expect(firstCombat.preparation.ledgers.counters).toMatchObject({
      biomeDepthCache: 1,
      biomeEncounterDepth: 2,
      roomHistoryOrdinal: 1,
    });
    expect(firstCombat.preparation.ledgers).toEqual(start.exit.ledgers);
    expect(firstCombat.preOutgoing?.ledgers.counters).toMatchObject({
      biomeDepthCache: 1,
      biomeEncounterDepth: 3,
    });
    expect(firstCombat.postCommit.ledgers.counters).toMatchObject({
      biomeDepthCache: 2,
      biomeEncounterDepth: 3,
      roomHistoryOrdinal: 2,
    });
    expect(secondCombat.preparation.ledgers.counters).toEqual(
      firstCombat.postCommit.ledgers.counters,
    );
    expect(secondCombat.preparation.ledgers).toEqual(firstCombat.exit.ledgers);
  });

  it('records entered stores only at commit and folds the full stream deterministically', () => {
    const result = history();
    const start = roomViews(result.rooms, startId);
    const firstCombat = roomViews(result.rooms, firstCombatId);

    expect(start.outgoingGeneration?.ledgers.enteredRewardStores).toEqual([]);
    expect(start.postCommit.ledgers.enteredRewardStores.map((entry) => entry.storeKey)).toEqual([
      'RunProgress',
    ]);
    expect(
      firstCombat.preparation.ledgers.enteredRewardStores.map((entry) => entry.storeKey),
    ).toEqual(['RunProgress']);
    expect(
      firstCombat.postCommit.ledgers.enteredRewardStores.map((entry) => entry.storeKey),
    ).toEqual(['RunProgress', 'MetaProgress']);

    expect(foldFHistoryEvents(result.events)).toEqual(result);
    expect(
      composeFHistory(catalog, materializeLinearBiome(catalog, biome, complete(historyProject()))),
    ).toEqual(result);
    expect(result.events.map((event) => event.sequence)).toEqual(
      result.events.map((_, index) => index + 1),
    );
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.events)).toBe(true);
    expect(Object.isFrozen(result.events[0])).toBe(true);
    expect(
      result.events[0]?.kind === 'biomeStarted' && Object.isFrozen(result.events[0].counters),
    ).toBe(true);
    expect(Object.isFrozen(result.ledgers.roomCreations)).toBe(true);
  });

  it('walks terminal and completion rooms before applying declared biome resets', () => {
    const result = history();
    const appearedNames = result.ledgers.roomAppearances.map((entry) => entry.gameName);

    expect(appearedNames.slice(-3)).toEqual(['F_PreBoss01', 'F_Boss01', 'F_PostBoss01']);
    expect(result.ledgers.enteredRewardStores.map((entry) => entry.gameName).slice(-1)).toEqual([
      'F_PreBoss01',
    ]);
    expect(result.events.filter((event) => event.kind === 'roomCountersAdvanced')).toHaveLength(
      result.ledgers.roomAppearances.length,
    );
    expect(result.biomeCompletion.ledgers.counters).toEqual({
      biomeDepthCache: 5,
      biomeEncounterDepth: 4,
      routeEncounterDepth: 4,
      roomHistoryOrdinal: 6,
    });
    expect(result.afterTransition.ledgers.counters).toEqual({
      biomeDepthCache: 0,
      biomeEncounterDepth: 0,
      routeEncounterDepth: 4,
      roomHistoryOrdinal: 6,
    });
    expect(result.events.slice(-3)).toEqual([
      expect.objectContaining({ kind: 'biomeCompleted' }),
      expect.objectContaining({ kind: 'biomeCounterReset', axis: 'biomeDepthCache' }),
      expect.objectContaining({ kind: 'biomeCounterReset', axis: 'biomeEncounterDepth' }),
    ]);
  });
});

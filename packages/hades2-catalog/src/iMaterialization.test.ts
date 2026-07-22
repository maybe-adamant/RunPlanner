import {
  applyProjectCommand,
  createBiomeAddress,
  createContinuationAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createPickedAddress,
  createProjectDocument,
  createTargetAddress,
  encodeProjectDocument,
  type LinearBiomePlan,
  type OccurrenceId,
  type ProjectCommand,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  composeLinearHistory,
  evaluateLinearCompleteness,
  LinearHistoryFoldContractError,
  materializeLinearBiome,
  type CanonicalLinearHistory,
  type CompleteLinearCompletenessResult,
  type LinearHistoryLedgers,
  type LinearHistoryStateView,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { catalog } from './index';

const biome = createBiomeAddress('Underworld', 'I');

interface BatchTargetFixture {
  readonly occurrenceId: OccurrenceId;
  readonly gameName: string;
}

type IncomingRewardValue = Extract<
  ProjectCommand,
  { readonly kind: 'ReplaceIncomingReward' }
>['value'];

function plan(project: ProjectDocument): LinearBiomePlan {
  const result = project.routes
    .find((route) => route.routeKey === 'Underworld')
    ?.biomes.find((candidate) => candidate.biomeKey === 'I');
  if (result?.kind !== 'LinearBiome') {
    throw new Error('fixture lost I plan');
  }
  return result;
}

function appendBatch(
  project: ProjectDocument,
  parentOccurrenceId: OccurrenceId | null,
  targets: readonly BatchTargetFixture[],
  pickedExitIndex: number,
): ProjectDocument {
  let next = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    continuation: createContinuationAddress(biome, parentOccurrenceId),
  });
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

function occurrence(key: string): OccurrenceId {
  return createOccurrenceId(`i-materialized-${key}`);
}

function completeProject(nonGoalOffer?: IncomingRewardValue): ProjectDocument {
  const combat01 = occurrence('combat01');
  const combat03 = occurrence('combat03');
  const combat05 = occurrence('combat05');
  const combat09 = occurrence('combat09');
  const combat06 = occurrence('combat06');
  const combat11 = occurrence('combat11');
  const offeredCombat12 = occurrence('offered-combat12');
  const enteredCombat12 = occurrence('entered-combat12');
  const combat07 = occurrence('combat07');
  const combat08 = occurrence('combat08');
  let project = createProjectDocument(catalog, {
    projectId: 'i-materialized-fixture',
    name: 'I Materialized Fixture',
    configuredBiomeCounts: { Underworld: 4 },
  });
  project = appendBatch(project, null, [{ occurrenceId: combat01, gameName: 'I_Combat01' }], 1);
  project = appendBatch(
    project,
    combat01,
    [
      { occurrenceId: combat03, gameName: 'I_Combat03' },
      { occurrenceId: occurrence('combat02'), gameName: 'I_Combat02' },
    ],
    1,
  );
  project = appendBatch(
    project,
    combat03,
    [
      { occurrenceId: occurrence('combat04'), gameName: 'I_Combat04' },
      { occurrenceId: combat05, gameName: 'I_Combat05' },
    ],
    2,
  );
  project = appendBatch(project, combat05, [{ occurrenceId: combat09, gameName: 'I_Combat09' }], 1);
  project = appendBatch(
    project,
    combat09,
    [
      { occurrenceId: occurrence('combat10'), gameName: 'I_Combat10' },
      { occurrenceId: combat06, gameName: 'I_Combat06' },
    ],
    2,
  );
  project = appendBatch(project, combat06, [{ occurrenceId: combat11, gameName: 'I_Combat11' }], 1);
  project = appendBatch(
    project,
    combat11,
    [
      { occurrenceId: offeredCombat12, gameName: 'I_Combat12' },
      { occurrenceId: combat07, gameName: 'I_Combat07' },
    ],
    2,
  );
  project = appendBatch(
    project,
    combat07,
    [{ occurrenceId: enteredCombat12, gameName: 'I_Combat12' }],
    1,
  );
  project = appendBatch(
    project,
    enteredCombat12,
    [
      { occurrenceId: occurrence('declined-preboss'), gameName: 'I_PreBoss02' },
      { occurrenceId: combat08, gameName: 'I_Combat08' },
    ],
    2,
  );
  project = appendBatch(
    project,
    combat08,
    [{ occurrenceId: occurrence('entered-preboss'), gameName: 'I_PreBoss02' }],
    1,
  );
  return nonGoalOffer === undefined
    ? project
    : applyProjectCommand(project, catalog, {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(biome, combat05),
        value: nonGoalOffer,
      });
}

function complete(project: ProjectDocument): CompleteLinearCompletenessResult {
  const result = evaluateLinearCompleteness(catalog, biome, plan(project));
  if (result.completion !== 'complete') {
    throw new Error(`fixture is incomplete: ${result.findings.map((finding) => finding.code)}`);
  }
  return result;
}

function carriedHHistory(): CanonicalLinearHistory {
  const ledgers: LinearHistoryLedgers = Object.freeze({
    roomCreations: Object.freeze([]),
    roomAppearances: Object.freeze([]),
    encounterStarts: Object.freeze([]),
    encounterCompletions: Object.freeze([]),
    enteredRewardStores: Object.freeze([]),
    requiredObjectSpawns: Object.freeze([]),
    requiredObjectCompletions: Object.freeze([]),
    roomRestores: Object.freeze([]),
    counters: Object.freeze({
      biomeDepthCache: 0,
      biomeEncounterDepth: 0,
      routeEncounterDepth: 20,
      roomHistoryOrdinal: 30,
    }),
  });
  const state: LinearHistoryStateView = Object.freeze({ sequence: 100, ledgers });
  return Object.freeze({
    routeKey: 'Underworld',
    biomeKey: 'H',
    events: Object.freeze([]),
    ledgers,
    rooms: Object.freeze([]),
    biomeCompletion: state,
    afterTransition: state,
  });
}

describe('canonical I Clockwork materialization and history', () => {
  it('derives physical Goal and NonGoal offers before each generated batch', () => {
    const project = completeProject();
    const encodedBefore = encodeProjectDocument(project);
    const snapshot = materializeLinearBiome(catalog, biome, complete(project));

    expect(snapshot.entryRooms).toMatchObject([
      { kind: 'fixedEntry', role: 'intro', gameName: 'I_Intro' },
      {
        kind: 'fixedEntry',
        role: 'story',
        gameName: 'I_Story01',
        incomingReward: { offer: { rewardType: 'Story' } },
      },
    ]);
    expect(snapshot.batches.map((batch) => batch.batchState)).toEqual([
      { kind: 'clockwork', goalsRemaining: 5, nonGoalRewardsAcquired: 0, maxNonGoalRewards: 3 },
      { kind: 'clockwork', goalsRemaining: 4, nonGoalRewardsAcquired: 0, maxNonGoalRewards: 3 },
      { kind: 'clockwork', goalsRemaining: 3, nonGoalRewardsAcquired: 0, maxNonGoalRewards: 3 },
      { kind: 'clockwork', goalsRemaining: 3, nonGoalRewardsAcquired: 1, maxNonGoalRewards: 3 },
      { kind: 'clockwork', goalsRemaining: 2, nonGoalRewardsAcquired: 1, maxNonGoalRewards: 3 },
      { kind: 'clockwork', goalsRemaining: 2, nonGoalRewardsAcquired: 2, maxNonGoalRewards: 3 },
      { kind: 'clockwork', goalsRemaining: 1, nonGoalRewardsAcquired: 2, maxNonGoalRewards: 3 },
      { kind: 'clockwork', goalsRemaining: 1, nonGoalRewardsAcquired: 3, maxNonGoalRewards: 3 },
      { kind: 'clockwork', goalsRemaining: 0, nonGoalRewardsAcquired: 3, maxNonGoalRewards: 3 },
    ]);
    expect(
      snapshot.batches.map((batch) =>
        batch.targets.map((target) => ({
          picked: target.picked,
          reward: target.room.clockworkReward,
          concrete: target.room.incomingReward?.offer.rewardType,
        })),
      ),
    ).toEqual([
      [{ picked: true, reward: 'goal', concrete: undefined }],
      [
        { picked: true, reward: 'goal', concrete: undefined },
        { picked: false, reward: 'nonGoal', concrete: 'RoomMoneyTripleDrop' },
      ],
      [
        { picked: false, reward: 'goal', concrete: undefined },
        { picked: true, reward: 'nonGoal', concrete: 'RoomMoneyTripleDrop' },
      ],
      [{ picked: true, reward: 'goal', concrete: undefined }],
      [
        { picked: false, reward: 'goal', concrete: undefined },
        { picked: true, reward: 'nonGoal', concrete: 'RoomMoneyTripleDrop' },
      ],
      [{ picked: true, reward: 'goal', concrete: undefined }],
      [
        { picked: false, reward: 'goal', concrete: undefined },
        { picked: true, reward: 'nonGoal', concrete: 'RoomMoneyTripleDrop' },
      ],
      [{ picked: true, reward: 'goal', concrete: undefined }],
      [
        { picked: false, reward: 'goal', concrete: 'Shop' },
        { picked: true, reward: 'goal', concrete: undefined },
      ],
    ]);
    expect(snapshot.terminalEntry).toMatchObject({
      batchState: {
        kind: 'clockwork',
        goalsRemaining: 0,
        nonGoalRewardsAcquired: 3,
        maxNonGoalRewards: 3,
      },
      rewardStore: { kind: 'none' },
      pickedExitIndex: 1,
      targets: [
        {
          picked: true,
          continuation: 'entersTerminal',
          room: {
            gameName: 'I_PreBoss02',
            clockworkReward: 'goal',
            entryState: { kind: 'shop', profileKey: 'I_WorldShop' },
          },
        },
      ],
    });
    const prebosses = [
      ...snapshot.batches.flatMap((batch) => batch.targets),
      ...snapshot.terminalEntry.targets,
    ].filter((target) => target.room.gameName === 'I_PreBoss02');
    expect(prebosses).toHaveLength(2);
    expect(prebosses.map((target) => target.room.entryState?.profileKey)).toEqual([
      undefined,
      'I_WorldShop',
    ]);
    expect(snapshot.completionRooms.map((room) => room.gameName)).toEqual([
      'I_Boss01',
      'I_PostBoss01',
    ]);
    expect(snapshot.biomeState).toEqual({ maxNonGoalRewards: 3 });
    expect(encodeProjectDocument(project)).toBe(encodedBefore);
  });

  it('carries H route state and advances Clockwork counters only at picked producer points', () => {
    const snapshot = materializeLinearBiome(catalog, biome, complete(completeProject()));
    const history = composeLinearHistory(catalog, snapshot, carriedHHistory());
    const events = history.events;
    const started = events.find((event) => event.kind === 'biomeStarted');

    expect(started).toMatchObject({
      counters: {
        biomeDepthCache: 1,
        biomeEncounterDepth: 1,
        routeEncounterDepth: 20,
        roomHistoryOrdinal: 30,
        clockworkGoalsRemaining: 5,
        clockworkNonGoalRewardsAcquired: 0,
        clockworkMaxNonGoalRewards: 3,
      },
    });
    expect(
      events
        .filter((event) => event.kind === 'roomCreated')
        .slice(0, 2)
        .map((event) => ({ gameName: event.gameName, source: event.source })),
    ).toEqual([
      { gameName: 'I_Intro', source: 'biomeEntry' },
      { gameName: 'I_Story01', source: 'layoutEntry' },
    ]);
    const firstGenerated = events.find(
      (event) => event.kind === 'roomCreated' && event.gameName === 'I_Combat01',
    );
    expect(firstGenerated).toMatchObject({
      source: 'generatedTarget',
      parentOrigin: { kind: 'fixedEntryRoom', role: 'story' },
    });
    expect(events.filter((event) => event.kind === 'clockworkBatchStateRecorded')).toHaveLength(10);
    expect(events.filter((event) => event.kind === 'clockworkGoalAcquired')).toHaveLength(7);
    expect(events.filter((event) => event.kind === 'clockworkNonGoalRewardSpawned')).toHaveLength(
      3,
    );

    const pickedNonGoal = snapshot.batches[2]?.targets[1]?.room.origin;
    if (pickedNonGoal === undefined) {
      throw new Error('fixture lost picked NonGoal room');
    }
    const pickedNonGoalEvents = events.filter(
      (event) =>
        'origin' in event && JSON.stringify(event.origin) === JSON.stringify(pickedNonGoal),
    );
    expect(pickedNonGoalEvents.map((event) => event.kind)).toEqual([
      'roomCreated',
      'roomPrepared',
      'roomEntered',
      'encounterStarted',
      'encounterDepthAdvanced',
      'encounterCompleted',
      'clockworkNonGoalRewardSpawned',
      'producerRoleAdvanced',
      'outgoingGenerationCheckpoint',
      'roomCommitted',
      'roomCountersAdvanced',
      'enteredRewardStoreRecorded',
      'roomExited',
    ]);
    expect(history.biomeCompletion.ledgers.counters).toMatchObject({
      biomeDepthCache: 13,
      biomeEncounterDepth: 10,
      routeEncounterDepth: 29,
      roomHistoryOrdinal: 44,
      clockworkGoalsRemaining: 0,
      clockworkNonGoalRewardsAcquired: 3,
      clockworkMaxNonGoalRewards: 3,
    });
    expect(history.afterTransition.ledgers.counters).toMatchObject({
      biomeDepthCache: 0,
      biomeEncounterDepth: 0,
      routeEncounterDepth: 29,
      roomHistoryOrdinal: 44,
      clockworkGoalsRemaining: 0,
      clockworkNonGoalRewardsAcquired: 3,
    });

    const firstBatch = snapshot.batches[0];
    if (firstBatch?.batchState.kind !== 'clockwork') {
      throw new Error('fixture lost first Clockwork batch');
    }
    const malformed = {
      ...snapshot,
      batches: [
        {
          ...firstBatch,
          batchState: { ...firstBatch.batchState, goalsRemaining: 4 },
        },
        ...snapshot.batches.slice(1),
      ],
    };
    expect(() => composeLinearHistory(catalog, malformed, carriedHHistory())).toThrowError(
      LinearHistoryFoldContractError,
    );
  });

  it('records a Devotion NonGoal spawn before its before-combat acquisition', () => {
    const project = completeProject({
      rewardType: 'Devotion',
      payload: {
        kind: 'DevotionPair',
        chosenSource: 'ApolloUpgrade',
        spurnedSource: 'ZeusUpgrade',
      },
    });
    const snapshot = materializeLinearBiome(catalog, biome, complete(project));
    const history = composeLinearHistory(catalog, snapshot, carriedHHistory());
    const devotionOrigin = snapshot.batches[2]?.targets[1]?.room.origin;
    if (devotionOrigin === undefined) {
      throw new Error('fixture lost picked Devotion NonGoal room');
    }

    expect(
      history.events
        .filter(
          (event) =>
            'origin' in event && JSON.stringify(event.origin) === JSON.stringify(devotionOrigin),
        )
        .map((event) => event.kind),
    ).toEqual([
      'roomCreated',
      'roomPrepared',
      'roomEntered',
      'clockworkNonGoalRewardSpawned',
      'producerRoleAdvanced',
      'encounterStarted',
      'encounterDepthAdvanced',
      'encounterCompleted',
      'producerRoleAdvanced',
      'outgoingGenerationCheckpoint',
      'roomCommitted',
      'roomCountersAdvanced',
      'enteredRewardStoreRecorded',
      'roomExited',
    ]);
  });
});

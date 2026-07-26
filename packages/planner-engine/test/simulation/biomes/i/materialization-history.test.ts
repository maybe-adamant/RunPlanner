import {
  applyProjectCommand,
  createBiomeAddress,
  createBiomeFieldAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createTargetAddress,
  encodeProjectDocument,
  type AuthoredBiomePlan,
  type OccurrenceId,
  type ProjectCommand,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  composeBiomeHistory,
  composeBiomeHistoryPrefix,
  evaluateBiomeCompleteness,
  evaluateBiomeRoomGeneration,
  HistoryFoldContractError,
  materializeBiome,
  materializeBiomePrefix,
  type CanonicalBiomeHistory,
  type CompleteBiomeCompletenessResult,
  type HistoryLedgers,
  type HistoryStateView,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';

const biome = createBiomeAddress('Underworld', 'I');

interface BatchTargetFixture {
  readonly occurrenceId: OccurrenceId;
  readonly gameName: string;
}

type IncomingRewardValue = Extract<
  ProjectCommand,
  { readonly kind: 'ReplaceIncomingReward' }
>['value'];

function plan(project: ProjectDocument): AuthoredBiomePlan {
  const result = project.routes
    .find((route) => route.routeKey === 'Underworld')
    ?.biomes.find((candidate) => candidate.biomeKey === 'I');
  if (result === undefined) {
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
  const resolvedParentOccurrenceId =
    parentOccurrenceId ?? plan(project).topology?.startOccurrenceId ?? null;
  if (resolvedParentOccurrenceId === null) {
    throw new Error('I fixture has no authored start');
  }
  const source = { kind: 'occurrence' as const, occurrenceId: resolvedParentOccurrenceId };
  const decision = createExitDecisionAddress(biome, source);
  let next = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision,
  });
  for (const [index, target] of targets.entries()) {
    next = applyProjectCommand(next, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, source, `exit${index + 1}`),
      occurrenceId: target.occurrenceId,
      gameName: target.gameName,
    });
  }
  return targets.length === 1
    ? next
    : applyProjectCommand(next, catalog, {
        kind: 'SetExitSelection',
        selection: createExitSelectionAddress(biome, source),
        value: { kind: 'normal', exitKey: `exit${pickedExitIndex}` },
      });
}

function occurrence(key: string): OccurrenceId {
  return createOccurrenceId(`i-materialized-${key}`);
}

function createIProject(projectId: string, name: string): ProjectDocument {
  const project = createProjectDocument(catalog, {
    projectId,
    name,
    configuredBiomeCounts: { Underworld: 4 },
  });
  const started = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: occurrence(`${projectId}-intro`),
  });
  return applyProjectCommand(started, catalog, {
    kind: 'ReplaceBiomeField',
    field: createBiomeFieldAddress(biome, 'maxNonGoalRewards'),
    value: 3,
  });
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
  let project = createIProject('i-materialized-fixture', 'I Materialized Fixture');
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBiomeField',
    field: createBiomeFieldAddress(biome, 'maxNonGoalRewards'),
    value: 5,
  });
  project = appendBatch(project, null, [{ occurrenceId: combat01, gameName: 'I_Combat01' }], 1);
  project = appendBatch(
    project,
    combat01,
    [
      { occurrenceId: combat03, gameName: 'I_Combat03' },
      { occurrenceId: occurrence('story'), gameName: 'I_Story01' },
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

function projectWithPickedStory(): ProjectDocument {
  const combat01 = occurrence('picked-story-combat01');
  const story = occurrence('picked-story');
  const combat05 = occurrence('picked-story-combat05');
  const combat06 = occurrence('picked-story-combat06');
  const combat07 = occurrence('picked-story-combat07');
  const combat08 = occurrence('picked-story-combat08');
  let project = createIProject('i-picked-story-fixture', 'I Picked Story Fixture');
  project = appendBatch(project, null, [{ occurrenceId: combat01, gameName: 'I_Combat01' }], 1);
  project = appendBatch(
    project,
    combat01,
    [
      { occurrenceId: occurrence('picked-story-declined-goal'), gameName: 'I_Combat03' },
      { occurrenceId: story, gameName: 'I_Story01' },
    ],
    2,
  );
  project = appendBatch(project, story, [{ occurrenceId: combat05, gameName: 'I_Combat05' }], 1);
  project = appendBatch(project, combat05, [{ occurrenceId: combat06, gameName: 'I_Combat06' }], 1);
  project = appendBatch(project, combat06, [{ occurrenceId: combat07, gameName: 'I_Combat07' }], 1);
  project = appendBatch(project, combat07, [{ occurrenceId: combat08, gameName: 'I_Combat08' }], 1);
  return appendBatch(
    project,
    combat08,
    [{ occurrenceId: occurrence('picked-story-preboss'), gameName: 'I_PreBoss02' }],
    1,
  );
}

function projectWithExhaustedLimitDomain(): ProjectDocument {
  const combat15 = occurrence('combat08');
  const combat18 = occurrence('exhausted-combat18');
  let project = applyProjectCommand(completeProject(), catalog, {
    kind: 'ReplaceOccurrenceRoom',
    occurrence: createOccurrenceAddress(biome, combat15),
    gameName: 'I_Combat15',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, { kind: 'occurrence', occurrenceId: combat15 }, 'exit2'),
    occurrenceId: combat18,
    gameName: 'I_Combat18',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(biome, { kind: 'occurrence', occurrenceId: combat15 }),
    value: { kind: 'normal', exitKey: 'exit2' },
  });
  return appendBatch(
    project,
    combat18,
    [
      { occurrenceId: occurrence('exhausted-preboss'), gameName: 'I_PreBoss02' },
      { occurrenceId: occurrence('exhausted-combat21'), gameName: 'I_Combat21' },
    ],
    2,
  );
}

function complete(project: ProjectDocument): CompleteBiomeCompletenessResult {
  const result = evaluateBiomeCompleteness(catalog, biome, plan(project));
  if (result.completion !== 'complete') {
    throw new Error(`fixture is incomplete: ${result.findings.map((finding) => finding.code)}`);
  }
  return result;
}

function carriedHHistory(): CanonicalBiomeHistory {
  const ledgers: HistoryLedgers = Object.freeze({
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
  const state: HistoryStateView = Object.freeze({ sequence: 100, ledgers });
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

function batches(snapshot: ReturnType<typeof materializeBiome>) {
  return snapshot.decisions.filter(
    (
      decision,
    ): decision is Extract<(typeof snapshot.decisions)[number], { readonly kind: 'batch' }> =>
      decision.kind === 'batch',
  );
}

describe('canonical I Clockwork materialization and history', () => {
  it('derives physical Goal and NonGoal offers before each generated batch', () => {
    const project = completeProject();
    const encodedBefore = encodeProjectDocument(project);
    const snapshot = materializeBiome(catalog, biome, complete(project));
    const snapshotBatches = batches(snapshot);

    expect(snapshot.entryRoom).toMatchObject({
      kind: 'authored',
      gameName: 'I_Intro',
      entered: true,
    });
    expect(
      snapshotBatches.slice(0, -1).map((batch) => {
        if (batch.batchState.kind !== 'clockwork') {
          throw new Error('fixture lost Clockwork batch state');
        }
        return [
          batch.batchState.goalsRemaining,
          batch.batchState.nonGoalRewardsAcquired,
          batch.batchState.maxNonGoalRewards,
        ];
      }),
    ).toEqual([
      [5, 0, 5],
      [4, 0, 5],
      [3, 0, 5],
      [3, 1, 5],
      [2, 1, 5],
      [2, 2, 5],
      [1, 2, 5],
      [1, 3, 5],
      [0, 3, 5],
    ]);
    expect(materializeBiome(catalog, biome, complete(project))).toEqual(snapshot);
    expect(
      snapshotBatches.slice(0, -1).map((batch) =>
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
        { picked: false, reward: undefined, concrete: 'Story' },
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
        { picked: true, reward: 'nonGoal', concrete: 'RoomMoneyTripleDrop' },
      ],
    ]);
    expect(snapshotBatches.at(-1)).toMatchObject({
      batchState: {
        kind: 'clockwork',
        goalsRemaining: 0,
        nonGoalRewardsAcquired: 4,
        maxNonGoalRewards: 5,
      },
      rewardStore: { kind: 'none' },
      selectedExitKey: 'exit1',
      targets: [
        {
          picked: true,
          continuation: 'startsCompletion',
          room: {
            gameName: 'I_PreBoss02',
            clockworkReward: 'goal',
            entryState: { kind: 'shop', profileKey: 'I_WorldShop' },
          },
        },
      ],
    });
    const prebosses = snapshotBatches
      .flatMap((batch) => batch.targets)
      .filter((target) => target.room.gameName === 'I_PreBoss02');
    expect(prebosses).toHaveLength(2);
    expect(prebosses.map((target) => target.room.entryState?.profileKey)).toEqual([
      undefined,
      'I_WorldShop',
    ]);
    expect(snapshot.completionRooms.map((room) => room.gameName)).toEqual([
      'I_Boss01',
      'I_PostBoss01',
    ]);
    expect(snapshot.biomeState).toEqual({ maxNonGoalRewards: 5 });
    expect(encodeProjectDocument(project)).toBe(encodedBefore);
  });

  it('carries H route state and advances Clockwork counters only at picked producer points', () => {
    const snapshot = materializeBiome(catalog, biome, complete(completeProject()));
    const snapshotBatches = batches(snapshot);
    const history = composeBiomeHistory(catalog, snapshot, carriedHHistory().afterTransition);
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
        clockworkMaxNonGoalRewards: 5,
      },
    });
    expect(
      events
        .filter((event) => event.kind === 'roomCreated')
        .slice(0, 2)
        .map((event) => ({ gameName: event.gameName, source: event.source })),
    ).toEqual([
      { gameName: 'I_Intro', source: 'biomeEntry' },
      { gameName: 'I_Combat01', source: 'generatedTarget' },
    ]);
    const firstGenerated = events.find(
      (event) => event.kind === 'roomCreated' && event.gameName === 'I_Combat01',
    );
    expect(firstGenerated).toMatchObject({
      source: 'generatedTarget',
      parentOrigin: { kind: 'occurrence' },
    });
    expect(events.filter((event) => event.kind === 'clockworkBatchStateRecorded')).toHaveLength(10);
    expect(events.filter((event) => event.kind === 'clockworkGoalAcquired')).toHaveLength(6);
    expect(events.filter((event) => event.kind === 'clockworkNonGoalRewardSpawned')).toHaveLength(
      4,
    );

    const pickedNonGoal = snapshotBatches[2]?.targets[1]?.room.origin;
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
      roomHistoryOrdinal: 43,
      clockworkGoalsRemaining: 0,
      clockworkNonGoalRewardsAcquired: 4,
      clockworkMaxNonGoalRewards: 5,
    });
    expect(history.afterTransition.ledgers.counters).toMatchObject({
      biomeDepthCache: 0,
      biomeEncounterDepth: 0,
      routeEncounterDepth: 29,
      roomHistoryOrdinal: 43,
      clockworkGoalsRemaining: 0,
      clockworkNonGoalRewardsAcquired: 4,
    });

    const firstBatch = snapshotBatches[0];
    if (firstBatch?.batchState.kind !== 'clockwork') {
      throw new Error('fixture lost first Clockwork batch');
    }
    const malformed = {
      ...snapshot,
      decisions: [
        {
          ...firstBatch,
          batchState: { ...firstBatch.batchState, goalsRemaining: 4 },
        },
        ...snapshot.decisions.slice(1),
      ],
    };
    expect(() =>
      composeBiomeHistory(catalog, malformed, carriedHHistory().afterTransition),
    ).toThrowError(HistoryFoldContractError);
  });

  it('enters an authored Story without changing either Clockwork counter', () => {
    const project = projectWithPickedStory();
    const snapshot = materializeBiome(catalog, biome, complete(project));
    const snapshotBatches = batches(snapshot);
    const history = composeBiomeHistory(catalog, snapshot, carriedHHistory().afterTransition);
    const storyTarget = snapshotBatches[1]?.targets[1];

    expect(storyTarget).toMatchObject({
      picked: true,
      room: {
        gameName: 'I_Story01',
        incomingReward: { offer: { rewardType: 'Story' } },
      },
    });
    expect(storyTarget?.room.clockworkReward).toBeUndefined();
    expect(snapshotBatches.slice(0, -1).map((batch) => batch.batchState)).toMatchObject([
      { goalsRemaining: 5, nonGoalRewardsAcquired: 0 },
      { goalsRemaining: 4, nonGoalRewardsAcquired: 0 },
      { goalsRemaining: 4, nonGoalRewardsAcquired: 0 },
      { goalsRemaining: 3, nonGoalRewardsAcquired: 0 },
      { goalsRemaining: 2, nonGoalRewardsAcquired: 0 },
      { goalsRemaining: 1, nonGoalRewardsAcquired: 0 },
    ]);
    expect(history.events.filter((event) => event.kind === 'clockworkGoalAcquired')).toHaveLength(
      6,
    );
    expect(
      history.events.filter((event) => event.kind === 'clockworkNonGoalRewardSpawned'),
    ).toHaveLength(0);
    expect(
      history.events
        .filter(
          (event) =>
            'origin' in event &&
            JSON.stringify(event.origin) === JSON.stringify(storyTarget?.room.origin),
        )
        .filter(
          (event) =>
            event.kind === 'clockworkGoalAcquired' ||
            event.kind === 'clockworkNonGoalRewardSpawned',
        ),
    ).toEqual([]);
    expect(history.biomeCompletion.ledgers.counters).toMatchObject({
      clockworkGoalsRemaining: 0,
      clockworkNonGoalRewardsAcquired: 0,
    });
  });

  it('rejects a two-exit room after the authored non-goal limit is exhausted', () => {
    const project = projectWithExhaustedLimitDomain();
    const snapshot = materializeBiomePrefix(catalog, biome, plan(project));
    if (snapshot === null || snapshot.entryRoom === undefined) {
      throw new Error('exhausted Clockwork fixture did not materialize a prefix');
    }
    const prefix = Object.freeze({ ...snapshot, entryRoom: snapshot.entryRoom });
    const history = composeBiomeHistoryPrefix(catalog, prefix, carriedHHistory().afterTransition);
    if (history === null) throw new Error('exhausted Clockwork fixture has no history');
    const generation = evaluateBiomeRoomGeneration(catalog, prefix, history, 4);
    const target = createTargetAddress(
      biome,
      { kind: 'occurrence', occurrenceId: occurrence('exhausted-combat18') },
      'exit2',
    );
    expect(generation.findings).toContainEqual(
      expect.objectContaining({
        code: 'targetRoomUnavailable',
        origin: target,
      }),
    );
    expect(
      generation.forcePressure.find(
        (entry) => JSON.stringify(entry.targetOrigin) === JSON.stringify(target),
      ),
    ).toMatchObject({
      selectedGameName: 'I_Combat21',
      selectedPossible: false,
      selectedExclusions: [
        {
          kind: 'eligibilityRequirement',
          evaluation: {
            kind: 'clockworkNonGoalCapacity',
            satisfied: false,
            acquired: 5,
            maximum: 5,
            reserve: 1,
          },
        },
      ],
    });
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
    const snapshot = materializeBiome(catalog, biome, complete(project));
    const snapshotBatches = batches(snapshot);
    const history = composeBiomeHistory(catalog, snapshot, carriedHHistory().afterTransition);
    const devotionOrigin = snapshotBatches[2]?.targets[1]?.room.origin;
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

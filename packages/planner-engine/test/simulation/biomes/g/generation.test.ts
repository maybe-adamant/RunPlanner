import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createTargetAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import type { Catalog, RoomDeclaration } from '@run-planner/engine/catalog-schema';
import {
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
  evaluateTakeoverPrebossBatchCandidate,
  simulateProject,
} from '@run-planner/engine/simulation';

import {
  createCompleteFGProject,
  goldenGBiome,
  goldenGOccurrenceId,
  goldenGStartId,
} from '@run-planner/test-fixtures';

function catalogWithRoom(room: RoomDeclaration): Catalog {
  return Object.freeze({
    ...catalog,
    rooms: Object.freeze({
      ...catalog.rooms,
      values: Object.freeze(
        catalog.rooms.values.map((candidate) =>
          candidate.gameName === room.gameName ? room : candidate,
        ),
      ),
      byKey: Object.freeze({ ...catalog.rooms.byKey, [room.gameName]: room }),
    }),
  });
}

function completeG(project = createCompleteFGProject()) {
  const result = simulateProject(catalog, project);
  const g = result.routes
    .find((route) => route.routeKey === 'Underworld')
    ?.biomes.find((biome) => biome.biomeKey === 'G');
  if (g?.authoring !== 'complete') throw new Error('Golden G fixture is incomplete');
  return { result, g };
}

describe('G generation and takeover', () => {
  it('does not let an aggregate-invalid three-door takeover suppress ordinary Door 1 support', () => {
    let project = createCompleteFGProject();
    const plan = project.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'G');
    if (plan?.topology === null || plan === undefined) throw new Error('G topology is missing');
    const takeover = plan.topology.decisions.find(
      (candidate) =>
        candidate.kind === 'exit' &&
        candidate.normal.kind === 'batch' &&
        candidate.normal.targets.some(
          (target) =>
            plan.topology?.occurrences.find(
              (occurrence) => occurrence.occurrenceId === target.occurrenceId,
            )?.gameName === 'G_PreBoss01',
        ),
    );
    if (takeover?.kind !== 'exit') throw new Error('G takeover decision is missing');
    const decision = createExitDecisionAddress(goldenGBiome, takeover.source);
    const target = createTargetAddress(goldenGBiome, takeover.source, 'exit1');
    project = applyProjectCommand(project, catalog, { kind: 'RemoveExitDecision', decision });
    project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(goldenGBiome, takeover.source),
      storeKey: 'RunProgress',
    });

    const preboss = catalog.rooms.byKey.G_PreBoss01;
    if (preboss === undefined) throw new Error('G Preboss declaration is missing');
    const cappedCatalog = catalogWithRoom(
      Object.freeze({
        ...preboss,
        caps: Object.freeze({ ...preboss.caps, maxCreationsThisRun: 1 }),
      }),
    );
    const session = createPreparedProjectCandidateSession(
      cappedCatalog,
      simulateProjectAssembly(cappedCatalog, project),
    );
    const ordinaryGameNames = cappedCatalog.rooms.values
      .filter(
        (room) =>
          room.biomeKey === 'G' &&
          room.mode.kind === 'authored' &&
          room.prebossBatchPolicy?.kind !== 'takeOverNormalDoors',
      )
      .map((room) => room.gameName);
    const [takeoverCandidate, ...ordinaryCandidates] = session.evaluate([
      { kind: 'takeoverPrebossBatch' as const, source: decision, gameName: 'G_PreBoss01' },
      ...ordinaryGameNames.map((gameName) =>
        Object.freeze({ kind: 'roomTarget' as const, target, gameName }),
      ),
    ]);

    expect(takeoverCandidate).toMatchObject({
      kind: 'takeoverPrebossBatch',
      result: {
        support: 'impossible',
        selectedPossible: false,
        pressure: expect.arrayContaining([
          expect.objectContaining({
            selectedExclusionReasons: expect.arrayContaining(['maxCreationsThisRun']),
          }),
        ]),
      },
    });
    expect(
      ordinaryCandidates.some(
        (candidate) =>
          candidate.kind === 'roomTarget' &&
          candidate.result.pressure.selectedPossible &&
          !candidate.result.pressure.requiredForcedRoomGameNames.includes('G_PreBoss01'),
      ),
      JSON.stringify(ordinaryCandidates),
    ).toBe(true);
  });

  it('carries the validated F prefix through G’s fixed intro, ordinary spine, and completion', () => {
    const { result, g } = completeG();
    const f = result.routes[0]?.biomes[0];
    if (f?.authoring !== 'complete') throw new Error('Golden F prefix is unavailable');

    expect(result.status).toBe('valid');
    expect(result.routes[0]?.processing.completeValidPrefix).toEqual(['F', 'G']);
    expect(g.validity).toBe('valid');
    expect(g.snapshot.entryRoom).toMatchObject({
      gameName: 'G_Intro',
      lifecycleProfileKey: 'RewardlessRoom',
    });
    expect(g.snapshot.completionRooms.map((room) => room.gameName)).toEqual([
      'G_Boss01',
      'G_PostBoss01',
    ]);
    expect(g.history.events[0]).toMatchObject({
      kind: 'biomeStarted',
      counters: {
        routeEncounterDepth: f.history.afterTransition.ledgers.counters.routeEncounterDepth,
        roomHistoryOrdinal: f.history.afterTransition.ledgers.counters.roomHistoryOrdinal,
      },
    });
    expect(
      g.history.ledgers.encounterStarts.some(
        (entry) => entry.baselineEncounterKey === 'GeneratedG_ExtraDoor',
      ),
    ).toBe(false);
    expect(
      g.roomGeneration.ordinary.forcePressure.find(
        (entry) => entry.selectedGameName === 'G_Shop01',
      ),
    ).toMatchObject({
      biomeDepthCache: 5,
      selectedPossible: true,
      requiredForcedRoomGameNames: ['G_Shop01'],
    });
    expect(
      evaluateTakeoverPrebossBatchCandidate(
        catalog,
        g.snapshot,
        g.history,
        createExitDecisionAddress(goldenGBiome, {
          kind: 'occurrence',
          occurrenceId: goldenGOccurrenceId(7, 1),
        }),
        'G_PreBoss01',
        2,
      ),
    ).toMatchObject({
      gameName: 'G_PreBoss01',
      support: 'required',
      selectedPossible: true,
      pressure: expect.arrayContaining([
        expect.objectContaining({ biomeDepthCache: 8, selectedPossible: true }),
      ]),
    });
  });

  it('does not assess a later batch store or takeover after an earlier reward failure', () => {
    const project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(goldenGBiome, goldenGOccurrenceId(1, 1)),
      value: { rewardType: 'MetaCurrencyDrop' },
    });
    const session = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );
    const results = session.evaluate([
      {
        kind: 'batchRewardStore',
        rewardStore: createBatchRewardStoreAddress(goldenGBiome, {
          kind: 'occurrence',
          occurrenceId: goldenGOccurrenceId(1, 1),
        }),
        storeKey: 'MetaProgress',
      },
      {
        kind: 'takeoverPrebossBatch',
        source: createExitDecisionAddress(goldenGBiome, {
          kind: 'occurrence',
          occurrenceId: goldenGOccurrenceId(7, 1),
        }),
        gameName: 'G_PreBoss01',
      },
    ]);

    expect(results).toMatchObject([
      { kind: 'unavailable', reason: 'coverageNotReached' },
      { kind: 'unavailable', reason: 'coverageNotReached' },
    ]);
  });

  it('preserves Crawler’s non-counting encounter and excludes entered miniboss peers', () => {
    const project = createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' });
    const { g, result } = completeG(project);
    const crawlerOrigin = createOccurrenceAddress(goldenGBiome, goldenGOccurrenceId(6, 1));
    const crawler = g.history.rooms.find(
      (room) => semanticAddressKey(room.origin) === semanticAddressKey(crawlerOrigin),
    );

    expect(result.status).toBe('valid');
    expect(g.validity).toBe('valid');
    expect(
      g.history.ledgers.encounterStarts.find(
        (entry) => semanticAddressKey(entry.origin) === semanticAddressKey(crawlerOrigin),
      ),
    ).toMatchObject({ gameName: 'G_MiniBoss02', baselineEncounterKey: 'MiniBossCrawler' });
    expect(crawler?.preOutgoing?.ledgers.counters.biomeEncounterDepth).toBe(
      crawler?.entry.ledgers.counters.biomeEncounterDepth,
    );

    const session = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );
    for (const gameName of ['G_MiniBoss01', 'G_MiniBoss03']) {
      const candidate = session.evaluate([
        {
          kind: 'roomTarget',
          target: createTargetAddress(
            goldenGBiome,
            { kind: 'occurrence', occurrenceId: goldenGOccurrenceId(6, 1) },
            'exit1',
          ),
          gameName,
        },
      ])[0];
      expect(candidate).toMatchObject({
        kind: 'roomTarget',
        result: { pressure: { selectedPossible: false } },
      });
      if (candidate?.kind !== 'roomTarget') {
        throw new Error(`${gameName} candidate context is unavailable`);
      }
      expect(candidate.result.pressure.selectedExclusionReasons).toContain(
        'eligibilityRequirement',
      );
    }
  });

  it('materializes a declaration-ordered three-door takeover batch', () => {
    const { result, g } = completeG(createCompleteFGProject({ prebossSource: 'G_Combat14' }));
    const takeover = g.snapshot.decisions.at(-1);
    if (takeover?.kind !== 'batch') throw new Error('Golden G fixture lost its takeover batch');

    expect(result.status).toBe('valid');
    expect(
      takeover.targets.map((target) => ({
        exitKey: target.exit.exitKey,
        gameName: target.room.gameName,
        producerKind: target.room.incomingReward?.producerKind,
        hasShop: target.room.entryState?.kind === 'shop',
      })),
    ).toEqual([
      { exitKey: 'exit1', gameName: 'G_PreBoss01', producerKind: 'shop', hasShop: true },
      { exitKey: 'exit2', gameName: 'G_PreBoss01', producerKind: 'freeReward', hasShop: false },
      { exitKey: 'exit3', gameName: 'G_PreBoss01', producerKind: 'freeReward', hasShop: false },
    ]);
  });

  it('retains a complete invalid G product at the exact target owner', () => {
    const project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenGBiome, goldenGOccurrenceId(1, 1)),
      gameName: 'G_Combat10',
    });
    const { result, g } = completeG(project);
    const target = createTargetAddress(
      goldenGBiome,
      { kind: 'occurrence', occurrenceId: goldenGStartId },
      'exit1',
    );

    expect(result.status).toBe('invalid');
    expect(result.routes[0]?.processing).toEqual({
      completeValidPrefix: ['F'],
      active: { kind: 'invalid', biomeKey: 'G' },
      blockedSuffix: [],
    });
    expect(g.validity).toBe('invalid');
    expect(g.findings).toContainEqual(
      expect.objectContaining({ code: 'targetRoomUnavailable', origin: target }),
    );
  });

  it('reports invalid G reward-bag entries at the incoming reward owner', () => {
    const reward = createIncomingRewardAddress(goldenGBiome, goldenGOccurrenceId(1, 1));
    const project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'MetaCurrencyDrop' },
    });
    const { g } = completeG(project);

    expect(g.rewards.validity).toBe('invalid');
    expect(g.rewards.findings).toContainEqual(
      expect.objectContaining({ code: 'rewardBagEntryUnavailable', origin: reward }),
    );
  });

  it('seeds invalid G room and reward repairs from the complete F history and reward branches', () => {
    const roomProject = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenGBiome, goldenGOccurrenceId(1, 1)),
      gameName: 'G_Combat10',
    });
    const { result: roomEvaluation } = completeG(roomProject);
    const f = roomEvaluation.routes[0]?.biomes.find((biome) => biome.biomeKey === 'F');
    if (f?.authoring !== 'complete')
      throw new Error('G repair fixture must retain complete F history');
    const room = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, roomProject),
    ).evaluate({
      kind: 'roomTarget',
      target: createTargetAddress(
        goldenGBiome,
        { kind: 'occurrence', occurrenceId: goldenGStartId },
        'exit1',
      ),
      gameName: 'G_Combat01',
    });
    expect(room).toMatchObject({
      kind: 'roomTarget',
      result: { pressure: { selectedPossible: true } },
    });
    if (room.kind !== 'roomTarget') throw new Error('invalid G room repair is unavailable');
    expect(room.result.pressure.beforeSequence).toBeGreaterThan(f.history.afterTransition.sequence);

    const reward = createIncomingRewardAddress(goldenGBiome, goldenGOccurrenceId(1, 1));
    const rewardProject = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'MetaCurrencyDrop' },
    });
    const candidate = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, rewardProject),
    ).evaluate({ kind: 'incomingReward', reward, value: { rewardType: 'MetaCurrencyDrop' } });

    expect(candidate).toMatchObject({
      kind: 'incomingReward',
      result: {
        supported: false,
        findings: [expect.objectContaining({ code: 'rewardBagEntryUnavailable', origin: reward })],
      },
    });
  });

  it('evaluates G room, store, and reward candidates through semantic owners', () => {
    const project = createCompleteFGProject();
    const session = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );
    const source = { kind: 'occurrence' as const, occurrenceId: goldenGStartId };
    const [room, store, reward] = session.evaluate([
      {
        kind: 'roomTarget',
        target: createTargetAddress(goldenGBiome, source, 'exit1'),
        gameName: 'G_Combat02',
      },
      {
        kind: 'batchRewardStore',
        rewardStore: createBatchRewardStoreAddress(goldenGBiome, source),
        storeKey: 'RunProgress',
      },
      {
        kind: 'incomingReward',
        reward: createIncomingRewardAddress(goldenGBiome, goldenGOccurrenceId(1, 1)),
        value: { rewardType: 'MaxHealthDrop' },
      },
    ]);

    expect(room).toMatchObject({
      kind: 'roomTarget',
      result: { pressure: { selectedGameName: 'G_Combat02', selectedPossible: true } },
    });
    expect(store).toMatchObject({
      kind: 'batchRewardStore',
      result: { selectedStoreKey: 'RunProgress', selectedPossible: true },
    });
    expect(reward).toMatchObject({ kind: 'incomingReward', result: { supported: true } });
  });
});

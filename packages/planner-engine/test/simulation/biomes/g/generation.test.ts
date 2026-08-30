import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createOccurrenceAddress,
  createTargetAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
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
} from '@run-planner/test-fixtures/underworld';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';

function completeG(project = createCompleteFGProject()) {
  const result = simulateProject(catalog, project);
  const g = result.routes
    .find((route) => route.routeKey === 'Underworld')
    ?.biomes.find((biome) => biome.biomeKey === 'G');
  if (g?.authoring !== 'complete') throw new Error('Golden G fixture is incomplete');
  return { result, g };
}

describe('G generation and takeover', () => {
  it('carries F Postboss through G Intro and a selected G Preboss free reward', () => {
    let project = createCompleteFGProject({ prebossSource: 'G_Combat14' });
    const source = { kind: 'occurrence' as const, occurrenceId: goldenGOccurrenceId(7, 1) };
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenGBiome, source),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(
        goldenGBiome,
        createOccurrenceId('golden-g-preboss-free-2'),
      ),
      value: { rewardType: 'HermesUpgrade' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(
        goldenGBiome,
        createOccurrenceId('golden-g-preboss-free-3'),
      ),
      value: { rewardType: 'StackUpgrade' },
    });
    const result = simulateProject(catalog, authorLegalTraitOffers(project));
    const g = result.routes[0]?.biomes.find((biome) => biome.biomeKey === 'G');

    expect(result.findings).toEqual([]);
    expect(g).toMatchObject({ authoring: 'complete', validity: 'valid' });
  });

  it('carries the validated F prefix through G’s fixed intro, ordinary spine, and completion', () => {
    const { result, g } = completeG();
    const f = result.routes[0]?.biomes[0];
    if (f?.authoring !== 'complete' || f.validity !== 'valid' || g.validity !== 'valid') {
      throw new Error('Golden F/G prefix is unavailable');
    }

    expect(result.status).toBe('valid');
    expect(result.routes[0]?.processing.completeValidPrefix).toEqual(['F', 'G']);
    expect(g.validity).toBe('valid');
    expect(g.snapshot.entryRoom).toMatchObject({
      gameName: 'G_Intro',
      lifecycleProfileKey: 'RewardlessRoom',
    });
    expect(g.snapshot.fixedRoomLinks.map((link) => link.target.gameName)).toEqual([
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
        (entry) => entry.encounterKey === 'GeneratedG_ExtraDoor',
      ),
    ).toBe(false);
    expect(
      g.roomGeneration.ordinary.ordinaryBatches
        .flatMap((batch) => batch.targets.map((target) => target.pressure))
        .find((entry) => entry.selectedGameName === 'G_Shop01'),
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

  it('keeps a selected reward replaceable while its current trait child is unresolved', () => {
    const source = {
      kind: 'occurrence' as const,
      occurrenceId: goldenGOccurrenceId(2, 1),
    };
    const occurrenceId = goldenGOccurrenceId(3, 3);
    const reward = createIncomingRewardAddress(goldenGBiome, occurrenceId);
    let project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenGBiome, source),
      value: { kind: 'normal', exitKey: 'exit3' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'HermesUpgrade' },
    });
    const session = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );

    expect(
      session.evaluate({
        kind: 'incomingReward',
        reward,
        value: { rewardType: 'MaxHealthDrop' },
      }),
    ).toMatchObject({ kind: 'incomingReward', result: { supported: true, findings: [] } });
    expect(
      session.evaluate({
        kind: 'incomingReward',
        reward,
        value: { rewardType: 'RoomMoneyDrop' },
      }),
    ).toMatchObject({ kind: 'incomingReward', result: { supported: true, findings: [] } });
  });

  it('preserves Crawler’s non-counting encounter and excludes entered miniboss peers', () => {
    const project = createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' });
    const { g, result } = completeG(project);
    if (g.validity !== 'valid') throw new Error('Crawler fixture must be valid');
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
    ).toMatchObject({ gameName: 'G_MiniBoss02', encounterKey: 'MiniBossCrawler' });
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
    if (g.validity !== 'valid') throw new Error('Golden G fixture must be valid');
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

  it('composes the alternate miniboss and Preboss deltas from one saved F/G checkpoint', () => {
    const { result, g } = completeG(
      createCompleteFGProject({
        pickedMiniboss: 'G_MiniBoss02',
        prebossSource: 'G_Combat14',
      }),
    );
    if (g.validity !== 'valid') throw new Error('Alternate G fixture must be valid');
    const crawlerOrigin = createOccurrenceAddress(goldenGBiome, goldenGOccurrenceId(6, 1));
    const takeover = g.snapshot.decisions.at(-1);

    expect(result.status).toBe('valid');
    expect(
      g.history.ledgers.encounterStarts.find(
        (entry) => semanticAddressKey(entry.origin) === semanticAddressKey(crawlerOrigin),
      ),
    ).toMatchObject({ encounterKey: 'MiniBossCrawler', gameName: 'G_MiniBoss02' });
    expect(takeover?.kind).toBe('batch');
    expect(
      takeover?.kind === 'batch' ? takeover.targets.map((target) => target.exit.exitKey) : [],
    ).toEqual(['exit1', 'exit2', 'exit3']);
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
    if (f?.authoring !== 'complete' || f.validity !== 'valid')
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

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createExitDecisionAddress,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createIncomingRewardAddress,
  createLocalChildAddress,
  createLocalChildGroupAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createProjectDocument,
  createShopOfferAddress,
  encodeProjectDocument,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { factsWithHistory, type RewardKernelFacts } from '@run-planner/engine/reward-kernel';
import {
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
  simulateProject,
} from '@run-planner/engine/simulation';
import { createDefaultTraitOffers } from '../../../../src/authored-project/traits';
import { createTestArcanaFearState } from '../../../support/arcana-fear';
import { materializeHubDecision } from '../../../../src/simulation/materialization';
import {
  initializeRewardBranches,
  settleOwnedAcquisitionSite,
} from '../../../../src/simulation/rewards/processing';
import { describe, expect, it } from 'vitest';

import {
  appendCompleteN,
  createRepresentativeNProject,
  nBiome,
  nOccurrenceId,
  nOccurrenceIds,
  nOpenSlotKeys,
  authorLegalTraitOffers,
} from '@run-planner/test-fixtures';

function completeN(project = createRepresentativeNProject()) {
  project = authorLegalTraitOffers(project);
  const evaluation = simulateProject(catalog, project);
  const biome = evaluation.routes
    .find((route) => route.routeKey === 'Surface')
    ?.biomes.find((candidate) => candidate.biomeKey === 'N');
  if (biome?.authoring !== 'complete') throw new Error('N fixture did not complete');
  return { project, evaluation, biome };
}

function validN(project = createRepresentativeNProject()) {
  const result = completeN(project);
  if (result.biome.validity !== 'valid') throw new Error('N fixture did not complete-valid');
  return { ...result, biome: result.biome };
}

describe('N Hub rewards, validation, and candidates', () => {
  it('owns takeover candidates only at the completed Hub decision', () => {
    const openingId = nOccurrenceId('candidate-opening-domain');
    const openingOnly = applyProjectCommand(
      createProjectDocument(catalog, {
        projectId: 'candidate-n-opening-domain',
        name: 'N opening candidate domain',
        configuredBiomeCounts: { Surface: 1 },
      }),
      catalog,
      { kind: 'CreateStart', biome: nBiome, occurrenceId: openingId },
    );
    const openingSession = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, openingOnly),
    );

    expect(() =>
      openingSession.evaluate({
        kind: 'takeoverPrebossBatch',
        source: createExitDecisionAddress(nBiome, {
          kind: 'occurrence',
          occurrenceId: openingId,
        }),
        gameName: 'N_PreBoss01',
      }),
    ).toThrow(/no declaration-owned takeover Preboss candidate domain/);

    const withoutHandoff = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision: createExitDecisionAddress(nBiome, {
        kind: 'hubDecision',
        decisionKey: 'hub',
      }),
    });
    expect(
      createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, withoutHandoff),
      ).evaluate({
        kind: 'takeoverPrebossBatch',
        source: createExitDecisionAddress(nBiome, {
          kind: 'hubDecision',
          decisionKey: 'hub',
        }),
        gameName: 'N_PreBoss01',
      }),
    ).toMatchObject({
      kind: 'takeoverPrebossBatch',
      result: { requiredExitKeys: ['preboss'], selectedPossible: true },
    });
  });

  it('consumes the physical board while acquiring only the six visited target rewards', () => {
    const { biome } = validN();
    const hub = biome.snapshot.decisions.find((decision) => decision.kind === 'hub');
    if (hub?.kind !== 'hub') throw new Error('fixture lost Hub decision');
    const boardOrigins = new Set(
      hub.board.targets.map((target) => semanticAddressKey(target.room.incomingReward!.origin)),
    );
    const offered = biome.rewards.branches.flatMap((branch) =>
      branch.events.filter((event) => event.kind === 'rewardOffered'),
    );
    const acquired = biome.rewards.branches.flatMap((branch) =>
      branch.events.filter((event) => event.kind === 'concreteAcquisition'),
    );

    expect(biome.rewards.validity).toBe('valid');
    const offeredOrigins = new Set(offered.map((event) => semanticAddressKey(event.origin)));
    expect([...boardOrigins].every((origin) => offeredOrigins.has(origin))).toBe(true);
    expect(
      offered.filter((event) => boardOrigins.has(semanticAddressKey(event.origin))),
    ).toHaveLength(9);
    expect(
      acquired
        .filter((event) => boardOrigins.has(semanticAddressKey(event.origin)))
        .map((event) => event.origin),
    ).toHaveLength(6);
    expect(
      hub.visits.map((visit) => semanticAddressKey(visit.target.room.incomingReward!.origin)),
    ).toEqual(
      expect.arrayContaining(
        acquired
          .filter((event) => boardOrigins.has(semanticAddressKey(event.origin)))
          .map((event) => semanticAddressKey(event.origin)),
      ),
    );
    for (const visit of hub.visits) {
      const incoming = visit.target.room.incomingReward;
      if (incoming === undefined) throw new Error('fixture lost visited target reward');
      const site = createAcquisitionSiteAddress(visit.origin, 'roomRewardPickup');
      const acquisition = acquired.find(
        (event) => semanticAddressKey(event.origin) === semanticAddressKey(incoming.origin),
      );
      expect(acquisition).toMatchObject({ settlement: { site } });
      expect(acquisition?.settlement?.entry.site).toEqual(site);
    }
    const unvisitedHammer = hub.board.targets.find((target) => target.hubSlotKey === 'combat03');
    if (unvisitedHammer?.room.incomingReward === undefined) {
      throw new Error('fixture lost the unvisited N hammer reward');
    }
    expect(
      acquired.some(
        (event) =>
          semanticAddressKey(event.origin) ===
          semanticAddressKey(unvisitedHammer.room.incomingReward!.origin),
      ),
    ).toBe(false);
    expect(
      biome.rewards.branches[0]?.bags.HubRewards?.remainingEntryCounts.reduce(
        (total, count) => total + count,
        0,
      ),
    ).toBe(2);
  });

  it('rejects an authored open set that violates the explicit miniboss constraint', () => {
    expect(() =>
      applyProjectCommand(createRepresentativeNProject(), catalog, {
        kind: 'OpenHubSlot',
        slot: createHubSlotAddress(nBiome, 'hub', 'miniBoss02'),
        occurrenceId: nOccurrenceId('miniBoss02'),
      }),
    ).toThrow(/Hub open-slot constraint excludes miniBoss02/);
  });

  it('keeps unavailable side generation and its local reward owner precise', () => {
    let project = createRepresentativeNProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSideRoomEntryOrder',
      group: createLocalChildGroupAddress(nBiome, nOccurrenceId('combat05'), 'sideRooms'),
      enteredSlotKeys: ['sideDoor2'],
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSideRoomGeneration',
      sideRoom: createLocalChildAddress(
        nBiome,
        nOccurrenceId('combat05'),
        'sideRooms',
        'sideDoor1',
      ),
      generation: 'notGenerated',
    });
    const { biome } = completeN(project);

    expect(biome.validity).toBe('invalid');
    expect(biome.findings).toContainEqual(
      expect.objectContaining({
        code: 'sideRoomGenerationUnavailable',
        origin: createLocalChildAddress(
          nBiome,
          nOccurrenceId('combat05'),
          'sideRooms',
          'sideDoor1',
        ),
      }),
    );
  });

  it('keeps the blocked side-generation owner assessable for repair', () => {
    let project = createRepresentativeNProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSideRoomEntryOrder',
      group: createLocalChildGroupAddress(nBiome, nOccurrenceId('combat05'), 'sideRooms'),
      enteredSlotKeys: ['sideDoor2'],
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSideRoomGeneration',
      sideRoom: createLocalChildAddress(
        nBiome,
        nOccurrenceId('combat05'),
        'sideRooms',
        'sideDoor1',
      ),
      generation: 'notGenerated',
    });
    const blockedSideRoom = createLocalChildAddress(
      nBiome,
      nOccurrenceId('combat05'),
      'sideRooms',
      'sideDoor1',
    );
    const hub = createHubDecisionAddress(nBiome, 'hub');
    const laterSideRoom = createLocalChildAddress(
      nBiome,
      nOccurrenceId('combat02'),
      'sideRooms',
      'sideDoor1',
    );
    const withLaterViolation = applyProjectCommand(project, catalog, {
      kind: 'ReplaceLocalReward',
      reward: createLocalRewardAddress(nBiome, nOccurrenceId('combat02'), 'sideRooms', 'sideDoor1'),
      value: { rewardType: 'AirBoost' },
    });
    const candidates = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );
    const blockedQuery = {
      kind: 'sideRoomGeneration' as const,
      sideRoom: blockedSideRoom,
      generation: 'notGenerated' as const,
    };
    const blockedCandidate = candidates.evaluate(blockedQuery);

    expect(blockedCandidate).toMatchObject({
      kind: 'sideRoomGeneration',
      result: { selectedPossible: false, supportOutcomes: ['generated'] },
    });
    expect(
      createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, withLaterViolation),
      ).evaluate(blockedQuery),
    ).toEqual(blockedCandidate);
    expect(
      candidates.evaluate({
        kind: 'sideRoomGeneration',
        sideRoom: laterSideRoom,
        generation: 'generated',
      }),
    ).toMatchObject({
      kind: 'unavailable',
      reason: 'coverageNotReached',
      evidence: {
        requiredOwner: laterSideRoom,
        requiredCheckpoint: 'afterTargetGeneration',
      },
    });
    expect(
      candidates.evaluate({
        kind: 'hubVisitOrder',
        hub,
        hubSlotKeys: ['combat05', 'miniBoss01', 'combat02'],
      }),
    ).toMatchObject({
      kind: 'hubVisitOrder',
      result: {
        selectedPossible: true,
        findings: [
          expect.objectContaining({
            code: 'sideRoomGenerationUnavailable',
            origin: blockedSideRoom,
          }),
        ],
      },
    });
  });

  it('keeps invalid board rewards attached to their incoming-reward owner', () => {
    const project = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat10')),
      value: { rewardType: 'WeaponUpgrade' },
    });
    const { biome } = completeN(project);

    expect(biome.validity).toBe('invalid');
    expect(biome.findings).toContainEqual(
      expect.objectContaining({
        code: 'rewardBagEntryUnavailable',
        origin: createIncomingRewardAddress(nBiome, nOccurrenceId('combat10')),
      }),
    );
  });

  it('retains the invalid board region while keeping structural Hub order proposals authorable', () => {
    const project = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat10')),
      value: { rewardType: 'WeaponUpgrade' },
    });
    const candidates = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );

    expect(
      candidates.evaluate({
        kind: 'hubVisitOrder',
        hub: createHubDecisionAddress(nBiome, 'hub'),
        hubSlotKeys: ['combat05', 'miniBoss01', 'combat02', 'combat11', 'combat23', 'combat09'],
      }),
    ).toMatchObject({ kind: 'hubVisitOrder', result: { selectedPossible: true } });
    expect(
      candidates.evaluate({
        kind: 'sideRoomGeneration',
        sideRoom: createLocalChildAddress(
          nBiome,
          nOccurrenceId('combat05'),
          'sideRooms',
          'sideDoor1',
        ),
        generation: 'generated',
      }),
    ).toMatchObject({ kind: 'unavailable', reason: 'coverageNotReached' });
    expect(
      candidates.evaluate({
        kind: 'sideRoomEntryOrder',
        group: createLocalChildGroupAddress(nBiome, nOccurrenceId('combat05'), 'sideRooms'),
        enteredSlotKeys: ['sideDoor1', 'sideDoor2'],
      }),
    ).toMatchObject({
      kind: 'sideRoomEntryOrder',
      result: { candidateEnteredSlotKeys: ['sideDoor1', 'sideDoor2'] },
    });
  });

  it('assesses an aggregate visit prefix when current board findings block later evaluation', () => {
    let project = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat10')),
      value: { rewardType: 'WeaponUpgrade' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'RemoveExitDecision',
      decision: createExitDecisionAddress(nBiome, { kind: 'hubDecision', decisionKey: 'hub' }),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceHubVisitOrder',
      hub: createHubDecisionAddress(nBiome, 'hub'),
      hubSlotKeys: ['combat05', 'miniBoss01', 'combat02'],
    });
    const evaluation = simulateProject(catalog, project);
    const biome = evaluation.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((candidate) => candidate.biomeKey === 'N');

    expect(biome).toMatchObject({ authoring: 'incomplete', coverage: { kind: 'prefix' } });
    expect(
      createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, project),
      ).evaluate({
        kind: 'hubVisitOrder',
        hub: createHubDecisionAddress(nBiome, 'hub'),
        hubSlotKeys: ['combat05', 'miniBoss01', 'combat02', 'combat09'],
      }),
    ).toMatchObject({ kind: 'hubVisitOrder', result: { selectedPossible: true } });
  });

  it('permits the audited ten-target peer-source repeat without changing physical-board ownership', () => {
    let project = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'OpenHubSlot',
      slot: createHubSlotAddress(nBiome, 'hub', 'combat12'),
      occurrenceId: nOccurrenceId('combat12'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat12')),
      value: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' },
      },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nOccurrenceId('miniBoss01')),
      value: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'AphroditeUpgrade' },
      },
    });
    const { biome } = validN(project);
    const hub = biome.snapshot.decisions.find((decision) => decision.kind === 'hub');
    if (hub?.kind !== 'hub') throw new Error('fixture lost Hub decision');

    expect(biome.validity).toBe('valid');
    expect(hub.board.targets).toHaveLength(10);
    expect(
      hub.board.targets.filter(
        (target) =>
          target.room.incomingReward?.offer.rewardType === 'Boon' &&
          target.room.incomingReward.offer.payload?.kind === 'BoonSource' &&
          target.room.incomingReward.offer.payload.source === 'AphroditeUpgrade',
      ),
    ).toHaveLength(2);
  });

  it('permits six distinct acquired god sources after visiting every Ephyra Boon offer', () => {
    const hubSources = {
      combat01: 'DemeterUpgrade',
      combat02: 'ZeusUpgrade',
      combat10: 'ApolloUpgrade',
      combat11: 'HeraUpgrade',
      combat23: 'AresUpgrade',
      miniBoss01: 'PoseidonUpgrade',
    } as const;
    let project = createRepresentativeNProject({ visitSlotKeys: Object.keys(hubSources) });
    for (const [occurrenceId, source] of [
      [nOccurrenceIds.opening, 'ApolloUpgrade'],
      [nOccurrenceIds.preHub, 'HeraUpgrade'],
    ] as const) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(nBiome, occurrenceId),
        value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source } },
      });
    }
    for (const [slotKey, source] of Object.entries(hubSources)) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(nBiome, nOccurrenceId(slotKey)),
        value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source } },
      });
    }

    const { biome } = validN(authorLegalTraitOffers(project));
    const acquiredSources = new Set(
      biome.rewards.branches[0]?.events.flatMap((event) =>
        event.kind === 'concreteAcquisition' &&
        Object.values(hubSources).includes(
          event.acquisition.acquisition.gameName as (typeof hubSources)[keyof typeof hubSources],
        )
          ? [event.acquisition.acquisition.gameName]
          : [],
      ),
    );

    expect(acquiredSources).toEqual(new Set(Object.values(hubSources)));
    expect(biome.rewards.validity).toBe('valid');
  });

  it('treats Hub board generation independently from its six-room acquisition order', () => {
    let project = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'OpenHubSlot',
      slot: createHubSlotAddress(nBiome, 'hub', 'story'),
      occurrenceId: nOccurrenceId('story'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat02')),
      value: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
      },
    });
    expect(
      createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, project),
      ).evaluate({
        kind: 'incomingReward',
        reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat09')),
        value: {
          rewardType: 'Boon',
          payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
        },
      }),
    ).toMatchObject({ kind: 'incomingReward', result: { supported: true, findings: [] } });

    for (const slotKey of ['combat09', 'miniBoss01'] as const) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(nBiome, nOccurrenceId(slotKey)),
        value: {
          rewardType: 'Boon',
          payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
        },
      });
    }
    expect(validN(project).biome.validity).toBe('valid');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceHubVisitOrder',
      hub: createHubDecisionAddress(nBiome, 'hub'),
      hubSlotKeys: ['combat02', 'combat09', 'miniBoss01', 'combat05', 'combat03', 'combat01'],
    });
    const { biome } = validN(project);
    const hub = biome.snapshot.decisions.find((decision) => decision.kind === 'hub');
    if (hub?.kind !== 'hub') throw new Error('fixture lost Hub decision');

    expect(
      hub.board.targets
        .filter(
          (target) =>
            target.room.incomingReward?.offer.payload?.kind === 'BoonSource' &&
            target.room.incomingReward.offer.payload.source === 'ZeusUpgrade',
        )
        .map((target) => target.hubSlotKey),
    ).toEqual(['combat02', 'combat09', 'miniBoss01']);
    expect(hub.visits.map((visit) => visit.target.hubSlotKey)).toEqual([
      'combat02',
      'combat09',
      'miniBoss01',
      'combat05',
      'combat03',
      'combat01',
    ]);
    expect(hub.board.targets).toHaveLength(10);
    const zeusRewardOwners = new Set(
      hub.board.targets.flatMap((target) =>
        target.room.incomingReward?.offer.payload?.kind === 'BoonSource' &&
        target.room.incomingReward.offer.payload.source === 'ZeusUpgrade'
          ? [semanticAddressKey(target.room.incomingReward.origin)]
          : [],
      ),
    );
    expect(
      biome.rewards.branches[0]?.events.filter(
        (event) =>
          event.kind === 'concreteAcquisition' &&
          zeusRewardOwners.has(semanticAddressKey(event.origin)),
      ),
    ).toHaveLength(3);
    expect(biome.rewards.validity).toBe('valid');
  });

  it('keeps one changed Hub reward authorable while sibling defaults still block the board', () => {
    let project = createRepresentativeNProject();
    const repeatedDefault = {
      rewardType: 'Boon' as const,
      payload: { kind: 'BoonSource' as const, source: 'AphroditeUpgrade' },
    };
    for (const slotKey of nOpenSlotKeys) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(nBiome, nOccurrenceId(slotKey)),
        value: repeatedDefault,
      });
    }
    const session = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );
    const reward = createIncomingRewardAddress(nBiome, nOccurrenceId('combat01'));

    expect(
      session.evaluate({ kind: 'incomingReward', reward, value: repeatedDefault }),
    ).toMatchObject({
      kind: 'incomingReward',
      result: {
        supported: false,
        findings: [expect.objectContaining({ code: 'rewardSourceUnavailable' })],
      },
    });
    expect(
      session.evaluate({
        kind: 'incomingReward',
        reward,
        value: {
          rewardType: 'Boon',
          payload: { kind: 'BoonSource', source: 'AresUpgrade' },
        },
      }),
    ).toMatchObject({ kind: 'incomingReward', result: { supported: true, findings: [] } });
  });

  it('still rejects a repeated Hub source when no hidden generation order reaches the cap', () => {
    let project = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat11')),
      value: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
      },
    });
    const repeatedZeus = {
      rewardType: 'Boon' as const,
      payload: { kind: 'BoonSource' as const, source: 'ZeusUpgrade' },
    };
    expect(
      createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, project),
      ).evaluate({
        kind: 'incomingReward',
        reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat23')),
        value: repeatedZeus,
      }),
    ).toMatchObject({
      kind: 'incomingReward',
      result: {
        supported: false,
        findings: [expect.objectContaining({ code: 'rewardSourceUnavailable' })],
      },
    });

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat23')),
      value: repeatedZeus,
    });
    const { biome } = completeN(project);
    expect(biome.validity).toBe('invalid');
    expect(biome.findings).toContainEqual(
      expect.objectContaining({ code: 'rewardSourceUnavailable' }),
    );
  });

  it('jointly consumes generated side siblings but acquires only the entered local rooms', () => {
    const { biome } = validN();
    const hub = biome.snapshot.decisions.find((decision) => decision.kind === 'hub');
    if (hub?.kind !== 'hub') throw new Error('fixture lost Hub decision');
    const generated = hub.visits.flatMap((visit) =>
      visit.localSlots.filter((slot) => slot.generation === 'generated'),
    );
    const entered = hub.visits.flatMap((visit) => visit.enteredLocalRooms);
    const generatedOrigins = generated.map((slot) =>
      semanticAddressKey(slot.incomingReward!.origin),
    );
    const enteredOrigins = entered.map((slot) => semanticAddressKey(slot.incomingReward!.origin));
    const branch = biome.rewards.branches[0];
    if (branch === undefined) throw new Error('fixture has no reward branch');

    expect(
      branch.events.filter(
        (event) =>
          event.kind === 'rewardOffered' &&
          generatedOrigins.includes(semanticAddressKey(event.origin)),
      ),
    ).toHaveLength(6);
    expect(
      branch.events
        .filter(
          (event) =>
            event.kind === 'concreteAcquisition' &&
            generatedOrigins.includes(semanticAddressKey(event.origin)),
        )
        .map((event) => semanticAddressKey(event.origin)),
    ).toEqual(enteredOrigins);
    for (const local of entered) {
      const incoming = local.incomingReward;
      if (incoming === undefined) throw new Error('entered local room lost its reward');
      const site = createAcquisitionSiteAddress(local.origin, 'roomRewardPickup');
      expect(
        branch.events.find(
          (event) =>
            event.kind === 'concreteAcquisition' &&
            semanticAddressKey(event.origin) === semanticAddressKey(incoming.origin),
        ),
      ).toMatchObject({
        settlement: {
          site,
          entry: createAcquisitionEntryAddress(site, 'self'),
        },
      });
    }
  });

  it('propagates and acquires a trait-bearing active Ephyra local reward', () => {
    const project = createRepresentativeNProject();
    const route = project.routes.find((candidate) => candidate.routeKey === 'Surface');
    const plan = route?.biomes.find((candidate) => candidate.biomeKey === 'N');
    const topology = plan?.topology;
    const decision = topology?.decisions.find((candidate) => candidate.kind === 'hub');
    const descriptor = catalog.biomeLayouts.byKey.N?.progression;
    if (
      route === undefined ||
      plan === undefined ||
      topology === null ||
      topology === undefined ||
      decision?.kind !== 'hub' ||
      descriptor?.kind !== 'hub'
    ) {
      throw new Error('fixture lost complete Hub topology');
    }
    const target = decision.openTargets.find((candidate) => candidate.hubSlotKey === 'combat05');
    const parent = topology.occurrences.find(
      (occurrence) => occurrence.occurrenceId === target?.occurrenceId,
    );
    if (target === undefined || parent?.state.kind !== 'ephyraCombat') {
      throw new Error('fixture lost Ephyra combat target');
    }
    const side = parent.state.sideRooms.sideDoor1;
    if (side === undefined) throw new Error('fixture lost Ephyra local slot');
    const offer = {
      rewardType: 'Boon' as const,
      payload: { kind: 'BoonSource' as const, source: 'DemeterUpgrade' },
    };
    const traitOffersByAcquisitionRole = createDefaultTraitOffers(catalog, offer, route.loadout);
    const replacedParent = Object.freeze({
      ...parent,
      state: Object.freeze({
        ...parent.state,
        sideRooms: Object.freeze({
          ...parent.state.sideRooms,
          sideDoor1: Object.freeze({
            ...side,
            reward: Object.freeze({ offer, traitOffersByAcquisitionRole }),
          }),
        }),
      }),
    });
    const occurrences = new Map(
      topology.occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence]),
    );
    occurrences.set(replacedParent.occurrenceId, replacedParent);
    const canonical = materializeHubDecision(catalog, nBiome, descriptor, decision, occurrences, {
      weaponKey: route.loadout.weaponKey,
      aspectKey: route.loadout.aspectKey,
    });
    const visit = canonical.visits.find(
      (candidate) => candidate.target.room.occurrenceId === parent.occurrenceId,
    );
    const local = visit?.localSlots.find((candidate) => candidate.slotKey === 'sideDoor1');
    const incoming = local?.incomingReward;
    if (incoming === undefined) throw new Error('fixture lost materialized local reward');
    expect(incoming.traitOffersByAcquisitionRole).toEqual(traitOffersByAcquisitionRole);

    const findings = new Map();
    const baseFacts: RewardKernelFacts = {
      requirements: {
        counters: {
          biomeDepthCache: 4,
          biomeEncounterDepth: 2,
          encounterDepth: 7,
          enteredBiomes: 1,
          upgradableTraitCount: 0,
        },
        records: {
          biomeUseRecord: {},
          lootTypeHistory: {},
          roomsEntered: {},
          useRecord: {},
        },
        currentRoomShopOptionNames: new Set(),
        currentRoomRewardType: undefined,
        currentRoomStructuralTags: [],
        rewardLookups: {},
        runDepthCache: 8,
        lastEventRunDepthCaches: {},
        recentEncounterEnvelopeSlots: [],
        offeredExitCount: 3,
        currentBatchRoomGameNames: [],
        clockwork: undefined,
        flags: { allSpellInvested: false, pendingSpellDrop: false },
      },
    };
    const branches = settleOwnedAcquisitionSite(
      catalog,
      initializeRewardBranches(undefined, createTestArcanaFearState()),
      {
        siteOwner: local!.origin,
        pointKey: 'roomRewardPickup',
        entryKey: 'self',
        source: incoming,
        historySequence: 1,
      },
      (history) => factsWithHistory(baseFacts, history, new Set()),
      findings,
    ).branches;
    const branch = branches[0];
    const expectedOffer = Object.values(incoming.traitOffersByAcquisitionRole ?? {})[0];
    if (branch === undefined || expectedOffer === undefined || expectedOffer.kind !== 'traits') {
      throw new Error('trait event was not reached');
    }
    expect(branch.events).toContainEqual(
      expect.objectContaining({ kind: 'concreteAcquisition', origin: incoming.origin }),
    );
    expect(branch.traitHistory?.equippedTraits[expectedOffer.options[0]!.traitKey]).toBeDefined();
    expect(findings).toHaveLength(0);
  });

  it('keeps the peer-exclusion finding at the second conflicting local reward owner', () => {
    let project = createRepresentativeNProject();
    for (const slotKey of ['sideDoor1', 'sideDoor2'] as const) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceLocalReward',
        reward: createLocalRewardAddress(nBiome, nOccurrenceId('combat05'), 'sideRooms', slotKey),
        value: { rewardType: 'AirBoost' },
      });
    }
    const { biome } = completeN(project);

    expect(biome.validity).toBe('invalid');
    expect(biome.findings).toContainEqual(
      expect.objectContaining({
        code: 'rewardBagEntryUnavailable',
        origin: createLocalRewardAddress(
          nBiome,
          nOccurrenceId('combat05'),
          'sideRooms',
          'sideDoor2',
        ),
      }),
    );
  });

  it('offers the fixed Story target without acquiring it or depleting the Hub bag', () => {
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'n-story-board',
        name: 'N Story Board',
        configuredBiomeCounts: { Surface: 1 },
      }),
      {
        openSlotKeys: [
          'combat11',
          'combat10',
          'combat09',
          'combat05',
          'story',
          'combat02',
          'combat01',
          'miniBoss01',
          'combat23',
        ],
        visitSlotKeys: ['combat05', 'miniBoss01', 'combat02', 'combat11', 'combat23', 'story'],
      },
    );
    const { biome } = validN(project);
    const hub = biome.snapshot.decisions.find((decision) => decision.kind === 'hub');
    if (hub?.kind !== 'hub') throw new Error('fixture lost Hub decision');
    const story = hub.board.targets.find((target) => target.hubSlotKey === 'story');
    const branch = biome.rewards.branches[0];
    if (story?.room.incomingReward === undefined || branch === undefined) {
      throw new Error('fixture lost the Story reward');
    }

    expect(biome.validity).toBe('valid');
    expect(story.room).toMatchObject({ gameName: 'N_Story01', entered: true });
    expect(biome.rewards.rewardLookups.hubRewardLookup).toContain('Story');
    expect(
      branch.events.filter(
        (event) =>
          event.kind === 'rewardOffered' &&
          semanticAddressKey(event.origin) ===
            semanticAddressKey(story.room.incomingReward!.origin),
      ),
    ).toHaveLength(1);
    expect(
      branch.events.filter(
        (event) =>
          event.kind === 'concreteAcquisition' &&
          semanticAddressKey(event.origin) ===
            semanticAddressKey(story.room.incomingReward!.origin),
      ),
    ).toHaveLength(0);
    expect(
      branch.bags.HubRewards?.remainingEntryCounts.reduce((total, count) => total + count, 0),
    ).toBe(3);
  });

  it('validates the Preboss inventory from all open target offers and applies its purchase owner', () => {
    const lookup = completeN().biome.rewards.rewardLookups.hubRewardLookup;
    expect(lookup).toEqual([
      'MaxHealthDropBig',
      'MaxManaDropBig',
      'WeaponUpgrade',
      'HermesUpgrade',
      'SpellDrop',
      'Boon',
    ]);

    const invalidProject = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'ReplaceShopOffer',
      offer: createShopOfferAddress(nBiome, nOccurrenceIds.preboss, 'MajorNonBoon'),
      value: { rewardType: 'WeaponUpgradeDrop' },
    });
    const invalidBiome = completeN(invalidProject).biome;
    expect(invalidBiome.coverage).toMatchObject({
      kind: 'prefix',
      blockedAt: createShopOfferAddress(nBiome, nOccurrenceIds.preboss, 'MajorNonBoon'),
    });
    expect(invalidBiome.findings).toContainEqual(
      expect.objectContaining({
        code: 'shopOfferUnavailable',
        origin: createShopOfferAddress(nBiome, nOccurrenceIds.preboss, 'MajorNonBoon'),
      }),
    );

    const purchasedProject = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'ReplaceAcquisitionOrder',
      site: createAcquisitionSiteAddress(
        createOccurrenceAddress(nBiome, nOccurrenceIds.preboss),
        'roomExit',
      ),
      entryKeys: ['Minor'],
    });
    expect(
      completeN(purchasedProject).biome.rewards.branches.some((branch) =>
        branch.events.some(
          (event) =>
            event.kind === 'concreteAcquisition' &&
            event.settlement !== undefined &&
            semanticAddressKey(event.settlement.entry) ===
              semanticAddressKey(
                createAcquisitionEntryAddress(
                  createAcquisitionSiteAddress(
                    createOccurrenceAddress(nBiome, nOccurrenceIds.preboss),
                    'roomExit',
                  ),
                  'Minor',
                ),
              ),
        ),
      ),
    ).toBe(true);
  });

  it('evaluates board rewards and the Preboss shop from their prepared semantic owners', () => {
    const { project } = completeN();
    const candidates = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );

    expect(
      candidates.evaluate({
        kind: 'incomingReward',
        reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat09')),
        value: { rewardType: 'SpellDrop' },
      }),
    ).toMatchObject({ kind: 'incomingReward', result: { supported: true } });
    expect(
      candidates.evaluate({
        kind: 'shopOffer',
        offer: createShopOfferAddress(nBiome, nOccurrenceIds.preboss, 'MajorNonBoon'),
        value: { rewardType: 'MaxHealthDrop' },
      }),
    ).toMatchObject({ kind: 'shopOffer', result: { supported: true } });
  });

  it('evaluates Hub membership, visits, and parent-local state through their semantic owners', () => {
    const { project } = completeN();
    const encodedBefore = encodeProjectDocument(project);
    const candidates = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );
    const [
      conflictingMiniboss,
      validTenthSlot,
      requiredOpenSlot,
      alternateVisit,
      duplicateVisit,
      forcedSideGeneration,
      blockedEnteredSide,
      optionalSideGeneration,
      sideEntryOrder,
    ] = candidates.evaluate([
      {
        kind: 'hubSlot',
        slot: createHubSlotAddress(nBiome, 'hub', 'miniBoss02'),
        open: true,
        occurrenceId: nOccurrenceId('candidate-miniBoss02'),
      },
      {
        kind: 'hubSlot',
        slot: createHubSlotAddress(nBiome, 'hub', 'combat12'),
        open: true,
        occurrenceId: nOccurrenceId('candidate-combat12'),
      },
      {
        kind: 'hubSlot',
        slot: createHubSlotAddress(nBiome, 'hub', 'combat10'),
        open: false,
        occurrenceId: nOccurrenceId('combat10'),
      },
      {
        kind: 'hubVisitOrder',
        hub: createHubDecisionAddress(nBiome, 'hub'),
        hubSlotKeys: ['combat03', 'miniBoss01', 'combat02', 'combat11', 'combat23', 'combat09'],
      },
      {
        kind: 'hubVisitOrder',
        hub: createHubDecisionAddress(nBiome, 'hub'),
        hubSlotKeys: ['miniBoss01', 'miniBoss01', 'combat02', 'combat11', 'combat23', 'combat09'],
      },
      {
        kind: 'sideRoomGeneration',
        sideRoom: createLocalChildAddress(
          nBiome,
          nOccurrenceId('combat05'),
          'sideRooms',
          'sideDoor1',
        ),
        generation: 'generated',
      },
      {
        kind: 'sideRoomGeneration',
        sideRoom: createLocalChildAddress(
          nBiome,
          nOccurrenceId('combat05'),
          'sideRooms',
          'sideDoor1',
        ),
        generation: 'notGenerated',
      },
      {
        kind: 'sideRoomGeneration',
        sideRoom: createLocalChildAddress(
          nBiome,
          nOccurrenceId('combat05'),
          'sideRooms',
          'sideDoor3',
        ),
        generation: 'notGenerated',
      },
      {
        kind: 'sideRoomEntryOrder',
        group: createLocalChildGroupAddress(nBiome, nOccurrenceId('combat05'), 'sideRooms'),
        enteredSlotKeys: ['sideDoor1', 'sideDoor2'],
      },
    ]);

    expect(conflictingMiniboss).toMatchObject({
      kind: 'hubSlot',
      result: {
        selectedPossible: false,
        findings: [
          {
            code: 'hubOpenSlotUnavailable',
            origin: createHubSlotAddress(nBiome, 'hub', 'miniBoss02'),
          },
        ],
      },
    });
    expect(validTenthSlot).toMatchObject({ kind: 'hubSlot', result: { selectedPossible: true } });
    expect(requiredOpenSlot).toMatchObject({
      kind: 'hubSlot',
      result: { selectedPossible: true, findings: [] },
    });
    expect(alternateVisit).toMatchObject({
      kind: 'hubVisitOrder',
      result: {
        selectedPossible: true,
        findings: [expect.objectContaining({ code: 'sideRoomGenerationUnavailable' })],
      },
    });
    expect(duplicateVisit).toMatchObject({
      kind: 'hubVisitOrder',
      result: { selectedPossible: false },
    });
    expect(forcedSideGeneration).toMatchObject({
      kind: 'sideRoomGeneration',
      result: { selectedPossible: true, supportOutcomes: ['generated'] },
    });
    expect(blockedEnteredSide).toMatchObject({
      kind: 'sideRoomGeneration',
      result: { selectedPossible: false, enteredOrdinal: 2 },
    });
    expect(optionalSideGeneration).toMatchObject({
      kind: 'sideRoomGeneration',
      result: { selectedPossible: true, supportOutcomes: ['generated', 'notGenerated'] },
    });
    expect(sideEntryOrder).toMatchObject({
      kind: 'sideRoomEntryOrder',
      result: {
        selectedPossible: true,
        generatedSlotKeys: ['sideDoor1', 'sideDoor2', 'sideDoor3'],
      },
    });
    expect(encodeProjectDocument(project)).toBe(encodedBefore);
  });

  it('replays every proposed Hub visit and retains exact descendant findings as order evidence', () => {
    let project = createRepresentativeNProject();
    const combat05Group = createLocalChildGroupAddress(
      nBiome,
      nOccurrenceId('combat05'),
      'sideRooms',
    );
    const combat05SideDoor1 = createLocalChildAddress(
      nBiome,
      nOccurrenceId('combat05'),
      'sideRooms',
      'sideDoor1',
    );
    const combat03SideDoor1 = createLocalChildAddress(
      nBiome,
      nOccurrenceId('combat03'),
      'sideRooms',
      'sideDoor1',
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSideRoomEntryOrder',
      group: combat05Group,
      enteredSlotKeys: ['sideDoor2'],
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSideRoomGeneration',
      sideRoom: combat05SideDoor1,
      generation: 'notGenerated',
    });

    const candidate = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    ).evaluate({
      kind: 'hubVisitOrder',
      hub: createHubDecisionAddress(nBiome, 'hub'),
      hubSlotKeys: ['combat03', 'combat05', 'miniBoss01', 'combat02', 'combat11', 'combat23'],
    });

    expect(candidate).toMatchObject({
      kind: 'hubVisitOrder',
      result: {
        candidateHubSlotKeys: [
          'combat03',
          'combat05',
          'miniBoss01',
          'combat02',
          'combat11',
          'combat23',
        ],
        selectedPossible: true,
        findings: [
          expect.objectContaining({
            code: 'sideRoomGenerationUnavailable',
            origin: combat03SideDoor1,
          }),
          expect.objectContaining({
            code: 'sideRoomGenerationUnavailable',
            origin: combat05SideDoor1,
          }),
        ],
      },
    });
  });

  it('does not offer a visit-referenced slot for closure even when the board would retain its minimum size', () => {
    const project = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'OpenHubSlot',
      slot: createHubSlotAddress(nBiome, 'hub', 'combat12'),
      occurrenceId: nOccurrenceId('close-referenced-slot'),
    });
    const candidate = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    ).evaluate({
      kind: 'hubSlot',
      slot: createHubSlotAddress(nBiome, 'hub', 'combat05'),
      open: false,
      occurrenceId: nOccurrenceId('combat05'),
    });

    expect(candidate).toMatchObject({
      kind: 'hubSlot',
      result: { selectedPossible: false, referencedVisitIndexes: [1], findings: [] },
    });
  });

  it('keeps an unvisited ninth Hub slot closable while the completed handoff is removed', () => {
    const { project } = completeN();
    const candidate = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    ).evaluate({
      kind: 'hubSlot',
      slot: createHubSlotAddress(nBiome, 'hub', 'combat03'),
      open: false,
      occurrenceId: nOccurrenceId('combat03'),
    });

    expect(candidate).toMatchObject({
      kind: 'hubSlot',
      result: { selectedPossible: true, referencedVisitIndexes: [], findings: [] },
    });

    const closed = applyProjectCommand(project, catalog, {
      kind: 'CloseHubSlot',
      slot: createHubSlotAddress(nBiome, 'hub', 'combat03'),
    });
    const closedBiome = simulateProject(catalog, closed)
      .routes.find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N');
    expect(closedBiome).toMatchObject({
      authoring: 'incomplete',
      findings: [expect.objectContaining({ code: 'hubOpenSetIncomplete' })],
    });
  });

  it('preserves the fixed opening and PreHub reward surfaces as normal authored occurrences', () => {
    const { biome } = validN();
    const opening = biome.snapshot.entryRoom;
    const openingBatch = biome.snapshot.decisions.find(
      (decision) =>
        decision.kind === 'batch' &&
        decision.source.kind === 'occurrence' &&
        decision.source.occurrenceId === nOccurrenceIds.opening,
    );
    if (openingBatch?.kind !== 'batch') throw new Error('fixture lost PreHub batch');
    const preHub = openingBatch.targets.find((target) => target.exit.exitKey === 'prehub');
    if (preHub === undefined) throw new Error('fixture lost PreHub target');

    expect(opening.incomingReward?.origin).toEqual(
      createIncomingRewardAddress(nBiome, nOccurrenceIds.opening),
    );
    expect(preHub.room.incomingReward?.origin).toEqual(
      createIncomingRewardAddress(nBiome, nOccurrenceIds.preHub),
    );
    for (const incoming of [
      createIncomingRewardAddress(nBiome, nOccurrenceIds.opening),
      createIncomingRewardAddress(nBiome, nOccurrenceIds.preHub),
    ]) {
      const acquisitions = biome.rewards.branches.flatMap((branch) =>
        branch.events.filter(
          (event) =>
            event.kind === 'concreteAcquisition' &&
            semanticAddressKey(event.origin) === semanticAddressKey(incoming),
        ),
      );
      expect(acquisitions.length).toBeGreaterThan(0);
      expect(acquisitions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            settlement: expect.objectContaining({
              site: expect.objectContaining({ pointKey: 'roomRewardPickup' }),
            }),
          }),
        ]),
      );
    }
    expect(
      biome.findings.filter(
        (finding) => semanticAddressKey(finding.origin) === semanticAddressKey(opening.origin),
      ),
    ).toEqual([]);
  });

  it('does not mutate reward ownership when replacing one local offer', () => {
    const project = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'ReplaceLocalReward',
      reward: createLocalRewardAddress(nBiome, nOccurrenceId('combat02'), 'sideRooms', 'sideDoor1'),
      value: { rewardType: 'RoomMoneyTinyDrop' },
    });
    const { biome } = validN(project);
    const owner = createLocalRewardAddress(
      nBiome,
      nOccurrenceId('combat02'),
      'sideRooms',
      'sideDoor1',
    );

    expect(biome.snapshot.decisions.find((decision) => decision.kind === 'hub')).toBeDefined();
    expect(
      biome.rewards.branches.some((branch) =>
        branch.events.some(
          (event) => semanticAddressKey(event.origin) === semanticAddressKey(owner),
        ),
      ),
    ).toBe(true);
  });
});

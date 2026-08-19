import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionRoleAddress,
  createExitDecisionAddress,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createEncounterPhaseAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createIncomingRewardAddress,
  createLocalVisitOrderAddress,
  createLocalVisitSlotAddress,
  createOccurrenceAddress,
  createProjectDocument,
  createRouteAddress,
  createRouteStartKeepsakeSelectionAddress,
  createShopOfferAddress,
  createTraitOfferAddress,
  encodeProjectDocument,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { factsWithHistory, type RewardKernelFacts } from '@run-planner/engine/reward-kernel';
import {
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
  simulateProject,
} from '@run-planner/engine/simulation';
import { createNormalDispositionByAcquisitionRole } from '../../../../src/authored-project/reward-state';
import {
  createTestArcanaFearState,
  initializeTestRewardBranches,
} from '../../../support/arcana-fear';
import { materializeHubDecision } from '../../../../src/simulation/materialization';
import { settleOwnedAcquisitionSite } from '../../../../src/simulation/rewards/processing';
import { describe, expect, it } from 'vitest';

import {
  appendCompleteN,
  createRepresentativeNProject,
  replaceTestShopOfferActions,
  nBiome,
  nLocalOccurrenceId,
  nLocalOccurrenceIdsBySlot,
  nOccurrenceId,
  nOccurrenceIds,
  nOpenSlotKeys,
  nVisitSlotKeys,
  authorLegalTraitOffers,
  authorTestArtificerReplacement,
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
        localOccurrenceIdsBySlot: nLocalOccurrenceIdsBySlot('miniBoss02'),
      }),
    ).toThrow(/Hub open-slot constraint excludes miniBoss02/);
  });

  it('keeps unavailable side generation and its local reward owner precise', () => {
    let project = createRepresentativeNProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceLocalVisitOrder',
      order: createLocalVisitOrderAddress(nBiome, nOccurrenceId('combat05'), 'sideRooms'),
      occurrenceIds: [nLocalOccurrenceId('combat05', 'sideDoor2')],
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetLocalVisitGeneration',
      slot: createLocalVisitSlotAddress(
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
        origin: createLocalVisitSlotAddress(
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
      kind: 'ReplaceLocalVisitOrder',
      order: createLocalVisitOrderAddress(nBiome, nOccurrenceId('combat05'), 'sideRooms'),
      occurrenceIds: [nLocalOccurrenceId('combat05', 'sideDoor2')],
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetLocalVisitGeneration',
      slot: createLocalVisitSlotAddress(
        nBiome,
        nOccurrenceId('combat05'),
        'sideRooms',
        'sideDoor1',
      ),
      generation: 'notGenerated',
    });
    const blockedSideRoom = createLocalVisitSlotAddress(
      nBiome,
      nOccurrenceId('combat05'),
      'sideRooms',
      'sideDoor1',
    );
    const hub = createHubDecisionAddress(nBiome, 'hub');
    const laterSideRoom = createLocalVisitSlotAddress(
      nBiome,
      nOccurrenceId('combat02'),
      'sideRooms',
      'sideDoor1',
    );
    const withLaterViolation = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nLocalOccurrenceId('combat02', 'sideDoor1')),
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
        sideRoom: createLocalVisitSlotAddress(
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
        group: createLocalVisitOrderAddress(nBiome, nOccurrenceId('combat05'), 'sideRooms'),
        occurrenceIds: [
          nLocalOccurrenceId('combat05', 'sideDoor1'),
          nLocalOccurrenceId('combat05', 'sideDoor2'),
        ],
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
      localOccurrenceIdsBySlot: nLocalOccurrenceIdsBySlot('combat12'),
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
      localOccurrenceIdsBySlot: nLocalOccurrenceIdsBySlot('story'),
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

  it('assesses a resolved participant without existentially completing unresolved Hub peers', () => {
    let project = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'OpenHubSlot',
      slot: createHubSlotAddress(nBiome, 'hub', 'combat12'),
      occurrenceId: nOccurrenceId('combat12'),
      localOccurrenceIdsBySlot: nLocalOccurrenceIdsBySlot('combat12'),
    });
    // Free the singleton Max Health entry. Combat 12 remains unresolved:
    // candidate evaluation must use the current partial board and must not
    // search that sibling's complete reward domain for a completion witness.
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat01')),
      value: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' },
      },
    });
    const result = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    ).evaluate({
      kind: 'incomingReward',
      reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat09')),
      value: { rewardType: 'MaxHealthDropBig' },
    });

    expect(result).toMatchObject({
      kind: 'incomingReward',
      result: { supported: true, findings: [] },
    });
    expect(
      simulateProject(catalog, project)
        .routes.find((route) => route.routeKey === 'Surface')
        ?.biomes.find((candidate) => candidate.biomeKey === 'N'),
    ).toMatchObject({
      authoring: 'complete',
      validity: 'invalid',
      findings: [expect.objectContaining({ code: 'rewardMissing' })],
    });
  });

  it('rejects a singleton reward already authored on another Hub door during the next edit', () => {
    const reward = createIncomingRewardAddress(nBiome, nOccurrenceId('combat09'));
    const result = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, createRepresentativeNProject()),
    ).evaluate({
      kind: 'incomingReward',
      reward,
      value: { rewardType: 'MaxHealthDropBig' },
    });

    expect(result).toMatchObject({
      kind: 'incomingReward',
      result: {
        supported: false,
        findings: [
          expect.objectContaining({
            code: 'rewardBagEntryUnavailable',
            origin: reward,
          }),
        ],
      },
    });
  });

  it('uses the authored peer pool while keeping a complete invalid board repairable', () => {
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
        findings: [expect.objectContaining({ code: 'rewardBagEntryUnavailable' })],
      },
    });
    expect(
      session.evaluate({
        kind: 'incomingReward',
        reward,
        value: { rewardType: 'MaxManaDropBig' },
      }),
    ).toMatchObject({
      kind: 'incomingReward',
      result: { supported: true, findings: [] },
    });
    expect(completeN(project).biome).toMatchObject({
      validity: 'invalid',
      findings: [expect.objectContaining({ code: 'rewardSourceUnavailable' })],
    });
  });

  it('separates focused participant support from complete-board source failure', () => {
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
      result: { supported: true, findings: [] },
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

  it('keeps unrelated board reward authoring available under a retained-invalid peer', () => {
    const invalidPeer = createIncomingRewardAddress(nBiome, nOccurrenceId('combat10'));
    const project = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: invalidPeer,
      value: { rewardType: 'WeaponUpgrade' },
    });
    const assembly = simulateProjectAssembly(catalog, project);
    const biome = assembly.evaluation.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((candidate) => candidate.biomeKey === 'N');
    expect(biome).toMatchObject({
      validity: 'invalid',
      findings: [
        expect.objectContaining({ code: 'rewardBagEntryUnavailable', origin: invalidPeer }),
      ],
    });

    expect(
      createPreparedProjectCandidateSession(catalog, assembly).evaluate({
        kind: 'incomingReward',
        reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat09')),
        value: { rewardType: 'SpellDrop' },
      }),
    ).toMatchObject({ kind: 'incomingReward', result: { supported: true, findings: [] } });
  });

  it('derives board candidates independently from Hub visit and nested-room chronology', () => {
    const reward = createIncomingRewardAddress(nBiome, nOccurrenceId('combat09'));
    const value = { rewardType: 'SpellDrop' } as const;
    const baseline = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, createRepresentativeNProject()),
    ).evaluate({ kind: 'incomingReward', reward, value });

    let blocked = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'ReplaceHubVisitOrder',
      hub: createHubDecisionAddress(nBiome, 'hub'),
      hubSlotKeys: ['combat02', 'combat05', 'miniBoss01', 'combat11', 'combat23', 'combat09'],
    });
    blocked = applyProjectCommand(blocked, catalog, {
      kind: 'ReplaceLocalVisitOrder',
      order: createLocalVisitOrderAddress(nBiome, nOccurrenceId('combat02'), 'sideRooms'),
      occurrenceIds: [nLocalOccurrenceId('combat02', 'sideDoor1')],
    });
    blocked = applyProjectCommand(blocked, catalog, {
      kind: 'SetLocalVisitGeneration',
      slot: createLocalVisitSlotAddress(
        nBiome,
        nOccurrenceId('combat02'),
        'sideRooms',
        'sideDoor2',
      ),
      generation: 'notGenerated',
    });
    const blockedAssembly = simulateProjectAssembly(catalog, blocked);
    expect(
      blockedAssembly.evaluation.routes
        .find((route) => route.routeKey === 'Surface')
        ?.biomes.find((candidate) => candidate.biomeKey === 'N'),
    ).toMatchObject({ validity: 'invalid' });

    const candidate = createPreparedProjectCandidateSession(catalog, blockedAssembly).evaluate({
      kind: 'incomingReward',
      reward,
      value,
    });
    expect(candidate).toEqual(baseline);
  });

  it('jointly consumes generated side siblings but acquires only the entered local rooms', () => {
    const { biome } = validN();
    const hub = biome.snapshot.decisions.find((decision) => decision.kind === 'hub');
    if (hub?.kind !== 'hub') throw new Error('fixture lost Hub decision');
    const generated = hub.visits.flatMap((visit) =>
      visit.localSlots.filter((slot) => slot.localVisit.generation === 'generated'),
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
    const localOccurrence = topology.occurrences.find(
      (occurrence) => occurrence.occurrenceId === nLocalOccurrenceId('combat05', 'sideDoor1'),
    );
    if (target === undefined || parent === undefined || localOccurrence === undefined) {
      throw new Error('fixture lost Ephyra combat target');
    }
    const offer = {
      rewardType: 'Boon' as const,
      payload: { kind: 'BoonSource' as const, source: 'DemeterUpgrade' },
    };
    const traitOffersByAcquisitionRole = Object.freeze({
      source: Object.freeze({
        kind: 'traits' as const,
        giverKey: 'Demeter',
        options: Object.freeze([
          Object.freeze({ traitKey: 'DemeterWeaponBoon', rarity: 'Common' as const }),
          Object.freeze({ traitKey: 'DemeterSpecialBoon', rarity: 'Common' as const }),
          Object.freeze({ traitKey: 'DemeterCastBoon', rarity: 'Common' as const }),
        ] as const),
        selectedOptionKey: 'option1' as const,
      }),
    });
    if (!('reward' in localOccurrence.state)) {
      throw new Error('fixture local room has no incoming reward state');
    }
    const replacedLocalOccurrence = Object.freeze({
      ...localOccurrence,
      state: Object.freeze({
        ...localOccurrence.state,
        reward: Object.freeze({
          offer,
          dispositionByAcquisitionRole: createNormalDispositionByAcquisitionRole(catalog, offer),
          traitOffersByAcquisitionRole,
        }),
      }),
    });
    const occurrences = new Map(
      topology.occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence]),
    );
    occurrences.set(replacedLocalOccurrence.occurrenceId, replacedLocalOccurrence);
    const canonical = materializeHubDecision(
      catalog,
      nBiome,
      descriptor,
      decision,
      topology.decisions.filter((candidate) => candidate.kind === 'localVisit'),
      occurrences,
      {
        weaponKey: route.loadout.weaponKey,
        aspectKey: route.loadout.aspectKey,
      },
    );
    const visit = canonical.visits.find(
      (candidate) => candidate.target.room.occurrenceId === parent.occurrenceId,
    );
    const local = visit?.localSlots.find(
      (candidate) => candidate.localVisit.slotKey === 'sideDoor1',
    );
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
      initializeTestRewardBranches(createTestArcanaFearState({ BoonSkipShrineUpgrade: 1 })),
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
    if (
      branch === undefined ||
      expectedOffer === undefined ||
      expectedOffer === null ||
      expectedOffer.kind !== 'traits'
    ) {
      throw new Error('trait event was not reached');
    }
    expect(branch.events).toContainEqual(
      expect.objectContaining({ kind: 'concreteAcquisition', origin: incoming.origin }),
    );
    expect(branch.arcanaFear.fear.forfeitConsumed).toBe(false);
    expect(branch.traitHistory?.equippedTraits[expectedOffer.options[0]!.traitKey]).toBeDefined();
    expect(findings).toHaveLength(0);
  });

  it('keeps the peer-exclusion finding at the second conflicting local reward owner', () => {
    let project = createRepresentativeNProject();
    for (const slotKey of ['sideDoor1', 'sideDoor2'] as const) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(nBiome, nLocalOccurrenceId('combat05', slotKey)),
        value: { rewardType: 'AirBoost' },
      });
    }
    const { biome } = completeN(project);

    expect(biome.validity).toBe('invalid');
    expect(biome.findings).toContainEqual(
      expect.objectContaining({
        code: 'rewardBagEntryUnavailable',
        origin: createIncomingRewardAddress(nBiome, nLocalOccurrenceId('combat05', 'sideDoor2')),
      }),
    );
  });

  it('retains an entered local reward finding on local and aggregate Hub order candidates', () => {
    let project = createRepresentativeNProject();
    for (const slotKey of ['sideDoor1', 'sideDoor2'] as const) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(nBiome, nLocalOccurrenceId('combat05', slotKey)),
        value: { rewardType: 'AirBoost' },
      });
    }
    const findingOrigin = createIncomingRewardAddress(
      nBiome,
      nLocalOccurrenceId('combat05', 'sideDoor2'),
    );
    const candidates = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );

    expect(
      candidates.evaluate({
        kind: 'sideRoomEntryOrder',
        group: createLocalVisitOrderAddress(nBiome, nOccurrenceId('combat05'), 'sideRooms'),
        occurrenceIds: [
          nLocalOccurrenceId('combat05', 'sideDoor2'),
          nLocalOccurrenceId('combat05', 'sideDoor1'),
        ],
      }),
    ).toMatchObject({
      kind: 'sideRoomEntryOrder',
      result: {
        selectedPossible: false,
        findings: [
          expect.objectContaining({ code: 'rewardBagEntryUnavailable', origin: findingOrigin }),
        ],
      },
    });
    expect(
      candidates.evaluate({
        kind: 'hubVisitOrder',
        hub: createHubDecisionAddress(nBiome, 'hub'),
        hubSlotKeys: [...nVisitSlotKeys],
      }),
    ).toMatchObject({
      kind: 'hubVisitOrder',
      result: {
        selectedPossible: true,
        findings: [
          expect.objectContaining({ code: 'rewardBagEntryUnavailable', origin: findingOrigin }),
        ],
      },
    });
  });

  it('retains a nested entered-local encounter finding on local and aggregate Hub order candidates', () => {
    const occurrenceId = nLocalOccurrenceId('combat02', 'sideDoor1');
    const phase = createEncounterPhaseAddress(
      nBiome,
      { kind: 'occurrence', occurrenceId },
      'Encounter',
    );
    let project = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'SkipEncounterKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFigLeafSkip',
      phase,
      value: true,
    });
    const candidates = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );

    expect(
      candidates.evaluate({
        kind: 'sideRoomEntryOrder',
        group: createLocalVisitOrderAddress(nBiome, nOccurrenceId('combat02'), 'sideRooms'),
        occurrenceIds: [occurrenceId],
      }),
    ).toMatchObject({
      kind: 'sideRoomEntryOrder',
      result: {
        selectedPossible: false,
        findings: [expect.objectContaining({ code: 'figLeafSkipUnavailable', origin: phase })],
      },
    });
    expect(
      candidates.evaluate({
        kind: 'hubVisitOrder',
        hub: createHubDecisionAddress(nBiome, 'hub'),
        hubSlotKeys: [...nVisitSlotKeys],
      }),
    ).toMatchObject({
      kind: 'hubVisitOrder',
      result: {
        selectedPossible: true,
        findings: expect.arrayContaining([
          expect.objectContaining({ code: 'figLeafSkipUnavailable', origin: phase }),
        ]),
      },
    });
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

    let invalidProject = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'ReplaceShopOffer',
      offer: createShopOfferAddress(nBiome, nOccurrenceIds.preboss, 'MajorNonBoon'),
      value: { rewardType: 'WeaponUpgradeDrop' },
    });
    invalidProject = replaceTestShopOfferActions(
      invalidProject,
      catalog,
      createOccurrenceAddress(nBiome, nOccurrenceIds.preboss),
      ['MajorNonBoon'],
    );
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

    const purchasedProject = replaceTestShopOfferActions(
      createRepresentativeNProject(),
      catalog,
      createOccurrenceAddress(nBiome, nOccurrenceIds.preboss),
      ['Minor'],
    );
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
        localOccurrenceIdsBySlot: nLocalOccurrenceIdsBySlot('miniBoss02'),
      },
      {
        kind: 'hubSlot',
        slot: createHubSlotAddress(nBiome, 'hub', 'combat12'),
        open: true,
        occurrenceId: nOccurrenceId('candidate-combat12'),
        localOccurrenceIdsBySlot: nLocalOccurrenceIdsBySlot('combat12'),
      },
      {
        kind: 'hubSlot',
        slot: createHubSlotAddress(nBiome, 'hub', 'combat10'),
        open: false,
        occurrenceId: nOccurrenceId('combat10'),
        localOccurrenceIdsBySlot: {},
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
        sideRoom: createLocalVisitSlotAddress(
          nBiome,
          nOccurrenceId('combat05'),
          'sideRooms',
          'sideDoor1',
        ),
        generation: 'generated',
      },
      {
        kind: 'sideRoomGeneration',
        sideRoom: createLocalVisitSlotAddress(
          nBiome,
          nOccurrenceId('combat05'),
          'sideRooms',
          'sideDoor1',
        ),
        generation: 'notGenerated',
      },
      {
        kind: 'sideRoomGeneration',
        sideRoom: createLocalVisitSlotAddress(
          nBiome,
          nOccurrenceId('combat05'),
          'sideRooms',
          'sideDoor3',
        ),
        generation: 'notGenerated',
      },
      {
        kind: 'sideRoomEntryOrder',
        group: createLocalVisitOrderAddress(nBiome, nOccurrenceId('combat05'), 'sideRooms'),
        occurrenceIds: [
          nLocalOccurrenceId('combat05', 'sideDoor1'),
          nLocalOccurrenceId('combat05', 'sideDoor2'),
        ],
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
        findings: expect.arrayContaining([
          expect.objectContaining({ code: 'sideRoomGenerationUnavailable' }),
          expect.objectContaining({
            code: 'traitOfferMissing',
            origin: createTraitOfferAddress(
              createIncomingRewardAddress(nBiome, nOccurrenceId('combat03')),
              'self',
            ),
          }),
        ]),
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
    const combat05Group = createLocalVisitOrderAddress(
      nBiome,
      nOccurrenceId('combat05'),
      'sideRooms',
    );
    const combat05SideDoor1 = createLocalVisitSlotAddress(
      nBiome,
      nOccurrenceId('combat05'),
      'sideRooms',
      'sideDoor1',
    );
    const combat03SideDoor1 = createLocalVisitSlotAddress(
      nBiome,
      nOccurrenceId('combat03'),
      'sideRooms',
      'sideDoor1',
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceLocalVisitOrder',
      order: combat05Group,
      occurrenceIds: [nLocalOccurrenceId('combat05', 'sideDoor2')],
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetLocalVisitGeneration',
      slot: combat05SideDoor1,
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
        findings: expect.arrayContaining([
          expect.objectContaining({
            code: 'sideRoomGenerationUnavailable',
            origin: combat03SideDoor1,
          }),
          expect.objectContaining({
            code: 'sideRoomGenerationUnavailable',
            origin: combat05SideDoor1,
          }),
          expect.objectContaining({
            code: 'traitOfferMissing',
            origin: createTraitOfferAddress(
              createIncomingRewardAddress(nBiome, nOccurrenceId('combat03')),
              'self',
            ),
          }),
        ]),
      },
    });
  });

  it('does not offer a visit-referenced slot for closure even when the board would retain its minimum size', () => {
    const project = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'OpenHubSlot',
      slot: createHubSlotAddress(nBiome, 'hub', 'combat12'),
      occurrenceId: nOccurrenceId('close-referenced-slot'),
      localOccurrenceIdsBySlot: nLocalOccurrenceIdsBySlot('combat12'),
    });
    const candidate = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    ).evaluate({
      kind: 'hubSlot',
      slot: createHubSlotAddress(nBiome, 'hub', 'combat05'),
      open: false,
      occurrenceId: nOccurrenceId('combat05'),
      localOccurrenceIdsBySlot: {},
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
      localOccurrenceIdsBySlot: {},
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
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nLocalOccurrenceId('combat02', 'sideDoor1')),
      value: { rewardType: 'RoomMoneyTinyDrop' },
    });
    const { biome } = validN(project);
    const owner = createIncomingRewardAddress(nBiome, nLocalOccurrenceId('combat02', 'sideDoor1'));

    expect(biome.snapshot.decisions.find((decision) => decision.kind === 'hub')).toBeDefined();
    expect(
      biome.rewards.branches.some((branch) =>
        branch.events.some(
          (event) => semanticAddressKey(event.origin) === semanticAddressKey(owner),
        ),
      ),
    ).toBe(true);
  });

  it('keeps the Ephyra HubRewards bag independent from an Artificer conversion', () => {
    const owner = createIncomingRewardAddress(nBiome, nLocalOccurrenceId('combat02', 'sideDoor1'));
    let project = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'ReplaceManualArcanaSelection',
      route: createRouteAddress('Surface'),
      arcanaKeys: ['ChanneledCast', 'HealthRegen', 'BonusDodge', 'MetaToRunUpgrade'],
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: owner,
      value: { rewardType: 'MetaCurrencyDrop' },
    });
    project = authorTestArtificerReplacement(
      project,
      catalog,
      createAcquisitionRoleAddress(owner, 'self'),
      Object.freeze({
        offer: Object.freeze({ rewardType: 'MaxHealthDrop' }),
        traitOffersByAcquisitionRole: Object.freeze({}),
        dispositionByAcquisitionRole: Object.freeze({
          self: Object.freeze({ kind: 'normal' as const }),
        }),
      }),
    );
    const baseline = validN().biome.rewards.branches[0]?.bags.HubRewards;
    const converted = completeN(project).biome;
    const branch = converted.rewards.branches[0];
    expect(converted.validity).toBe('valid');
    expect(branch?.events).toContainEqual(
      expect.objectContaining({ kind: 'artificerConversion', origin: owner }),
    );
    expect(branch?.bags.HubRewards?.remainingEntryCounts).toEqual(baseline?.remainingEntryCounts);
  });
});

import { catalog, createCatalog } from '@run-planner/hades2-catalog';
import { declarations } from '@run-planner/hades2-catalog/test-support';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  createLocalChildAddress,
  createLocalChildGroupAddress,
  createLocalRewardAddress,
  createOccurrenceId,
  createProjectDocument,
  createDefaultRouteLoadout,
  createTargetAddress,
  createTraitOfferAddress,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
  simulateProject,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { evaluateProgressiveBiome } from '../../src/simulation/progressive/biome';

const defaultRouteLoadout = createDefaultRouteLoadout(catalog);

import {
  authorLegalTraitOffers,
  createRepresentativeNProject,
  nBiome,
  nOccurrenceId,
  nOpenSlotKeys,
} from '@run-planner/test-fixtures';

function catalogWithImpossibleEncounters(keys: readonly string[]) {
  const impossibleKeys = new Set(keys);
  return createCatalog({
    ...declarations,
    encounterDefinitions: declarations.encounterDefinitions.map((definition) =>
      impossibleKeys.has(definition.key)
        ? {
            ...definition,
            requirements: {
              kind: 'counterRange' as const,
              axis: 'biomeDepthCache' as const,
              range: { min: 999 },
            },
          }
        : definition,
    ),
  });
}

function openHub(slotCount: number, resolvedBoardRewards = false) {
  const opening = createOccurrenceId('progressive-n-opening');
  const preHub = createOccurrenceId('progressive-n-prehub');
  let project = createProjectDocument(catalog, {
    projectId: `progressive-n-${slotCount}`,
    name: 'Progressive N',
    configuredBiomeCounts: { Surface: 1 },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: nBiome,
    occurrenceId: opening,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(nBiome, opening),
    value: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'AphroditeUpgrade' },
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(createIncomingRewardAddress(nBiome, opening), 'source'),
    value: {
      kind: 'traits',
      giverKey: 'Aphrodite',
      options: [
        { traitKey: 'AphroditeWeaponBoon', rarity: 'Common' },
        { traitKey: 'AphroditeSpecialBoon', rarity: 'Common' },
        { traitKey: 'AphroditeCastBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  const openingDecision = createExitDecisionAddress(nBiome, {
    kind: 'occurrence',
    occurrenceId: opening,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision: openingDecision,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(nBiome, openingDecision.source, 'prehub'),
    occurrenceId: preHub,
    gameName: 'N_PreHub01',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(nBiome, preHub),
    value: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(createIncomingRewardAddress(nBiome, preHub), 'source'),
    value: {
      kind: 'traits',
      giverKey: 'Apollo',
      options: [
        { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        { traitKey: 'ApolloSprintBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  const preHubDecision = createExitDecisionAddress(nBiome, {
    kind: 'occurrence',
    occurrenceId: preHub,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision: preHubDecision,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceWithHubDecision',
    decision: preHubDecision,
    hub: createHubDecisionAddress(nBiome, 'hub'),
  });
  for (const slotKey of nOpenSlotKeys.slice(0, slotCount)) {
    project = applyProjectCommand(project, catalog, {
      kind: 'OpenHubSlot',
      slot: createHubSlotAddress(nBiome, 'hub', slotKey),
      occurrenceId: createOccurrenceId(`progressive-n-${slotKey}`),
    });
  }
  if (resolvedBoardRewards) {
    for (const [slotKey, value] of Object.entries({
      combat01: { rewardType: 'MaxHealthDropBig' },
      combat02: { rewardType: 'MaxManaDropBig' },
      combat03: { rewardType: 'WeaponUpgrade' },
      combat05: { rewardType: 'HermesUpgrade' },
      combat09: { rewardType: 'SpellDrop' },
      combat10: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource' as const, source: 'AphroditeUpgrade' },
      },
      combat11: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource' as const, source: 'AresUpgrade' },
      },
      combat23: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' },
      },
      miniBoss01: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource' as const, source: 'HephaestusUpgrade' },
      },
    })) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(nBiome, createOccurrenceId(`progressive-n-${slotKey}`)),
        value,
      });
    }
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(
        createIncomingRewardAddress(nBiome, createOccurrenceId('progressive-n-combat05')),
        'self',
      ),
      value: {
        kind: 'traits',
        giverKey: 'Hermes',
        options: [
          { traitKey: 'SprintShieldBoon', rarity: 'Common' },
          { traitKey: 'SorcerySpeedBoon', rarity: 'Common' },
          { traitKey: 'DodgeChanceBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    });
  }
  return authorLegalTraitOffers(project);
}

function nEvaluation(project: ReturnType<typeof openHub>) {
  const biome = simulateProject(catalog, project)
    .routes.find((route) => route.routeKey === 'Surface')
    ?.biomes.find((candidate) => candidate.biomeKey === 'N');
  if (biome === undefined) throw new Error('project lost N');
  return biome;
}

function progressiveN(project: ReturnType<typeof openHub>) {
  const plan = project.routes
    .find((route) => route.routeKey === 'Surface')
    ?.biomes.find((biome) => biome.biomeKey === 'N');
  if (plan === undefined) throw new Error('project lost authored N');
  const progressive = evaluateProgressiveBiome(catalog, nBiome, plan, {
    enteredBiomeCount: 1,
    loadout: defaultRouteLoadout,
  });
  if (progressive === null) throw new Error('N did not produce a progressive prefix');
  return progressive;
}

describe('Hub progressive biome evaluation', () => {
  it('retains an unopened Hub as incomplete rather than manufacturing a board', () => {
    const project = createProjectDocument(catalog, {
      projectId: 'progressive-n-empty',
      name: 'Progressive N empty',
      configuredBiomeCounts: { Surface: 1 },
    });
    const biome = nEvaluation(project as ReturnType<typeof openHub>);

    expect(biome).toMatchObject({
      authoring: 'incomplete',
      coverage: { kind: 'none', reason: 'notEvaluated' },
      origin: createBiomeAddress('Surface', 'N'),
    });
  });

  it('covers the generated Hub-board prefix before an insufficient joint board', () => {
    const biome = nEvaluation(openHub(8));
    if (biome.authoring !== 'incomplete' || !('materializedPrefix' in biome)) {
      throw new Error('N did not retain an incomplete prefix');
    }

    expect(biome.coverage).toMatchObject({
      kind: 'prefix',
      through: { checkpoint: 'afterTargetGeneration' },
    });
    expect(biome.materializedPrefix.entryRoom?.gameName).toBe('N_Opening01');
    expect(biome.materializedPrefix.decisions.map((decision) => decision.kind)).toEqual([
      'batch',
      'hub',
    ]);
    expect(
      biome.history.events.some(
        (event) => event.kind === 'roomCreated' && event.source === 'hubTarget',
      ),
    ).toBe(true);
  });

  it('publishes a complete open board as one prefix region before visits are authored', () => {
    const biome = nEvaluation(openHub(9, true));
    if (biome.authoring !== 'incomplete' || !('materializedPrefix' in biome)) {
      throw new Error('N board did not produce a prefix');
    }
    const hub = biome.materializedPrefix.decisions.find((decision) => decision.kind === 'hub');
    if (hub?.kind !== 'hub') throw new Error('N board lost Hub decision');

    expect(hub.board.targets).toHaveLength(9);
    expect(hub.board.targets.every((target) => !target.room.entered)).toBe(true);
    expect(
      biome.history.ledgers.roomCreations.filter((event) => event.source === 'hubTarget'),
    ).toHaveLength(9);
    expect(biome.coverage).toMatchObject({
      kind: 'prefix',
      through: {
        owner: hub.board.targets.at(-1)?.origin,
        checkpoint: 'afterTargetGeneration',
      },
    });
  });

  it('retains an explicit side-generation violation at the local child boundary', () => {
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
    const biome = nEvaluation(project as ReturnType<typeof openHub>);

    expect(biome).toMatchObject({ authoring: 'complete', validity: 'invalid' });
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

  it('orders one Hub visit as target lifecycle, side generation, then local lifecycle', () => {
    const base = createRepresentativeNProject();
    let sideBlocked = applyProjectCommand(base, catalog, {
      kind: 'ReplaceSideRoomEntryOrder',
      group: createLocalChildGroupAddress(nBiome, nOccurrenceId('combat05'), 'sideRooms'),
      enteredSlotKeys: ['sideDoor2'],
    });
    sideBlocked = applyProjectCommand(sideBlocked, catalog, {
      kind: 'ReplaceSideRoomGeneration',
      sideRoom: createLocalChildAddress(
        nBiome,
        nOccurrenceId('combat05'),
        'sideRooms',
        'sideDoor1',
      ),
      generation: 'notGenerated',
    });
    const evaluation = (project: typeof base, impossibleEncounterKeys: readonly string[]) => {
      const biome = simulateProject(
        catalogWithImpossibleEncounters(impossibleEncounterKeys),
        project,
      )
        .routes.find((route) => route.routeKey === 'Surface')
        ?.biomes.find((candidate) => candidate.biomeKey === 'N');
      if (
        biome?.authoring !== 'complete' ||
        biome.validity !== 'invalid' ||
        !('assessmentPrefix' in biome)
      ) {
        throw new Error('Hub phase-order fixture did not produce a bounded invalid evaluation');
      }
      return biome;
    };
    const targetLifecycle = evaluation(sideBlocked, ['GeneratedN', 'GeneratedNSubRoom']);
    const sideGeneration = evaluation(sideBlocked, ['GeneratedNSubRoom']);
    const localRoomLifecycle = evaluation(base, ['GeneratedNSubRoom']);
    const combat05 = nOccurrenceId('combat05');
    const localOwner = createLocalChildAddress(nBiome, combat05, 'sideRooms', 'sideDoor2');

    expect(targetLifecycle.coverage).toMatchObject({
      blockedAt: createEncounterPhaseAddress(
        nBiome,
        { kind: 'occurrence', occurrenceId: combat05 },
        'Encounter',
      ),
    });
    expect(targetLifecycle.assessmentPrefix?.frontier).toMatchObject({
      kind: 'hubVisit',
      phase: 'targetLifecycle',
    });
    expect(sideGeneration.coverage).toMatchObject({
      blockedAt: createLocalChildAddress(nBiome, combat05, 'sideRooms', 'sideDoor1'),
    });
    expect(sideGeneration.assessmentPrefix?.frontier).toMatchObject({
      kind: 'hubVisit',
      phase: 'sideGeneration',
    });
    expect(localRoomLifecycle.coverage).toMatchObject({
      blockedAt: createEncounterPhaseAddress(nBiome, localOwner, 'Encounter'),
    });
    expect(localRoomLifecycle.assessmentPrefix?.frontier).toMatchObject({
      kind: 'hubVisit',
      phase: 'localRoomLifecycle',
      enteredLocalRooms: [expect.objectContaining({ origin: localOwner })],
    });
  });

  it('publishes the reached visit as coverage at a Hub local frontier', () => {
    const project = applyProjectCommand(openHub(9, true), catalog, {
      kind: 'ReplaceHubVisitOrder',
      hub: createHubDecisionAddress(nBiome, 'hub'),
      hubSlotKeys: ['combat05'],
    });
    const biome = nEvaluation(project);

    expect(biome.coverage, JSON.stringify(biome.findings)).toMatchObject({
      kind: 'prefix',
      through: {
        owner: createHubVisitAddress(nBiome, 'hub', 1),
        checkpoint: 'afterTargetGeneration',
      },
    });
    expect(biome.findings).toContainEqual(
      expect.objectContaining({
        code: 'sideRoomGenerationUnavailable',
        origin: createLocalChildAddress(
          nBiome,
          createOccurrenceId('progressive-n-combat05'),
          'sideRooms',
          'sideDoor1',
        ),
      }),
    );
  });

  it('retains physical board targets and the active visit through their invalid regions', () => {
    const boardProject = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat10')),
      value: { rewardType: 'WeaponUpgrade' },
    });
    const board = progressiveN(boardProject as ReturnType<typeof openHub>);
    const retainedBoard = board.materializedPrefix.decisions.find(
      (decision) => decision.kind === 'hub',
    );
    if (retainedBoard?.kind !== 'hub') throw new Error('invalid board lost its Hub decision');

    expect(board.assessmentPrefix?.frontier).toMatchObject({ kind: 'hubBoard' });
    expect(retainedBoard.board.targets).toHaveLength(9);
    expect(retainedBoard.visits.map((visit) => visit.visitIndex)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(
      board.history.events.filter(
        (event) => event.kind === 'roomCreated' && event.source === 'hubTarget',
      ),
    ).toHaveLength(9);
    // The authored visit roster stays visible, but the invalid board does not
    // manufacture any entered Hub traversal or return lifecycle.
    expect(board.history.events.some((event) => event.kind === 'roomRestored')).toBe(false);
    expect(board.rewards.findings).toContainEqual(
      expect.objectContaining({
        code: 'rewardBagEntryUnavailable',
        origin: createIncomingRewardAddress(nBiome, nOccurrenceId('combat10')),
      }),
    );

    let sideProject = createRepresentativeNProject();
    sideProject = applyProjectCommand(sideProject, catalog, {
      kind: 'ReplaceSideRoomEntryOrder',
      group: createLocalChildGroupAddress(nBiome, nOccurrenceId('combat05'), 'sideRooms'),
      enteredSlotKeys: ['sideDoor2'],
    });
    sideProject = applyProjectCommand(sideProject, catalog, {
      kind: 'ReplaceSideRoomGeneration',
      sideRoom: createLocalChildAddress(
        nBiome,
        nOccurrenceId('combat05'),
        'sideRooms',
        'sideDoor1',
      ),
      generation: 'notGenerated',
    });
    const side = progressiveN(sideProject as ReturnType<typeof openHub>);
    const frontier = side.assessmentPrefix?.frontier;

    expect(frontier).toMatchObject({
      kind: 'hubVisit',
      phase: 'sideGeneration',
      target: { hubSlotKey: 'combat05' },
      enteredLocalRooms: [],
      parentRestores: [],
    });
    expect(
      side.history.rooms.find(
        (room) =>
          room.origin.kind === 'occurrence' &&
          room.origin.occurrenceId === nOccurrenceId('combat05'),
      )?.outgoingGeneration,
    ).toBeDefined();
    expect(
      side.history.rooms.some(
        (room) =>
          room.origin.kind === 'localChild' &&
          room.origin.occurrenceId === nOccurrenceId('combat05'),
      ),
    ).toBe(false);
    expect(side.history.events.some((event) => event.kind === 'roomRestored')).toBe(false);
  });

  it('blocks at invalid Hub board generation before a simultaneous first-visit failure', () => {
    let project = createRepresentativeNProject();
    const boardReward = createIncomingRewardAddress(nBiome, nOccurrenceId('combat10'));
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: boardReward,
      value: { rewardType: 'WeaponUpgrade' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSideRoomEntryOrder',
      group: createLocalChildGroupAddress(nBiome, nOccurrenceId('combat05'), 'sideRooms'),
      enteredSlotKeys: ['sideDoor2'],
    });
    const laterVisitFailure = createLocalChildAddress(
      nBiome,
      nOccurrenceId('combat05'),
      'sideRooms',
      'sideDoor1',
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSideRoomGeneration',
      sideRoom: laterVisitFailure,
      generation: 'notGenerated',
    });
    const biome = nEvaluation(project as ReturnType<typeof openHub>);
    if (
      biome.authoring !== 'complete' ||
      biome.validity !== 'invalid' ||
      !('assessmentPrefix' in biome)
    ) {
      throw new Error('simultaneous Hub failure did not produce a bounded invalid evaluation');
    }

    expect(biome.coverage).toMatchObject({ kind: 'prefix', blockedAt: boardReward });
    expect(biome.assessmentPrefix?.frontier).toMatchObject({ kind: 'hubBoard' });
    expect(biome.findings).toContainEqual(
      expect.objectContaining({ code: 'rewardBagEntryUnavailable', origin: boardReward }),
    );
    expect(biome.findings).not.toContainEqual(
      expect.objectContaining({ origin: laterVisitFailure }),
    );
  });

  it('stops a local reward-bag failure within side generation before Hub entry', () => {
    let project = createRepresentativeNProject();
    for (const slotKey of ['sideDoor1', 'sideDoor2'] as const) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceLocalReward',
        reward: createLocalRewardAddress(nBiome, nOccurrenceId('combat05'), 'sideRooms', slotKey),
        value: { rewardType: 'AirBoost' },
      });
    }
    const progressive = progressiveN(project as ReturnType<typeof openHub>);
    const frontier = progressive.assessmentPrefix?.frontier;

    expect(frontier).toMatchObject({
      kind: 'hubVisit',
      phase: 'sideGeneration',
      target: { hubSlotKey: 'combat05' },
      enteredLocalRooms: [],
      parentRestores: [],
    });
    expect(progressive.findings).toContainEqual(
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
    expect(
      progressive.history.ledgers.roomCreations.some(
        (event) =>
          event.origin.kind === 'localChild' &&
          event.origin.occurrenceId === nOccurrenceId('combat05'),
      ),
    ).toBe(true);
    expect(progressive.history.events.some((event) => event.kind === 'roomRestored')).toBe(false);
  });

  it('keeps incomplete Hub selection explicit while still evaluating the board-completing slot', () => {
    const project = openHub(8);
    const candidates = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );

    expect(
      candidates.evaluate({
        kind: 'hubSlot',
        slot: createHubSlotAddress(nBiome, 'hub', nOpenSlotKeys[8]!),
        open: true,
        occurrenceId: createOccurrenceId('progressive-n-completing-slot'),
      }),
    ).toMatchObject({ kind: 'hubSlot', result: { selectedPossible: true } });

    const empty = createProjectDocument(catalog, {
      projectId: 'progressive-n-candidate-empty',
      name: 'Progressive N candidate empty',
      configuredBiomeCounts: { Surface: 1 },
    });
    expect(
      createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, empty),
      ).evaluate({
        kind: 'hubSlot',
        slot: createHubSlotAddress(nBiome, 'hub', 'combat01'),
        open: true,
        occurrenceId: createOccurrenceId('progressive-n-uncovered-slot'),
      }),
    ).toEqual({
      kind: 'unavailable',
      reason: 'coverageNotReached',
      evidence: {
        kind: 'coverageNotReached',
        requiredOwner: createHubSlotAddress(nBiome, 'hub', 'combat01'),
        requiredCheckpoint: 'afterTargetGeneration',
        coverage: { kind: 'none', reason: 'notEvaluated' },
      },
    });

    // The Hub exists here, but its board is deliberately still empty.  The
    // minimum open count is a board-level completeness finding, not a reason
    // to make the first physical-door action unavailable.
    const freshBoard = openHub(0);
    const firstSlot = {
      kind: 'hubSlot' as const,
      slot: createHubSlotAddress(nBiome, 'hub', nOpenSlotKeys[0]!),
      open: true,
      occurrenceId: createOccurrenceId('progressive-n-first-slot'),
    };
    expect(
      createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, freshBoard),
      ).evaluate(firstSlot),
    ).toMatchObject({
      kind: 'hubSlot',
      result: { selectedPossible: true, findings: [] },
    });
    const withFirstSlot = applyProjectCommand(freshBoard, catalog, {
      kind: 'OpenHubSlot',
      slot: firstSlot.slot,
      occurrenceId: firstSlot.occurrenceId,
    });
    const hub = withFirstSlot.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N')
      ?.topology?.decisions.find((decision) => decision.kind === 'hub');
    expect(hub).toMatchObject({ kind: 'hub', openTargets: [{ hubSlotKey: nOpenSlotKeys[0] }] });
  });

  it('derives one-based Hub visit addresses from aggregate authored order', () => {
    const project = applyProjectCommand(openHub(9), catalog, {
      kind: 'ReplaceHubVisitOrder',
      hub: createHubDecisionAddress(nBiome, 'hub'),
      hubSlotKeys: ['combat05'],
    });
    const plan = project.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N');

    expect(plan?.topology?.decisions).toContainEqual(
      expect.objectContaining({ kind: 'hub', visitOrder: ['combat05'] }),
    );
  });
});

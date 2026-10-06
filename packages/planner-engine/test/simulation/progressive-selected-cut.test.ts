import { describe, expect, it } from 'vitest';
import {
  createAcquisitionRoleAddress,
  createBiomeAddress,
  createAdditionalExitAddress,
  createEncounterPhaseAddress,
  createRoomActionAddress,
  createRoomFeatureAddress,
  createRoomRunStateCheckpointAddress,
  createRouteAddress,
  createRouteStartKeepsakeSelectionAddress,
  createShopOfferAddress,
  type OccurrenceId,
  type ProjectDocument,
  roomActionKey,
  type RoomRunStateCheckpointAddress,
} from '@run-planner/engine/authored-project';
import type { ResourceFamily } from '@run-planner/engine/catalog-schema';
import {
  encounterPhaseCandidateSupportForProjectEvaluationAssembly,
  encounterPhaseFigLeafSupportForProjectEvaluationAssembly,
  generatedEncounterSupportForProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';
import {
  createSurfaceNUnresolvedBossHermesDeliveryCheckpoint,
  loadSurfaceNOProject,
  nBiome,
  qBiome,
  qOccurrenceIds,
  surfaceShrineDeliveriesProject,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceIds,
  surfaceEncounterShowcaseProject,
  surfaceTravelDealRefillAnvilProject,
  surfaceTravelDealRefillAnvilResult,
} from '@run-planner/test-fixtures/surface';
import {
  createCompleteFGProject,
  createUnderworldFPoolCheckpoint,
  underworldWorldShopTravelDealProject,
} from '@run-planner/test-fixtures/underworld';
import { replaceTestShopOfferActions } from '@run-planner/test-fixtures/shared';
import { freshFileRouteFrontierWalk } from '@run-planner/test-fixtures/fresh-file';

import * as fixture from './support/progressive-biome-fixtures';

const {
  applyProjectCommand,
  authorLegalTraitOffers,
  bindTestCandidateSession,
  catalog,
  candidateArtifactsForProjectEvaluationAssembly,
  createExitDecisionAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createTargetAddress,
  createTraitOfferAddress,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenGBiome,
  goldenGOccurrenceId,
  goldenHBiome,
  createGoldenFGHIProject,
  partialGWithEarlierInvalidReward,
  prefix,
  simulateProject,
  simulateProjectAssembly,
  semanticAddressKey,
  source,
} = fixture;

describe('selected cut products', () => {
  it('keeps the whole doors opening when a door offer blocks before a later door fails', () => {
    const fixture = partialGWithEarlierInvalidReward();
    const { evaluation } = prefix(fixture.project, 'Underworld', 'G');

    expect(evaluation.coverage.blockedAt).toEqual(
      createIncomingRewardAddress(goldenGBiome, fixture.firstTarget),
    );
    expect(evaluation.assessmentPrefix?.frontier).toMatchObject({
      kind: 'exitDecision',
      targets: [
        {
          origin: createTargetAddress(goldenGBiome, source(fixture.source), 'exit1'),
          room: { occurrenceId: fixture.firstTarget },
        },
        {
          origin: createTargetAddress(goldenGBiome, source(fixture.source), 'exit2'),
        },
      ],
    });
    expect(
      bindTestCandidateSession(catalog, fixture.project).evaluate({
        kind: 'incomingReward',
        reward: createIncomingRewardAddress(goldenGBiome, fixture.firstTarget),
        // The run-scoped ledger keeps both G batches on the Meta bag.
        value: { rewardType: 'MetaCardPointsCommonBigDrop' },
      }),
    ).toMatchObject({ kind: 'incomingReward', result: { supported: true } });
    expect(
      bindTestCandidateSession(catalog, fixture.project).evaluate({
        kind: 'incomingReward',
        reward: createIncomingRewardAddress(
          goldenGBiome,
          createOccurrenceId('progressive-invalid-g-combat10'),
        ),
        value: { rewardType: 'MetaCardPointsCommonBigDrop' },
      }),
    ).toMatchObject({ kind: 'unavailable' });
    // Door offers share one store: the later door's generation belongs to the same blocking product.
    expect(
      bindTestCandidateSession(catalog, fixture.project).evaluate({
        kind: 'roomTarget',
        target: createTargetAddress(goldenGBiome, source(fixture.source), 'exit2'),
        gameName: 'G_Combat02',
      }),
    ).toMatchObject({ kind: 'roomTarget' });
    const retainedBatch = evaluation.roomGeneration.ordinary.ordinaryBatches.find(
      (batch) =>
        semanticAddressKey(batch.origin) ===
        semanticAddressKey(createExitDecisionAddress(goldenGBiome, source(fixture.source))),
    );
    expect(retainedBatch?.targets.map((target) => target.origin.exitKey)).toEqual([
      'exit1',
      'exit2',
    ]);
    expect(evaluation.findings).toContainEqual(
      expect.objectContaining({
        origin: createTargetAddress(goldenGBiome, source(fixture.source), 'exit2'),
      }),
    );
  });

  it('replays every physical peer when a later forced room changes the shared batch store', () => {
    const target = goldenFOccurrenceId(5, 2);
    let project = applyProjectCommand(authorLegalTraitOffers(createGoldenFGHIProject()), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenFBiome, target),
      gameName: 'F_Combat01',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(goldenFBiome, target),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HestiaUpgrade' } },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(createIncomingRewardAddress(goldenFBiome, target), 'source'),
      value: {
        kind: 'traits',
        giverKey: 'Hestia',
        options: [
          { traitKey: 'HestiaWeaponBoon', rarity: 'Common' },
          { traitKey: 'HestiaSprintBoon', rarity: 'Common' },
          { traitKey: 'HestiaManaBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    });

    const assembly = simulateProjectAssembly(catalog, project);
    expect(() => simulateProject(catalog, project)).not.toThrow();
    const evaluation = assembly.evaluation.route?.biomes.find(
      (candidate) => candidate.biomeKey === 'F',
    );
    const artifacts =
      candidateArtifactsForProjectEvaluationAssembly(assembly).biomeAt(goldenFBiome);
    const firstReward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(5, 1));
    const laterReward = createIncomingRewardAddress(goldenFBiome, target);
    expect(artifacts?.rewardProducers.at(firstReward)).toMatchObject({
      acquisitionHorizon: 'ownEnteredLifecycle',
      resolvedStoreKey: 'RunProgress',
    });
    expect(artifacts?.rewardProducers.at(laterReward)).toBeUndefined();
    expect(
      artifacts?.traitOffers.at(createTraitOfferAddress(laterReward, 'source')),
    ).toBeUndefined();
    expect(evaluation).toMatchObject({
      authoring: 'complete',
      validity: 'invalid',
      coverage: { kind: 'prefix' },
    });
    expect(evaluation?.coverage).toMatchObject({
      blockedAt: firstReward,
    });
    expect(evaluation?.findings).toContainEqual(
      expect.objectContaining({
        code: 'rewardBagEntryUnavailable',
        origin: firstReward,
      }),
    );
  });
});

const pCombat02 = fixture.createOccurrenceId('surface-p-2-1-p_combat02');
const pCombat04 = fixture.createOccurrenceId('surface-p-3-1-p_combat04');
const pCombat07 = fixture.createOccurrenceId('surface-p-4-1-p_combat07');

function placeResource(project: ProjectDocument, family: ResourceFamily): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceResourcePlacement',
    route: createRouteAddress('Surface'),
    family,
    value: { biomeKey: 'P', occurrenceId: pCombat04 },
  });
}

/** An unsupported generated composition stops P_Combat07 at its own preparation. */
function blockPCombat07(project: ProjectDocument): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceEncounterCustomization',
    phase: createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pCombat07 },
      'Intro',
    ),
    decisionKey: 'generatedComposition',
    value: {
      kind: 'generated',
      baseRoll: 9999,
      waveCount: 1,
      waves: [{ waveIndex: 1, typeKeys: ['SentryBot', 'Dragon'], allocations: { SentryBot: 206 } }],
    },
  });
}

function biomeEvaluation(project: ProjectDocument, biomeKey: string) {
  const evaluation = simulateProject(catalog, project).route?.biomes.find(
    (candidate) => candidate.biomeKey === biomeKey,
  );
  if (
    evaluation === undefined ||
    !('assessmentPrefix' in evaluation) ||
    evaluation.coverage.kind !== 'prefix'
  )
    throw new Error(`${biomeKey} lost its blocked evaluation`);
  return Object.freeze({ ...evaluation, coverage: evaluation.coverage });
}

function runStateAvailability(
  evaluation: ReturnType<typeof biomeEvaluation>,
  owner: RoomRunStateCheckpointAddress,
) {
  return evaluation.rewards.runStateAvailability.find(
    (entry) => semanticAddressKey(entry.owner) === semanticAddressKey(owner),
  )?.availability;
}

function exited(evaluation: ReturnType<typeof biomeEvaluation>, occurrenceId: OccurrenceId) {
  return evaluation.history.events.some(
    (event) =>
      event.kind === 'roomExited' &&
      event.origin.kind === 'occurrence' &&
      event.origin.occurrenceId === occurrenceId,
  );
}

describe('source room exit before a later block', () => {
  it('settles the source room exit and its resource before a next-room Overview block', () => {
    const p = biomeEvaluation(
      blockPCombat07(placeResource(surfaceEncounterShowcaseProject(), 'Pickaxe')),
      'P',
    );

    expect(p.coverage.blockedAt).toEqual(
      createEncounterPhaseAddress(pBiome, { kind: 'occurrence', occurrenceId: pCombat07 }, 'Intro'),
    );
    expect(exited(p, pCombat04)).toBe(true);
    expect(
      runStateAvailability(
        p,
        createRoomRunStateCheckpointAddress(createOccurrenceAddress(pBiome, pCombat04), {
          kind: 'beforeRoomExit',
        }),
      ),
    ).toBe('available');
    expect(
      runStateAvailability(
        p,
        createRoomRunStateCheckpointAddress(createOccurrenceAddress(pBiome, pCombat07), {
          kind: 'roomEntered',
        }),
      ),
    ).toBe('available');
    // Its encounter composition is an Overview product: the Timeline never starts.
    expect(
      p.history.events.some(
        (event) =>
          event.kind === 'encounterStarted' &&
          event.origin.kind === 'occurrence' &&
          event.origin.occurrenceId === pCombat07,
      ),
    ).toBe(false);
    for (const branch of p.rewards.branches)
      expect(branch.state.traitHistory.events).toContainEqual(
        expect.objectContaining({
          kind: 'elementContribution',
          owner: createOccurrenceAddress(pBiome, pCombat04),
          acquisitionPoint: 'roomExited',
        }),
      );
  });

  it("blocks a picked host's illegal resource placement at its Overview", () => {
    const p = biomeEvaluation(
      blockPCombat07(placeResource(surfaceEncounterShowcaseProject(), 'Fishing')),
      'P',
    );

    expect(p.coverage.blockedAt).toEqual(
      createRoomFeatureAddress(createOccurrenceAddress(pBiome, pCombat04), {
        kind: 'resource',
        family: 'Fishing',
      }),
    );
    // The preceding room P_Combat02 still settles its own exit.
    expect(exited(p, pCombat02)).toBe(true);
    expect(
      runStateAvailability(
        p,
        createRoomRunStateCheckpointAddress(createOccurrenceAddress(pBiome, pCombat02), {
          kind: 'beforeRoomExit',
        }),
      ),
    ).toBe('available');
    // P_Combat04 is entered; its Timeline, doors and exit are unreached.
    expect(roomEvents(p, pCombat04).map((event) => event.kind)).toEqual([
      'roomCreated',
      'roomPrepared',
      'encounterRecorded',
      'encounterRecorded',
      'roomEntered',
    ]);
    expect(p.coverage.roomTimeline).toBeUndefined();
    for (const [kind, availability] of [
      ['roomEntered', 'available'],
      ['beforeRoomExit', 'unavailable'],
    ] as const)
      expect(
        runStateAvailability(
          p,
          createRoomRunStateCheckpointAddress(createOccurrenceAddress(pBiome, pCombat04), {
            kind,
          }),
        ),
      ).toBe(availability);
  });

  it('keeps an invalid door offer before the source room exit', () => {
    const project = applyProjectCommand(surfaceEncounterShowcaseProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(pBiome, pCombat07),
      value: { rewardType: 'WeaponUpgrade' },
    });
    const p = biomeEvaluation(project, 'P');

    expect(p.coverage.blockedAt).toEqual(createIncomingRewardAddress(pBiome, pCombat07));
    expect(p.findings).toContainEqual(
      expect.objectContaining({
        code: 'rewardBagEntryUnavailable',
        origin: createIncomingRewardAddress(pBiome, pCombat07),
      }),
    );
    // Doors are generated before the source room's purchases, commit and exit.
    expect(exited(p, pCombat04)).toBe(false);
    expect(
      runStateAvailability(
        p,
        createRoomRunStateCheckpointAddress(createOccurrenceAddress(pBiome, pCombat04), {
          kind: 'beforeRoomExit',
        }),
      ),
    ).toBe('unavailable');
    expect(
      bindTestCandidateSession(catalog, project).evaluate({
        kind: 'incomingReward',
        reward: createIncomingRewardAddress(pBiome, pCombat07),
        value: { rewardType: 'HermesUpgrade' },
      }),
    ).toMatchObject({ kind: 'incomingReward', result: { supported: true } });
  });
});

const pCombat12 = fixture.createOccurrenceId('surface-p-8-1-p_combat12');
const prebossShop = pOccurrenceIds.prebossShop;

function roomEvents(evaluation: ReturnType<typeof biomeEvaluation>, occurrenceId: OccurrenceId) {
  return evaluation.history.events.filter(
    (event) => event.origin.kind === 'occurrence' && event.origin.occurrenceId === occurrenceId,
  );
}

describe('room Overview block', () => {
  it('enters a Shop whose inventory blocks and stops before its Timeline', () => {
    const boon = createShopOfferAddress(pBiome, prebossShop, 'Boon');
    const project = applyProjectCommand(surfaceEncounterShowcaseProject(), catalog, {
      kind: 'ReplaceShopOffer',
      offer: boon,
      value: { rewardType: 'RandomLoot', payload: { kind: 'BoonSource', source: 'HeraUpgrade' } },
    });
    const p = biomeEvaluation(project, 'P');

    expect(p.coverage.blockedAt).toEqual(boon);
    expect(p.findings).toContainEqual(
      expect.objectContaining({ code: 'shopOfferUnavailable', origin: boon }),
    );
    // The source room has exited and the Shop is entered with its entry Run State.
    expect(exited(p, pCombat12)).toBe(true);
    for (const [occurrenceId, kind] of [
      [pCombat12, 'beforeRoomExit'],
      [prebossShop, 'roomEntered'],
    ] as const)
      expect(
        runStateAvailability(
          p,
          createRoomRunStateCheckpointAddress(createOccurrenceAddress(pBiome, occurrenceId), {
            kind,
          }),
        ),
      ).toBe('available');
    // Nothing of the Shop's Timeline or Exit is evaluated.
    expect(roomEvents(p, prebossShop).map((event) => event.kind)).toEqual([
      'roomCreated',
      'roomPrepared',
      'encounterRecorded',
      'offerPointMaterialized',
      'roomEntered',
    ]);
    expect(
      bindTestCandidateSession(catalog, project).evaluate({
        kind: 'shopOffer',
        offer: boon,
        value: {
          rewardType: 'RandomLoot',
          payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
        },
      }),
    ).toMatchObject({ kind: 'shopOffer', result: { supported: true } });
  });
});

describe('room Overview block keeps its incoming reward candidates', () => {
  it('assesses an Overview-stopped room reward offer without its unreached pickup', () => {
    // fresh-3-0 stops at its encounter Overview; its Apollo Boon offer has no trait offer yet.
    const project = freshFileRouteFrontierWalk()[3]!;
    const room = createOccurrenceId('fresh-3-0');
    const f = biomeEvaluation(project, 'F');
    expect(f.coverage.blockedAt).toMatchObject({ kind: 'encounterPhase', phaseKey: 'Encounter' });

    expect(
      bindTestCandidateSession(catalog, project).evaluate({
        kind: 'incomingReward',
        reward: createIncomingRewardAddress(createBiomeAddress('FreshFile', 'F'), room),
        value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
      }),
    ).toMatchObject({ kind: 'incomingReward', result: { supported: true } });
  });
});

describe('room Overview block keeps its entry continuations', () => {
  it('creates the Chaos gate of a host whose encounter blocks its Overview', () => {
    const chaosId = createOccurrenceId('progressive-overview-chaos');
    let project = applyProjectCommand(surfaceEncounterShowcaseProject(), catalog, {
      kind: 'AddChaos',
      additional: createAdditionalExitAddress(pBiome, pCombat07, 'chaos'),
      occurrenceId: chaosId,
    });
    project = blockPCombat07(project);
    const p = biomeEvaluation(project, 'P');

    expect(p.coverage.blockedAt).toMatchObject({ kind: 'encounterPhase', phaseKey: 'Intro' });
    expect(roomEvents(p, pCombat07).some((event) => event.kind === 'roomEntered')).toBe(true);
    // The gate is created on the host's entry, inside its Overview.
    expect(
      p.history.events.some(
        (event) =>
          event.kind === 'roomCreated' &&
          event.source === 'additionalExit' &&
          event.origin.kind === 'occurrence' &&
          event.origin.occurrenceId === chaosId,
      ),
    ).toBe(true);
  });
});

describe('room Overview block keeps the room entry effects', () => {
  it('flushes Shrine deliveries at a Q Preboss Shop whose inventory blocks', () => {
    const entryOwner = createRoomRunStateCheckpointAddress(
      createOccurrenceAddress(qBiome, qOccurrenceIds.preboss),
      { kind: 'roomEntered' },
    );
    const entrySnapshot = (project: ProjectDocument) => {
      const q = simulateProject(catalog, project).route?.biomes.find(
        (candidate) => candidate.biomeKey === 'Q',
      );
      return q !== undefined && 'rewards' in q
        ? q.rewards.runStateSnapshots.find(
            (snapshot) => semanticAddressKey(snapshot.owner) === semanticAddressKey(entryOwner),
          )
        : undefined;
    };
    const valid = surfaceShrineDeliveriesProject();
    const blocked = applyProjectCommand(valid, catalog, {
      kind: 'ReplaceShopOffer',
      offer: createShopOfferAddress(qBiome, qOccurrenceIds.preboss, 'MixedProgress1'),
      value: { rewardType: 'RandomLoot', payload: { kind: 'BoonSource', source: 'HeraUpgrade' } },
    });
    expect(biomeEvaluation(blocked, 'Q').coverage.blockedAt).toMatchObject({
      kind: 'shopOffer',
      offerKey: 'MixedProgress1',
    });
    const flushed = entrySnapshot(valid)?.pendingHermesShrineDeliveries;
    expect(Object.values(flushed ?? {})).toContainEqual(
      expect.objectContaining({
        remainingUses: 0,
        due: expect.objectContaining({ cause: 'flush' }),
      }),
    );
    expect(entrySnapshot(blocked)?.pendingHermesShrineDeliveries).toEqual(flushed);
  });
});

describe('room Overview block for a Shrine inventory', () => {
  it('enters a Ship Shrine host and stops before its first encounter', () => {
    const hostId = oOccurrenceIds.combat07;
    const host = createOccurrenceAddress(oBiome, hostId);
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'SetHermesShrinePresence',
      occurrence: host,
      present: true,
    });
    // SpellDrop belongs to the second group, so the first slot is a wrong-group inventory.
    for (const [slotKey, rewardType] of [
      ['first', 'SpellDrop'],
      ['secondLeft', 'MaxHealthDrop'],
      ['secondRight', 'MaxManaDrop'],
    ] as const)
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceHermesShrineOffer',
        occurrence: host,
        slotKey,
        value: { rewardType },
      });
    const o = biomeEvaluation(project, 'O');

    expect(o.coverage.blockedAt).toMatchObject({ kind: 'roomFeature', occurrenceId: hostId });
    // A Ship host has no entry Run State; its entry-time Shrine assessment is published.
    expect(
      o.rewards.hermesShrineAssessments.some(
        (entry) => semanticAddressKey(entry.origin) === semanticAddressKey(host),
      ),
    ).toBe(true);
    expect(roomEvents(o, hostId).some((event) => event.kind === 'roomEntered')).toBe(true);
    expect(roomEvents(o, hostId).some((event) => event.kind === 'encounterStarted')).toBe(false);
  });
});

describe('encounters in the room Overview', () => {
  const combat07 = oOccurrenceIds.combat07;
  const shipPhase = (phaseKey: string) =>
    createEncounterPhaseAddress(oBiome, { kind: 'occurrence', occurrenceId: combat07 }, phaseKey);

  it('blocks a later Ship phase composition at the Overview with every phase editable', () => {
    let project = applyProjectCommand(surfaceEncounterShowcaseProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence: createOccurrenceAddress(oBiome, combat07),
      encounterCount: 3,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase: shipPhase('Combat2'),
      decisionKey: 'generatedComposition',
      value: {
        kind: 'generated',
        baseRoll: 9999,
        waveCount: 1,
        waves: [
          { waveIndex: 1, typeKeys: ['SentryBot', 'Dragon'], allocations: { SentryBot: 206 } },
        ],
      },
    });
    const assembly = simulateProjectAssembly(catalog, project);
    const o = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'O');
    if (o === undefined || !('history' in o)) throw new Error('O lost its evaluation');

    expect(o.issue).toMatchObject({
      kind: 'invalid',
      owner: shipPhase('Combat2'),
      reasons: [expect.objectContaining({ code: 'encounterCustomizationUnavailable' })],
    });
    const events = o.history.events.filter(
      (event) => event.origin.kind === 'occurrence' && event.origin.occurrenceId === combat07,
    );
    // Entered with every phase recorded; the Intro never starts.
    expect(events.filter((event) => event.kind === 'encounterRecorded')).toHaveLength(3);
    expect(events.some((event) => event.kind === 'roomEntered')).toBe(true);
    expect(events.some((event) => event.kind === 'encounterStarted')).toBe(false);
    expect(exited(biomeEvaluation(project, 'O'), oOccurrenceIds.combat04)).toBe(true);
    for (const phaseKey of ['Intro', 'Combat1', 'Combat2']) {
      expect(
        encounterPhaseCandidateSupportForProjectEvaluationAssembly(assembly, shipPhase(phaseKey)),
      ).toBeDefined();
      expect(
        generatedEncounterSupportForProjectEvaluationAssembly(assembly, shipPhase(phaseKey)),
      ).toBeDefined();
    }
  });

  it('assesses a first-phase Fig Leaf skip against the room entry state', () => {
    const occurrenceId = createOccurrenceId('surface-p-1-1-p_combat03');
    const intro = createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId },
      'Intro',
    );
    const project = applyProjectCommand(surfaceEncounterShowcaseProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'SkipEncounterKeepsake',
    });
    const assembly = simulateProjectAssembly(catalog, project);
    const p = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'P');
    if (p === undefined || !('rewards' in p)) throw new Error('P lost its evaluation');
    const entry = p.rewards.runStateSnapshots.find(
      (snapshot) =>
        semanticAddressKey(snapshot.owner) ===
        semanticAddressKey(
          createRoomRunStateCheckpointAddress(createOccurrenceAddress(pBiome, occurrenceId), {
            kind: 'roomEntered',
          }),
        ),
    );
    expect(encounterPhaseFigLeafSupportForProjectEvaluationAssembly(assembly, intro)).toMatchObject(
      {
        supported: true,
        remainingUses: entry?.keepsakes.figLeaf?.remainingUses,
        activatedThisBiome: entry?.keepsakes.figLeaf?.activatedThisBiome,
      },
    );
  });
});

describe('room Timeline block', () => {
  const rowKey = (reference: Parameters<typeof roomActionKey>[0]) => roomActionKey(reference);

  it('keeps an earlier Shop purchase offer when the Travel Deal refill offer is missing', () => {
    const shopId = createOccurrenceId('golden-f-preboss-shop');
    const shop = createOccurrenceAddress(goldenFBiome, shopId);
    const boon = createShopOfferAddress(goldenFBiome, shopId, 'Boon');
    const refill = createShopOfferAddress(goldenFBiome, shopId, 'travelDealRefill');
    const refillRow = {
      kind: 'interactAcquisitionEntry' as const,
      siteKey: 'roomExit' as const,
      entryKey: 'travelDealRefill',
    };
    let project = replaceTestShopOfferActions(
      underworldWorldShopTravelDealProject(),
      catalog,
      shop,
      ['Boon'],
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'MoveRoomAction',
      action: createRoomActionAddress(goldenFBiome, shopId, rowKey(refillRow)),
      toIndex: 1,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopOffer',
      offer: refill,
      value: { rewardType: 'RandomLoot', payload: { kind: 'BoonSource', source: 'HeraUpgrade' } },
    });
    project = authorLegalTraitOffers(project);
    // A new refill source resets its offer: the purchased Boon's offer stays authored.
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopOffer',
      offer: refill,
      value: { rewardType: 'RandomLoot', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
    });
    const assembly = simulateProjectAssembly(catalog, project);
    const f = biomeEvaluation(project, 'F');
    const refillTrait = createTraitOfferAddress(refill, 'source');
    const boonTrait = createTraitOfferAddress(boon, 'source');

    expect(f.coverage.blockedAt).toEqual(refillTrait);
    expect(f.coverage.roomTimeline).toEqual({ room: shop, blockingRowKeys: [rowKey(refillRow)] });
    expect(f.rewards.selectedTraitOffers).toContainEqual(
      expect.objectContaining({ address: boonTrait }),
    );
    const artifacts =
      candidateArtifactsForProjectEvaluationAssembly(assembly).biomeAt(goldenFBiome);
    expect(artifacts?.traitOffers.at(boonTrait)).toBeDefined();
    // The blocking contact keeps its own pre-offer capability.
    expect(artifacts?.traitOffers.at(refillTrait)).toBeDefined();
    expect(exited(f, shopId)).toBe(false);
  });

  it("keeps a combat room's encounter and entry Run State before its invalid reward offer", () => {
    const completeProject = authorLegalTraitOffers(createGoldenFGHIProject());
    const minibossId = createOccurrenceId('golden-h-miniboss01');
    const h = simulateProject(catalog, completeProject).route?.biomes.find(
      (candidate) => candidate.biomeKey === 'H',
    );
    const selected =
      h !== undefined && 'rewards' in h
        ? h.rewards.selectedTraitOffers.find(
            (offer) =>
              offer.address.owner.kind === 'incomingReward' &&
              offer.address.owner.occurrenceId === minibossId,
          )
        : undefined;
    if (selected === undefined || selected.offer.kind !== 'traits')
      throw new Error('H miniboss has no selected trait offer');
    const [first, second, third] = selected.offer.options;
    if (first === undefined || second === undefined || third === undefined)
      throw new Error('H miniboss trait offer is incomplete');
    const project = applyProjectCommand(completeProject, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: selected.address,
      value: {
        ...selected.offer,
        options: [{ ...first, rarity: 'Heroic' }, second, third],
      },
    });
    const blocked = biomeEvaluation(project, 'H');
    const miniboss = createOccurrenceAddress(goldenHBiome, minibossId);

    expect(blocked.coverage.blockedAt).toEqual(selected.address);
    const events = roomEvents(blocked, minibossId).map((event) => event.kind);
    expect(events).toEqual(expect.arrayContaining(['encounterStarted', 'encounterCompleted']));
    // Nothing after the reward pickup is assessed: its doors never open.
    expect(events).not.toContain('outgoingGenerationCheckpoint');
    expect(
      runStateAvailability(
        blocked,
        createRoomRunStateCheckpointAddress(miniboss, { kind: 'roomEntered' }),
      ),
    ).toBe('available');
    expect(
      runStateAvailability(
        blocked,
        createRoomRunStateCheckpointAddress(miniboss, { kind: 'beforeRoomExit' }),
      ),
    ).toBe('unavailable');
    expect(blocked.coverage.roomTimeline?.room).toEqual(miniboss);
    expect(blocked.coverage.roomTimeline?.blockingRowKeys).toContain(
      rowKey({
        kind: 'interactIncomingReward',
        producerPoint: 'roomRewardPickup',
        acquisitionRole: selected.address.acquisitionRole,
      }),
    );
  });

  it('blocks an invalid Shop door offer at the doors opening without committing the Shop', () => {
    const shopId = goldenGOccurrenceId(5, 1);
    const shop = createOccurrenceAddress(goldenGBiome, shopId);
    let project = replaceTestShopOfferActions(createCompleteFGProject(), catalog, shop, ['Minor']);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(goldenGBiome, goldenGOccurrenceId(6, 1)),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
    });
    const g = biomeEvaluation(project, 'G');

    expect(g.coverage.blockedAt).toMatchObject({ kind: 'incomingReward' });
    expect(g.coverage.roomTimeline).toEqual({ room: shop, blockingRowKeys: [] });
    const events = roomEvents(g, shopId).map((event) => event.kind);
    expect(events).toEqual(expect.arrayContaining(['roomEntered', 'outgoingGenerationCheckpoint']));
    // The purchase after the doors opening, the commit and the exit are never assessed.
    expect(events).not.toContain('acquisitionPointReached');
    expect(events).not.toContain('roomCommitted');
    expect(exited(g, shopId)).toBe(false);
    expect(
      runStateAvailability(g, createRoomRunStateCheckpointAddress(shop, { kind: 'roomEntered' })),
    ).toBe('available');
    expect(g.assessmentPrefix?.frontier).toMatchObject({
      kind: 'exitDecision',
      origin: createExitDecisionAddress(goldenGBiome, source(shopId)),
    });
  });

  it('blocks an invalid Story room door offer at the doors opening without committing it', () => {
    const storyId = createOccurrenceId('surface-p-7-1-p_story01');
    const project = applyProjectCommand(surfaceEncounterShowcaseProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(pBiome, pCombat12),
      value: { rewardType: 'WeaponUpgrade' },
    });
    const p = biomeEvaluation(project, 'P');

    expect(p.coverage.blockedAt).toEqual(createIncomingRewardAddress(pBiome, pCombat12));
    expect(p.coverage.roomTimeline?.room).toEqual(createOccurrenceAddress(pBiome, storyId));
    const events = roomEvents(p, storyId).map((event) => event.kind);
    expect(events).toContain('outgoingGenerationCheckpoint');
    expect(events).not.toContain('roomCommitted');
    expect(exited(p, storyId)).toBe(false);
  });

  it('blocks at the one failing Shop purchase and keeps the earlier one', () => {
    const shopId = qOccurrenceIds.preboss;
    const shop = createOccurrenceAddress(qBiome, shopId);
    const premium = createShopOfferAddress(qBiome, shopId, 'PremiumProgress');
    const refill = createShopOfferAddress(qBiome, shopId, 'travelDealRefill');
    const refillRow = {
      kind: 'interactAcquisitionEntry' as const,
      siteKey: 'roomExit' as const,
      entryKey: 'travelDealRefill',
    };
    let project = replaceTestShopOfferActions(
      surfaceTravelDealRefillAnvilProject(),
      catalog,
      shop,
      ['PremiumProgress', 'MixedProgress1'],
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'MoveRoomAction',
      action: createRoomActionAddress(qBiome, shopId, rowKey(refillRow)),
      toIndex: 1,
    });
    // Removing a Hammer the run does not hold makes the refill's Anvil illegal.
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAnvilResult',
      acquisition: createAcquisitionRoleAddress(refill, 'self'),
      value: { ...surfaceTravelDealRefillAnvilResult, removedTraitKey: 'StaffTripleShotTrait' },
    });
    const assembly = simulateProjectAssembly(catalog, project);
    const q = biomeEvaluation(project, 'Q');

    // A (Premium) settles, B (the refill) blocks alone, C (Mixed Progress) is after the block.
    expect(q.coverage.roomTimeline).toEqual({ room: shop, blockingRowKeys: [rowKey(refillRow)] });
    expect(
      candidateArtifactsForProjectEvaluationAssembly(assembly)
        .biomeAt(qBiome)
        ?.acquisitionConversions.at(createAcquisitionRoleAddress(premium, 'self')),
    ).toBeDefined();
    const points = roomEvents(q, shopId).flatMap((event) =>
      event.kind === 'acquisitionPointReached' ? [event.point] : [],
    );
    expect(points).toContain('shopOffer:PremiumProgress');
    expect(points).not.toContain('shopOffer:MixedProgress1');
  });
});

describe('fixed room blocks', () => {
  it('keeps the Preboss settled and the Boss Timeline before its blocking delivery', () => {
    const n = biomeEvaluation(createSurfaceNUnresolvedBossHermesDeliveryCheckpoint(), 'N');
    const [bossLink, postbossLink] = n.materializedPrefix.fixedRoomLinks ?? [];
    if (bossLink === undefined || postbossLink === undefined)
      throw new Error('N lost its fixed rooms');
    const preboss = bossLink.source.origin;
    const boss = bossLink.target.origin;

    expect(n.coverage.roomTimeline?.room).toEqual(boss);
    // The Preboss settled through its exit; the Boss is entered and fought.
    expect(exited(n, preboss.occurrenceId)).toBe(true);
    expect(
      runStateAvailability(
        n,
        createRoomRunStateCheckpointAddress(preboss, { kind: 'beforeRoomExit' }),
      ),
    ).toBe('available');
    const events = roomEvents(n, boss.occurrenceId).map((event) => event.kind);
    expect(events).toEqual(
      expect.arrayContaining(['roomEntered', 'encounterStarted', 'encounterCompleted']),
    );
    expect(events).not.toContain('roomExited');
    expect(roomEvents(n, postbossLink.target.occurrenceId)).toEqual([]);
    expect(n.assessmentPrefix?.fixedRoomLinks?.map((link) => link.target.gameName)).toEqual([
      'N_Boss01',
    ]);
  });

  it('keeps the Boss settled before a blocking Postboss Pool', () => {
    const pool = createOccurrenceAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    );
    const project = applyProjectCommand(createUnderworldFPoolCheckpoint(), catalog, {
      kind: 'ReplacePurgingPoolSlot',
      occurrence: pool,
      slotKey: 'left',
      traitKey: null,
    });
    const f = biomeEvaluation(project, 'F');
    const [bossLink, postbossLink] = f.materializedPrefix.fixedRoomLinks ?? [];
    if (bossLink === undefined || postbossLink === undefined)
      throw new Error('F lost its fixed rooms');
    const postboss = postbossLink.target.origin;

    // The cleared sold slot leaves that Pool slot unfilled at its use.
    expect(f.coverage.blockedAt).toMatchObject({
      kind: 'roomFeature',
      occurrenceId: postboss.occurrenceId,
      target: { kind: 'purgingPoolOffer', slotKey: 'left' },
    });
    expect(f.coverage.roomTimeline?.room).toEqual(postboss);
    expect(exited(f, bossLink.target.occurrenceId)).toBe(true);
    const events = roomEvents(f, postboss.occurrenceId).map((event) => event.kind);
    expect(events).toEqual(expect.arrayContaining(['roomEntered', 'fountainUsed']));
    expect(events).not.toContain('roomExited');
    expect(f.assessmentPrefix?.fixedRoomLinks).toHaveLength(2);
  });
});

describe('opening room blocks', () => {
  const nOpening = createOccurrenceId('surface-n-opening');
  const pIntro = createOccurrenceId('surface-p-intro');
  const pCombat03 = createOccurrenceId('surface-p-1-1-p_combat03');

  it('enters the opening room whose encounter composition blocks its Overview', () => {
    const project = applyProjectCommand(surfaceEncounterShowcaseProject(), catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase: createEncounterPhaseAddress(
        nBiome,
        { kind: 'occurrence', occurrenceId: nOpening },
        'Encounter',
      ),
      decisionKey: 'generatedComposition',
      value: {
        kind: 'generated',
        baseRoll: 9999,
        waveCount: 1,
        waves: [
          { waveIndex: 1, typeKeys: ['SentryBot', 'Dragon'], allocations: { SentryBot: 206 } },
        ],
      },
    });
    const n = biomeEvaluation(project, 'N');

    expect(n.coverage.blockedAt).toMatchObject({ kind: 'encounterPhase', phaseKey: 'Encounter' });
    expect(n.coverage.roomTimeline).toBeUndefined();
    expect(roomEvents(n, nOpening).map((event) => event.kind)).toEqual([
      'roomCreated',
      'roomPrepared',
      'encounterRecorded',
      'roomEntered',
    ]);
    expect(
      runStateAvailability(
        n,
        createRoomRunStateCheckpointAddress(createOccurrenceAddress(nBiome, nOpening), {
          kind: 'roomEntered',
        }),
      ),
    ).toBe('available');
    expect(n.assessmentPrefix?.decisions).toEqual([]);
  });

  it('keeps the opening encounter before a blocking door offer', () => {
    const project = applyProjectCommand(surfaceEncounterShowcaseProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(pBiome, pCombat03),
      value: { rewardType: 'MetaCardPointsCommonDrop' },
    });
    const p = biomeEvaluation(project, 'P');

    expect(p.coverage.blockedAt).toEqual(createIncomingRewardAddress(pBiome, pCombat03));
    expect(p.coverage.roomTimeline?.room).toEqual(createOccurrenceAddress(pBiome, pIntro));
    const events = roomEvents(p, pIntro).map((event) => event.kind);
    expect(events).toEqual(
      expect.arrayContaining([
        'encounterStarted',
        'encounterCompleted',
        'outgoingGenerationCheckpoint',
      ]),
    );
    expect(events).not.toContain('roomCommitted');
    expect(p.assessmentPrefix?.decisions).toEqual([]);
    expect(p.assessmentPrefix?.frontier).toMatchObject({
      kind: 'exitDecision',
      origin: createExitDecisionAddress(pBiome, source(pIntro)),
    });
  });
});

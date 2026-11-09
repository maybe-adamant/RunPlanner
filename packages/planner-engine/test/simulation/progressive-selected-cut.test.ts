import { describe, expect, it } from 'vitest';
import {
  createAcquisitionRoleAddress,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createAdditionalExitAddress,
  createEncounterPhaseAddress,
  createRoomActionAddress,
  createRoomFeatureAddress,
  createRoomRunStateCheckpointAddress,
  createRouteAddress,
  createRouteStartKeepsakeSelectionAddress,
  createShopOfferAddress,
  createLocalVisitOrderAddress,
  createExitSelectionAddress,
  createPostbossKeepsakeSelectionAddress,
  createRewardWheelAddress,
  createStartingRewardAddress,
  decodeProjectDocument,
  type RoomActionReference,
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
  roomObjectInteractionsForProjectEvaluationAssembly,
  stygianWellCandidateForProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';
import {
  createSurfaceNUnresolvedBossHermesDeliveryCheckpoint,
  loadSurfaceNOProject,
  loadSurfaceNProject,
  nBiome,
  nLocalOccurrenceId,
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
  createUnderworldFWellCheckpoint,
  loadUnderworldFGProject,
  underworldWorldShopTravelDealProject,
} from '@run-planner/test-fixtures/underworld';
import { replaceTestShopOfferActions } from '@run-planner/test-fixtures/shared';
import { createFreshFileFProject } from '@run-planner/test-fixtures/fresh-file';
import {
  loadUnderworldFGCheckpoint,
  loadUnderworldFGHICheckpoint,
  loadNemesisPomSeaStarCheckpoint,
  loadUnderworldFigLeafCheckpoint,
  loadUnderworldTwistScyllaCheckpoint,
  underworldCheckpointArtifacts,
} from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  loadSurfaceNOHermesShrineDeliveryCheckpoint,
  loadSurfaceNOPQCheckpoint,
  loadSurfaceNSteadyGrowthFrontierCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/surface';

import * as fixture from './support/progressive-biome-fixtures';
import { reachedFrontier } from '../support/reward-frontier';

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

/**
 * The entry the walk stopped at in its blocked room, named by kind or row key (`end` past
 * every entry), and whether the walk reached it.
 */
function stopAt(evaluation: ReturnType<typeof biomeEvaluation>) {
  const stop = evaluation.coverage.roomStop;
  if (stop === undefined) return undefined;
  const prefix = evaluation.materializedPrefix;
  const rooms = [
    ...(prefix.entryRoom === undefined ? [] : [prefix.entryRoom]),
    ...prefix.decisions.flatMap((decision) =>
      decision.kind === 'batch'
        ? [...decision.targets, ...decision.additional].map((target) => target.room)
        : decision.visits.flatMap((visit) => [visit.target.room, ...visit.enteredLocalRooms]),
    ),
    ...(prefix.fixedRoomLinks ?? []).map((link) => link.target),
  ];
  const room = rooms.find((candidate) => candidate.occurrenceId === stop.room.occurrenceId);
  if (room === undefined) throw new Error(`${stop.room.occurrenceId} is not materialized`);
  const entry = room.roomLifecycleTimeline.entries[stop.entryIndex];
  return {
    room: stop.room.occurrenceId,
    kind: stop.kind,
    at: stop.at,
    entry:
      entry === undefined
        ? 'end'
        : entry.kind === 'boundary'
          ? 'phaseKey' in entry.boundary
            ? `${entry.boundary.kind}:${entry.boundary.phaseKey}`
            : entry.boundary.kind
          : entry.kind === 'action'
            ? entry.action.key
            : entry.effect,
  };
}

const qRefillRow = Object.freeze({
  kind: 'interactAcquisitionEntry' as const,
  siteKey: 'roomExit' as const,
  entryKey: 'travelDealRefill',
});

/** Q's Preboss Shop buys Premium Progress, then a refill whose Anvil removes a Hammer the run lacks. */
function failingQShopRefill(): ProjectDocument {
  const shopId = qOccurrenceIds.preboss;
  const shop = createOccurrenceAddress(qBiome, shopId);
  const refill = createShopOfferAddress(qBiome, shopId, 'travelDealRefill');
  let project = replaceTestShopOfferActions(surfaceTravelDealRefillAnvilProject(), catalog, shop, [
    'PremiumProgress',
    'MixedProgress1',
  ]);
  project = applyProjectCommand(project, catalog, {
    kind: 'MoveRoomAction',
    action: createRoomActionAddress(qBiome, shopId, roomActionKey(qRefillRow)),
    toIndex: 1,
  });
  // Removing a Hammer the run does not hold makes the refill's Anvil illegal.
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceAnvilResult',
    acquisition: createAcquisitionRoleAddress(refill, 'self'),
    value: { ...surfaceTravelDealRefillAnvilResult, removedTraitKey: 'StaffTripleShotTrait' },
  });
  return project;
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
    for (const branch of reachedFrontier(p.rewards))
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
    // Purchases append to the unreached Timeline; a settled inventory offers them.
    const shop = createOccurrenceAddress(pBiome, prebossShop);
    expect(
      roomObjectInteractionsForProjectEvaluationAssembly(
        simulateProjectAssembly(catalog, project),
        shop,
      ),
    ).toBeUndefined();
    expect(
      roomObjectInteractionsForProjectEvaluationAssembly(
        simulateProjectAssembly(catalog, surfaceEncounterShowcaseProject()),
        shop,
      )?.worldShop?.offers.length,
    ).toBeGreaterThan(0);
  });
});

const goldenFWellHost = fixture.createOccurrenceId('golden-f-b2-e1');
const goldenFLaterWell = fixture.createOccurrenceId('golden-f-b4-e1');

/** A Stygian Well whose second-right item may duplicate its second-left one. */
function withStygianWell(
  project: ProjectDocument,
  occurrenceId: OccurrenceId,
  secondRight: string,
): ProjectDocument {
  const occurrence = createOccurrenceAddress(goldenFBiome, occurrenceId);
  let next = applyProjectCommand(project, catalog, { kind: 'AddStygianWell', occurrence });
  for (const [slotKey, itemKey] of [
    ['healing', 'ArmorBoostStore'],
    ['secondLeft', 'TemporaryForcedSecretDoorTrait'],
    ['secondRight', secondRight],
  ] as const)
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceStygianWellOffer',
      occurrence,
      slotKey,
      itemKey,
    });
  return next;
}

describe('room Overview block withholds its Timeline interactions', () => {
  it("offers a Well's purchases only once its Overview is settled", () => {
    const room = createOccurrenceAddress(goldenFBiome, goldenFLaterWell);
    const interaction = (secondRight: string) =>
      stygianWellCandidateForProjectEvaluationAssembly(
        simulateProjectAssembly(
          catalog,
          withStygianWell(loadUnderworldFGProject(), goldenFLaterWell, secondRight),
        ),
        room,
      )?.interaction;

    expect(interaction('TemporaryImprovedCastTrait')?.offers).toHaveLength(3);
    expect(interaction('TemporaryForcedSecretDoorTrait')).toBeUndefined();
  });
});

describe('room Overview block is one region', () => {
  it('publishes every Overview reason in one issue and leaves the Timeline unreached', () => {
    let project = withStygianWell(
      loadUnderworldFGProject(),
      goldenFWellHost,
      'TemporaryForcedSecretDoorTrait',
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceResourcePlacement',
      route: createRouteAddress('Underworld'),
      family: 'Fishing',
      value: { biomeKey: 'F', occurrenceId: goldenFWellHost },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase: createEncounterPhaseAddress(
        goldenFBiome,
        { kind: 'occurrence', occurrenceId: goldenFWellHost },
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
    const assembly = simulateProjectAssembly(catalog, project);
    const f = biomeEvaluation(project, 'F');

    expect(f.issue?.reasons.map((reason) => reason.code).sort()).toEqual([
      'encounterCustomizationUnavailable',
      'resourcePlacementUnavailable',
      'stygianWellDuplicate',
      'stygianWellPlacementUnavailable',
    ]);
    expect(f.coverage.roomTimeline).toBeUndefined();
    const room = createOccurrenceAddress(goldenFBiome, goldenFWellHost);
    // The Overview stays repairable; nothing appends to its unreached Timeline.
    const well = stygianWellCandidateForProjectEvaluationAssembly(assembly, room);
    expect(well).toBeDefined();
    expect(well?.interaction).toBeUndefined();
  });
});

describe('room Overview block keeps its incoming reward candidates', () => {
  it('assesses an Overview-stopped room reward offer without its unreached pickup', () => {
    // An unavailable composition stops fresh-3-0 at its encounter Overview.
    const room = createOccurrenceId('fresh-3-0');
    const project = applyProjectCommand(createFreshFileFProject(), catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase: createEncounterPhaseAddress(
        createBiomeAddress('FreshFile', 'F'),
        { kind: 'occurrence', occurrenceId: room },
        'Encounter',
      ),
      decisionKey: 'generatedComposition',
      value: { kind: 'generated', waveCount: 1, waves: [{ waveIndex: 1, typeKeys: ['Dragon'] }] },
    });
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
    const project = failingQShopRefill();
    const assembly = simulateProjectAssembly(catalog, project);
    const q = biomeEvaluation(project, 'Q');

    // A (Premium) settles, B (the refill) blocks alone, C (Mixed Progress) is after the block.
    expect(q.coverage.roomTimeline).toEqual({
      room: shop,
      blockingRowKeys: [roomActionKey(qRefillRow)],
    });
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

describe('room stop', () => {
  /** A save that never placed some of a room's actions: its required ones stay owed. */
  function withRoomActions(
    project: ProjectDocument,
    biomeKey: string,
    occurrenceId: string,
    keep: (reference: RoomActionReference) => boolean,
  ) {
    return decodeProjectDocument(
      {
        ...project,
        route: {
          ...project.route,
          biomes: project.route.biomes.map((biome) =>
            biome.biomeKey !== biomeKey || biome.topology === null
              ? biome
              : {
                  ...biome,
                  topology: {
                    ...biome.topology,
                    occurrences: biome.topology.occurrences.map((occurrence) =>
                      occurrence.occurrenceId === occurrenceId
                        ? {
                            ...occurrence,
                            roomActions: { order: occurrence.roomActions.order.filter(keep) },
                          }
                        : occurrence,
                    ),
                  },
                },
          ),
        },
      },
      catalog,
    );
  }

  function repeatedSideVisit() {
    const project = loadSurfaceNOPQCheckpoint();
    const main = createOccurrenceId('surface-n-combat05');
    const decision = project.route.biomes
      .find((biome) => biome.biomeKey === 'N')
      ?.topology?.decisions.find(
        (candidate) => candidate.kind === 'localVisit' && candidate.sourceOccurrenceId === main,
      );
    if (decision?.kind !== 'localVisit') throw new Error('N lost its side visits');
    const visits = decision.visitOrder;
    return applyProjectCommand(project, catalog, {
      kind: 'ReplaceLocalVisitOrder',
      order: createLocalVisitOrderAddress(nBiome, main, 'sideRooms'),
      occurrenceIds: [visits[1]!, ...visits.slice(1)],
    });
  }

  function figLeafSkip(project: ProjectDocument, biome: typeof nBiome, occurrenceId: OccurrenceId) {
    return applyProjectCommand(project, catalog, {
      kind: 'ReplaceFigLeafSkip',
      phase: createEncounterPhaseAddress(biome, { kind: 'occurrence', occurrenceId }, 'Encounter'),
      value: true,
    });
  }

  function partialWheel() {
    const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat07, 'wheel1');
    const project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceRewardWheelStore',
      wheel,
      storeKey: 'MetaProgress',
    });
    // The second offer is still unset as the wheel is offered.
    return applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOfferCount',
      wheel,
      offerCount: 2,
    });
  }

  function lockedExitTaken() {
    const g = goldenGBiome;
    const host = createOccurrenceId('golden-g-b1-e1');
    const locked = applyProjectCommand(loadUnderworldFGHICheckpoint(), catalog, {
      kind: 'ReplaceLockedExit',
      occurrence: createOccurrenceAddress(g, host),
      exitKey: 'exit2',
      locked: true,
    });
    return applyProjectCommand(locked, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(g, { kind: 'occurrence', occurrenceId: host }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
  }

  /** O's Trial with its due Hermes Shrine delivery not placed. */
  function shrineDeliveryUnplaced() {
    const project = loadSurfaceNOHermesShrineDeliveryCheckpoint();
    const trial = createOccurrenceId('surface-o-devotion');
    const delivery = project.route.biomes
      .find((biome) => biome.biomeKey === 'O')
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === trial)
      ?.roomActions.order.find(
        (reference) =>
          reference.kind === 'interactAcquisitionEntry' &&
          reference.siteKey === 'hermesShrineDelivery',
      );
    if (delivery === undefined) throw new Error('O Trial lost its Shrine delivery');
    return applyProjectCommand(project, catalog, {
      kind: 'UnplaceGeneratedDelivery',
      action: createRoomActionAddress(oBiome, trial, roomActionKey(delivery)),
    });
  }

  /** A Chaos room whose reward is taken as Time Piece, leaving its door store unavailable. */
  function chaosTimePiece() {
    let project = underworldCheckpointArtifacts['natural-chaos-unresolved-trial'].load();
    const opening = createOccurrenceId('fixture-chaos-opening');
    const target = createOccurrenceId('interaction-chaos-target');
    const commands: readonly Parameters<typeof applyProjectCommand>[2][] = [
      {
        kind: 'ReplaceStartingReward',
        reward: createStartingRewardAddress('Underworld'),
        value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
      },
      {
        kind: 'ReplaceTraitOffer',
        trait: createTraitOfferAddress(
          createIncomingRewardAddress(goldenFBiome, opening),
          'source',
        ),
        value: {
          kind: 'traits',
          giverKey: 'Apollo',
          options: [
            { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
            { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
            { traitKey: 'ApolloCastBoon', rarity: 'Common' },
          ],
          selectedOptionKey: 'option1',
        },
      },
      {
        kind: 'ReplaceBatchRewardStore',
        rewardStore: createBatchRewardStoreAddress(goldenFBiome, source(opening)),
        storeKey: 'MetaProgress',
      },
      {
        kind: 'CreateTarget',
        target: createTargetAddress(goldenFBiome, source(opening), 'exit1'),
        occurrenceId: target,
        gameName: 'F_Combat01',
      },
      {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(goldenFBiome, target),
        value: { rewardType: 'MaxHealthDrop' },
      },
      {
        kind: 'ReplaceStartingKeepsake',
        selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
        keepsakeKey: 'GoldifyKeepsake',
      },
      {
        kind: 'ReplaceAcquisitionDisposition',
        acquisition: createAcquisitionRoleAddress(
          createIncomingRewardAddress(goldenFBiome, createOccurrenceId('fixture-chaos-room')),
          'self',
        ),
        value: { kind: 'timePiece' },
      },
    ];
    for (const command of commands) project = applyProjectCommand(project, catalog, command);
    return project;
  }

  const fPostboss = createOccurrenceId('golden-f-preboss-shop:postboss');
  const wellPurchaseRow = roomActionKey({
    kind: 'purchaseStygianWellOffer',
    generationKey: 'initial:secondLeft',
  });

  /** F's Postboss buys a Fateful Twist whose result is not set. */
  function unsetWellTwist() {
    const owner = createOccurrenceAddress(goldenFBiome, fPostboss);
    let project = loadUnderworldFGProject();
    for (const [slotKey, itemKey] of [
      ['healing', 'ArmorBoostStore'],
      ['secondLeft', 'RandomStoreItem'],
      ['secondRight', 'TemporaryBoonRarityTrait'],
    ] as const)
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceStygianWellOffer',
        occurrence: owner,
        slotKey,
        itemKey,
      });
    return applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: owner,
      generationKey: 'initial:secondLeft',
      purchased: true,
    });
  }

  /** F's Postboss rack takes the Jeweled Pom without its equip result. */
  function rackWithoutEquipResult() {
    return applyProjectCommand(loadUnderworldFGCheckpoint(), catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: createPostbossKeepsakeSelectionAddress(
        createOccurrenceAddress(goldenFBiome, fPostboss),
      ),
      keepsakeKey: 'HadesAndPersephoneKeepsake',
    });
  }

  /** F's Postboss sells its Pool's left slot, whose trait is cleared. */
  function poolSaleWithoutTrait() {
    return applyProjectCommand(createUnderworldFPoolCheckpoint(), catalog, {
      kind: 'ReplacePurgingPoolSlot',
      occurrence: createOccurrenceAddress(goldenFBiome, fPostboss),
      slotKey: 'left',
      traitKey: null,
    });
  }
  const poolSaleRow = roomActionKey({ kind: 'sellPurgingPoolTrait', slotKey: 'left' });

  /** F's Postboss Travel Deal restock pinned to an item its first purchase's roll still shows. */
  function duplicateWellRefill() {
    return applyProjectCommand(createUnderworldFWellCheckpoint(), catalog, {
      kind: 'ReplaceStygianWellTravelDealRefill',
      occurrence: createOccurrenceAddress(goldenFBiome, fPostboss),
      itemKey: 'TemporaryBoonRarityTrait',
    });
  }

  /** F's Postboss moves `reference` ahead of its fountain, which opens the doors. */
  function beforeFountain(reference: RoomActionReference) {
    return applyProjectCommand(createUnderworldFWellCheckpoint(), catalog, {
      kind: 'MoveRoomAction',
      action: createRoomActionAddress(goldenFBiome, fPostboss, roomActionKey(reference)),
      toIndex: 0,
    });
  }
  const wellPurchase: RoomActionReference = {
    kind: 'purchaseStygianWellOffer',
    generationKey: 'initial:secondLeft',
  };

  /** F's Postboss fountain used with a Phial and no rarity target. */
  function fountainWithoutRarityTarget() {
    return applyProjectCommand(loadUnderworldTwistScyllaCheckpoint(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'FountainRarityKeepsake',
    });
  }

  const cases: readonly (readonly [
    string,
    () => ProjectDocument,
    string,
    {
      readonly room: string;
      readonly kind: string;
      readonly at: 'entry' | 'before';
      readonly entry: string;
    },
  ])[] = [
    [
      'Overview: past Room entered, its entry effects reached',
      () =>
        applyProjectCommand(surfaceEncounterShowcaseProject(), catalog, {
          kind: 'ReplaceShopOffer',
          offer: createShopOfferAddress(pBiome, prebossShop, 'Boon'),
          value: {
            rewardType: 'RandomLoot',
            payload: { kind: 'BoonSource', source: 'HeraUpgrade' },
          },
        }),
      'P',
      { room: prebossShop, kind: 'overview', at: 'before', entry: 'cleanup' },
    ],
    [
      'a Timeline row: the first row of the blocking product',
      failingQShopRefill,
      'Q',
      {
        room: qOccurrenceIds.preboss,
        kind: 'timeline',
        at: 'entry',
        entry: roomActionKey(qRefillRow),
      },
    ],
    [
      'an unplaced required pickup: where the walk stopped, at its spawn after the encounter',
      () => withRoomActions(loadUnderworldFGCheckpoint(), 'F', 'golden-f-b1-e1', () => false),
      'F',
      { room: 'golden-f-b1-e1', kind: 'timeline', at: 'before', entry: 'cleanup' },
    ],
    [
      'an unplaced Fields cage: the walk stops before that cage starts',
      () =>
        withRoomActions(
          applyProjectCommand(createGoldenFGHIProject(), catalog, {
            kind: 'ReplaceFieldsCageOutcome',
            decision: createExitDecisionAddress(
              goldenHBiome,
              source(createOccurrenceId('golden-h-intro')),
            ),
            cageOutcome: 'max',
          }),
          'H',
          'golden-h-combat02',
          (reference) => reference.kind !== 'completeFieldsCage' || reference.phaseKey !== 'Cage03',
        ),
      'H',
      {
        room: 'golden-h-combat02',
        kind: 'timeline',
        at: 'before',
        entry: 'encounterStart:Cage03',
      },
    ],
    [
      "an invalid door offer: the source room's doors opening, reached",
      () =>
        applyProjectCommand(loadUnderworldFGCheckpoint(), catalog, {
          kind: 'ReplaceIncomingReward',
          reward: createIncomingRewardAddress(goldenFBiome, createOccurrenceId('golden-f-b1-e1')),
          value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' } },
        }),
      'F',
      { room: 'golden-f-start', kind: 'timeline', at: 'entry', entry: 'cleanup' },
    ],
    [
      'a phase-start contact: its own entry, reached (Fig Leaf)',
      () =>
        figLeafSkip(
          loadUnderworldFigLeafCheckpoint(),
          goldenFBiome,
          createOccurrenceId('golden-f-b3-e1'),
        ),
      'F',
      {
        room: 'golden-f-b3-e1',
        kind: 'timeline',
        at: 'entry',
        entry: 'encounterStart:Encounter',
      },
    ],
    [
      'a Hub side room phase-start contact (Fig Leaf)',
      () =>
        figLeafSkip(
          applyProjectCommand(loadSurfaceNProject(), catalog, {
            kind: 'ReplaceStartingKeepsake',
            selection: createRouteStartKeepsakeSelectionAddress('Surface'),
            keepsakeKey: 'SkipEncounterKeepsake',
          }),
          nBiome,
          nLocalOccurrenceId('combat02', 'sideDoor1'),
        ),
      'N',
      {
        room: nLocalOccurrenceId('combat02', 'sideDoor1'),
        kind: 'timeline',
        at: 'entry',
        entry: 'encounterStart:Encounter',
      },
    ],
    [
      'Boss defeated: reached, blocked on its due Judgment',
      () =>
        applyProjectCommand(loadSurfaceNOProject(), catalog, {
          kind: 'ReplaceManualArcanaSelection',
          route: createRouteAddress('Surface'),
          arcanaKeys: ['CastCount'],
        }),
      'N',
      {
        room: 'surface-n-preboss:boss',
        kind: 'timeline',
        at: 'entry',
        entry: 'bossDefeated:Encounter',
      },
    ],
    [
      "an encounter end's due outcome: that end, reached (Steady Growth, Hub main room)",
      loadSurfaceNSteadyGrowthFrontierCheckpoint,
      'N',
      {
        room: 'surface-n-combat11',
        kind: 'timeline',
        at: 'entry',
        entry: 'encounterEnd:Encounter',
      },
    ],
    [
      "a Ship wheel offer: its next phase, reached; the wheel's later choice row is not",
      partialWheel,
      'O',
      { room: oOccurrenceIds.combat07, kind: 'timeline', at: 'entry', entry: 'nextPhase' },
    ],
    [
      'exit work after the room committed (a locked door taken)',
      lockedExitTaken,
      'G',
      { room: 'golden-g-b1-e1', kind: 'exit', at: 'before', entry: 'end' },
    ],
    [
      'exit work as a restored room departs again (a repeated side visit)',
      repeatedSideVisit,
      'N',
      { room: 'surface-n-combat05', kind: 'exit', at: 'before', entry: 'end' },
    ],
    [
      "an encounter end's due Shrine delivery not placed: that end, reached",
      shrineDeliveryUnplaced,
      'O',
      {
        room: 'surface-o-devotion',
        kind: 'timeline',
        at: 'entry',
        entry: 'encounterEnd:Encounter',
      },
    ],
    [
      "the doors' store unavailable at generation: the doors opening, reached (Chaos)",
      chaosTimePiece,
      'F',
      { room: 'fixture-chaos-room', kind: 'timeline', at: 'entry', entry: 'cleanup' },
    ],
    [
      'a Well Twist result unset: its purchase row',
      unsetWellTwist,
      'F',
      { room: fPostboss, kind: 'timeline', at: 'entry', entry: wellPurchaseRow },
    ],
    [
      "a Postboss rack's equip result unset: the rack row",
      rackWithoutEquipResult,
      'F',
      {
        room: fPostboss,
        kind: 'timeline',
        at: 'entry',
        entry: roomActionKey({ kind: 'interactKeepsakeRack' }),
      },
    ],
    [
      "a Pool sale's trait unset: the sale row whose own contact blocks",
      poolSaleWithoutTrait,
      'F',
      { room: fPostboss, kind: 'timeline', at: 'entry', entry: poolSaleRow },
    ],
    [
      'a Nemesis pickup row past an encounter end without end effects',
      loadNemesisPomSeaStarCheckpoint,
      'F',
      {
        room: 'golden-f-b5-e1',
        kind: 'timeline',
        at: 'entry',
        entry: roomActionKey({
          kind: 'interactAcquisitionEntry',
          siteKey: 'nemesisGenerated:Encounter',
          entryKey: 'result',
        }),
      },
    ],
    [
      'a Well restock judged at the first purchase: not its later refill row',
      duplicateWellRefill,
      'F',
      {
        room: fPostboss,
        kind: 'timeline',
        at: 'before',
        entry: roomActionKey({ kind: 'interactKeepsakeRack' }),
      },
    ],
    [
      'a Postboss Well purchase ranked before the fountain: the purchase row',
      () => beforeFountain(wellPurchase),
      'F',
      { room: fPostboss, kind: 'timeline', at: 'entry', entry: wellPurchaseRow },
    ],
    [
      "a Postboss fountain's rarity outcome unset: the fountain row",
      fountainWithoutRarityTarget,
      'F',
      {
        room: fPostboss,
        kind: 'timeline',
        at: 'entry',
        entry: roomActionKey({ kind: 'useFountain' }),
      },
    ],
  ];

  it.each(cases)('%s', (_name, build, biomeKey, expected) => {
    expect(stopAt(biomeEvaluation(build(), biomeKey))).toEqual(expected);
  });

  it('stops at a Postboss Well purchase the required fountain must precede', () => {
    const evaluation = biomeEvaluation(beforeFountain(wellPurchase), 'F');
    // Using the fountain unlocks the exits; only then is the Well usable.
    expect(evaluation.findings).toEqual([
      {
        code: 'roomActionOrderUnavailable',
        phase: 'encounterResolution',
        origin: createRoomActionAddress(goldenFBiome, fPostboss, wellPurchaseRow),
        evidence: {
          reason: 'requiredFirst',
          detail: `must follow ${roomActionKey({ kind: 'useFountain' })}, a required action of an earlier window`,
          requiredAction: roomActionKey({ kind: 'useFountain' }),
        },
      },
    ]);
    expect(evaluation.coverage.roomTimeline?.blockingRowKeys).toEqual([wellPurchaseRow]);
  });

  it('runs a Postboss Keepsake Rack used before the fountain', () => {
    const project = beforeFountain({ kind: 'interactKeepsakeRack' });
    const biome = simulateProject(catalog, project).route?.biomes.find(
      (candidate) => candidate.biomeKey === 'F',
    );
    expect(biome?.findings ?? []).toEqual([]);
    expect(biome?.coverage.kind).toBe('complete');
  });

  it('marks no row for a Well restock judged at the first purchase', () => {
    const evaluation = biomeEvaluation(duplicateWellRefill(), 'F');
    expect(evaluation.findings.map((finding) => [finding.code, finding.evidence])).toEqual([
      ['stygianWellTravelDealRefillUnavailable', { reason: 'refillDuplicate' }],
    ]);
    expect(evaluation.coverage.roomTimeline?.blockingRowKeys).toEqual([]);
  });

  it.each([
    ['a Well Twist', unsetWellTwist, [wellPurchaseRow]],
    [
      'a rack equip result',
      rackWithoutEquipResult,
      [roomActionKey({ kind: 'interactKeepsakeRack' })],
    ],
    ['a Pool sale', poolSaleWithoutTrait, [poolSaleRow]],
    [
      'a fountain rarity outcome',
      fountainWithoutRarityTarget,
      [roomActionKey({ kind: 'useFountain' })],
    ],
  ] as const)('marks the row that settles %s, where the walk stops', (_name, build, rows) => {
    const evaluation = biomeEvaluation(build(), 'F');
    expect(evaluation.coverage.roomTimeline?.blockingRowKeys).toEqual(rows);
    expect(stopAt(evaluation)?.entry).toBe(rows[0]);
  });

  it('publishes no stop for a settled route', () => {
    for (const biome of simulateProject(catalog, loadUnderworldFGCheckpoint()).route?.biomes ?? [])
      expect('roomStop' in biome.coverage).toBe(false);
  });
});

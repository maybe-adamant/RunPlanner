import { describe, expect, it } from 'vitest';
import {
  createEncounterPhaseAddress,
  createRoomFeatureAddress,
  createRoomRunStateCheckpointAddress,
  createRouteAddress,
  createShopOfferAddress,
  type OccurrenceId,
  type ProjectDocument,
  type RoomRunStateCheckpointAddress,
} from '@run-planner/engine/authored-project';
import type { ResourceFamily } from '@run-planner/engine/catalog-schema';
import {
  loadSurfaceNOProject,
  qBiome,
  qOccurrenceIds,
  surfaceShrineDeliveriesProject,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceIds,
  surfaceEncounterShowcaseProject,
} from '@run-planner/test-fixtures/surface';

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
  createGoldenFGHIProject,
  partialGWithEarlierInvalidReward,
  prefix,
  simulateProject,
  simulateProjectAssembly,
  semanticAddressKey,
  source,
} = fixture;

describe('progressive clamp products', () => {
  it('clamps a same-batch reward failure before a later physical target failure', () => {
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
    expect(
      bindTestCandidateSession(catalog, fixture.project).evaluate({
        kind: 'roomTarget',
        target: createTargetAddress(goldenGBiome, source(fixture.source), 'exit2'),
        gameName: 'G_Combat02',
      }),
    ).toMatchObject({ kind: 'unavailable', reason: 'coverageNotReached' });
    const retainedBatch = evaluation.roomGeneration.ordinary.ordinaryBatches.find(
      (batch) =>
        semanticAddressKey(batch.origin) ===
        semanticAddressKey(createExitDecisionAddress(goldenGBiome, source(fixture.source))),
    );
    expect(retainedBatch?.targets.map((target) => target.origin.exitKey)).toEqual(['exit1']);
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

  it('blocks at the source room exit when its own exit work fails', () => {
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
    expect(exited(p, pCombat04)).toBe(false);
    expect(
      runStateAvailability(
        p,
        createRoomRunStateCheckpointAddress(createOccurrenceAddress(pBiome, pCombat04), {
          kind: 'beforeRoomExit',
        }),
      ),
    ).toBe('unavailable');
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

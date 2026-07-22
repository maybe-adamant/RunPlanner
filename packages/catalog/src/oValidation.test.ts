import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createContinuationAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  createLocalChildAddress,
  createLocalChildGroupAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPickedAddress,
  createProjectDocument,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  createTargetAddress,
  evaluateLinearBiome,
  evaluateNBiome,
  semanticAddressKey,
  type CompleteHubProjectEvaluation,
  type CompleteLinearProjectEvaluation,
  type HubBiomePlan,
  type LinearBiomePlan,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/core';
import { describe, expect, it } from 'vitest';

import { catalog } from './index';

const nBiome = createBiomeAddress('Surface', 'N');
const oBiome = createBiomeAddress('Surface', 'O');
const oIds = {
  intro: createOccurrenceId('o-validation-intro'),
  combat04: createOccurrenceId('o-validation-combat04'),
  combat07: createOccurrenceId('o-validation-combat07'),
  combat01: createOccurrenceId('o-validation-combat01'),
  devotion: createOccurrenceId('o-validation-devotion'),
  story: createOccurrenceId('o-validation-story'),
  combat02: createOccurrenceId('o-validation-combat02'),
  preboss: createOccurrenceId('o-validation-preboss'),
} as const;

function project(): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: 'o-validation-fixture',
    name: 'O Validation Fixture',
    configuredBiomeCounts: { Surface: 2 },
  });
}

function nPlan(document: ProjectDocument): HubBiomePlan {
  const plan = document.routes
    .find((route) => route.routeKey === 'Surface')
    ?.biomes.find((biome) => biome.biomeKey === 'N');
  if (plan?.kind !== 'HubBiome') {
    throw new Error('fixture lost N plan');
  }
  return plan;
}

function oPlan(document: ProjectDocument): LinearBiomePlan {
  const plan = document.routes
    .find((route) => route.routeKey === 'Surface')
    ?.biomes.find((biome) => biome.biomeKey === 'O');
  if (plan?.kind !== 'LinearBiome') {
    throw new Error('fixture lost O plan');
  }
  return plan;
}

function completeN(document: ProjectDocument): ProjectDocument {
  let next = applyProjectCommand(document, catalog, {
    kind: 'CreateHubTopology',
    biome: nBiome,
    fixedOccurrenceIds: {
      opening: createOccurrenceId('n-o-validation-opening'),
      preHub: createOccurrenceId('n-o-validation-prehub'),
      preboss: createOccurrenceId('n-o-validation-preboss'),
    },
  });
  const openSlots = [
    'combat11',
    'combat10',
    'combat09',
    'combat05',
    'combat03',
    'combat02',
    'combat01',
    'miniBoss01',
    'combat23',
  ] as const;
  for (const hubSlotKey of openSlots) {
    next = applyProjectCommand(next, catalog, {
      kind: 'OpenHubSlot',
      slot: createHubSlotAddress(nBiome, hubSlotKey),
      occurrenceId: createOccurrenceId(`n-o-validation-${hubSlotKey}`),
    });
  }
  const hubOffers = {
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
  } as const;
  for (const [hubSlotKey, value] of Object.entries(hubOffers)) {
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(
        nBiome,
        createOccurrenceId(`n-o-validation-${hubSlotKey}`),
      ),
      value,
    });
  }
  for (const [index, hubSlotKey] of [
    'combat05',
    'miniBoss01',
    'combat02',
    'combat11',
    'combat23',
    'combat09',
  ].entries()) {
    next = applyProjectCommand(next, catalog, {
      kind: 'AppendHubVisit',
      visit: createHubVisitAddress(nBiome, index + 1),
      hubSlotKey,
    });
  }
  for (const [parentSlotKey, sideSlotKeys] of Object.entries({
    combat05: ['sideDoor1', 'sideDoor2', 'sideDoor3'],
    combat02: ['sideDoor1', 'sideDoor2'],
    combat11: ['sideDoor1'],
  })) {
    for (const sideSlotKey of sideSlotKeys) {
      next = applyProjectCommand(next, catalog, {
        kind: 'ReplaceSideRoomGeneration',
        sideRoom: createLocalChildAddress(
          nBiome,
          createOccurrenceId(`n-o-validation-${parentSlotKey}`),
          'sideRooms',
          sideSlotKey,
        ),
        generation: 'generated',
      });
    }
  }
  for (const [parentSlotKey, enteredSlotKeys] of [
    ['combat05', ['sideDoor2', 'sideDoor1']],
    ['combat02', ['sideDoor1']],
    ['combat11', ['sideDoor1']],
  ] as const) {
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceSideRoomEntryOrder',
      group: createLocalChildGroupAddress(
        nBiome,
        createOccurrenceId(`n-o-validation-${parentSlotKey}`),
        'sideRooms',
      ),
      enteredSlotKeys,
    });
  }
  for (const [parentSlotKey, sideSlotKey, rewardType] of [
    ['combat05', 'sideDoor1', 'MaxManaDropSmall'],
    ['combat05', 'sideDoor2', 'MaxHealthDropSmall'],
    ['combat05', 'sideDoor3', 'EmptyMaxHealthSmallDrop'],
    ['combat02', 'sideDoor1', 'RoomMoneyTinyDrop'],
    ['combat02', 'sideDoor2', 'AirBoost'],
    ['combat11', 'sideDoor1', 'EarthBoost'],
  ] as const) {
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceLocalReward',
      reward: createLocalRewardAddress(
        nBiome,
        createOccurrenceId(`n-o-validation-${parentSlotKey}`),
        'sideRooms',
        sideSlotKey,
      ),
      value: { rewardType },
    });
  }
  return applyProjectCommand(next, catalog, {
    kind: 'ReplaceShopOffer',
    offer: createShopOfferAddress(
      nBiome,
      createOccurrenceId('n-o-validation-preboss'),
      'MajorNonBoon',
    ),
    value: { rewardType: 'MaxHealthDrop' },
  });
}

function appendRoom(
  document: ProjectDocument,
  parentOccurrenceId: OccurrenceId,
  occurrenceId: OccurrenceId,
  gameName: string,
): ProjectDocument {
  let next = applyProjectCommand(document, catalog, {
    kind: 'CreateBatch',
    continuation: createContinuationAddress(oBiome, parentOccurrenceId),
  });
  next = applyProjectCommand(next, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(oBiome, parentOccurrenceId, 1),
    occurrenceId,
    gameName,
  });
  return applyProjectCommand(next, catalog, {
    kind: 'SetPicked',
    picked: createPickedAddress(oBiome, parentOccurrenceId),
    exitIndex: 1,
  });
}

function validProject(): ProjectDocument {
  let next = completeN(project());
  next = applyProjectCommand(next, catalog, {
    kind: 'CreateStart',
    biome: oBiome,
    occurrenceId: oIds.intro,
    gameName: 'O_Intro',
  });
  for (const [parentOccurrenceId, occurrenceId, gameName] of [
    [oIds.intro, oIds.combat04, 'O_Combat04'],
    [oIds.combat04, oIds.combat07, 'O_Combat07'],
    [oIds.combat07, oIds.combat01, 'O_Combat01'],
    [oIds.combat01, oIds.devotion, 'O_Devotion01'],
    [oIds.devotion, oIds.story, 'O_Story01'],
    [oIds.story, oIds.combat02, 'O_Combat02'],
  ] as const) {
    next = appendRoom(next, parentOccurrenceId, occurrenceId, gameName);
  }
  for (const [occurrenceId, value] of [
    [oIds.combat04, { rewardType: 'MaxHealthDrop' }],
    [oIds.combat07, { rewardType: 'MaxManaDrop' }],
    [oIds.combat01, { rewardType: 'RoomMoneyDrop' }],
    [oIds.combat02, { rewardType: 'StackUpgrade' }],
  ] as const) {
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: createRewardWheelOfferAddress(oBiome, occurrenceId, 'wheel1', 'offer1'),
      value,
    });
  }
  next = applyProjectCommand(next, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(oBiome, oIds.devotion),
    value: {
      rewardType: 'Devotion',
      payload: {
        kind: 'DevotionPair',
        chosenSource: 'AresUpgrade',
        spurnedSource: 'HephaestusUpgrade',
      },
    },
  });
  next = applyProjectCommand(next, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(oBiome, oIds.devotion),
    storeKey: 'MetaProgress',
  });
  next = applyProjectCommand(next, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(oBiome, oIds.story),
    storeKey: 'MetaProgress',
  });
  next = applyProjectCommand(next, catalog, {
    kind: 'CreateTerminalTransition',
    continuation: createContinuationAddress(oBiome, oIds.combat02),
    targetOccurrenceIds: [oIds.preboss],
  });
  return applyProjectCommand(next, catalog, {
    kind: 'ReplaceShopOffer',
    offer: createShopOfferAddress(oBiome, oIds.preboss, 'MajorNonBoon'),
    value: { rewardType: 'MaxHealthDrop' },
  });
}

function evaluateN(document: ProjectDocument): CompleteHubProjectEvaluation {
  const evaluation = evaluateNBiome(catalog, 'Surface', nPlan(document));
  if (evaluation.completion !== 'complete') {
    throw new Error('fixture N is incomplete');
  }
  return evaluation;
}

function evaluateO(document: ProjectDocument): CompleteLinearProjectEvaluation {
  const n = evaluateN(document);
  if (n.validity !== 'valid') {
    throw new Error(`fixture N is invalid: ${n.findings.map((finding) => finding.code)}`);
  }
  const evaluation = evaluateLinearBiome(catalog, 'Surface', oPlan(document), 2, n);
  if (evaluation.completion !== 'complete') {
    throw new Error('fixture O is incomplete');
  }
  return evaluation;
}

describe('selected O validation', () => {
  it('validates the complete N/O prefix with exact room and encounter support', () => {
    const evaluation = evaluateO(validProject());

    expect(evaluation.findings).toEqual([]);
    expect(evaluation.validity).toBe('valid');
    expect(
      evaluation.roomGeneration.encounterCounts.map((entry) => ({
        gameName: evaluation.snapshot.batches
          .flatMap((batch) => batch.targets)
          .find(
            (target) => semanticAddressKey(target.room.origin) === semanticAddressKey(entry.origin),
          )?.room.gameName,
        selected: entry.selectedEncounterCount,
        support: entry.supportEncounterCounts,
      })),
    ).toEqual([
      { gameName: 'O_Combat04', selected: 2, support: [2] },
      { gameName: 'O_Combat07', selected: 2, support: [2, 3] },
      { gameName: 'O_Combat01', selected: 2, support: [2, 3] },
      { gameName: 'O_Combat02', selected: 2, support: [2, 3] },
    ]);
    expect(evaluation.rewards.targetHistory).toHaveLength(7);
    expect(
      evaluation.roomGeneration.forcePressure.find(
        (entry) => entry.selectedGameName === 'O_Devotion01',
      ),
    ).toMatchObject({ selectedPossible: true, selectedExclusionReasons: [] });
    expect(evaluation.roomGeneration.forcePressure.at(-1)).toMatchObject({
      selectedGameName: 'O_PreBoss01',
      selectedPossible: true,
      requiredForcedRoomGameNames: ['O_PreBoss01'],
    });
  });

  it('addresses an unavailable first-room Combat2 selection to its room occurrence', () => {
    const document = applyProjectCommand(validProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence: createOccurrenceAddress(oBiome, oIds.combat04),
      encounterCount: 3,
    });
    const evaluation = evaluateO(document);

    expect(evaluation.validity).toBe('invalid');
    expect(evaluation.findings).toContainEqual(
      expect.objectContaining({
        code: 'encounterCountUnavailable',
        origin: createOccurrenceAddress(oBiome, oIds.combat04),
        evidence: expect.objectContaining({
          selectedEncounterCount: 3,
          supportEncounterCounts: [2],
        }),
      }),
    );
  });

  it('retains forced-pool and appearance-cap violations at their target owners', () => {
    let forced = applyProjectCommand(validProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(oBiome, oIds.story),
      gameName: 'O_Combat03',
    });
    const forcedEvaluation = evaluateO(forced);
    expect(
      forcedEvaluation.roomGeneration.forcePressure.find(
        (entry) =>
          semanticAddressKey(entry.targetOrigin) ===
          semanticAddressKey(createTargetAddress(oBiome, oIds.devotion, 1)),
      ),
    ).toMatchObject({ selectedPossible: false, selectedExclusionReasons: ['forcedPool'] });

    forced = applyProjectCommand(validProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(oBiome, oIds.combat02),
      gameName: 'O_Combat01',
    });
    const capEvaluation = evaluateO(forced);
    expect(
      capEvaluation.roomGeneration.forcePressure.find(
        (entry) =>
          semanticAddressKey(entry.targetOrigin) ===
          semanticAddressKey(createTargetAddress(oBiome, oIds.story, 1)),
      ),
    ).toMatchObject({
      selectedPossible: false,
      selectedExclusionReasons: expect.arrayContaining(['maxAppearancesThisBiome']),
    });
  });

  it('jointly rejects an overdrawn wheel at the concrete offer owner', () => {
    let document = applyProjectCommand(validProject(), catalog, {
      kind: 'ReplaceRewardWheelOfferCount',
      wheel: createRewardWheelAddress(oBiome, oIds.combat04, 'wheel1'),
      offerCount: 2,
    });
    for (const offerKey of ['offer1', 'offer2'] as const) {
      document = applyProjectCommand(document, catalog, {
        kind: 'ReplaceRewardWheelOffer',
        offer: createRewardWheelOfferAddress(oBiome, oIds.combat04, 'wheel1', offerKey),
        value: { rewardType: 'SpellDrop' },
      });
    }
    const evaluation = evaluateO(document);

    expect(evaluation.validity).toBe('invalid');
    expect(evaluation.rewards.findings).toContainEqual(
      expect.objectContaining({
        code: 'rewardBagEntryUnavailable',
        origin: expect.objectContaining({
          kind: 'rewardWheelOffer',
          routeKey: 'Surface',
          biomeKey: 'O',
          occurrenceId: oIds.combat04,
          wheelKey: 'wheel1',
          offerKey: expect.stringMatching(/^offer[12]$/),
        }),
      }),
    );
  });
});

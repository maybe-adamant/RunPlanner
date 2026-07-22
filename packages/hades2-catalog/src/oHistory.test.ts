import {
  applyProjectCommand,
  createBiomeAddress,
  createContinuationAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPickedAddress,
  createProjectDocument,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  createTargetAddress,
  semanticAddressKey,
  type HubBiomePlan,
  type LinearBiomePlan,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  composeLinearHistory,
  composeNHistory,
  evaluateHubCompleteness,
  evaluateLinearCompleteness,
  evaluateLinearRewards,
  evaluateNRewards,
  materializeHubBiome,
  materializeLinearBiome,
  type CompleteHubCompletenessResult,
  type CompleteLinearCompletenessResult,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { catalog } from './index';

const nBiome = createBiomeAddress('Surface', 'N');
const oBiome = createBiomeAddress('Surface', 'O');

function project(): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: 'o-history-fixture',
    name: 'O History Fixture',
    configuredBiomeCounts: { Surface: 2 },
  });
}

function nPlan(document: ProjectDocument): HubBiomePlan {
  const plan = document.routes
    .find((route) => route.routeKey === 'Surface')
    ?.biomes.find((biome) => biome.biomeKey === 'N');
  if (plan?.kind !== 'HubBiome') {
    throw new Error('fixture has no N plan');
  }
  return plan;
}

function oPlan(document: ProjectDocument): LinearBiomePlan {
  const plan = document.routes
    .find((route) => route.routeKey === 'Surface')
    ?.biomes.find((biome) => biome.biomeKey === 'O');
  if (plan?.kind !== 'LinearBiome') {
    throw new Error('fixture has no O plan');
  }
  return plan;
}

function completeN(document: ProjectDocument): ProjectDocument {
  let next = applyProjectCommand(document, catalog, {
    kind: 'CreateHubTopology',
    biome: nBiome,
    fixedOccurrenceIds: {
      opening: createOccurrenceId('n-o-opening'),
      preHub: createOccurrenceId('n-o-prehub'),
      preboss: createOccurrenceId('n-o-preboss'),
    },
  });
  const openSlots = [
    'combat01',
    'combat02',
    'combat03',
    'combat04',
    'combat05',
    'combat06',
    'combat07',
    'combat08',
    'combat09',
  ];
  for (const hubSlotKey of openSlots) {
    next = applyProjectCommand(next, catalog, {
      kind: 'OpenHubSlot',
      slot: createHubSlotAddress(nBiome, hubSlotKey),
      occurrenceId: createOccurrenceId(`n-o-${hubSlotKey}`),
    });
  }
  const hubOffers = {
    combat01: { rewardType: 'MaxHealthDropBig' },
    combat02: { rewardType: 'MaxManaDropBig' },
    combat03: { rewardType: 'WeaponUpgrade' },
    combat04: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource' as const, source: 'HeraUpgrade' },
    },
    combat05: { rewardType: 'HermesUpgrade' },
    combat06: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource' as const, source: 'PoseidonUpgrade' },
    },
    combat07: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' },
    },
    combat08: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource' as const, source: 'ZeusUpgrade' },
    },
    combat09: { rewardType: 'SpellDrop' },
  } as const;
  for (const [hubSlotKey, value] of Object.entries(hubOffers)) {
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, createOccurrenceId(`n-o-${hubSlotKey}`)),
      value,
    });
  }
  for (const [index, hubSlotKey] of openSlots.slice(0, 6).entries()) {
    next = applyProjectCommand(next, catalog, {
      kind: 'AppendHubVisit',
      visit: createHubVisitAddress(nBiome, index + 1),
      hubSlotKey,
    });
  }
  return applyProjectCommand(next, catalog, {
    kind: 'ReplaceShopOffer',
    offer: createShopOfferAddress(nBiome, createOccurrenceId('n-o-preboss'), 'MajorNonBoon'),
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

function completeO(document: ProjectDocument): ProjectDocument {
  const combat01 = createOccurrenceId('o-history-combat01');
  const reprieve = createOccurrenceId('o-history-reprieve');
  const combat02 = createOccurrenceId('o-history-combat02');
  const miniboss = createOccurrenceId('o-history-miniboss');
  const story = createOccurrenceId('o-history-story');
  const devotion = createOccurrenceId('o-history-devotion');
  let next = applyProjectCommand(document, catalog, {
    kind: 'CreateStart',
    biome: oBiome,
    occurrenceId: createOccurrenceId('o-history-intro'),
    gameName: 'O_Intro',
  });
  next = appendRoom(next, createOccurrenceId('o-history-intro'), combat01, 'O_Combat01');
  next = applyProjectCommand(next, catalog, {
    kind: 'ReplaceShipEncounterCount',
    occurrence: createOccurrenceAddress(oBiome, combat01),
    encounterCount: 3,
  });
  next = applyProjectCommand(next, catalog, {
    kind: 'ReplaceRewardWheelStore',
    wheel: createRewardWheelAddress(oBiome, combat01, 'wheel2'),
    storeKey: 'MetaProgress',
  });
  next = applyProjectCommand(next, catalog, {
    kind: 'ReplaceRewardWheelOffer',
    offer: createRewardWheelOfferAddress(oBiome, combat01, 'wheel2', 'offer1'),
    value: { rewardType: 'MetaCurrencyBigDrop' },
  });
  next = appendRoom(next, combat01, reprieve, 'O_Reprieve01');
  next = appendRoom(next, reprieve, combat02, 'O_Combat02');
  next = appendRoom(next, combat02, miniboss, 'O_MiniBoss01');
  next = appendRoom(next, miniboss, story, 'O_Story01');
  next = appendRoom(next, story, devotion, 'O_Devotion01');
  next = applyProjectCommand(next, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(oBiome, devotion),
    value: {
      rewardType: 'Devotion',
      payload: {
        kind: 'DevotionPair',
        chosenSource: 'HeraUpgrade',
        spurnedSource: 'PoseidonUpgrade',
      },
    },
  });
  next = applyProjectCommand(next, catalog, {
    kind: 'CreateTerminalTransition',
    continuation: createContinuationAddress(oBiome, devotion),
    targetOccurrenceIds: [createOccurrenceId('o-history-preboss')],
  });
  return applyProjectCommand(next, catalog, {
    kind: 'ReplaceShopOffer',
    offer: createShopOfferAddress(oBiome, createOccurrenceId('o-history-preboss'), 'MajorNonBoon'),
    value: { rewardType: 'MaxHealthDrop' },
  });
}

function completeHub(document: ProjectDocument): CompleteHubCompletenessResult {
  const result = evaluateHubCompleteness(catalog, nBiome, nPlan(document));
  if (result.completion !== 'complete') {
    throw new Error(`N fixture is incomplete: ${result.findings.map((finding) => finding.code)}`);
  }
  return result;
}

function completeLinear(document: ProjectDocument): CompleteLinearCompletenessResult {
  const result = evaluateLinearCompleteness(catalog, oBiome, oPlan(document));
  if (result.completion !== 'complete') {
    throw new Error(`O fixture is incomplete: ${result.findings.map((finding) => finding.code)}`);
  }
  return result;
}

function fixture() {
  const document = completeO(completeN(project()));
  const nSnapshot = materializeHubBiome(catalog, nBiome, completeHub(document));
  const nHistory = composeNHistory(catalog, nSnapshot);
  const nRewards = evaluateNRewards(catalog, nSnapshot, nHistory);
  const snapshot = materializeLinearBiome(catalog, oBiome, completeLinear(document));
  const history = composeLinearHistory(catalog, snapshot, nHistory);
  return { document, history, nHistory, nRewards, snapshot };
}

describe('O canonical materialization and lifecycle', () => {
  it('materializes active wheels, source-derived stores, and the direct completion tail', () => {
    const { snapshot } = fixture();
    const firstCombat = snapshot.batches[0]?.targets[0]?.room;
    const reprieve = snapshot.batches[1]?.targets[0]?.room;
    const secondCombat = snapshot.batches[2]?.targets[0]?.room;

    expect(firstCombat).toMatchObject({
      gameName: 'O_Combat01',
      encounterProfileKey: 'ShipCombat',
      encounterPhases: [{ key: 'Intro' }, { key: 'Combat1' }, { key: 'Combat2' }],
      rewardWheels: [
        { wheelKey: 'wheel1', storeKey: 'RunProgress', offers: [{ picked: true }] },
        {
          wheelKey: 'wheel2',
          storeKey: 'MetaProgress',
          offers: [{ offer: { rewardType: 'MetaCurrencyBigDrop' }, picked: true }],
        },
      ],
    });
    expect(reprieve?.incomingReward).toMatchObject({ resolvedStoreKey: 'MetaProgress' });
    expect(secondCombat).toMatchObject({
      gameName: 'O_Combat02',
      encounterPhases: [{ key: 'Intro' }, { key: 'Combat1' }],
      rewardWheels: [{ wheelKey: 'wheel1' }],
    });
    expect(snapshot.batches[1]?.rewardStore).toMatchObject({ kind: 'sourceOfferPoint' });
    expect(snapshot.terminalEntry).toMatchObject({
      pickedExitIndex: 1,
      targets: [
        {
          picked: true,
          continuation: 'entersTerminal',
          room: {
            gameName: 'O_PreBoss01',
            lifecycleProfileKey: 'TerminalWorldShopRoom',
            entryState: { kind: 'shop' },
          },
        },
      ],
    });
    expect(snapshot.completionRooms.map((room) => room.gameName)).toEqual([
      'O_Boss01',
      'O_PostBoss01',
    ]);
  });

  it('orders both wheel lifecycles at their encounter phases and carries N route state', () => {
    const { history, nHistory, snapshot } = fixture();
    const combat = snapshot.batches[0]!.targets[0]!.room;
    const events = history.events.filter(
      (event) =>
        'origin' in event && semanticAddressKey(event.origin) === semanticAddressKey(combat.origin),
    );

    expect(events.map((event) => event.kind)).toEqual([
      'roomCreated',
      'roomPrepared',
      'roomEntered',
      'encounterStarted',
      'encounterCompleted',
      'offerPointMaterialized',
      'encounterStarted',
      'encounterDepthAdvanced',
      'encounterCompleted',
      'offerPointAcquired',
      'offerPointMaterialized',
      'encounterStarted',
      'encounterDepthAdvanced',
      'encounterCompleted',
      'offerPointAcquired',
      'outgoingGenerationCheckpoint',
      'roomCommitted',
      'roomCountersAdvanced',
      'roomExited',
    ]);
    expect(
      events
        .filter((event) => event.kind === 'offerPointAcquired')
        .map((event) => [event.offerPoint, event.enteredRewardStoreKey]),
    ).toEqual([
      ['wheel1', 'RunProgress'],
      ['wheel2', 'MetaProgress'],
    ]);
    const view = history.rooms.find(
      (room) => semanticAddressKey(room.origin) === semanticAddressKey(combat.origin),
    );
    expect(
      view?.offerPoints?.map((offerPoint) => ({
        key: offerPoint.offerPoint,
        offerDepth: offerPoint.before.ledgers.counters.biomeEncounterDepth,
        acquisitionDepth: offerPoint.acquisitionBefore?.ledgers.counters.biomeEncounterDepth,
      })),
    ).toEqual([
      { key: 'wheel1', offerDepth: 1, acquisitionDepth: 2 },
      { key: 'wheel2', offerDepth: 2, acquisitionDepth: 3 },
    ]);
    expect(
      view?.exit.ledgers.enteredRewardStores
        .filter((entry) => semanticAddressKey(entry.origin) === semanticAddressKey(combat.origin))
        .map((entry) => entry.storeKey),
    ).toEqual(['RunProgress', 'MetaProgress']);
    expect(history.events[0]?.sequence).toBe(nHistory.afterTransition.sequence + 1);
    expect(
      (history.events[0] as Extract<(typeof history.events)[number], { kind: 'biomeStarted' }>)
        .counters.routeEncounterDepth,
    ).toBe(nHistory.afterTransition.ledgers.counters.routeEncounterDepth);
  });

  it('jointly resolves active wheel offers and acquires only each picked offer', () => {
    const { history, nRewards, snapshot } = fixture();
    expect(nRewards.findings).toEqual([]);
    expect(nRewards.validity).toBe('valid');
    const rewards = evaluateLinearRewards(catalog, snapshot, history, 2, nRewards.branches);
    const firstCombat = snapshot.batches[0]!.targets[0]!.room;
    const wheelOffers = firstCombat.rewardWheels!.flatMap((wheel) => wheel.offers);

    expect(rewards.findings).toEqual([]);
    expect(rewards.validity).toBe('valid');
    for (const offer of wheelOffers) {
      expect(
        rewards.branches.some((branch) =>
          branch.events.some(
            (event) =>
              event.kind === 'rewardOffered' &&
              semanticAddressKey(event.origin) === semanticAddressKey(offer.origin),
          ),
        ),
      ).toBe(true);
      expect(
        rewards.branches.some((branch) =>
          branch.events.some(
            (event) =>
              event.kind === 'concreteAcquisition' &&
              semanticAddressKey(event.origin) === semanticAddressKey(offer.origin),
          ),
        ),
      ).toBe(offer.picked);
    }
    const secondCombat = snapshot.batches[2]!.targets[0]!.room;
    expect(secondCombat.rewardWheels?.map((wheel) => wheel.wheelKey)).toEqual(['wheel1']);
  });
});

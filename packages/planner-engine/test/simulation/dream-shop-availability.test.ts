import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createBiomeFieldAddress,
  createExitDecisionAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createProjectDocument,
  createStartingRewardAddress,
  createShopOfferAddress,
  createTargetAddress,
  createTraitOfferAddress,
  resolveRoutePosition,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { createArcanaFearState } from '../../src/simulation/arcana-fear';
import { materializeAuthoredRoom } from '../../src/simulation/materialization/rooms/assemble';
import { createRewardFacts } from '../../src/simulation/rewards/facts';
import { initializeTestRewardBranchesForRoute as initializeRewardBranches } from '../support/arcana-fear';
import { processShopInventory } from '../../src/simulation/rewards/shop/inventory';
import { deriveTravelRefill } from '../../src/simulation/rewards/shop/derived-rewards';
import { settleShopAcquisitionSite } from '../../src/simulation/rewards/shop/settlement';

const dreamI = createBiomeAddress('Dream', 'I');

function authorApolloOpening(
  project: ReturnType<typeof createProjectDocument>,
  biome: typeof dreamI,
  occurrenceId: ReturnType<typeof createOccurrenceId>,
) {
  const reward = createIncomingRewardAddress(biome, occurrenceId);
  let next = applyProjectCommand(project, catalog, {
    kind: 'ReplaceStartingReward',
    reward: createStartingRewardAddress('Dream'),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
  });
  next = applyProjectCommand(next, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(reward, 'source'),
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
  });
  return next;
}

function dreamIShopContact(metaOption: 'ElementalBoost' | 'CardUpgradePointsDrop') {
  const shop = createOccurrenceId('dream-shop-i-preboss');
  let project = createProjectDocument(catalog, {
    projectId: 'dream-i-shop-contact',
    routeKey: 'Dream',
    itineraryBiomeKeys: ['I', 'Q'],
    configuredBiomeCount: 1,
  });
  const intro = project.route.biomes[0]!.topology!.startOccurrenceId;
  project = authorApolloOpening(project, dreamI, intro);
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBiomeField',
    field: createBiomeFieldAddress(dreamI, 'maxNonGoalRewards'),
    value: 5,
  });
  const source = { kind: 'occurrence' as const, occurrenceId: intro };
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision: createExitDecisionAddress(dreamI, source),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(dreamI, source, 'exit1'),
    occurrenceId: shop,
    gameName: 'I_PreBoss01',
  });
  for (const [offerKey, value] of Object.entries({
    BoostedBoon: {
      optionKey: 'RandomLoot',
      offer: {
        rewardType: 'RandomLoot' as const,
        payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' },
      },
    },
    MixedProgress: { optionKey: 'MaxHealthDrop', offer: { rewardType: 'MaxHealthDrop' as const } },
    Survival: { optionKey: 'LastStandDrop', offer: { rewardType: 'LastStandDrop' as const } },
    PremiumProgress: {
      optionKey: 'RandomLoot',
      offer: {
        rewardType: 'RandomLoot' as const,
        payload: { kind: 'BoonSource' as const, source: 'ZeusUpgrade' },
      },
    },
    MetaProgress: {
      optionKey: metaOption,
      offer: {
        rewardType:
          metaOption === 'ElementalBoost'
            ? ('ElementalBoost' as const)
            : ('CardUpgradePointsDrop' as const),
      },
    },
  })) {
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopOfferOption',
      offer: createShopOfferAddress(dreamI, shop, offerKey),
      value,
    });
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopPurchaseParticipation',
    offer: createShopOfferAddress(dreamI, shop, 'MetaProgress'),
    purchased: true,
  });
  const plan = project.route?.biomes[0];
  const occurrence = plan?.topology?.occurrences.find(
    (candidate) => candidate.occurrenceId === shop,
  );
  if (occurrence === undefined) throw new Error('Dream I contact lost its Shop occurrence');
  const declaration = catalog.rooms.byKey.I_PreBoss01;
  if (declaration === undefined) throw new Error('I World Shop declaration is missing');
  const room = materializeAuthoredRoom({
    catalog,
    biome: dreamI,
    routePosition: resolveRoutePosition(catalog, project.route!, 'I'),
    room: declaration,
    occurrence,
    role: 'prebossShop',
    entered: true,
    lifecycleProfileKey: 'PrebossShopRoom',
    loadout: project.route!.loadout,
  });
  const evaluation = simulateProject(catalog, project);
  const biome = evaluation.route?.biomes[0];
  if (biome?.coverage.kind !== 'prefix') throw new Error('Dream I contact has no reached prefix');
  if (!('history' in biome)) throw new Error('Dream I contact has no assessed history');
  if (!('current' in biome.history)) throw new Error('Dream I contact expected prefix history');
  return { project, declaration, room, view: biome.history.current };
}

describe('Dream Shop availability', () => {
  it('retains an excluded Dream I Meta selection as an explicit repair finding', () => {
    const { project, declaration, room, view } = dreamIShopContact('CardUpgradePointsDrop');
    const branches = initializeRewardBranches(
      undefined,
      createArcanaFearState(catalog, project.route!.loadout),
      catalog,
      project.route!.loadout.startingKeepsakeKey,
      undefined,
      'Dream',
      project.route!.loadout,
      { routePosition: resolveRoutePosition(catalog, project.route, 'I'), historyView: view },
    );
    const facts = (history: (typeof branches)[number]['state']['rewardHistory']) =>
      createRewardFacts({
        catalog,
        sourceOrigin: room.origin,
        currentRoom: room,
        sourceDeclaration: declaration,
        view,
        history,
        enteredBiomeCount: 1,
        currentBatchRoomGameNames: [],
        rewardLookups: { hubRewardLookup: new Set() },
        fail: (detail) => {
          throw new Error(detail);
        },
      });
    const inventory = processShopInventory(branches, {
      catalog,
      room,
      declaration,
      historySequence: 1,
      facts,
      fail: (detail) => {
        throw new Error(detail);
      },
    });

    expect(inventory.findingEmissions.map((entry) => entry.finding)).toEqual([
      expect.objectContaining({
        code: 'shopOfferUnavailable',
        origin: expect.objectContaining({ offerKey: 'MetaProgress' }),
      }),
    ]);
  });

  it('settles Dream I ElementalBoost through materialization and production reward facts', () => {
    const { project, declaration, room, view } = dreamIShopContact('ElementalBoost');
    const branches = initializeRewardBranches(
      undefined,
      createArcanaFearState(catalog, project.route!.loadout),
      catalog,
      project.route!.loadout.startingKeepsakeKey,
      undefined,
      'Dream',
      project.route!.loadout,
      { routePosition: resolveRoutePosition(catalog, project.route, 'I'), historyView: view },
    );
    const facts = (history: (typeof branches)[number]['state']['rewardHistory']) =>
      createRewardFacts({
        catalog,
        sourceOrigin: room.origin,
        currentRoom: room,
        sourceDeclaration: declaration,
        view,
        history,
        enteredBiomeCount: 1,
        currentBatchRoomGameNames: [],
        rewardLookups: { hubRewardLookup: new Set() },
        fail: (detail) => {
          throw new Error(detail);
        },
      });
    const inventory = processShopInventory(branches, {
      catalog,
      room,
      declaration,
      historySequence: 1,
      facts,
      fail: (detail) => {
        throw new Error(detail);
      },
    });
    const settlement = settleShopAcquisitionSite(inventory.branches, {
      catalog,
      room,
      declaration,
      historySequence: 2,
      facts,
      order: ['MetaProgress'],
      fail: (detail) => {
        throw new Error(detail);
      },
    });
    expect(inventory.findingEmissions).toEqual([]);
    expect(settlement.findingEmissions).toEqual([]);
    expect(settlement.branches[0]?.state.traitHistory?.elementCounts).toMatchObject({
      Earth: 1,
      Air: 1,
      Fire: 1,
      Water: 1,
    });

    const profile = catalog.rewards.shops.byKey.I_WorldShop;
    const sourceOffer =
      room.entryState?.kind === 'shop'
        ? room.entryState.offers.find((offer) => offer.offerKey === 'MetaProgress')
        : undefined;
    const branch = settlement.branches[0];
    if (profile === undefined || sourceOffer === undefined || branch === undefined)
      throw new Error('Dream I Travel refill contact is incomplete');
    const refill = deriveTravelRefill({
      catalog,
      profile,
      branch,
      sourceOffer,
      slotIndex: 4,
      excludedNames: new Set(['ElementalBoost']),
      requirements: {},
      facts,
    });
    if (refill === undefined) throw new Error('Dream I Travel refill was not generated');
    expect(refill.data.generationFacts.requirements.routeKey).toBe('Dream');
    expect(refill.data.generationFacts.requirements.records.useRecord.ElementalBoost).toBe(1);
    expect(refill.data.rewardTypes).toEqual(['ElementalBoost']);
    expect(
      refill.capability.evaluateShopOption({
        optionKey: 'ElementalBoost',
        offer: { rewardType: 'ElementalBoost' },
      }),
    ).toMatchObject({ supported: true });
    expect(
      refill.capability.evaluateShopOption({
        optionKey: 'CardUpgradePointsDrop',
        offer: { rewardType: 'CardUpgradePointsDrop' },
      }),
    ).toMatchObject({ supported: false });
  });
});

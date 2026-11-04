import { describe, expect, it } from 'vitest';

import {
  summarizeCatalog,
  type Catalog,
  type CatalogCollection,
} from '@run-planner/engine/catalog-schema';

function emptyCollection<T>(): CatalogCollection<T> {
  return { values: [], byKey: {} };
}

describe('summarizeCatalog', () => {
  it('summarizes normalized catalog structure without platform dependencies', () => {
    const route = {
      key: 'FixtureRoute',
      label: 'Fixture Route',
      biomeKeys: ['A', 'B'],
      completion: {
        prebossRoomGameNameByBiomeKey: { A: 'A_PreBoss', B: 'B_PreBoss' },
        postbossRoomGameNamesByOrdinal: ['A_PostBoss', null],
      },
      initialProfile: { kind: 'matureSave' as const },
    };
    const catalog: Catalog = {
      version: 'fixture-1',
      biomes: {
        values: [
          { key: 'A', label: 'Biome A', minDepthBeforeIntros: 3 },
          { key: 'B', label: 'Biome B', minDepthBeforeIntros: 3 },
        ],
        byKey: {
          A: { key: 'A', label: 'Biome A', minDepthBeforeIntros: 3 },
          B: { key: 'B', label: 'Biome B', minDepthBeforeIntros: 3 },
        },
      },
      routes: { values: [route], byKey: { FixtureRoute: route } },
      runStartReward: {
        incomingReward: {
          kind: 'countedChoice',
          storeKeys: ['RunProgress'],
          eligibleRewardTypes: [],
          ineligibleRewardTypes: [],
          allowedRewardTypes: ['Boon'],
          producerLifecycleKey: 'RoomReward',
        },
      },
      arcanaCards: emptyCollection(),
      fearVows: emptyCollection(),
      keepsakes: emptyCollection(),
      defaultStartingKeepsakeKey: 'FixtureKeepsake',
      familiars: emptyCollection(),
      defaultFamiliarKey: 'FixtureFamiliar',
      heroMaxStats: { maxHealth: 30, maxMana: 50 },
      gold: {
        fallbackGold: 90,
        purgingPoolSale: {
          byRarity: {
            Common: { min: 30, max: 50 },
            Rare: { min: 70, max: 90 },
            Epic: { min: 140, max: 160 },
            Heroic: { min: 210, max: 230 },
            Duo: { min: 250, max: 270 },
            Legendary: { min: 400, max: 450 },
          },
          infusion: { min: 100, max: 130 },
          unranked: 20,
          perLevel: 20,
          roundDownTo: 5,
        },
      },
      rewards: {
        payloadDomains: emptyCollection(),
        rewardTypes: emptyCollection(),
        acquisitions: emptyCollection(),
        stores: emptyCollection(),
        shops: emptyCollection(),
        producerLifecycles: emptyCollection(),
        countedStoreFallbackRewardType: 'RoomRewardHealDrop',
      },
      encounterEnvelopes: emptyCollection(),
      encounterDefinitions: emptyCollection(),
      encounterSets: emptyCollection(),
      enemyGoldDrops: emptyCollection(),
      fieldNpcEncounterKeys: [],
      roomLifecycleProfiles: emptyCollection(),
      exitCompatibilityPolicies: emptyCollection(),
      exitTypes: emptyCollection(),
      rooms: emptyCollection(),
      challengeSwitches: {
        kinds: emptyCollection(),
        variants: emptyCollection(),
        hosts: emptyCollection(),
        minimumBiomeDepth: 5,
        minimumRoomsSinceLast: 3,
        producerLifecycleKey: 'ChallengeSwitchLoot',
        gold: { startingValue: 100, minimumValue: 10, defaultValue: 90 },
        bonusReward: { rewardType: 'GiftDrop', dropChance: 0.05 },
      },
      biomeLayouts: emptyCollection(),
      weapons: emptyCollection(),
      aspects: emptyCollection(),
      traits: emptyCollection(),
      chaos: {
        curses: emptyCollection(),
        blessings: emptyCollection(),
        pendingBlessingSavePath: 'OnExpire.TraitData',
        rarity: {
          itemOverride: { Rare: 0.4, Epic: 0.1, Duo: 0, Legendary: 0.05 },
          rollOrder: ['Common', 'Rare', 'Epic'],
        },
      },
      traitGivers: emptyCollection(),
      traitGiverByAcquisitionGameName: {},
      boonRarityBases: {
        olympian: { Rare: 0.1, Epic: 0.05, Heroic: 0, Duo: 0.12, Legendary: 0.1 },
        hermes: { Rare: 0.06, Epic: 0.03, Heroic: 0, Duo: 0, Legendary: 0.01 },
      },
      boonRarityRollOrder: ['Common', 'Rare', 'Epic', 'Duo', 'Legendary'],
      boonReplacement: { chance: 0.1, excludedRouteKeys: [] },
      echoLastRunBoon: { variants: emptyCollection() },
      hexes: emptyCollection(),
      traitOfferContexts: emptyCollection(),
      traitRarityOrder: ['Common', 'Rare', 'Epic', 'Heroic'],
      traitElements: [],
      traitBaseElements: ['Earth', 'Air', 'Fire', 'Water'],
    };

    expect(summarizeCatalog(catalog)).toEqual({
      version: 'fixture-1',
      routeCount: 1,
      biomeCount: 2,
      rewardTypeCount: 0,
      roomCount: 0,
    });
  });
});

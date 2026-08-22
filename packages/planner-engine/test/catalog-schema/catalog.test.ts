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
    };
    const catalog: Catalog = {
      version: 'fixture-1',
      biomes: {
        values: [
          { key: 'A', label: 'Biome A', hasPostbossKeepsakeRack: false },
          { key: 'B', label: 'Biome B', hasPostbossKeepsakeRack: false },
        ],
        byKey: {
          A: { key: 'A', label: 'Biome A', hasPostbossKeepsakeRack: false },
          B: { key: 'B', label: 'Biome B', hasPostbossKeepsakeRack: false },
        },
      },
      routes: { values: [route], byKey: { FixtureRoute: route } },
      arcanaCards: emptyCollection(),
      fearVows: emptyCollection(),
      keepsakes: emptyCollection(),
      defaultStartingKeepsakeKey: 'FixtureKeepsake',
      rewards: {
        payloadDomains: emptyCollection(),
        rewardTypes: emptyCollection(),
        acquisitions: emptyCollection(),
        stores: emptyCollection(),
        shops: emptyCollection(),
        producerLifecycles: emptyCollection(),
      },
      encounterEnvelopes: emptyCollection(),
      encounterDefinitions: emptyCollection(),
      encounterSets: emptyCollection(),
      roomLifecycleProfiles: emptyCollection(),
      exitCompatibilityPolicies: emptyCollection(),
      exitTypes: emptyCollection(),
      rooms: emptyCollection(),
      biomeLayouts: emptyCollection(),
      weapons: emptyCollection(),
      aspects: emptyCollection(),
      traits: emptyCollection(),
      traitGivers: emptyCollection(),
      boonRarityBases: {
        olympian: { Rare: 0.1, Epic: 0.05, Duo: 0.12, Legendary: 0.1 },
        hermes: { Rare: 0.06, Epic: 0.03, Duo: 0, Legendary: 0.01 },
      },
      echoLastRunBoon: { variants: emptyCollection() },
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

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
          { key: 'A', label: 'Biome A' },
          { key: 'B', label: 'Biome B' },
        ],
        byKey: {
          A: { key: 'A', label: 'Biome A' },
          B: { key: 'B', label: 'Biome B' },
        },
      },
      routes: { values: [route], byKey: { FixtureRoute: route } },
      rewards: {
        payloadDomains: emptyCollection(),
        rewardTypes: emptyCollection(),
        acquisitions: emptyCollection(),
        stores: emptyCollection(),
        shops: emptyCollection(),
        producerLifecycles: emptyCollection(),
      },
      encounterProfiles: emptyCollection(),
      roomLifecycleProfiles: emptyCollection(),
      exitCompatibilityPolicies: emptyCollection(),
      exitTypes: emptyCollection(),
      rooms: emptyCollection(),
      biomeLayouts: emptyCollection(),
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

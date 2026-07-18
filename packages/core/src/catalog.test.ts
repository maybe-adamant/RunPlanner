import { describe, expect, it } from 'vitest';

import { summarizeCatalog, type Catalog, type CatalogCollection } from './catalog';

function emptyCollection<T>(): CatalogCollection<T> {
  return { values: [], byKey: {} };
}

describe('summarizeCatalog', () => {
  it('summarizes normalized catalog structure without platform dependencies', () => {
    const route = {
      key: 'FixtureRoute',
      label: 'Fixture Route',
      biomeSteps: [
        { key: 'Fixture_A', biome: 'A' },
        { key: 'Fixture_B', biome: 'B' },
      ],
    };
    const catalog: Catalog = {
      version: 'fixture-1',
      routes: { values: [route], byKey: { FixtureRoute: route } },
      rewardPayloadDomains: emptyCollection(),
      rewardPrimitives: emptyCollection(),
      rewardStores: emptyCollection(),
      shopOptionSets: emptyCollection(),
      shopProfiles: emptyCollection(),
      encounterProfiles: emptyCollection(),
      rooms: emptyCollection(),
      biomeLayouts: emptyCollection(),
    };

    expect(summarizeCatalog(catalog)).toEqual({
      version: 'fixture-1',
      routeCount: 1,
      biomeStepCount: 2,
      rewardPrimitiveCount: 0,
      roomCount: 0,
    });
  });
});

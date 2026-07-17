import { describe, expect, it } from 'vitest';

import { summarizeCatalog, type Catalog } from './catalog';

describe('summarizeCatalog', () => {
  it('summarizes normalized catalog structure without platform dependencies', () => {
    const catalog: Catalog = {
      version: 'fixture-1',
      routes: [
        {
          key: 'FixtureRoute',
          label: 'Fixture Route',
          biomeSteps: [
            { key: 'Fixture_A', biome: 'A' },
            { key: 'Fixture_B', biome: 'B' },
          ],
        },
      ],
    };

    expect(summarizeCatalog(catalog)).toEqual({
      version: 'fixture-1',
      routeCount: 1,
      biomeStepCount: 2,
    });
  });
});

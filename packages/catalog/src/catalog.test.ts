import { describe, expect, it } from 'vitest';

import { CatalogContractError, createCatalog } from './catalog';

describe('createCatalog', () => {
  it('constructs an immutable catalog from a trivial route fixture', () => {
    const catalog = createCatalog({
      version: 'fixture-1',
      routes: [
        {
          key: 'FixtureRoute',
          label: 'Fixture Route',
          biomeSteps: [{ key: 'Fixture_A', biome: 'A' }],
        },
      ],
    });

    expect(catalog).toEqual({
      version: 'fixture-1',
      routes: [
        {
          key: 'FixtureRoute',
          label: 'Fixture Route',
          biomeSteps: [{ key: 'Fixture_A', biome: 'A' }],
        },
      ],
    });
    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog.routes)).toBe(true);
    expect(Object.isFrozen(catalog.routes[0]?.biomeSteps)).toBe(true);
  });

  it('rejects duplicate route identity at the catalog boundary', () => {
    expect(() =>
      createCatalog({
        version: 'fixture-1',
        routes: [
          { key: 'Duplicate', label: 'First', biomeSteps: [] },
          { key: 'Duplicate', label: 'Second', biomeSteps: [] },
        ],
      }),
    ).toThrow(CatalogContractError);
  });
});

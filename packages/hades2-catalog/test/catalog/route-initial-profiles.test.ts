import { describe, expect, it } from 'vitest';

import { CatalogContractError, createCatalog } from '@run-planner/hades2-catalog';
import { declarations } from '@run-planner/hades2-catalog/test-support';
import { cloneCatalogInput } from './support/catalog-input';

type MutableProfile = { kind: string; fixedWeaponKey?: string; openingRoomGameName?: string };

function freshProfileInput(mutate: (profile: MutableProfile) => void) {
  const raw = cloneCatalogInput();
  const route = raw.routes.find((candidate) => candidate.key === 'FreshFile');
  if (route === undefined) throw new Error('missing FreshFile route');
  mutate(route.initialProfile as MutableProfile);
  return raw;
}

describe('route initial profiles', () => {
  it('declares mature saves for the existing routes and a fresh profile for FreshFile', () => {
    const catalog = createCatalog(declarations);
    for (const key of ['Underworld', 'Surface', 'Dream'])
      expect(catalog.routes.byKey[key]?.initialProfile).toEqual({ kind: 'matureSave' });
    expect(catalog.routes.byKey.FreshFile).toMatchObject({
      label: 'Fresh File',
      biomeKeys: ['F', 'G', 'H', 'I'],
      initialProfile: {
        kind: 'freshFile',
        fixedWeaponKey: 'WeaponStaffSwing',
        openingRoomGameName: 'F_Opening01',
      },
      completion: {
        prebossRoomGameNameByBiomeKey: { I: 'I_PreBoss01' },
        postbossRoomGameNamesByOrdinal: ['F_PostBoss01', 'G_PostBoss01', 'H_PostBoss01', null],
      },
    });
  });

  it('resolves the fresh F_Opening01 entry as OpeningEmpty only at the first position', () => {
    const catalog = createCatalog(declarations);
    expect(catalog.rooms.byKey.F_Opening01?.entryContextualEncounterRules).toContainEqual({
      routeKey: 'FreshFile',
      position: 'first',
      encounterDefinitionKey: 'OpeningEmpty',
    });
    expect(
      catalog.rooms.byKey.F_Opening02?.entryContextualEncounterRules?.some(
        (rule) => rule.routeKey === 'FreshFile',
      ),
    ).toBe(false);
  });

  it('rejects an unknown fixed weapon', () => {
    expect(() =>
      createCatalog(
        freshProfileInput((profile) => {
          profile.fixedWeaponKey = 'WeaponMissing';
        }),
      ),
    ).toThrow(/fixedWeaponKey.*unknown weapon WeaponMissing/);
  });

  it('rejects an opening outside the first route biome', () => {
    expect(() =>
      createCatalog(
        freshProfileInput((profile) => {
          profile.openingRoomGameName = 'G_Intro';
        }),
      ),
    ).toThrow(CatalogContractError);
  });
});

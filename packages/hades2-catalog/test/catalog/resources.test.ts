import { describe, expect, it } from 'vitest';

import { CatalogContractError, catalog, createCatalog } from '@run-planner/hades2-catalog';
import { declarations, type RawCatalogInput } from '@run-planner/hades2-catalog/test-support';

const families = ['Pickaxe', 'Exorcism', 'Shovel', 'Fishing'] as const;
const chaosFamilies = ['Pickaxe', 'Shovel', 'Fishing'] as const;
const ordinaryFamiliesWithoutFishing = ['Pickaxe', 'Exorcism', 'Shovel'] as const;

const fFishingDisabled = [
  'F_MiniBoss01',
  'F_MiniBoss02',
  'F_Combat02',
  'F_Combat03',
  'F_Combat09',
  'F_Combat22',
  'F_Boss01',
  'F_PostBoss01',
] as const;
const hFishingDisabled = [
  'H_MiniBoss01',
  'H_Combat05',
  'H_Combat09',
  'H_Combat13',
  'H_Boss01',
] as const;
const iFishingDisabled = [
  'I_Combat02',
  'I_Combat03',
  'I_Combat04',
  'I_Combat05',
  'I_Combat08',
  'I_Combat09',
  'I_Combat15',
  'I_Combat16',
  'I_Combat18',
  'I_Combat20',
  'I_Combat21',
  'I_Combat22',
  'I_MiniBoss01',
  'I_Story01',
  'I_PostBoss01',
] as const;
const nFishingEnabled = ['N_Opening01', 'N_PreBoss01', 'N_Combat16', 'N_Story01'] as const;
const sourceResourceExceptionsOutsideCatalog = ['I_MiniBoss03', 'N_Shop01'] as const;
const oFishingEnabled = [
  'O_Intro',
  'O_Boss01',
  'O_Devotion01',
  'O_Reprieve01',
  'O_Story01',
] as const;
const pFishingDisabled = [
  'P_Combat02',
  'P_Combat04',
  'P_Combat08',
  'P_Combat09',
  'P_Combat12',
  'P_Combat18',
  'P_Combat19',
  'P_MiniBoss01',
  'P_MiniBoss02',
  'P_Boss01',
] as const;
const chaosRooms = [
  'Chaos_01',
  'Chaos_02',
  'Chaos_03',
  'Chaos_04',
  'Chaos_05',
  'Chaos_06',
] as const;
const roomsWithNoResourceFamilies = [
  'B_Combat01',
  'B_Combat05',
  'B_Combat06',
  'B_Combat07',
  'B_Combat08',
  'B_Combat10',
  'B_Combat21',
  'C_Boss01',
  'G_Boss01',
  'H_PostBoss01',
  'I_PostBoss01',
  'N_Hub',
  'O_PostBoss01',
  'Q_Boss01',
] as const;
const roomsIgnoringBiomeLimit = [
  'F_Reprieve01',
  'F_Story01',
  'G_Reprieve01',
  'G_Story01',
  'N_Story01',
  'O_Reprieve01',
  'O_Story01',
  ...chaosRooms,
] as const;

function input(): RawCatalogInput {
  return JSON.parse(JSON.stringify(declarations)) as RawCatalogInput;
}

describe('selected resource-success catalog facts', () => {
  it('owns the exact family-to-hidden-trait and element mapping', () => {
    const rules = catalog.rooms.byKey.F_Combat01?.resourcePointSupport.rules;
    expect(rules).toMatchObject({
      Pickaxe: { grantedTraitKey: 'FireEssence', element: 'Fire', sameFamilyLookback: 4 },
      Exorcism: { grantedTraitKey: 'AirEssence', element: 'Air', sameFamilyLookback: 6 },
      Shovel: { grantedTraitKey: 'EarthEssence', element: 'Earth', sameFamilyLookback: 4 },
      Fishing: { grantedTraitKey: 'WaterEssence', element: 'Water', sameFamilyLookback: 5 },
    });
  });

  it('normalizes normal, H, N, and Chaos spacing plus source overrides', () => {
    const normal = catalog.rooms.byKey.F_Combat01?.resourcePointSupport;
    const h = catalog.rooms.byKey.H_Combat01?.resourcePointSupport;
    const n = catalog.rooms.byKey.N_Combat01?.resourcePointSupport;
    const chaos = catalog.rooms.byKey.Chaos_01?.resourcePointSupport;
    expect(normal?.families).toEqual(families);
    for (const family of families) {
      for (const other of families) {
        expect(normal?.rules[family].crossFamilyLookback[other]).toBe(family === other ? 0 : 1);
        expect(n?.rules[family].crossFamilyLookback[other]).toBe(family === other ? 0 : 3);
        expect(chaos?.rules[family].crossFamilyLookback[other]).toBe(0);
      }
      expect(h?.rules[family].sameFamilyLookback).toBe(2);
    }
    expect(n?.rules).toMatchObject({
      Pickaxe: { sameFamilyLookback: 12 },
      Exorcism: { sameFamilyLookback: 16 },
      Shovel: { sameFamilyLookback: 12 },
      Fishing: { sameFamilyLookback: 14 },
    });
    expect(chaos).toMatchObject({
      families: chaosFamilies,
      capacity: 'allTools',
      ignoresBiomeLimit: true,
    });
  });

  it('matches every source-enumerated room support and capacity exception', () => {
    const namesWithFishing = (prefix: string) =>
      catalog.rooms.values
        .filter(
          (room) =>
            room.gameName.startsWith(prefix) &&
            room.resourcePointSupport.families.includes('Fishing'),
        )
        .map((room) => room.gameName)
        .sort();
    const namesWithoutFishing = (prefix: string) =>
      catalog.rooms.values
        .filter(
          (room) =>
            room.gameName.startsWith(prefix) &&
            !room.resourcePointSupport.families.includes('Fishing'),
        )
        .map((room) => room.gameName)
        .sort();
    const sorted = (values: readonly string[]) => [...values].sort();

    expect(namesWithoutFishing('F_')).toEqual(sorted(fFishingDisabled));
    expect(namesWithoutFishing('G_')).toEqual(['G_Boss01']);
    expect(namesWithoutFishing('H_')).toEqual(sorted([...hFishingDisabled, 'H_PostBoss01']));
    expect(namesWithoutFishing('I_')).toEqual(sorted(iFishingDisabled));
    expect(namesWithFishing('N_')).toEqual(sorted(nFishingEnabled));
    expect(namesWithFishing('O_')).toEqual(sorted(oFishingEnabled));
    expect(namesWithoutFishing('P_')).toEqual(sorted(pFishingDisabled));
    expect(namesWithoutFishing('Q_')).toEqual(['Q_Boss01', 'Q_Combat03', 'Q_Combat08']);

    for (const gameName of nFishingEnabled)
      expect(catalog.rooms.byKey[gameName]?.resourcePointSupport.families).toEqual(families);
    for (const gameName of oFishingEnabled)
      expect(catalog.rooms.byKey[gameName]?.resourcePointSupport.families).toEqual(families);
    for (const gameName of sourceResourceExceptionsOutsideCatalog)
      expect(catalog.rooms.byKey[gameName]).toBeUndefined();
    expect(catalog.rooms.byKey.N_Combat08?.resourcePointSupport.families).toEqual([
      'Pickaxe',
      'Shovel',
    ]);
    expect(catalog.rooms.byKey.P_Combat09?.resourcePointSupport.families).toEqual([
      'Pickaxe',
      'Shovel',
    ]);
    expect(catalog.rooms.byKey.I_MiniBoss02?.resourcePointSupport.families).toEqual(families);

    expect(
      catalog.rooms.values
        .filter((room) => room.resourcePointSupport.families.length === 0)
        .map((room) => room.gameName)
        .sort(),
    ).toEqual(sorted(roomsWithNoResourceFamilies));
    for (const gameName of fFishingDisabled)
      expect(catalog.rooms.byKey[gameName]?.resourcePointSupport.families).toEqual(
        ordinaryFamiliesWithoutFishing,
      );
    for (const gameName of hFishingDisabled)
      expect(catalog.rooms.byKey[gameName]?.resourcePointSupport.families).toEqual(
        ordinaryFamiliesWithoutFishing,
      );
    for (const gameName of pFishingDisabled.filter((gameName) => gameName !== 'P_Combat09'))
      expect(catalog.rooms.byKey[gameName]?.resourcePointSupport.families).toEqual(
        ordinaryFamiliesWithoutFishing,
      );
    for (const gameName of chaosRooms)
      expect(catalog.rooms.byKey[gameName]?.resourcePointSupport).toMatchObject({
        families: chaosFamilies,
        capacity: 'allTools',
        ignoresBiomeLimit: true,
      });

    expect(
      catalog.rooms.values
        .filter((room) => room.resourcePointSupport.capacity === 'allTools')
        .map((room) => room.gameName)
        .sort(),
    ).toEqual(sorted(chaosRooms));
    expect(
      catalog.rooms.values
        .filter((room) => room.resourcePointSupport.ignoresBiomeLimit === true)
        .map((room) => room.gameName)
        .sort(),
    ).toEqual(sorted(roomsIgnoringBiomeLimit));
  });

  it('publishes a closed four-family rule record for every room', () => {
    for (const room of catalog.rooms.values) {
      expect(Object.keys(room.resourcePointSupport.rules).sort()).toEqual([...families].sort());
      for (const family of families) {
        expect(
          Object.keys(room.resourcePointSupport.rules[family].crossFamilyLookback).sort(),
        ).toEqual([...families].sort());
      }
    }
  });

  it('requires each raw room to declare closed resource support', () => {
    const missingBase = input();
    const missing = {
      ...missingBase,
      rooms: missingBase.rooms.map((room, index) =>
        index === 0 ? ({ ...room, resourcePointSupport: undefined } as never) : room,
      ),
    };
    expect(() => createCatalog(missing)).toThrow(CatalogContractError);

    const invalidSupport = (
      mutate: (support: Record<string, unknown>) => Record<string, unknown>,
    ) => {
      const base = input();
      return {
        ...base,
        rooms: base.rooms.map((room, index) =>
          index === 0
            ? ({
                ...room,
                resourcePointSupport: mutate(room.resourcePointSupport as never),
              } as never)
            : room,
        ),
      };
    };
    expect(() => createCatalog(invalidSupport((support) => ({ ...support, extra: true })))).toThrow(
      CatalogContractError,
    );
    expect(() =>
      createCatalog(
        invalidSupport((support) => ({
          ...support,
          families: [...(support.families as readonly string[]), 'UnknownTool'],
        })),
      ),
    ).toThrow(CatalogContractError);
    expect(() =>
      createCatalog(
        invalidSupport((support) => ({ ...support, families: ['Pickaxe', 'Pickaxe'] })),
      ),
    ).toThrow(CatalogContractError);
    expect(() =>
      createCatalog(invalidSupport((support) => ({ ...support, capacity: 'unknown-capacity' }))),
    ).toThrow(CatalogContractError);
    expect(() =>
      createCatalog(invalidSupport((support) => ({ ...support, ignoresBiomeLimit: false }))),
    ).toThrow(CatalogContractError);
  });
});

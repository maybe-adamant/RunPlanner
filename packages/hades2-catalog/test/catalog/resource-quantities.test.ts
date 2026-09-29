import { describe, expect, it } from 'vitest';

import { catalog, createCatalog } from '../../src';
import { declarations } from '../../src/declarations';
import {
  createRewardKernelCatalog,
  rawInput,
  rewardKernelCatalog,
  rewardKernelDeclarations,
} from './support/reward-kernel';

function withBuriedTreasureBonus(bonus: unknown) {
  return {
    ...declarations,
    traitCatalog: {
      ...declarations.traitCatalog,
      traits: declarations.traitCatalog.traits.map((trait) =>
        trait.key === 'RoomRewardBonusBoon'
          ? { ...trait, resourceRewardBonus: bonus as never }
          : trait,
      ),
    },
  };
}

describe('resource quantity declarations', () => {
  it('declares the Ashes and Bones pickups base AddResources and no other resource grant', () => {
    expect(
      Object.fromEntries(
        rewardKernelCatalog.acquisitions.values.flatMap((acquisition) =>
          acquisition.resourceGrant === undefined
            ? []
            : [[acquisition.gameName, acquisition.resourceGrant]],
        ),
      ),
    ).toEqual({
      MetaCurrencyDrop: { MetaCurrency: 50 },
      MetaCurrencyBigDrop: { MetaCurrency: 100 },
      MetaCardPointsCommonDrop: { MetaCardPointsCommon: 5 },
      MetaCardPointsCommonBigDrop: { MetaCardPointsCommon: 10 },
    });
  });

  it('declares producer resource policy: NPC drops are exempt and Narcissus overrides Ashes', () => {
    const profiles = rewardKernelCatalog.producerLifecycles.values;
    expect(
      profiles.filter((profile) => profile.resourceBonusExempt === true).map((p) => p.key),
    ).toEqual(['NemesisEventPickup']);
    expect(
      Object.fromEntries(
        profiles.flatMap((profile) =>
          profile.resourceGrantOverrides === undefined
            ? []
            : [[profile.key, profile.resourceGrantOverrides]],
        ),
      ),
    ).toEqual({ NarcissusPickup: { MetaCardPointsCommonDrop: { MetaCardPointsCommon: 10 } } });
  });

  it('normalizes Buried Treasure to 1.5 scaled on its excess by rarity', () => {
    const byRarity = { Common: 1.5, Rare: 1.75, Epic: 2, Heroic: 2.25 };
    expect(catalog.traits.byKey.RoomRewardBonusBoon?.resourceRewardBonus).toEqual({
      MetaCardPointsCommon: byRarity,
      MetaCurrency: byRarity,
    });
    expect(
      catalog.traits.values.filter((trait) => trait.resourceRewardBonus !== undefined).length,
    ).toBe(1);
  });

  it('rejects malformed grants, overrides and bonuses', () => {
    expect(() =>
      createRewardKernelCatalog(
        rawInput({
          ...rewardKernelDeclarations,
          acquisitions: rewardKernelDeclarations.acquisitions.map((acquisition) =>
            acquisition.gameName === 'MetaCurrencyDrop'
              ? { ...acquisition, resourceGrant: { MetaCurrency: 0 } }
              : acquisition,
          ),
        }),
      ),
    ).toThrow(/resourceGrant\.MetaCurrency/);
    expect(() =>
      createRewardKernelCatalog(
        rawInput({
          ...rewardKernelDeclarations,
          producerLifecycles: rewardKernelDeclarations.producerLifecycles.map((profile) =>
            profile.key === 'NarcissusPickup'
              ? { ...profile, resourceGrantOverrides: { MaxHealthDrop: { MetaCurrency: 5 } } }
              : profile,
          ),
        }),
      ),
    ).toThrow(/must override a supported resource pickup/);
    expect(() =>
      createCatalog(
        withBuriedTreasureBonus({
          resources: ['MemPointsCommon'],
          baseValue: 1.5,
          rarityMultipliers: { Common: 1, Rare: 1.5, Epic: 2, Heroic: 2.5 },
        }),
      ),
    ).toThrow(/no declared pickup grants this resource/);
    expect(() =>
      createCatalog(
        withBuriedTreasureBonus({
          resources: ['MetaCurrency'],
          baseValue: 1.5,
          rarityMultipliers: { Common: 1, Rare: 1.5, Epic: 2 },
        }),
      ),
    ).toThrow(/must scale exactly this trait equipped ranked rarities/);
  });

  it('admits resource gains only where reward history is evaluated', () => {
    const threshold = {
      kind: 'recordCount',
      record: 'resourceGains',
      keys: ['MetaCardPointsCommon'],
      range: { min: 5 },
    } as const;
    const withStoreThreshold = createRewardKernelCatalog(
      rawInput({
        ...rewardKernelDeclarations,
        stores: rewardKernelDeclarations.stores.map((store, storeIndex) =>
          storeIndex === 0
            ? {
                ...store,
                entries: store.entries.map((entry, entryIndex) =>
                  entryIndex === 0 ? { ...entry, requirement: threshold } : entry,
                ),
              }
            : store,
        ),
      }),
    );
    expect(withStoreThreshold.stores.values[0]?.entries[0]?.requirement).toEqual(threshold);
    const eligibleRoom = declarations.rooms.find((room) => 'eligibility' in room);
    if (eligibleRoom === undefined) throw new Error('no room declares eligibility');
    expect(() =>
      createCatalog({
        ...declarations,
        rooms: declarations.rooms.map((room) =>
          room === eligibleRoom ? { ...room, eligibility: threshold as never } : room,
        ),
      }),
    ).toThrow(/resourceGains is only available where reward history is evaluated/);
  });
});

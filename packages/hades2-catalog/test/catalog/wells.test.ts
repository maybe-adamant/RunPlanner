import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';

const range = (prefix: string, first: number, last: number) =>
  Array.from(
    { length: last - first + 1 },
    (_, offset) => `${prefix}${String(first + offset).padStart(2, '0')}`,
  );

describe('Stygian Well room facts', () => {
  it('normalizes the complete item identities and consequential closed sets', () => {
    const profile = catalog.rewards.shops.byKey.RoomShop!;
    expect(profile.groups.byKey.Healing?.options.values.map((option) => option.key)).toEqual([
      'ArmorBoostStore',
      'DamageSelfDrop',
      'HealDropRange',
      'EmptyMaxHealthShopItem',
      'FirstHitHealTrait',
      'TemporaryDoorHealTrait',
      'TemporaryHealExpirationTrait',
      'LastStandShopItem',
    ]);
    expect(profile.groups.byKey.Other?.options.values.map((option) => option.key)).toEqual([
      'TemporaryImprovedSecondaryTrait',
      'TemporaryImprovedCastTrait',
      'TemporaryMoveSpeedTrait',
      'TemporaryBoonRarityTrait',
      'TemporaryImprovedExTrait',
      'TemporaryImprovedDefenseTrait',
      'TemporaryDiscountTrait',
      'TemporaryForcedSecretDoorTrait',
      'TemporaryEmptySlotDamageTrait',
      'ExtendedShopTrait',
      'MetaCurrencyRange',
      'MetaCardPointsCommonRange',
      'MemPointsCommonRange',
      'SeedMysteryRange',
      'RandomStoreItem',
      'LimitedManaRegenDrop',
      'LimitedSwapTraitDrop',
    ]);
    const option = (key: string) =>
      profile.groups.values
        .flatMap((group) => group.options.values)
        .find((entry) => entry.key === key)!;
    expect(option('TemporaryDiscountTrait').stygianWell?.offerRequirements).toEqual(['inactive']);
    expect(option('TemporaryEmptySlotDamageTrait').stygianWell?.offerRequirements).toEqual([
      'inactive',
      'emptyAttackOrSpecial',
    ]);
    expect(option('ExtendedShopTrait').stygianWell?.extendedDirectPurchaseItemKeys).toEqual([
      'TemporaryDoorHealTrait',
      'TemporaryImprovedSecondaryTrait',
      'TemporaryImprovedCastTrait',
      'TemporaryMoveSpeedTrait',
      'TemporaryImprovedExTrait',
      'TemporaryImprovedDefenseTrait',
      'TemporaryDiscountTrait',
      'TemporaryEmptySlotDamageTrait',
    ]);
    expect(option('RandomStoreItem').stygianWell?.nestedResultItemKeys).toEqual([
      'TemporaryImprovedSecondaryTrait',
      'TemporaryImprovedCastTrait',
      'TemporaryMoveSpeedTrait',
      'TemporaryBoonRarityTrait',
      'TemporaryImprovedExTrait',
      'TemporaryImprovedDefenseTrait',
      'TemporaryDiscountTrait',
      'TemporaryHealExpirationTrait',
      'TemporaryDoorHealTrait',
      'LastStandShopItem',
      'EmptyMaxHealthShopItem',
      'HealDropRange',
      'MetaCurrencyRange',
      'MetaCardPointsCommonRange',
      'MemPointsCommonRange',
      'SeedMysteryRange',
    ]);
    expect(option('RandomStoreItem').stygianWell?.nestedRuntimeOfferFallbacks).toEqual([
      { preferredItemKey: 'LastStandShopItem', fallbackItemKey: 'EmptyMaxHealthShopItem' },
    ]);
    expect(option('LastStandShopItem').runtimeOfferFallbackRewardTypes).toEqual(['ArmorBoost']);
    expect(option('ArmorBoostStore').runtimeOfferFallbackRewardTypes).toEqual(['MaxHealthDrop']);
  });

  it('normalizes the exact installed ordinary host matrix and forced Postboss anchors', () => {
    const fCounts = [1, 1, 2, 1, 2, 2, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 1, 2, 1, 1, 1, 1];
    const gNames = ['G_Combat01', 'G_Combat02', 'G_Combat03', ...range('G_Combat', 7, 20)];
    const gCounts = [1, 2, 2, 1, 1, 2, 2, 2, 2, 1, 1, 1, 1, 2, 1, 1, 1];
    const iCounts = [3, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 1, 1, 2, 2, 1, 1, 2, 1, 1, 2, 3, 1, 1];
    const expected = [
      ...range('F_Combat', 1, 22).map(
        (gameName, index) => [gameName, fCounts[index], 0.25, false] as const,
      ),
      ['F_PostBoss01', 2, 1, true] as const,
      ...gNames.map((gameName, index) => [gameName, gCounts[index], 0.3, false] as const),
      ['G_PostBoss01', 2, 1, true] as const,
      ...range('H_Combat', 1, 15).map((gameName) => [gameName, 1, 0.35, false] as const),
      ['H_PostBoss01', 2, 1, true] as const,
      ...range('I_Combat', 1, 24).map(
        (gameName, index) => [gameName, iCounts[index], 0.08, false] as const,
      ),
      ['I_MiniBoss01', 2, 0.08, false] as const,
      ['I_MiniBoss02', 2, 0.08, false] as const,
    ];
    const actual = catalog.rooms.values
      .filter((room) => room.roomShop !== undefined)
      .map(
        (room) =>
          [
            room.gameName,
            room.challengeSwitchAnchorCount,
            room.roomShop!.spawnChance,
            room.roomShop!.forced === true,
          ] as const,
      );
    expect(actual).toEqual(expected);
    for (const gameName of [
      'G_Combat04',
      'G_Combat05',
      'G_Combat06',
      'I_PostBoss01',
      'I_Story01',
      'I_Reprieve01',
    ])
      expect(catalog.rooms.byKey[gameName]?.roomShop, gameName).toBeUndefined();
  });
});

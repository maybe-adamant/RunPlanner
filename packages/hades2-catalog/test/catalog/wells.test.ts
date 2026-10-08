import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';

const range = (prefix: string, first: number, last: number) =>
  Array.from(
    { length: last - first + 1 },
    (_, offset) => `${prefix}${String(first + offset).padStart(2, '0')}`,
  );

describe('Stygian Well room facts', () => {
  it('normalizes the complete item identities, offer gates and Twist pool', () => {
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
    expect(
      Object.fromEntries(
        profile.groups.values
          .flatMap((group) => group.options.values)
          .map((entry) => [entry.key, entry.label]),
      ),
    ).toEqual({
      ArmorBoostStore: 'Splintered Shield',
      DamageSelfDrop: 'Price of Midas',
      EmptyMaxHealthShopItem: 'Centaur Soul',
      ExtendedShopTrait: 'Archaic Seal',
      FirstHitHealTrait: 'Breath of Eros',
      HealDropRange: 'Life Essence',
      LastStandShopItem: 'Kiss of Styx',
      LimitedManaRegenDrop: 'Mist Veil',
      LimitedSwapTraitDrop: 'Sacrificial Hymn',
      MemPointsCommonRange: 'Faint Flicker',
      MetaCardPointsCommonRange: 'Dust Parcel',
      MetaCurrencyRange: 'Exhumed Remains',
      RandomStoreItem: 'Fateful Twist',
      SeedMysteryRange: "Gaia's Gift",
      TemporaryBoonRarityTrait: 'Yarn of Ariadne',
      TemporaryDiscountTrait: 'Ferry Voucher',
      TemporaryDoorHealTrait: 'HydraLite',
      TemporaryEmptySlotDamageTrait: 'Danaid Dagger',
      TemporaryForcedSecretDoorTrait: 'Spark of Ixion',
      TemporaryHealExpirationTrait: 'Charity Bottle',
      TemporaryImprovedCastTrait: 'Braid of Atlas',
      TemporaryImprovedDefenseTrait: 'Python Scales',
      TemporaryImprovedExTrait: "Witch's Mark",
      TemporaryImprovedSecondaryTrait: 'Chimaera Jerky',
      TemporaryMoveSpeedTrait: 'Ignited Ichor',
    });
    expect(option('TemporaryDiscountTrait').stygianWell?.offerRequirements).toEqual(['inactive']);
    expect(option('TemporaryEmptySlotDamageTrait').stygianWell?.offerRequirements).toEqual([
      'inactive',
      'emptyAttackOrSpecial',
    ]);
    expect(option('RandomStoreItem').stygianWell?.grant).toEqual({
      kind: 'twist',
      pool: [
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
      ],
    });
  });

  it('normalizes every Well item grant with its native uses and clock', () => {
    const grants = Object.fromEntries(
      catalog.rewards.shops.byKey
        .RoomShop!.groups.values.flatMap((group) => group.options.values)
        .filter((option) => option.key !== 'RandomStoreItem')
        .map((option) => [option.key, option.stygianWell?.grant]),
    );
    const timed = (
      traitKey: string,
      initialUses: number,
      clock: 'encounters' | 'rooms',
      publishedEffect?: 'discount' | 'emptySlot',
    ) => ({
      kind: 'timedTrait',
      traitKey,
      initialUses,
      clock,
      ...(publishedEffect === undefined ? {} : { publishedEffect }),
    });
    expect(grants).toEqual({
      ArmorBoostStore: { kind: 'ledger' },
      DamageSelfDrop: { kind: 'immediate' },
      HealDropRange: { kind: 'immediate' },
      EmptyMaxHealthShopItem: {
        kind: 'consumable',
        acquisitionGameName: 'EmptyMaxHealthShopItem',
      },
      FirstHitHealTrait: { kind: 'ledger' },
      TemporaryDoorHealTrait: timed('TemporaryDoorHealTrait', 3, 'rooms'),
      TemporaryHealExpirationTrait: timed('TemporaryHealExpirationTrait', 4, 'encounters'),
      LastStandShopItem: {
        kind: 'consumable',
        acquisitionGameName: 'LastStandShopItem',
        publishedEffect: 'lastStand',
      },
      TemporaryImprovedSecondaryTrait: timed('TemporaryImprovedSecondaryTrait', 5, 'encounters'),
      TemporaryImprovedCastTrait: timed('TemporaryImprovedCastTrait', 5, 'encounters'),
      TemporaryMoveSpeedTrait: timed('TemporaryMoveSpeedTrait', 8, 'encounters'),
      TemporaryBoonRarityTrait: { kind: 'charge', charge: 'yarn' },
      TemporaryImprovedExTrait: timed('TemporaryImprovedExTrait', 6, 'encounters'),
      TemporaryImprovedDefenseTrait: timed('TemporaryImprovedDefenseTrait', 5, 'encounters'),
      TemporaryDiscountTrait: timed('TemporaryDiscountTrait', 6, 'encounters', 'discount'),
      TemporaryForcedSecretDoorTrait: { kind: 'charge', charge: 'spark' },
      TemporaryEmptySlotDamageTrait: timed(
        'TemporaryEmptySlotDamageTrait',
        6,
        'encounters',
        'emptySlot',
      ),
      ExtendedShopTrait: {
        kind: 'charge',
        charge: 'extended',
        eligibleItemKeys: [
          'TemporaryDoorHealTrait',
          'TemporaryImprovedSecondaryTrait',
          'TemporaryImprovedCastTrait',
          'TemporaryMoveSpeedTrait',
          'TemporaryImprovedExTrait',
          'TemporaryImprovedDefenseTrait',
          'TemporaryDiscountTrait',
          'TemporaryEmptySlotDamageTrait',
        ],
        bossExtension: 2,
      },
      MetaCurrencyRange: { kind: 'immediate' },
      MetaCardPointsCommonRange: { kind: 'immediate' },
      MemPointsCommonRange: { kind: 'immediate' },
      SeedMysteryRange: { kind: 'immediate' },
      LimitedManaRegenDrop: { kind: 'ledger' },
      LimitedSwapTraitDrop: { kind: 'charge', charge: 'hymn' },
    });
    for (const gameName of ['EmptyMaxHealthShopItem', 'LastStandShopItem'])
      expect(catalog.rewards.acquisitions.byKey[gameName]).toMatchObject({
        kind: 'consumable',
        historyProjection: 'consumableAndUse',
      });
  });

  it('normalizes the exact installed ordinary host matrix and forced Postboss anchors', () => {
    const fCounts = [1, 1, 2, 1, 2, 2, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 1, 2, 1, 1, 1, 1];
    const gNames = ['G_Combat01', 'G_Combat02', 'G_Combat03', ...range('G_Combat', 7, 20)];
    const gCounts = [1, 2, 2, 1, 1, 2, 2, 2, 2, 1, 1, 1, 1, 2, 1, 1, 1];
    const iCounts = [3, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 1, 1, 2, 2, 1, 1, 2, 1, 1, 2, 3, 1, 1];
    const expected = [
      ...['Dream_PostBoss01', 'Dream_PostBoss02', 'Dream_PostBoss03'].map(
        (gameName) => [gameName, 1, 1, true] as const,
      ),
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
    for (const gameName of ['Dream_PostBoss01', 'Dream_PostBoss02', 'Dream_PostBoss03']) {
      expect(catalog.rooms.byKey[gameName]).toMatchObject({
        roomSetKey: 'Dream',
        kind: 'PostBoss',
        hasKeepsakeRack: true,
        hasRequiredFountain: true,
        roomShop: { profileKey: 'RoomShop', spawnChance: 1, forced: true },
        exits: [],
      });
      expect(catalog.rooms.byKey[gameName]?.purgingPool).toBeUndefined();
      expect(catalog.rooms.byKey[gameName]).not.toHaveProperty('hermesShrine');
    }
    for (const gameName of ['G_Combat04', 'G_Combat05', 'G_Combat06', 'I_Story01', 'I_Reprieve01'])
      expect(catalog.rooms.byKey[gameName]?.roomShop, gameName).toBeUndefined();
  });
});

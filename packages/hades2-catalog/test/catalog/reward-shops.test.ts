import { CatalogContractError } from '@run-planner/hades2-catalog';
import {
  createRewardKernelCatalog,
  replaceShopOption,
  rewardKernelCatalog,
} from './support/reward-kernel';
import { describe, expect, it } from 'vitest';
import type { RawRewardKernelInput } from '@run-planner/hades2-catalog/test-support';

describe('reward compiler Shop normalizer', () => {
  it('normalizes World, Surface, I, and Q shop pools with their declared slot groups', () => {
    expect(rewardKernelCatalog.shops.byKey.SurfaceShop?.slotCount).toBe(3);
    expect(rewardKernelCatalog.shops.byKey.WorldShop?.slotCount).toBe(3);
    expect(rewardKernelCatalog.shops.byKey.I_WorldShop?.slotCount).toBe(5);
    expect(rewardKernelCatalog.shops.byKey.Q_WorldShop?.slotCount).toBe(6);
    expect(rewardKernelCatalog.shops.byKey.Q_WorldShop?.groups.values[0]?.offerCount).toBe(2);
    for (const profileKey of ['I_WorldShop', 'Q_WorldShop'] as const) {
      const survival = rewardKernelCatalog.shops.byKey[profileKey]?.groups.byKey.Survival;
      const option = survival?.options.byKey.LastStandDrop;
      expect(option?.requirement).toBeUndefined();
      expect(option?.purchaseRequirement).toBeUndefined();
      expect(option?.runtimeOfferRequirement).toBe('missingLastStand');
      expect(option?.runtimeOfferFallbackRewardTypes).toEqual(['ArmorBoost', 'ArmorBigBoost']);
      expect(survival?.options.byKey.ArmorBoost?.runtimeOfferFallbackRewardTypes).toEqual([
        'RoomRewardHealDrop',
      ]);
      expect(survival?.options.byKey.ArmorBigBoost?.runtimeOfferFallbackRewardTypes).toEqual([
        'HealBigDrop',
      ]);
    }
    expect(rewardKernelCatalog.shops.byKey.WorldShop?.groups.byKey.Boon?.rewardTypes).toEqual([
      'RandomLoot',
      'BlindBoxLoot',
      'ShopHermesUpgrade',
    ]);
    expect(
      Object.isFrozen(rewardKernelCatalog.shops.byKey.WorldShop?.groups.byKey.Boon?.rewardTypes),
    ).toBe(true);
    expect(
      rewardKernelCatalog.shops.byKey.WorldShop?.groups.byKey.MajorNonBoon?.options.values
        .filter((entry) => entry.rewardType === 'WeaponUpgradeDrop')
        .map((entry) => entry.key),
    ).toEqual(['WeaponUpgradeDropEarly', 'WeaponUpgradeDropLate']);
    expect(
      rewardKernelCatalog.shops.byKey.WorldShop?.groups.byKey.Boon?.options.byKey.BlindBoxLoot
        ?.acquisitionLifecycle,
    ).toEqual([
      { role: 'box', lifecyclePoint: 'purchase' },
      { role: 'hiddenSource', lifecyclePoint: 'afterUnwrap' },
    ]);
    expect(
      rewardKernelCatalog.shops.byKey.WorldShop?.groups.byKey.Boon?.options.byKey.RandomLoot
        ?.rewardType,
    ).toBe('RandomLoot');
    expect(
      Object.fromEntries(
        rewardKernelCatalog.shops.values.map((profile) => [
          profile.key,
          profile.slots.values.map((slot) => slot.groupKey),
        ]),
      ),
    ).toEqual({
      RoomShop: ['Healing', 'Other', 'Other'],
      SurfaceShop: ['First', 'Second', 'Second'],
      WorldShop: ['Boon', 'MajorNonBoon', 'Minor'],
      I_WorldShop: ['BoostedBoon', 'MixedProgress', 'Survival', 'PremiumProgress', 'MetaProgress'],
      Q_WorldShop: [
        'MixedProgress',
        'MixedProgress',
        'LargeSurvival',
        'Survival',
        'PremiumProgress',
        'MetaProgress',
      ],
    });
    const surfaceFirst = rewardKernelCatalog.shops.byKey.SurfaceShop?.groups.byKey.First;
    expect(surfaceFirst?.options.byKey.LastStandDrop?.runtimeOfferFallbackRewardTypes).toEqual([
      'ArmorBoost',
    ]);
    expect(surfaceFirst?.options.byKey.ArmorBoost?.runtimeOfferFallbackRewardTypes).toEqual([
      'ArmorBigBoost',
    ]);
    expect(
      Object.fromEntries(
        rewardKernelCatalog.shops.values.map((profile) => [
          profile.key,
          profile.groups.values.map((group) => ({
            key: group.key,
            offerCount: group.offerCount,
            options: group.options.values.map((entry) => entry.key),
          })),
        ]),
      ),
    ).toEqual({
      RoomShop: [
        {
          key: 'Healing',
          offerCount: 1,
          options: [
            'ArmorBoostStore',
            'DamageSelfDrop',
            'HealDropRange',
            'EmptyMaxHealthShopItem',
            'FirstHitHealTrait',
            'TemporaryDoorHealTrait',
            'TemporaryHealExpirationTrait',
            'LastStandShopItem',
          ],
        },
        {
          key: 'Other',
          offerCount: 2,
          options: [
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
          ],
        },
      ],
      SurfaceShop: [
        {
          key: 'First',
          offerCount: 1,
          options: [
            'HealBigDrop',
            'RoomRewardHealDrop',
            'ArmorBigBoost',
            'ArmorBoost',
            'LastStandDrop',
            'GiftDrop',
          ],
        },
        {
          key: 'Second',
          offerCount: 2,
          options: [
            'SpellDrop',
            'ShopHermesUpgrade',
            'MaxHealthDrop',
            'MaxManaDrop',
            'BlindBoxLoot',
            'TalentDrop',
          ],
        },
      ],
      WorldShop: [
        {
          key: 'Boon',
          offerCount: 1,
          options: ['RandomLoot', 'BlindBoxLoot', 'ShopHermesUpgrade'],
        },
        {
          key: 'MajorNonBoon',
          offerCount: 1,
          options: [
            'WeaponUpgradeDropEarly',
            'WeaponUpgradeDropLate',
            'RoomRewardHealDrop',
            'MaxHealthDrop',
            'ArmorBoost',
            'MetaCardPointsCommonDrop',
            'MetaCurrencyDrop',
            'GiftDrop',
          ],
        },
        {
          key: 'Minor',
          offerCount: 1,
          options: [
            'MaxManaDrop',
            'StackUpgrade',
            'StoreRewardRandomStack',
            'SpellDrop',
            'TalentDrop',
          ],
        },
      ],
      I_WorldShop: [
        {
          key: 'BoostedBoon',
          offerCount: 1,
          options: ['RandomLoot', 'BoostedRandomLoot', 'StackUpgradeBig'],
        },
        {
          key: 'MixedProgress',
          offerCount: 1,
          options: [
            'RandomLoot',
            'BlindBoxLoot',
            'MaxHealthDrop',
            'MaxManaDrop',
            'StackUpgrade',
            'TalentDrop',
            'SpellDrop',
          ],
        },
        {
          key: 'Survival',
          offerCount: 1,
          options: [
            'RoomRewardHealDrop',
            'ArmorBoost',
            'HealBigDrop',
            'ArmorBigBoost',
            'LastStandDrop',
          ],
        },
        {
          key: 'PremiumProgress',
          offerCount: 1,
          options: [
            'WeaponUpgradeDrop',
            'RandomLoot',
            'BlindBoxLoot',
            'ShopHermesUpgrade',
            'ChaosWeaponUpgrade',
            'BoostedRandomLoot',
            'MaxHealthDropBig',
            'MaxManaDropBig',
          ],
        },
        {
          key: 'MetaProgress',
          offerCount: 1,
          options: ['WeaponPointsRareDrop', 'CardUpgradePointsDrop', 'CharonPointsDrop'],
        },
      ],
      Q_WorldShop: [
        {
          key: 'MixedProgress',
          offerCount: 2,
          options: [
            'RandomLoot',
            'BlindBoxLoot',
            'StackUpgrade',
            'BoostedRandomLoot',
            'StackUpgradeBig',
            'MaxHealthDrop',
            'MaxManaDrop',
            'TalentDrop',
            'SpellDrop',
          ],
        },
        {
          key: 'LargeSurvival',
          offerCount: 1,
          options: ['RandomLoot', 'HealBigDrop', 'ArmorBigBoost'],
        },
        {
          key: 'Survival',
          offerCount: 1,
          options: [
            'RoomRewardHealDrop',
            'ArmorBoost',
            'HealBigDrop',
            'ArmorBigBoost',
            'LastStandDrop',
          ],
        },
        {
          key: 'PremiumProgress',
          offerCount: 1,
          options: [
            'WeaponUpgradeDrop',
            'RandomLoot',
            'ShopHermesUpgrade',
            'ChaosWeaponUpgrade',
            'BoostedRandomLoot',
            'MaxHealthDropBig',
            'MaxManaDropBig',
          ],
        },
        {
          key: 'MetaProgress',
          offerCount: 1,
          options: ['WeaponPointsRareDrop', 'CardUpgradePointsDrop', 'CharonPointsDrop'],
        },
      ],
    });
  });

  it('attests I/Q World Shop phase guards and preserves their existing option requirements', () => {
    const phase = (profileKey: 'I_WorldShop' | 'Q_WorldShop', groupKey: string, key: string) => {
      const entry =
        rewardKernelCatalog.shops.byKey[profileKey]?.groups.byKey[groupKey]?.options.byKey[key];
      if (entry === undefined) throw new Error(`missing ${profileKey}/${groupKey}/${key}`);
      return entry.requirement;
    };
    const firstHalf = { kind: 'counterRange', axis: 'enteredBiomes', range: { max: 2 } };
    const secondHalf = { kind: 'counterRange', axis: 'enteredBiomes', range: { min: 3 } };
    const hasPhase = (
      requirement: unknown,
      expected: { readonly kind: string; readonly axis: string; readonly range: object },
    ): boolean =>
      JSON.stringify(requirement) === JSON.stringify(expected) ||
      (typeof requirement === 'object' &&
        requirement !== null &&
        (requirement as { kind?: string; requirements?: readonly unknown[] }).kind === 'all' &&
        (requirement as { requirements?: readonly unknown[] }).requirements?.some((child) =>
          hasPhase(child, expected),
        ) === true);
    const exactPhaseEntries = {
      I_WorldShop: {
        first: {
          BoostedBoon: ['RandomLoot'],
          Survival: ['RoomRewardHealDrop', 'ArmorBoost'],
          PremiumProgress: ['WeaponUpgradeDrop', 'RandomLoot', 'BlindBoxLoot'],
        },
        second: {
          BoostedBoon: ['BoostedRandomLoot', 'StackUpgradeBig'],
          Survival: ['HealBigDrop', 'ArmorBigBoost'],
          PremiumProgress: [
            'ShopHermesUpgrade',
            'ChaosWeaponUpgrade',
            'BoostedRandomLoot',
            'MaxHealthDropBig',
            'MaxManaDropBig',
          ],
        },
      },
      Q_WorldShop: {
        first: {
          MixedProgress: ['StackUpgrade'],
          LargeSurvival: ['RandomLoot'],
          Survival: ['RoomRewardHealDrop', 'ArmorBoost'],
          PremiumProgress: ['WeaponUpgradeDrop', 'RandomLoot'],
        },
        second: {
          MixedProgress: ['BoostedRandomLoot', 'StackUpgradeBig'],
          LargeSurvival: ['HealBigDrop', 'ArmorBigBoost'],
          Survival: ['HealBigDrop', 'ArmorBigBoost'],
          PremiumProgress: [
            'ShopHermesUpgrade',
            'ChaosWeaponUpgrade',
            'BoostedRandomLoot',
            'MaxHealthDropBig',
            'MaxManaDropBig',
          ],
        },
      },
    } as const;
    const guardedKeys = (
      profileKey: 'I_WorldShop' | 'Q_WorldShop',
      expected: { readonly kind: string; readonly axis: string; readonly range: object },
    ) =>
      rewardKernelCatalog.shops.byKey[profileKey]!.groups.values.flatMap((group) =>
        group.options.values
          .filter((entry) => hasPhase(entry.requirement, expected))
          .map((entry) => `${group.key}/${entry.key}`),
      );
    expect({
      I_WorldShop: {
        first: guardedKeys('I_WorldShop', firstHalf),
        second: guardedKeys('I_WorldShop', secondHalf),
      },
      Q_WorldShop: {
        first: guardedKeys('Q_WorldShop', firstHalf),
        second: guardedKeys('Q_WorldShop', secondHalf),
      },
    }).toEqual({
      I_WorldShop: {
        first: [
          'BoostedBoon/RandomLoot',
          'Survival/RoomRewardHealDrop',
          'Survival/ArmorBoost',
          'PremiumProgress/WeaponUpgradeDrop',
          'PremiumProgress/RandomLoot',
          'PremiumProgress/BlindBoxLoot',
        ],
        second: [
          'BoostedBoon/BoostedRandomLoot',
          'BoostedBoon/StackUpgradeBig',
          'Survival/HealBigDrop',
          'Survival/ArmorBigBoost',
          'PremiumProgress/ShopHermesUpgrade',
          'PremiumProgress/ChaosWeaponUpgrade',
          'PremiumProgress/BoostedRandomLoot',
          'PremiumProgress/MaxHealthDropBig',
          'PremiumProgress/MaxManaDropBig',
        ],
      },
      Q_WorldShop: {
        first: [
          'MixedProgress/StackUpgrade',
          'LargeSurvival/RandomLoot',
          'Survival/RoomRewardHealDrop',
          'Survival/ArmorBoost',
          'PremiumProgress/WeaponUpgradeDrop',
          'PremiumProgress/RandomLoot',
        ],
        second: [
          'MixedProgress/BoostedRandomLoot',
          'MixedProgress/StackUpgradeBig',
          'LargeSurvival/HealBigDrop',
          'LargeSurvival/ArmorBigBoost',
          'Survival/HealBigDrop',
          'Survival/ArmorBigBoost',
          'PremiumProgress/ShopHermesUpgrade',
          'PremiumProgress/ChaosWeaponUpgrade',
          'PremiumProgress/BoostedRandomLoot',
          'PremiumProgress/MaxHealthDropBig',
          'PremiumProgress/MaxManaDropBig',
        ],
      },
    });
    for (const [profileKey, phases] of Object.entries(exactPhaseEntries) as readonly [
      'I_WorldShop' | 'Q_WorldShop',
      (typeof exactPhaseEntries)['I_WorldShop'] | (typeof exactPhaseEntries)['Q_WorldShop'],
    ][]) {
      for (const [groupKey, keys] of Object.entries(phases.first)) {
        for (const key of keys) {
          expect(hasPhase(phase(profileKey, groupKey, key), firstHalf)).toBe(true);
        }
      }
      for (const [groupKey, keys] of Object.entries(phases.second)) {
        for (const key of keys) {
          expect(hasPhase(phase(profileKey, groupKey, key), secondHalf)).toBe(true);
        }
      }
    }
    expect(phase('I_WorldShop', 'BoostedBoon', 'StackUpgradeBig')).toEqual({
      kind: 'all',
      requirements: [
        secondHalf,
        { kind: 'counterRange', axis: 'upgradableTraitCount', range: { min: 1 } },
      ],
    });
    expect(phase('Q_WorldShop', 'PremiumProgress', 'WeaponUpgradeDrop')).toEqual({
      kind: 'all',
      requirements: [
        firstHalf,
        {
          kind: 'all',
          requirements: [
            { kind: 'notInCurrentRoomShopOptions', rewardType: 'WeaponUpgradeDrop' },
            {
              kind: 'recordCount',
              record: 'lootTypeHistory',
              keys: ['WeaponUpgrade'],
              range: { max: 0 },
            },
          ],
        },
      ],
    });
  });

  it('attaches boosted rarity only to the exact second-half I/Q World Shop items', () => {
    const boosted = { Rare: 0.9, Epic: 0.25, Legendary: 0.1 };
    for (const profileKey of ['I_WorldShop', 'Q_WorldShop'] as const) {
      const groups = rewardKernelCatalog.shops.byKey[profileKey]?.groups.values ?? [];
      const options = groups.flatMap((group) => group.options.values);
      expect(
        options
          .filter((option) => option.key === 'RandomLoot')
          .some((option) => option.boonRarityOverride === undefined),
      ).toBe(true);
      expect(
        options
          .filter((option) => option.key === 'BoostedRandomLoot')
          .map((option) => option.boonRarityOverride),
      ).toEqual(expect.arrayContaining([boosted]));
      expect(
        options
          .filter((option) => option.key === 'ShopHermesUpgrade')
          .map((option) => option.boonRarityOverride),
      ).toEqual(expect.arrayContaining([boosted]));
    }
    expect(
      rewardKernelCatalog.shops.byKey.WorldShop?.groups.byKey.Boon?.options.byKey.RandomLoot
        ?.boonRarityOverride,
    ).toBeUndefined();
    expect(
      rewardKernelCatalog.shops.byKey.WorldShop?.groups.byKey.Boon?.options.byKey.ShopHermesUpgrade
        ?.boonRarityOverride,
    ).toBeUndefined();
  });

  it('rejects malformed Stygian Well metadata and cross-option references', () => {
    const malformed: readonly RawRewardKernelInput[] = [
      replaceShopOption('WorldShop', 'RandomLoot', (option) => ({
        ...option,
        stygianWell: { effect: 'neutral' },
      })),
      replaceShopOption('RoomShop', 'ArmorBoostStore', (option) => {
        const withoutMetadata = { ...option };
        delete withoutMetadata.stygianWell;
        return withoutMetadata;
      }),
      replaceShopOption('RoomShop', 'ArmorBoostStore', (option) => ({
        ...option,
        stygianWell: { effect: 'unknownEffect' },
      })),
      replaceShopOption('RoomShop', 'TemporaryDiscountTrait', (option) => ({
        ...option,
        stygianWell: { effect: 'discount', offerRequirements: ['unknownRequirement'] },
      })),
      replaceShopOption('RoomShop', 'RandomStoreItem', (option) => ({
        ...option,
        stygianWell: { effect: 'twist' },
      })),
      replaceShopOption('RoomShop', 'RandomStoreItem', (option) => ({
        ...option,
        stygianWell: { effect: 'twist', nestedResultItemKeys: ['HealDropRange'] },
      })),
      replaceShopOption('RoomShop', 'ExtendedShopTrait', (option) => ({
        ...option,
        stygianWell: { effect: 'extended' },
      })),
      replaceShopOption('RoomShop', 'RandomStoreItem', (option) => ({
        ...option,
        stygianWell: {
          effect: 'twist',
          nestedResultItemKeys: ['UnknownWellItem'],
          nestedRuntimeOfferFallbacks: [
            { preferredItemKey: 'UnknownWellItem', fallbackItemKey: 'UnknownWellItem' },
          ],
        },
      })),
      replaceShopOption('RoomShop', 'ExtendedShopTrait', (option) => ({
        ...option,
        stygianWell: {
          effect: 'extended',
          extendedDirectPurchaseItemKeys: ['UnknownWellItem'],
        },
      })),
      replaceShopOption('RoomShop', 'RandomStoreItem', (option) => ({
        ...option,
        stygianWell: {
          effect: 'twist',
          nestedResultItemKeys: ['HealDropRange'],
          nestedRuntimeOfferFallbacks: [
            { preferredItemKey: 'HealDropRange', fallbackItemKey: 'ArmorBoostStore' },
          ],
        },
      })),
      replaceShopOption('RoomShop', 'RandomStoreItem', (option) => ({
        ...option,
        stygianWell: {
          effect: 'twist',
          nestedResultItemKeys: ['LastStandShopItem', 'EmptyMaxHealthShopItem'],
          nestedRuntimeOfferFallbacks: [
            {
              preferredItemKey: 'LastStandShopItem',
              fallbackItemKey: 'EmptyMaxHealthShopItem',
            },
            {
              preferredItemKey: 'LastStandShopItem',
              fallbackItemKey: 'EmptyMaxHealthShopItem',
            },
          ],
        },
      })),
      replaceShopOption('RoomShop', 'ArmorBoostStore', (option) => ({
        ...option,
        stygianWell: { effect: 'neutral', nestedResultItemKeys: ['HealDropRange'] },
      })),
      replaceShopOption('RoomShop', 'ArmorBoostStore', (option) => ({
        ...option,
        stygianWell: {
          effect: 'neutral',
          extendedDirectPurchaseItemKeys: ['HealDropRange'],
        },
      })),
    ];
    for (const input of malformed)
      expect(() => createRewardKernelCatalog(input)).toThrow(CatalogContractError);
  });
});

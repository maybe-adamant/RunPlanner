import { CatalogContractError } from '@run-planner/hades2-catalog';
import {
  createRewardKernelCatalog,
  ordinarySources,
  rewardKernelDeclarations,
  type RawRewardKernelInput,
} from '@run-planner/hades2-catalog/test-support';
import { describe, expect, it } from 'vitest';

const rewardKernelCatalog = createRewardKernelCatalog(rewardKernelDeclarations);

function rawInput(value: unknown): RawRewardKernelInput {
  return value as RawRewardKernelInput;
}

function replaceRewardType(
  gameName: string,
  replace: (rewardType: (typeof rewardKernelDeclarations.rewardTypes)[number]) => unknown,
): RawRewardKernelInput {
  return rawInput({
    ...rewardKernelDeclarations,
    rewardTypes: rewardKernelDeclarations.rewardTypes.map((rewardType) =>
      rewardType.gameName === gameName ? replace(rewardType) : rewardType,
    ),
  });
}

describe('reward-kernel declaration parity', () => {
  it('declares the exact concrete Artificer source family', () => {
    expect(
      rewardKernelCatalog.acquisitions.values
        .filter((acquisition) => acquisition.artificerConversionEligible)
        .map((acquisition) => acquisition.gameName)
        .sort(),
    ).toEqual(
      [
        'GiftDrop',
        'MemPointsCommonDrop',
        'MetaCardPointsCommonBigDrop',
        'MetaCardPointsCommonDrop',
        'MetaCurrencyBigDrop',
        'MetaCurrencyDrop',
      ].sort(),
    );
    expect(rewardKernelCatalog.acquisitions.byKey.MemPointsBigDrop).toBeUndefined();
  });

  it('normalizes the complete counted-store inventory and exact progressed MetaProgress bag', () => {
    expect(
      Object.fromEntries(
        rewardKernelCatalog.stores.values.map((store) => [store.key, store.entries.length]),
      ),
    ).toEqual({
      RunProgress: 18,
      MetaProgress: 13,
      HubRewards: 10,
      SubRoomRewards: 23,
      SubRoomRewardsHard: 8,
      FieldsOptionalRewards: 19,
      TartarusRewards: 9,
      TyphonBossRewards: 6,
    });

    expect(
      rewardKernelCatalog.stores.byKey.MetaProgress?.entries.map((entry) => entry.rewardType),
    ).toEqual([
      'GiftDrop',
      'MetaCurrencyDrop',
      'MetaCurrencyDrop',
      'MetaCardPointsCommonDrop',
      'MetaCardPointsCommonDrop',
      'MetaCardPointsCommonDrop',
      'MetaCardPointsCommonDrop',
      'MetaCurrencyBigDrop',
      'MetaCurrencyBigDrop',
      'MetaCardPointsCommonBigDrop',
      'MetaCardPointsCommonBigDrop',
      'MetaCardPointsCommonBigDrop',
      'MetaCardPointsCommonBigDrop',
    ]);
    expect(
      rewardKernelCatalog.stores.byKey.RunProgress?.entries.filter(
        (entry) => entry.allowDuplicates,
      ),
    ).toHaveLength(4);
    expect(
      Object.fromEntries(
        rewardKernelCatalog.stores.values.map((store) => [
          store.key,
          store.entries.filter((entry) => entry.allowDuplicates).map((entry) => entry.index),
        ]),
      ),
    ).toEqual({
      RunProgress: [14, 15, 16, 17],
      MetaProgress: [],
      HubRewards: [5, 6, 7, 8, 9],
      SubRoomRewards: [],
      SubRoomRewardsHard: [],
      FieldsOptionalRewards: [],
      TartarusRewards: [6, 7, 8],
      TyphonBossRewards: [0, 1],
    });
    expect(rewardKernelCatalog.stores.byKey.RunProgress?.entries[0]?.rewardType).toBe(
      'MaxHealthDrop',
    );

    const expectedEntries = {
      RunProgress: [
        'MaxHealthDrop',
        'MaxHealthDrop',
        'MaxManaDrop',
        'MaxManaDrop',
        'RoomMoneyDrop',
        'RoomMoneyDrop',
        'StackUpgrade',
        'StackUpgrade',
        'WeaponUpgrade',
        'WeaponUpgrade',
        'HermesUpgrade',
        'Devotion',
        'SpellDrop',
        'TalentDrop',
        'Boon',
        'Boon',
        'Boon',
        'Boon',
      ],
      HubRewards: [
        'MaxHealthDropBig',
        'MaxManaDropBig',
        'WeaponUpgrade',
        'HermesUpgrade',
        'SpellDrop',
        'Boon',
        'Boon',
        'Boon',
        'Boon',
        'Boon',
      ],
      SubRoomRewards: [
        'MaxManaDropSmall',
        'MaxHealthDropSmall',
        'EmptyMaxHealthSmallDrop',
        'RoomMoneyTinyDrop',
        'AirBoost',
        'EarthBoost',
        'FireBoost',
        'WaterBoost',
        'GiftDrop',
        'MetaCurrencyDrop',
        'MetaCurrencyDrop',
        'MetaCardPointsCommonDrop',
        'MetaCardPointsCommonDrop',
        'MaxHealthDrop',
        'MaxHealthDrop',
        'MaxManaDrop',
        'MaxManaDrop',
        'StackUpgrade',
        'StackUpgrade',
        'RoomMoneyDrop',
        'RoomMoneyDrop',
        'MinorTalentDrop',
        'MinorTalentDrop',
      ],
      SubRoomRewardsHard: [
        'MaxHealthDrop',
        'MaxHealthDrop',
        'MaxManaDrop',
        'MaxManaDrop',
        'StackUpgrade',
        'StackUpgrade',
        'RoomMoneyDrop',
        'RoomMoneyDrop',
      ],
      FieldsOptionalRewards: [
        'MaxManaDropSmall',
        'MaxManaDropSmall',
        'MaxManaDropSmall',
        'MaxHealthDropSmall',
        'MaxHealthDropSmall',
        'MaxHealthDropSmall',
        'RoomMoneyTinyDrop',
        'RoomMoneyTinyDrop',
        'RoomMoneyTinyDrop',
        'RoomRewardHealDrop',
        'ArmorBoost',
        'GiftDrop',
        'MetaCurrencyDrop',
        'MetaCardPointsCommonDrop',
        'MetaCardPointsCommonDrop',
        'MetaCardPointsCommonDrop',
        'MetaCardPointsCommonDrop',
        'MinorTalentDrop',
        'MinorTalentDrop',
      ],
      TartarusRewards: [
        'RoomMoneyTripleDrop',
        'StackUpgradeTriple',
        'WeaponUpgrade',
        'WeaponUpgrade',
        'Devotion',
        'TalentBigDrop',
        'Boon',
        'Boon',
        'Boon',
      ],
      TyphonBossRewards: [
        'Boon',
        'Boon',
        'TalentBigDrop',
        'StackUpgradeTriple',
        'WeaponUpgrade',
        'WeaponUpgrade',
      ],
    } as const;
    for (const [storeKey, entries] of Object.entries(expectedEntries)) {
      expect(
        rewardKernelCatalog.stores.byKey[storeKey]?.entries.map((entry) => entry.rewardType),
      ).toEqual(entries);
    }
  });

  it('normalizes World, I, and Q shops as ordered groups with 3, 5, and 6 slots', () => {
    expect(rewardKernelCatalog.shops.byKey.WorldShop?.slotCount).toBe(3);
    expect(rewardKernelCatalog.shops.byKey.I_WorldShop?.slotCount).toBe(5);
    expect(rewardKernelCatalog.shops.byKey.Q_WorldShop?.slotCount).toBe(6);
    expect(rewardKernelCatalog.shops.byKey.Q_WorldShop?.groups.values[0]?.offerCount).toBe(2);
    for (const profileKey of ['I_WorldShop', 'Q_WorldShop'] as const) {
      const option = rewardKernelCatalog.shops.byKey[profileKey]?.groups.values
        .flatMap((group) => group.options.values)
        .find((entry) => entry.key === 'LastStandDrop');
      expect(option?.requirement).toEqual({
        kind: 'authoredCondition',
        condition: 'deathDefianceConditionMet',
        value: true,
      });
      expect(option?.purchaseRequirement).toEqual(option?.requirement);
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

  it('keeps every reward type label, default, and acquisition role exact', () => {
    const expectedLabels = {
      AphroditeUpgrade: 'Aphrodite',
      ApolloUpgrade: 'Apollo',
      AresUpgrade: 'Ares',
      DemeterUpgrade: 'Demeter',
      HephaestusUpgrade: 'Hephaestus',
      HeraUpgrade: 'Hera',
      HestiaUpgrade: 'Hestia',
      PoseidonUpgrade: 'Poseidon',
      ZeusUpgrade: 'Zeus',
      HermesUpgrade: 'Hermes',
      StackUpgrade: 'Pom of Power',
      StackUpgradeBig: 'Big Pom of Power',
      StackUpgradeTriple: 'Triple Pom of Power',
      WeaponUpgrade: 'Hammer',
      SpellDrop: "Selene's Gift",
      MaxHealthDrop: 'Max Health',
      MaxHealthDropBig: 'Big Max Health',
      MaxHealthDropSmall: 'Small Max Health',
      EmptyMaxHealthSmallDrop: 'Empty Small Max Health',
      MaxManaDrop: 'Max Magick',
      MaxManaDropBig: 'Big Max Magick',
      MaxManaDropSmall: 'Small Max Magick',
      Currency: 'Gold',
      RoomMoneyDrop: 'Gold',
      RoomMoneySmallDrop: 'Small Gold',
      RoomMoneyTripleDrop: 'Triple Gold',
      RoomMoneyTinyDrop: 'Tiny Gold',
      TalentDrop: 'Path of Stars',
      TalentBigDrop: 'Big Path of Stars',
      MinorTalentDrop: 'Minor Path of Stars',
      RoomRewardHealDrop: 'Heal',
      HealDropMinor: 'Minor Heal',
      HealBigDrop: 'Big Heal',
      ArmorBoost: 'Armor',
      ArmorBigBoost: 'Big Armor',
      AirBoost: 'Air Essence',
      EarthBoost: 'Earth Essence',
      FireBoost: 'Fire Essence',
      WaterBoost: 'Water Essence',
      ElementalBoost: 'Elemental Essence',
      StoreRewardRandomStack: 'Pom Slice',
      LastStandDrop: 'Death Defiance',
      ChaosWeaponUpgrade: 'Chaos Hammer',
      InfernalContractBoon: 'Infernal Contract',
      TrialUpgrade: 'Chaos Blessing',
      GiftDrop: 'Nectar',
      MetaCurrencyDrop: 'Bones',
      MetaCurrencyBigDrop: 'Big Bones',
      MetaCardPointsCommonDrop: 'Ashes',
      MetaCardPointsCommonBigDrop: 'Big Ashes',
      MemPointsCommonDrop: 'Psyche',
      WeaponPointsRareDrop: 'Nightmare',
      CardUpgradePointsDrop: 'Moon Dust',
      CharonPointsDrop: 'Obol Points',
      Boon: 'Boon',
      Devotion: 'Trial',
      RandomLoot: 'Boon',
      BlindBoxLoot: 'Mystery Boon',
      WeaponUpgradeDrop: 'Hammer',
      ShopHermesUpgrade: 'Hermes Boon',
      Story: 'Story',
      Shop: 'Shop',
      ClockworkGoal: 'Clockwork Goal',
    } as const;
    expect(
      Object.fromEntries(
        rewardKernelCatalog.rewardTypes.values.map((rewardType) => [
          rewardType.gameName,
          rewardType.label,
        ]),
      ),
    ).toEqual(expectedLabels);
    expect(rewardKernelCatalog.rewardTypes.values.map((rewardType) => rewardType.gameName)).toEqual(
      Object.keys(expectedLabels),
    );

    const sourceBearing = rewardKernelCatalog.rewardTypes.values
      .filter((rewardType) => rewardType.payloadDomain !== undefined)
      .map((rewardType) => ({
        gameName: rewardType.gameName,
        payloadDomain: rewardType.payloadDomain,
        sourceSupport: rewardType.sourceSupport,
        sourceResolution: rewardType.sourceResolution,
        offerProjection: rewardType.offerProjection,
        acquisitionRoles: rewardType.acquisitionRoles.values,
      }));
    expect(sourceBearing).toEqual([
      {
        gameName: 'Boon',
        payloadDomain: 'BoonSource',
        sourceSupport: 'ordinaryBoonPeer',
        sourceResolution: { kind: 'offer' },
        offerProjection: 'none',
        acquisitionRoles: [
          {
            key: 'source',
            resolution: { kind: 'payloadSource', acquisitionKind: 'loot', field: 'source' },
          },
        ],
      },
      {
        gameName: 'Devotion',
        payloadDomain: 'DevotionPair',
        sourceSupport: 'devotionAcquiredPair',
        sourceResolution: { kind: 'offer' },
        offerProjection: 'devotionSpacing',
        acquisitionRoles: [
          {
            key: 'chosenSource',
            resolution: {
              kind: 'payloadSource',
              acquisitionKind: 'loot',
              field: 'chosenSource',
            },
          },
          {
            key: 'spurnedSource',
            resolution: {
              kind: 'payloadSource',
              acquisitionKind: 'loot',
              field: 'spurnedSource',
            },
          },
        ],
      },
      {
        gameName: 'RandomLoot',
        payloadDomain: 'BoonSource',
        sourceSupport: 'ordinaryNoPeer',
        sourceResolution: { kind: 'offer' },
        offerProjection: 'none',
        acquisitionRoles: [
          {
            key: 'source',
            resolution: { kind: 'payloadSource', acquisitionKind: 'loot', field: 'source' },
          },
        ],
      },
      {
        gameName: 'BlindBoxLoot',
        payloadDomain: 'BoonSource',
        sourceSupport: 'ordinaryNoPeer',
        sourceResolution: { kind: 'acquisitionRole', role: 'hiddenSource' },
        offerProjection: 'none',
        acquisitionRoles: [
          {
            key: 'box',
            resolution: { kind: 'self', acquisitionKind: 'consumable' },
          },
          {
            key: 'hiddenSource',
            resolution: { kind: 'payloadSource', acquisitionKind: 'loot', field: 'source' },
            blocksGoldConversion: true,
          },
        ],
      },
    ]);
    for (const acquisition of rewardKernelCatalog.acquisitions.values) {
      if (acquisition.gameName === 'BlindBoxLoot') {
        continue;
      }
      expect(
        rewardKernelCatalog.rewardTypes.byKey[acquisition.gameName]?.acquisitionRoles.values,
        acquisition.gameName,
      ).toEqual([
        {
          key: 'self',
          resolution: { kind: 'self', acquisitionKind: acquisition.kind },
          ...(acquisition.gameName === 'TrialUpgrade' ? { traitGiverKey: 'Chaos' } : {}),
        },
      ]);
    }
    expect(
      rewardKernelCatalog.rewardTypes.byKey.WeaponUpgradeDrop?.acquisitionRoles.values,
    ).toEqual([
      {
        key: 'weaponUpgrade',
        resolution: {
          kind: 'fixed',
          acquisition: { kind: 'loot', gameName: 'WeaponUpgrade' },
        },
      },
    ]);
    expect(
      rewardKernelCatalog.rewardTypes.byKey.ShopHermesUpgrade?.acquisitionRoles.values,
    ).toEqual([
      {
        key: 'hermes',
        resolution: {
          kind: 'fixed',
          acquisition: { kind: 'loot', gameName: 'HermesUpgrade' },
        },
      },
    ]);
    expect(
      ['Story', 'Shop', 'ClockworkGoal'].map(
        (gameName) => rewardKernelCatalog.rewardTypes.byKey[gameName]?.acquisitionRoles.values,
      ),
    ).toEqual([[], [], []]);
  });

  it('keeps the exhaustive acquisition identity and projection registry exact', () => {
    const lootAndUse = rewardKernelCatalog.acquisitions.values
      .filter((entry) => entry.historyProjection === 'lootAndUse')
      .map((entry) => entry.gameName);
    expect(lootAndUse).toEqual([
      ...ordinarySources,
      'HermesUpgrade',
      'StackUpgrade',
      'StackUpgradeBig',
      'StackUpgradeTriple',
      'WeaponUpgrade',
      'InfernalContractBoon',
      'TrialUpgrade',
    ]);
    expect(
      rewardKernelCatalog.acquisitions.values
        .filter((entry) => entry.kind === 'loot' && entry.historyProjection === 'consumableAndUse')
        .map((entry) => entry.gameName),
    ).toEqual(['SpellDrop']);
    expect(
      rewardKernelCatalog.acquisitions.values
        .filter((entry) => entry.kind === 'consumable')
        .map((entry) => entry.gameName),
    ).toEqual([
      'MaxHealthDrop',
      'MaxHealthDropBig',
      'MaxHealthDropSmall',
      'EmptyMaxHealthSmallDrop',
      'MaxManaDrop',
      'MaxManaDropBig',
      'MaxManaDropSmall',
      'Currency',
      'RoomMoneyDrop',
      'RoomMoneySmallDrop',
      'RoomMoneyTripleDrop',
      'RoomMoneyTinyDrop',
      'HealDropMinor',
      'TalentDrop',
      'TalentBigDrop',
      'MinorTalentDrop',
      'RoomRewardHealDrop',
      'HealBigDrop',
      'ArmorBoost',
      'ArmorBigBoost',
      'AirBoost',
      'EarthBoost',
      'FireBoost',
      'WaterBoost',
      'ElementalBoost',
      'StoreRewardRandomStack',
      'LastStandDrop',
      'ChaosWeaponUpgrade',
      'BlindBoxLoot',
    ]);
    expect(
      rewardKernelCatalog.acquisitions.values
        .filter((entry) => entry.kind === 'resource')
        .map((entry) => entry.gameName),
    ).toEqual([
      'GiftDrop',
      'MetaCurrencyDrop',
      'MetaCurrencyBigDrop',
      'MetaCardPointsCommonDrop',
      'MetaCardPointsCommonBigDrop',
      'MemPointsCommonDrop',
      'WeaponPointsRareDrop',
      'CardUpgradePointsDrop',
      'CharonPointsDrop',
    ]);
    expect(rewardKernelCatalog.acquisitions.values).toHaveLength(55);
  });

  it('declares the exact Echo last-reward replay matrix and recreation lifecycle', () => {
    const expected = [
      'AphroditeUpgrade',
      'ApolloUpgrade',
      'AresUpgrade',
      'DemeterUpgrade',
      'HephaestusUpgrade',
      'HeraUpgrade',
      'HestiaUpgrade',
      'PoseidonUpgrade',
      'ZeusUpgrade',
      'HermesUpgrade',
      'StackUpgrade',
      'StackUpgradeBig',
      'StackUpgradeTriple',
      'WeaponUpgrade',
      'MaxHealthDrop',
      'MaxHealthDropBig',
      'MaxManaDrop',
      'MaxManaDropBig',
      'RoomMoneyDrop',
      'RoomMoneySmallDrop',
      'RoomMoneyTripleDrop',
      'TalentDrop',
      'TalentBigDrop',
      'TrialUpgrade',
      'GiftDrop',
      'MetaCurrencyDrop',
      'MetaCurrencyBigDrop',
      'MetaCardPointsCommonDrop',
      'MetaCardPointsCommonBigDrop',
      'MemPointsCommonDrop',
    ].sort();
    expect(
      rewardKernelCatalog.acquisitions.values
        .filter((acquisition) => acquisition.lastRewardRecreation !== undefined)
        .map((acquisition) => acquisition.gameName)
        .sort(),
    ).toEqual(expected);
    expect(
      expected.map(
        (gameName) => rewardKernelCatalog.acquisitions.byKey[gameName]?.lastRewardRecreation,
      ),
    ).toEqual(
      expected.map((rewardType) => ({
        offer: { rewardType },
        producerLifecycleKey: 'EchoLastReward',
      })),
    );
    expect(
      rewardKernelCatalog.producerLifecycles.byKey.EchoLastReward?.rewardTypes.values
        .map((entry) => [entry.rewardType, entry.acquisitionLifecycle] as const)
        .sort(([left], [right]) => left.localeCompare(right)),
    ).toEqual(
      expected.map((rewardType) => [
        rewardType,
        [
          {
            role: 'self',
            lifecyclePoint: 'echoReplay',
            blocksArtificerConversion: true,
            ...(rewardType === 'GiftDrop'
              ? { levelResolutionEffect: { kind: 'randomTargetIfAvailable', levelCount: 1 } }
              : {}),
          },
        ],
      ]),
    );
  });

  it('rejects drift in Echo last-reward eligibility and exact-source recreation', () => {
    expect(() =>
      createRewardKernelCatalog(
        rawInput({
          ...rewardKernelDeclarations,
          acquisitions: rewardKernelDeclarations.acquisitions.map((acquisition) =>
            acquisition.gameName === 'GiftDrop'
              ? { ...acquisition, lastRewardRecreation: undefined }
              : acquisition,
          ),
        }),
      ),
    ).toThrow('must declare the exact Echo last-reward eligibility set');
    expect(() =>
      createRewardKernelCatalog(
        rawInput({
          ...rewardKernelDeclarations,
          acquisitions: rewardKernelDeclarations.acquisitions.map((acquisition) =>
            acquisition.gameName === 'GiftDrop'
              ? {
                  ...acquisition,
                  lastRewardRecreation: {
                    rewardType: 'MetaCurrencyDrop',
                    producerLifecycleKey: 'EchoLastReward',
                  },
                }
              : acquisition.gameName === 'MetaCurrencyDrop'
                ? {
                    ...acquisition,
                    lastRewardRecreation: {
                      rewardType: 'GiftDrop',
                      producerLifecycleKey: 'EchoLastReward',
                    },
                  }
                : acquisition,
          ),
        }),
      ),
    ).toThrow('must recreate the exact self acquisition source');
    expect(() =>
      createRewardKernelCatalog(
        rawInput({
          ...rewardKernelDeclarations,
          acquisitions: rewardKernelDeclarations.acquisitions.map((acquisition) =>
            acquisition.gameName === 'MemPointsCommonDrop'
              ? { ...acquisition, lastRewardRecreation: undefined }
              : acquisition,
          ),
        }),
      ),
    ).toThrow('must declare the exact Echo last-reward eligibility set');
  });

  it('rejects drift in Echo replay timing and its sole Nectar level effect', () => {
    type EchoLastRewardProfile = Extract<
      (typeof rewardKernelDeclarations.producerLifecycles)[number],
      { readonly key: 'EchoLastReward' }
    >;
    const mutateEcho = (
      mutate: (profile: EchoLastRewardProfile) => unknown,
    ): RawRewardKernelInput =>
      rawInput({
        ...rewardKernelDeclarations,
        producerLifecycles: rewardKernelDeclarations.producerLifecycles.map((profile) =>
          profile.key === 'EchoLastReward' ? mutate(profile as EchoLastRewardProfile) : profile,
        ),
      });

    expect(() =>
      createRewardKernelCatalog(
        mutateEcho((profile) => ({
          ...profile,
          overrides: profile.overrides?.map((override) =>
            override.rewardType === 'AphroditeUpgrade'
              ? {
                  ...override,
                  acquisitionLifecycle: [
                    {
                      role: 'self',
                      lifecyclePoint: 'roomRewardPickup',
                      blocksArtificerConversion: true,
                    },
                  ],
                }
              : override,
          ),
        })),
      ),
    ).toThrow('must bind exactly self at echoReplay and block Artificer conversion');

    expect(() =>
      createRewardKernelCatalog(
        mutateEcho((profile) => ({
          ...profile,
          overrides: profile.overrides?.map((override) =>
            override.rewardType === 'GiftDrop'
              ? {
                  ...override,
                  acquisitionLifecycle: [
                    {
                      role: 'self',
                      lifecyclePoint: 'echoReplay',
                      blocksArtificerConversion: true,
                    },
                  ],
                }
              : override,
          ),
        })),
      ),
    ).toThrow('must apply randomTargetIfAvailable levelCount 1');

    expect(() =>
      createRewardKernelCatalog(
        mutateEcho((profile) => ({
          ...profile,
          overrides: profile.overrides?.map((override) =>
            override.rewardType === 'MaxHealthDrop'
              ? {
                  ...override,
                  acquisitionLifecycle: [
                    {
                      role: 'self',
                      lifecyclePoint: 'echoReplay',
                      blocksArtificerConversion: true,
                      levelResolutionEffect: {
                        kind: 'randomTargetIfAvailable',
                        levelCount: 1,
                      },
                    },
                  ],
                }
              : override,
          ),
        })),
      ),
    ).toThrow('must not apply a level-resolution effect');
  });

  it('normalizes room-reward acquisition timing without reward-name dispatch', () => {
    const roomReward = rewardKernelCatalog.producerLifecycles.byKey.RoomReward;
    expect(roomReward?.rewardTypes.byKey.Boon?.acquisitionLifecycle).toEqual([
      { role: 'source', lifecyclePoint: 'roomRewardPickup' },
    ]);
    expect(roomReward?.rewardTypes.byKey.Devotion?.acquisitionLifecycle).toEqual([
      { role: 'chosenSource', lifecyclePoint: 'beforeCombat' },
      { role: 'spurnedSource', lifecyclePoint: 'afterCombat' },
    ]);
    expect(roomReward?.rewardTypes.byKey.InfernalContractBoon?.acquisitionLifecycle).toEqual([
      { role: 'self', lifecyclePoint: 'roomRewardPickup' },
    ]);
    expect(roomReward?.rewardTypes.byKey.GiftDrop?.acquisitionLifecycle).toEqual([
      {
        role: 'self',
        lifecyclePoint: 'roomRewardPickup',
        levelResolutionEffect: { kind: 'randomTargetIfAvailable', levelCount: 1 },
      },
    ]);
    expect(rewardKernelCatalog.acquisitions.byKey.GiftDrop?.levelResolutionEffect).toBeUndefined();
    expect(roomReward?.rewardTypes.byKey.Story?.acquisitionLifecycle).toEqual([]);
  });

  it('normalizes the exact Narcissus pickup lifecycle at room exit', () => {
    expect(
      rewardKernelCatalog.producerLifecycles.byKey.NarcissusPickup?.rewardTypes.values.map(
        (reward) => [reward.rewardType, reward.acquisitionLifecycle] as const,
      ),
    ).toEqual(
      [
        'StoreRewardRandomStack',
        'MaxManaDrop',
        'MaxHealthDrop',
        'Currency',
        'LastStandDrop',
        'BlindBoxLoot',
        'ElementalBoost',
        'MetaCardPointsCommonDrop',
        'MemPointsCommonDrop',
        'MetaCurrencyDrop',
      ].map((rewardType) => [
        rewardType,
        rewardType === 'BlindBoxLoot'
          ? [
              { role: 'box', lifecyclePoint: 'roomExit' },
              { role: 'hiddenSource', lifecyclePoint: 'roomExit' },
            ]
          : [{ role: 'self', lifecyclePoint: 'roomExit' }],
      ]),
    );
  });

  it('normalizes the exact generated trait pickup lifecycle and replay/conversion facts', () => {
    const generated = rewardKernelCatalog.producerLifecycles.byKey.GeneratedTraitPickup;
    expect(
      generated?.rewardTypes.values.map((reward) => [
        reward.rewardType,
        reward.acquisitionLifecycle,
      ]),
    ).toEqual([
      ['RoomMoneyDrop', [{ role: 'self', lifecyclePoint: 'roomRewardPickup' }]],
      ['RoomMoneySmallDrop', [{ role: 'self', lifecyclePoint: 'roomRewardPickup' }]],
      ['RoomMoneyTinyDrop', [{ role: 'self', lifecyclePoint: 'roomRewardPickup' }]],
      ['HealDropMinor', [{ role: 'self', lifecyclePoint: 'roomRewardPickup' }]],
      [
        'MetaCurrencyDrop',
        [
          {
            role: 'self',
            lifecyclePoint: 'roomRewardPickup',
            blocksArtificerConversion: true,
          },
        ],
      ],
    ]);
    expect(rewardKernelCatalog.acquisitions.byKey.RoomMoneyDrop?.lastRewardRecreation).toEqual({
      offer: { rewardType: 'RoomMoneyDrop' },
      producerLifecycleKey: 'EchoLastReward',
    });
    expect(rewardKernelCatalog.acquisitions.byKey.RoomMoneySmallDrop?.lastRewardRecreation).toEqual(
      {
        offer: { rewardType: 'RoomMoneySmallDrop' },
        producerLifecycleKey: 'EchoLastReward',
      },
    );
    expect(rewardKernelCatalog.acquisitions.byKey.MetaCurrencyDrop?.lastRewardRecreation).toEqual({
      offer: { rewardType: 'MetaCurrencyDrop' },
      producerLifecycleKey: 'EchoLastReward',
    });
    expect(
      rewardKernelCatalog.acquisitions.byKey.RoomMoneyTinyDrop?.lastRewardRecreation,
    ).toBeUndefined();
    expect(
      rewardKernelCatalog.acquisitions.byKey.HealDropMinor?.lastRewardRecreation,
    ).toBeUndefined();
  });

  it('normalizes the fixed Contract grant and exact Travel purchase interaction identities', () => {
    expect(rewardKernelCatalog.acquisitions.byKey.InfernalContractBoon).toMatchObject({
      grantedTraitKey: 'InfernalContractBoon',
      historyProjection: 'lootAndUse',
    });
    const world = rewardKernelCatalog.shops.byKey.WorldShop;
    expect(world?.groups.byKey.Boon?.options.byKey.RandomLoot?.purchaseInteraction).toEqual({
      kind: 'resolvedOfferSource',
    });
    expect(
      world?.groups.byKey.MajorNonBoon?.options.byKey.WeaponUpgradeDropEarly?.purchaseInteraction,
    ).toEqual({ kind: 'fixed', gameName: 'WeaponUpgrade' });
    expect(world?.groups.byKey.Boon?.options.byKey.ShopHermesUpgrade?.purchaseInteraction).toEqual({
      kind: 'fixed',
      gameName: 'HermesUpgrade',
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

  it('rejects malformed emitted shop slots and producer lifecycle overrides', () => {
    const worldShop = rewardKernelDeclarations.shops.find((shop) => shop.key === 'WorldShop');
    if (worldShop === undefined) {
      throw new Error('WorldShop test declaration is missing');
    }
    const malformed: readonly RawRewardKernelInput[] = [
      rawInput({
        ...rewardKernelDeclarations,
        shops: rewardKernelDeclarations.shops.map((shop) =>
          shop.key === 'WorldShop' ? { ...shop, slots: shop.slots.slice(1) } : shop,
        ),
      }),
      ...(['infernalContractReward', 'travelDealRefill', 'echoDoubleShopReward'] as const).map(
        (reservedKey) =>
          rawInput({
            ...rewardKernelDeclarations,
            shops: rewardKernelDeclarations.shops.map((shop) =>
              shop.key === 'WorldShop'
                ? {
                    ...shop,
                    slots: shop.slots.map((slot, index) =>
                      index === 0 ? { ...slot, key: reservedKey } : slot,
                    ),
                  }
                : shop,
            ),
          }),
      ),
      rawInput({
        ...rewardKernelDeclarations,
        shops: rewardKernelDeclarations.shops.map((shop) =>
          shop.key === 'WorldShop'
            ? {
                ...shop,
                groups: shop.groups.map((group, groupIndex) =>
                  groupIndex === 0
                    ? {
                        ...group,
                        options: group.options.map((option, optionIndex) =>
                          optionIndex === 0
                            ? { ...option, rewardType: 'missingRewardType' }
                            : option,
                        ),
                      }
                    : group,
                ),
              }
            : shop,
        ),
      }),
      rawInput({
        ...rewardKernelDeclarations,
        shops: rewardKernelDeclarations.shops.map((shop) =>
          shop.key === 'WorldShop'
            ? {
                ...shop,
                slots: shop.slots.map((slot, index) =>
                  index === 0 ? { ...slot, key: 'echoDoubleShop:Major' } : slot,
                ),
              }
            : shop,
        ),
      }),
      rawInput({
        ...rewardKernelDeclarations,
        producerLifecycles: [
          {
            key: 'RoomReward',
            rewardTypes: ['Devotion'],
            defaultLifecyclePoint: 'roomRewardPickup',
            overrides: [
              {
                rewardType: 'Devotion',
                acquisitionLifecycle: [{ role: 'chosenSource', lifecyclePoint: 'beforeCombat' }],
              },
            ],
          },
        ],
      }),
    ];
    expect(worldShop.slots).toHaveLength(3);
    for (const input of malformed) {
      expect(() => createRewardKernelCatalog(input)).toThrow(CatalogContractError);
    }
  });

  it('rejects incomplete source contracts at catalog construction', () => {
    const boon = rewardKernelDeclarations.rewardTypes.find((entry) => entry.gameName === 'Boon');
    if (
      boon === undefined ||
      boon.payloadDomain === undefined ||
      boon.sourceSupport === undefined
    ) {
      throw new Error('Boon test declaration is missing');
    }
    const brokenBoon = {
      gameName: boon.gameName,
      label: boon.label,
      payloadDomain: boon.payloadDomain,
      sourceSupport: boon.sourceSupport,
      acquisitionRoles: boon.acquisitionRoles,
    };
    const broken = {
      ...rewardKernelDeclarations,
      rewardTypes: rewardKernelDeclarations.rewardTypes.map((entry) =>
        entry.gameName === 'Boon' ? brokenBoon : entry,
      ),
    };
    expect(() => createRewardKernelCatalog(broken)).toThrow(CatalogContractError);
  });

  it('rejects every malformed closed semantic family at catalog construction', () => {
    const cases: readonly [string, RawRewardKernelInput][] = [
      [
        'payload domain kind',
        rawInput({
          ...rewardKernelDeclarations,
          payloadDomains: rewardKernelDeclarations.payloadDomains.map((domain) =>
            domain.key === 'BoonSource' ? { ...domain, kind: 'unknownDomain' } : domain,
          ),
        }),
      ],
      [
        'acquisition kind',
        rawInput({
          ...rewardKernelDeclarations,
          acquisitions: rewardKernelDeclarations.acquisitions.map((acquisition) =>
            acquisition.gameName === 'ApolloUpgrade'
              ? { ...acquisition, kind: 'unknownAcquisition' }
              : acquisition,
          ),
        }),
      ],
      [
        'history projection',
        rawInput({
          ...rewardKernelDeclarations,
          acquisitions: rewardKernelDeclarations.acquisitions.map((acquisition) =>
            acquisition.gameName === 'ApolloUpgrade'
              ? { ...acquisition, historyProjection: 'unknownProjection' }
              : acquisition,
          ),
        }),
      ],
      [
        'role resolution kind',
        replaceRewardType('Boon', (rewardType) => ({
          ...rewardType,
          acquisitionRoles: [{ key: 'source', resolution: { kind: 'unknownResolution' } }],
        })),
      ],
      [
        'payload source field',
        replaceRewardType('Boon', (rewardType) => ({
          ...rewardType,
          acquisitionRoles: [
            {
              key: 'source',
              resolution: {
                kind: 'payloadSource',
                acquisitionKind: 'loot',
                field: 'unknownField',
              },
            },
          ],
        })),
      ],
      [
        'source support policy',
        replaceRewardType('Boon', (rewardType) => ({
          ...rewardType,
          sourceSupport: 'unknownSupport',
        })),
      ],
      [
        'source resolution kind',
        replaceRewardType('RandomLoot', (rewardType) => ({
          ...rewardType,
          sourceResolution: { kind: 'unknownSourceResolution' },
        })),
      ],
      [
        'offer projection',
        replaceRewardType('Boon', (rewardType) => ({
          ...rewardType,
          offerProjection: 'unknownOfferProjection',
        })),
      ],
      [
        'producer lifecycle point',
        rawInput({
          ...rewardKernelDeclarations,
          shops: rewardKernelDeclarations.shops.map((shop) =>
            shop.key === 'WorldShop'
              ? {
                  ...shop,
                  groups: shop.groups.map((group) =>
                    group.key === 'Boon'
                      ? {
                          ...group,
                          options: group.options.map((option) =>
                            option.key === 'RandomLoot'
                              ? {
                                  ...option,
                                  acquisitionLifecycle: [
                                    { role: 'source', lifecyclePoint: 'unknownPoint' },
                                  ],
                                }
                              : option,
                          ),
                        }
                      : group,
                  ),
                }
              : shop,
          ),
        }),
      ],
    ];

    for (const [name, input] of cases) {
      expect(() => createRewardKernelCatalog(input), name).toThrow(CatalogContractError);
    }
  });
});

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
    expect(rewardKernelCatalog.stores.byKey.RunProgress?.defaultOffer).toEqual({
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
    });

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
        .filter((entry) => entry.defaultOffer.rewardType === 'WeaponUpgradeDrop')
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
        ?.defaultOffer,
    ).toEqual({
      rewardType: 'RandomLoot',
      payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
    });
    expect(
      Object.fromEntries(
        rewardKernelCatalog.shops.values.map((profile) => [
          profile.key,
          profile.slots.values.map((slot) => ({
            key: slot.key,
            label: slot.label,
            groupKey: slot.groupKey,
            defaultOptionKey: slot.defaultOptionKey,
            defaultRewardType: slot.defaultOffer.rewardType,
          })),
        ]),
      ),
    ).toEqual({
      WorldShop: [
        {
          key: 'Boon',
          label: 'Offer 1',
          groupKey: 'Boon',
          defaultOptionKey: 'RandomLoot',
          defaultRewardType: 'RandomLoot',
        },
        {
          key: 'MajorNonBoon',
          label: 'Offer 2',
          groupKey: 'MajorNonBoon',
          defaultOptionKey: 'WeaponUpgradeDropEarly',
          defaultRewardType: 'WeaponUpgradeDrop',
        },
        {
          key: 'Minor',
          label: 'Offer 3',
          groupKey: 'Minor',
          defaultOptionKey: 'MaxManaDrop',
          defaultRewardType: 'MaxManaDrop',
        },
      ],
      I_WorldShop: [
        {
          key: 'BoostedBoon',
          label: 'Offer 1',
          groupKey: 'BoostedBoon',
          defaultOptionKey: 'BoostedRandomLoot',
          defaultRewardType: 'RandomLoot',
        },
        {
          key: 'MixedProgress',
          label: 'Offer 2',
          groupKey: 'MixedProgress',
          defaultOptionKey: 'RandomLoot',
          defaultRewardType: 'RandomLoot',
        },
        {
          key: 'Survival',
          label: 'Offer 3',
          groupKey: 'Survival',
          defaultOptionKey: 'HealBigDrop',
          defaultRewardType: 'HealBigDrop',
        },
        {
          key: 'PremiumProgress',
          label: 'Offer 4',
          groupKey: 'PremiumProgress',
          defaultOptionKey: 'ShopHermesUpgrade',
          defaultRewardType: 'ShopHermesUpgrade',
        },
        {
          key: 'MetaProgress',
          label: 'Offer 5',
          groupKey: 'MetaProgress',
          defaultOptionKey: 'WeaponPointsRareDrop',
          defaultRewardType: 'WeaponPointsRareDrop',
        },
      ],
      Q_WorldShop: [
        {
          key: 'MixedProgress1',
          label: 'Offer 1',
          groupKey: 'MixedProgress',
          defaultOptionKey: 'BoostedRandomLoot',
          defaultRewardType: 'RandomLoot',
        },
        {
          key: 'MixedProgress2',
          label: 'Offer 2',
          groupKey: 'MixedProgress',
          defaultOptionKey: 'StackUpgradeBig',
          defaultRewardType: 'StackUpgradeBig',
        },
        {
          key: 'LargeSurvival',
          label: 'Offer 3',
          groupKey: 'LargeSurvival',
          defaultOptionKey: 'HealBigDrop',
          defaultRewardType: 'HealBigDrop',
        },
        {
          key: 'Survival',
          label: 'Offer 4',
          groupKey: 'Survival',
          defaultOptionKey: 'HealBigDrop',
          defaultRewardType: 'HealBigDrop',
        },
        {
          key: 'PremiumProgress',
          label: 'Offer 5',
          groupKey: 'PremiumProgress',
          defaultOptionKey: 'ShopHermesUpgrade',
          defaultRewardType: 'ShopHermesUpgrade',
        },
        {
          key: 'MetaProgress',
          label: 'Offer 6',
          groupKey: 'MetaProgress',
          defaultOptionKey: 'WeaponPointsRareDrop',
          defaultRewardType: 'WeaponPointsRareDrop',
        },
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
          options: ['BoostedRandomLoot', 'StackUpgradeBig'],
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
          options: ['HealBigDrop', 'ArmorBigBoost', 'LastStandDrop'],
        },
        {
          key: 'PremiumProgress',
          offerCount: 1,
          options: [
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
            'BoostedRandomLoot',
            'StackUpgradeBig',
            'RandomLoot',
            'BlindBoxLoot',
            'MaxHealthDrop',
            'MaxManaDrop',
            'TalentDrop',
            'SpellDrop',
          ],
        },
        {
          key: 'LargeSurvival',
          offerCount: 1,
          options: ['HealBigDrop', 'ArmorBigBoost'],
        },
        {
          key: 'Survival',
          offerCount: 1,
          options: ['HealBigDrop', 'ArmorBigBoost', 'LastStandDrop'],
        },
        {
          key: 'PremiumProgress',
          offerCount: 1,
          options: [
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
      'RoomMoneyDrop',
      'RoomMoneyTripleDrop',
      'RoomMoneyTinyDrop',
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
      'WeaponPointsRareDrop',
      'CardUpgradePointsDrop',
      'CharonPointsDrop',
    ]);
    expect(rewardKernelCatalog.acquisitions.values).toHaveLength(48);
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
    expect(roomReward?.rewardTypes.byKey.Story?.acquisitionLifecycle).toEqual([]);
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
      rawInput({
        ...rewardKernelDeclarations,
        shops: rewardKernelDeclarations.shops.map((shop) =>
          shop.key === 'WorldShop'
            ? {
                ...shop,
                slots: shop.slots.map((slot, index) =>
                  index === 0 ? { ...slot, defaultOptionKey: 'missing' } : slot,
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
      boon.defaultPayload === undefined ||
      boon.sourceSupport === undefined
    ) {
      throw new Error('Boon test declaration is missing');
    }
    const brokenBoon = {
      gameName: boon.gameName,
      label: boon.label,
      payloadDomain: boon.payloadDomain,
      defaultPayload: boon.defaultPayload,
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
        'payload kind',
        replaceRewardType('Boon', (rewardType) => ({
          ...rewardType,
          defaultPayload: { kind: 'unknownPayload', source: 'ApolloUpgrade' },
        })),
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

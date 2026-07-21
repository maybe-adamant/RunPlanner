import { evaluateRequirement, type RequirementEvaluationContext } from '@run-planner/core';
import {
  applyConcreteAcquisition,
  applyOfferProjection,
  beginBiomeRewardHistory,
  beginCurrentRoomRewardHistory,
  consumeCountedOffer,
  createRewardBagState,
  createRewardHistoryState,
  evaluateShopGenerationSupport,
  factsWithHistory,
  findShopGenerationWitnesses,
  isOfferSupportedAtResolutionPoint,
  resolveAcquisitionRole,
  simulateShopPurchases,
  supportedPayloads,
  type AuthoredShopOffer,
  type RewardHistoryState,
  type RewardKernelFacts,
} from '@run-planner/core/reward-kernel';
import { describe, expect, it } from 'vitest';

import { CatalogContractError } from '../normalization/errors';
import { ordinarySources, rewardKernelDeclarations } from './index';
import { createRewardKernelCatalog } from './normalize';
import type { RawRewardKernelInput } from './types';

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

function requirementContext(
  overrides: Partial<RequirementEvaluationContext> = {},
): RequirementEvaluationContext {
  return {
    counters: {
      biomeDepthCache: 4,
      biomeEncounterDepth: 2,
      encounterDepth: 7,
      enteredBiomes: 1,
      upgradableTraitCount: 0,
    },
    records: {
      biomeUseRecord: {},
      lootTypeHistory: {},
      roomsEntered: {},
      useRecord: {},
    },
    currentRoomShopOptionNames: new Set(),
    currentRoomRewardType: undefined,
    rewardLookups: {},
    runDepthCache: 8,
    lastEventRunDepthCaches: {},
    recentEncounterPhases: [],
    offeredExitCount: 3,
    currentBatchRoomGameNames: [],
    clockwork: undefined,
    flags: { allSpellInvested: false, pendingSpellDrop: false },
    ...overrides,
  };
}

function facts(
  acquiredSources: readonly string[] = [],
  contextOverrides: Partial<RequirementEvaluationContext> = {},
): RewardKernelFacts {
  const runDepthCache = contextOverrides.runDepthCache ?? 8;
  const records = {
    biomeUseRecord: {},
    lootTypeHistory: Object.fromEntries(acquiredSources.map((source) => [source, 1])),
    roomsEntered: {},
    useRecord: {},
  };
  return {
    requirements: requirementContext({ records, ...contextOverrides, runDepthCache }),
  };
}

function historyFromSources(sources: readonly string[]): RewardHistoryState {
  const counts = Object.freeze(Object.fromEntries(sources.map((source) => [source, 1])));
  return Object.freeze({
    offerHistory: [],
    useRecord: counts,
    biomeUseRecord: counts,
    currentRoomUseRecord: counts,
    lootTypeHistory: counts,
    lootBiomeRecord: counts,
    consumableRecord: {},
    upgradableTraitCount: sources.length,
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

describe('source support', () => {
  const boonType = rewardKernelCatalog.rewardTypes.byKey.Boon!;
  const devotionType = rewardKernelCatalog.rewardTypes.byKey.Devotion!;

  it('uses the four-source cap and peer exclusion with the exhaustion fallback', () => {
    expect(supportedPayloads(rewardKernelCatalog, boonType, facts())).toHaveLength(9);
    expect(
      supportedPayloads(
        rewardKernelCatalog,
        boonType,
        facts(['AphroditeUpgrade', 'ApolloUpgrade', 'AresUpgrade', 'ZeusUpgrade']),
      ),
    ).toEqual([
      { kind: 'BoonSource', source: 'AphroditeUpgrade' },
      { kind: 'BoonSource', source: 'ApolloUpgrade' },
      { kind: 'BoonSource', source: 'AresUpgrade' },
      { kind: 'BoonSource', source: 'ZeusUpgrade' },
    ]);
    expect(
      supportedPayloads(
        rewardKernelCatalog,
        boonType,
        facts(['AphroditeUpgrade', 'ApolloUpgrade', 'AresUpgrade', 'ZeusUpgrade']),
        {
          priorOffers: [
            {
              rewardType: 'Boon',
              payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
            },
          ],
        },
      ),
    ).not.toContainEqual({ kind: 'BoonSource', source: 'ApolloUpgrade' });
    expect(
      supportedPayloads(
        rewardKernelCatalog,
        boonType,
        facts(['AphroditeUpgrade', 'ApolloUpgrade', 'AresUpgrade', 'ZeusUpgrade']),
        {
          priorOffers: ['AphroditeUpgrade', 'ApolloUpgrade', 'AresUpgrade', 'ZeusUpgrade'].map(
            (source) => ({
              rewardType: 'Boon',
              payload: { kind: 'BoonSource' as const, source },
            }),
          ),
        },
      ),
    ).toEqual([
      { kind: 'BoonSource', source: 'AphroditeUpgrade' },
      { kind: 'BoonSource', source: 'ApolloUpgrade' },
      { kind: 'BoonSource', source: 'AresUpgrade' },
      { kind: 'BoonSource', source: 'ZeusUpgrade' },
    ]);
  });

  it('constructs ordered Devotion roles from distinct acquired ordinary sources', () => {
    expect(
      supportedPayloads(rewardKernelCatalog, devotionType, facts(['ApolloUpgrade', 'ZeusUpgrade'])),
    ).toEqual([
      {
        kind: 'DevotionPair',
        chosenSource: 'ApolloUpgrade',
        spurnedSource: 'ZeusUpgrade',
      },
      {
        kind: 'DevotionPair',
        chosenSource: 'ZeusUpgrade',
        spurnedSource: 'ApolloUpgrade',
      },
    ]);
  });

  it('defers Blind Box hidden-source support from shop generation to acquisition', () => {
    const blindBox = {
      rewardType: 'BlindBoxLoot',
      payload: { kind: 'BoonSource' as const, source: 'HestiaUpgrade' },
    };
    const capped = facts(['AphroditeUpgrade', 'ApolloUpgrade', 'AresUpgrade', 'ZeusUpgrade']);
    expect(isOfferSupportedAtResolutionPoint(rewardKernelCatalog, blindBox, capped, 'offer')).toBe(
      true,
    );
    expect(
      isOfferSupportedAtResolutionPoint(rewardKernelCatalog, blindBox, capped, {
        acquisitionRole: 'hiddenSource',
      }),
    ).toBe(false);
  });
});

describe('reward eligibility requirements', () => {
  it('keeps current-shop Hermes exclusion on counted loot without self-blocking shop Hermes', () => {
    const countedHermes = rewardKernelCatalog.stores.byKey.RunProgress?.entries.find(
      (entry) => entry.rewardType === 'HermesUpgrade',
    );
    const shopHermes =
      rewardKernelCatalog.shops.byKey.WorldShop?.groups.byKey.Boon?.options.byKey.ShopHermesUpgrade;
    if (countedHermes?.requirement === undefined || shopHermes?.requirement === undefined) {
      throw new Error('Hermes requirements are missing');
    }
    const context = facts([], {
      currentRoomShopOptionNames: new Set(['ShopHermesUpgrade']),
    }).requirements;
    expect(evaluateRequirement(countedHermes.requirement, context)).toBe(false);
    expect(evaluateRequirement(shopHermes.requirement, context)).toBe(true);
  });

  it('does not count Ares toward the two-source Devotion eligibility requirement', () => {
    const devotion = rewardKernelCatalog.stores.byKey.RunProgress?.entries.find(
      (entry) => entry.rewardType === 'Devotion',
    );
    if (devotion?.requirement === undefined) {
      throw new Error('RunProgress Devotion requirement is missing');
    }
    expect(
      evaluateRequirement(
        devotion.requirement,
        facts(['ApolloUpgrade', 'AresUpgrade']).requirements,
      ),
    ).toBe(false);
    expect(
      evaluateRequirement(
        devotion.requirement,
        facts(['ApolloUpgrade', 'ZeusUpgrade']).requirements,
      ),
    ).toBe(true);
  });
});

describe('counted reward bags', () => {
  const runProgress = rewardKernelCatalog.stores.byKey.RunProgress!;

  it('branches when one offer can consume entries with different future requirements', () => {
    const next = consumeCountedOffer(
      rewardKernelCatalog,
      runProgress,
      createRewardBagState(runProgress),
      { rewardType: 'MaxHealthDrop' },
      facts(['ApolloUpgrade']),
    );
    expect(next).toHaveLength(2);
    expect(next.map((state) => state.remainingEntryCounts.slice(0, 2))).toEqual([
      [0, 1],
      [1, 0],
    ]);
  });

  it('deduplicates equivalent latent states from duplicate Boon entries', () => {
    const next = consumeCountedOffer(
      rewardKernelCatalog,
      runProgress,
      createRewardBagState(runProgress),
      { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
      facts(),
    );
    expect(next).toHaveLength(1);
    expect(next[0]?.remainingEntryCounts.slice(14).reduce((sum, count) => sum + count, 0)).toBe(3);
  });

  it('blocks non-duplicate peer reward types while allowing a different-source Boon peer', () => {
    const initial = createRewardBagState(runProgress);
    expect(
      consumeCountedOffer(
        rewardKernelCatalog,
        runProgress,
        initial,
        { rewardType: 'MaxHealthDrop' },
        facts(),
        { peers: { priorOffers: [{ rewardType: 'MaxHealthDrop' }] } },
      ),
    ).toEqual([]);
    expect(
      consumeCountedOffer(
        rewardKernelCatalog,
        runProgress,
        initial,
        { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
        facts(),
        {
          peers: {
            priorOffers: [
              {
                rewardType: 'Boon',
                payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
              },
            ],
          },
        },
      ),
    ).toHaveLength(1);
  });

  it('retains ineligible leftovers while appending one complete base set', () => {
    const remaining = runProgress.entries.map(() => 0);
    remaining[12] = 1;
    const next = consumeCountedOffer(
      rewardKernelCatalog,
      runProgress,
      { remainingEntryCounts: remaining },
      { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
      facts([], {
        records: {
          biomeUseRecord: {},
          lootTypeHistory: {},
          roomsEntered: {},
          useRecord: { SpellDrop: 1 },
        },
      }),
    );
    expect(next).toHaveLength(1);
    expect(next[0]?.remainingEntryCounts[12]).toBe(2);
    expect(next[0]?.remainingEntryCounts.slice(14).reduce((sum, count) => sum + count, 0)).toBe(3);
  });

  it('fails loudly when a supported consumer remains empty after its one refill', () => {
    expect(() =>
      consumeCountedOffer(
        rewardKernelCatalog,
        runProgress,
        { remainingEntryCounts: runProgress.entries.map(() => 0) },
        { rewardType: 'SpellDrop' },
        facts([], {
          records: {
            biomeUseRecord: {},
            lootTypeHistory: {},
            roomsEntered: {},
            useRecord: { SpellDrop: 1 },
          },
        }),
        { eligibleRewardTypes: new Set(['SpellDrop']) },
      ),
    ).toThrow('one-refill eligibility invariant');
  });
});

describe('offer and acquisition projections', () => {
  it('records every generic offer without pretending it was acquired', () => {
    const history = applyOfferProjection(
      rewardKernelCatalog,
      createRewardHistoryState(),
      { rewardType: 'MaxHealthDrop' },
      facts([], { runDepthCache: 3 }),
    );
    expect(history.offerHistory).toEqual([{ rewardType: 'MaxHealthDrop' }]);
    expect(history.useRecord).toEqual({});
  });

  it('records Devotion spacing on offer and its chosen/spurned acquisitions in order', () => {
    const offer = {
      rewardType: 'Devotion',
      payload: {
        kind: 'DevotionPair' as const,
        chosenSource: 'ApolloUpgrade',
        spurnedSource: 'ZeusUpgrade',
      },
    };
    let history = applyOfferProjection(
      rewardKernelCatalog,
      createRewardHistoryState(),
      offer,
      facts([], { runDepthCache: 12 }),
    );
    expect(history.lastDevotionDepth).toBe(12);
    expect(history.offerHistory).toEqual([offer]);

    const chosen = resolveAcquisitionRole(
      rewardKernelCatalog,
      offer,
      'chosenSource',
      'beforeCombat',
    );
    const spurned = resolveAcquisitionRole(
      rewardKernelCatalog,
      offer,
      'spurnedSource',
      'afterCombat',
    );
    expect([chosen.lifecyclePoint, spurned.lifecyclePoint]).toEqual([
      'beforeCombat',
      'afterCombat',
    ]);
    history = applyConcreteAcquisition(rewardKernelCatalog, history, chosen.acquisition);
    history = applyConcreteAcquisition(rewardKernelCatalog, history, spurned.acquisition);
    expect(history.lootTypeHistory).toEqual({ ApolloUpgrade: 1, ZeusUpgrade: 1 });
    expect(history.upgradableTraitCount).toBe(2);
  });

  it('feeds Devotion offer spacing back into RunDepthCache requirements', () => {
    const requirement = { kind: 'minRoomsSinceEvent', event: 'Devotion', count: 15 } as const;
    const history = applyOfferProjection(
      rewardKernelCatalog,
      createRewardHistoryState(),
      {
        rewardType: 'Devotion',
        payload: {
          kind: 'DevotionPair',
          chosenSource: 'ApolloUpgrade',
          spurnedSource: 'ZeusUpgrade',
        },
      },
      facts([], { runDepthCache: 12 }),
    );
    const requirementFacts = (runDepthCache: number) =>
      factsWithHistory(facts([], { runDepthCache }), history, new Set()).requirements;

    expect(evaluateRequirement(requirement, requirementFacts(12))).toBe(true);
    expect(evaluateRequirement(requirement, requirementFacts(26))).toBe(false);
    expect(evaluateRequirement(requirement, requirementFacts(27))).toBe(true);
  });

  it('projects Spell as consumable history despite its loot acquisition kind', () => {
    const history = applyConcreteAcquisition(rewardKernelCatalog, createRewardHistoryState(), {
      kind: 'loot',
      gameName: 'SpellDrop',
    });
    expect(history.useRecord).toEqual({ SpellDrop: 1 });
    expect(history.consumableRecord).toEqual({ SpellDrop: 1 });
    expect(history.lootTypeHistory).toEqual({});
  });

  it('starts a new current-room use record without clearing route or biome history', () => {
    const acquired = applyConcreteAcquisition(rewardKernelCatalog, createRewardHistoryState(), {
      kind: 'consumable',
      gameName: 'MaxHealthDrop',
    });
    const nextRoom = beginCurrentRoomRewardHistory(acquired);

    expect(nextRoom.currentRoomUseRecord).toEqual({});
    expect(nextRoom.useRecord).toEqual({ MaxHealthDrop: 1 });
    expect(nextRoom.biomeUseRecord).toEqual({ MaxHealthDrop: 1 });
    expect(nextRoom.consumableRecord).toEqual({ MaxHealthDrop: 1 });
  });

  it('starts a new biome without clearing route-wide reward history', () => {
    const acquired = applyConcreteAcquisition(rewardKernelCatalog, createRewardHistoryState(), {
      kind: 'loot',
      gameName: 'ApolloUpgrade',
    });
    const nextBiome = beginBiomeRewardHistory(acquired);

    expect(nextBiome.currentRoomUseRecord).toEqual({});
    expect(nextBiome.biomeUseRecord).toEqual({});
    expect(nextBiome.lootBiomeRecord).toEqual({});
    expect(nextBiome.useRecord).toEqual({ ApolloUpgrade: 1 });
    expect(nextBiome.lootTypeHistory).toEqual({ ApolloUpgrade: 1 });
    expect(nextBiome.upgradableTraitCount).toBe(1);
  });

  it('makes the trait-free reward baseline explicit', () => {
    const baseline = facts();
    expect(baseline.requirements.counters.upgradableTraitCount).toBe(0);
    expect(baseline.requirements.flags).toEqual({
      allSpellInvested: false,
      pendingSpellDrop: false,
    });
  });
});

describe('ordered shop transitions', () => {
  it('finds exact WorldShop generation witnesses and keeps distinct Hammer entries', () => {
    const profile = rewardKernelCatalog.shops.byKey.WorldShop!;
    const authored: readonly AuthoredShopOffer[] = [
      {
        offer: {
          rewardType: 'RandomLoot',
          payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
        },
        purchased: false,
      },
      { offer: { rewardType: 'WeaponUpgradeDrop' }, purchased: false },
      { offer: { rewardType: 'MaxManaDrop' }, purchased: false },
    ];
    const witnesses = findShopGenerationWitnesses(rewardKernelCatalog, profile, authored, facts());
    expect(witnesses.map((witness) => witness.optionKeys)).toEqual([
      ['RandomLoot', 'WeaponUpgradeDropEarly', 'MaxManaDrop'],
    ]);
  });

  it('applies declaration-owned option requirements during generation and revalidation', () => {
    const profile = rewardKernelCatalog.shops.byKey.WorldShop!;
    const authored: readonly AuthoredShopOffer[] = [
      {
        offer: {
          rewardType: 'RandomLoot',
          payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
        },
        purchased: false,
      },
      { offer: { rewardType: 'WeaponUpgradeDrop' }, purchased: false },
      { offer: { rewardType: 'MaxManaDrop' }, purchased: false },
    ];
    const additionalRequirements = {
      WeaponUpgradeDropEarly: {
        kind: 'rewardLookupExcludes' as const,
        lookupKey: 'hubRewardLookup',
        rewardType: 'WeaponUpgrade',
      },
    };
    const supportedFacts = facts([], {
      rewardLookups: { hubRewardLookup: new Set() },
    });
    const witness = findShopGenerationWitnesses(
      rewardKernelCatalog,
      profile,
      authored,
      supportedFacts,
      additionalRequirements,
    )[0];
    if (witness === undefined) {
      throw new Error('WorldShop lookup witness is missing');
    }
    const blockedFacts = facts([], {
      rewardLookups: { hubRewardLookup: new Set(['WeaponUpgrade']) },
    });

    expect(
      evaluateShopGenerationSupport(
        rewardKernelCatalog,
        profile,
        authored,
        blockedFacts,
        additionalRequirements,
      ),
    ).toMatchObject({ witnesses: [], unsupportedSlotIndexes: [1] });
    expect(
      simulateShopPurchases(
        rewardKernelCatalog,
        profile,
        authored,
        witness,
        createRewardHistoryState(),
        blockedFacts,
        additionalRequirements,
      ),
    ).toEqual([]);
  });

  it('rejects a generation witness that does not support the authored shop offers', () => {
    const profile = rewardKernelCatalog.shops.byKey.WorldShop!;
    const authored: readonly AuthoredShopOffer[] = [
      {
        offer: {
          rewardType: 'RandomLoot',
          payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
        },
        purchased: false,
      },
      { offer: { rewardType: 'WeaponUpgradeDrop' }, purchased: false },
      { offer: { rewardType: 'MaxManaDrop' }, purchased: false },
    ];
    const witness = findShopGenerationWitnesses(rewardKernelCatalog, profile, authored, facts())[0];
    if (witness === undefined) {
      throw new Error('WorldShop witness is missing');
    }
    const mismatched: readonly AuthoredShopOffer[] = [
      authored[0]!,
      authored[1]!,
      { offer: { rewardType: 'MaxHealthDrop' }, purchased: true },
    ];
    expect(
      simulateShopPurchases(
        rewardKernelCatalog,
        profile,
        mismatched,
        witness,
        createRewardHistoryState(),
        facts(),
      ),
    ).toEqual([]);
  });

  it('revalidates generation witnesses against the authoritative initial history', () => {
    const profile = rewardKernelCatalog.shops.byKey.WorldShop!;
    const authored: readonly AuthoredShopOffer[] = [
      {
        offer: {
          rewardType: 'RandomLoot',
          payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
        },
        purchased: true,
      },
      { offer: { rewardType: 'WeaponUpgradeDrop' }, purchased: false },
      { offer: { rewardType: 'MaxManaDrop' }, purchased: false },
    ];
    const staleFacts = facts();
    const witness = findShopGenerationWitnesses(
      rewardKernelCatalog,
      profile,
      authored,
      staleFacts,
    )[0];
    if (witness === undefined) {
      throw new Error('stale WorldShop witness is missing');
    }
    const cappedSources = ['AphroditeUpgrade', 'ApolloUpgrade', 'AresUpgrade', 'ZeusUpgrade'];
    expect(
      simulateShopPurchases(
        rewardKernelCatalog,
        profile,
        authored,
        witness,
        historyFromSources(cappedSources),
        staleFacts,
      ),
    ).toEqual([]);
  });

  it('enforces without-replacement assignment for the two-offer Q group', () => {
    const profile = rewardKernelCatalog.shops.byKey.Q_WorldShop!;
    const authored: readonly AuthoredShopOffer[] = [
      {
        offer: {
          rewardType: 'RandomLoot',
          payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
        },
        purchased: false,
      },
      {
        offer: {
          rewardType: 'RandomLoot',
          payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
        },
        purchased: false,
      },
      { offer: { rewardType: 'HealBigDrop' }, purchased: false },
      { offer: { rewardType: 'HealBigDrop' }, purchased: false },
      { offer: { rewardType: 'MaxHealthDropBig' }, purchased: false },
      { offer: { rewardType: 'WeaponPointsRareDrop' }, purchased: false },
    ];
    const witnesses = findShopGenerationWitnesses(rewardKernelCatalog, profile, authored, facts());
    expect(witnesses).toHaveLength(2);
    expect(witnesses.map((witness) => witness.optionKeys.slice(0, 2))).toEqual([
      ['BoostedRandomLoot', 'RandomLoot'],
      ['RandomLoot', 'BoostedRandomLoot'],
    ]);
  });

  it('distinguishes a jointly unavailable Q group from unsupported individual slots', () => {
    const profile = rewardKernelCatalog.shops.byKey.Q_WorldShop!;
    const authored: readonly AuthoredShopOffer[] = [
      {
        offer: {
          rewardType: 'BlindBoxLoot',
          payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
        },
        purchased: false,
      },
      {
        offer: {
          rewardType: 'BlindBoxLoot',
          payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
        },
        purchased: false,
      },
      { offer: { rewardType: 'HealBigDrop' }, purchased: false },
      { offer: { rewardType: 'HealBigDrop' }, purchased: false },
      { offer: { rewardType: 'MaxHealthDropBig' }, purchased: false },
      { offer: { rewardType: 'WeaponPointsRareDrop' }, purchased: false },
    ];

    const support = evaluateShopGenerationSupport(rewardKernelCatalog, profile, authored, facts());

    expect(support.witnesses).toEqual([]);
    expect(support.unsupportedSlotIndexes).toEqual([]);
    expect(support.jointlyUnavailable).toBe(true);
  });

  it('merges purchase orders that produce equivalent history records', () => {
    const profile = rewardKernelCatalog.shops.byKey.Q_WorldShop!;
    const authored: readonly AuthoredShopOffer[] = [
      { offer: { rewardType: 'MaxHealthDrop' }, purchased: true },
      { offer: { rewardType: 'MaxManaDrop' }, purchased: true },
      { offer: { rewardType: 'HealBigDrop' }, purchased: false },
      { offer: { rewardType: 'HealBigDrop' }, purchased: false },
      { offer: { rewardType: 'MaxHealthDropBig' }, purchased: false },
      { offer: { rewardType: 'WeaponPointsRareDrop' }, purchased: false },
    ];
    const baseFacts = facts();
    const witness = findShopGenerationWitnesses(
      rewardKernelCatalog,
      profile,
      authored,
      baseFacts,
    )[0];
    if (witness === undefined) {
      throw new Error('Q shop witness is missing');
    }
    const results = simulateShopPurchases(
      rewardKernelCatalog,
      profile,
      authored,
      witness,
      createRewardHistoryState(),
      baseFacts,
    );
    expect(results).toHaveLength(1);
    expect(results[0]?.purchaseOrder).toEqual([0, 1]);
    expect(results[0]?.acquisitions).toEqual([
      expect.objectContaining({
        slotIndex: 0,
        event: expect.objectContaining({
          acquisition: { kind: 'consumable', gameName: 'MaxHealthDrop' },
        }),
      }),
      expect.objectContaining({
        slotIndex: 1,
        event: expect.objectContaining({
          acquisition: { kind: 'consumable', gameName: 'MaxManaDrop' },
        }),
      }),
    ]);
    expect(results[0]?.history.consumableRecord).toEqual({
      MaxHealthDrop: 1,
      MaxManaDrop: 1,
    });
  });

  it('branches purchase order and retains the only Blind Box source witness that remains valid', () => {
    const profile = rewardKernelCatalog.shops.byKey.Q_WorldShop!;
    const initialSources = ['AphroditeUpgrade', 'ApolloUpgrade', 'AresUpgrade'];
    const authored: readonly AuthoredShopOffer[] = [
      {
        offer: {
          rewardType: 'RandomLoot',
          payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
        },
        purchased: true,
      },
      {
        offer: {
          rewardType: 'BlindBoxLoot',
          payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
        },
        purchased: true,
      },
      { offer: { rewardType: 'HealBigDrop' }, purchased: false },
      { offer: { rewardType: 'HealBigDrop' }, purchased: false },
      { offer: { rewardType: 'MaxHealthDropBig' }, purchased: false },
      { offer: { rewardType: 'WeaponPointsRareDrop' }, purchased: false },
    ];
    const baseFacts = facts(initialSources);
    const witnesses = findShopGenerationWitnesses(
      rewardKernelCatalog,
      profile,
      authored,
      baseFacts,
    );
    expect(witnesses).not.toHaveLength(0);
    const results = simulateShopPurchases(
      rewardKernelCatalog,
      profile,
      authored,
      witnesses[0]!,
      historyFromSources(initialSources),
      baseFacts,
    );
    expect(results).toHaveLength(1);
    expect(results[0]?.purchaseOrder).toEqual([1, 0]);
    expect(results[0]?.acquisitions.map((acquisition) => acquisition.event.role)).toEqual([
      'box',
      'hiddenSource',
      'source',
    ]);
    expect(results[0]?.history.lootTypeHistory).toMatchObject({
      ZeusUpgrade: 1,
      HestiaUpgrade: 1,
    });
    expect(results[0]?.history.consumableRecord).toMatchObject({ BlindBoxLoot: 1 });
  });
});

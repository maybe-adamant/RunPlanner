import { CatalogContractError } from '@run-planner/hades2-catalog';
import {
  createRewardKernelCatalog,
  rawInput,
  rewardKernelCatalog,
  rewardKernelDeclarations,
} from './support/reward-kernel';
import { describe, expect, it } from 'vitest';
import type { RawRewardKernelInput } from '@run-planner/hades2-catalog/test-support';

describe('reward compiler acquisition and producer lifecycle normalizers', () => {
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
});

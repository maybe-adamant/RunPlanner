import { CatalogContractError } from '@run-planner/hades2-catalog';
import {
  createRewardKernelCatalog,
  ordinarySources,
  rawInput,
  rewardKernelCatalog,
  rewardKernelDeclarations,
} from './support/reward-kernel';
import { describe, expect, it } from 'vitest';

describe('reward compiler acquisition, reward-type, and store normalizers', () => {
  it('normalizes and guards the exact 1/3/5 concrete Path grants', () => {
    expect({
      MinorTalentDrop: rewardKernelCatalog.acquisitions.byKey.MinorTalentDrop?.pathPointGrant,
      TalentDrop: rewardKernelCatalog.acquisitions.byKey.TalentDrop?.pathPointGrant,
      TalentBigDrop: rewardKernelCatalog.acquisitions.byKey.TalentBigDrop?.pathPointGrant,
    }).toEqual({ MinorTalentDrop: 1, TalentDrop: 3, TalentBigDrop: 5 });
    expect(() =>
      createRewardKernelCatalog(
        rawInput({
          ...rewardKernelDeclarations,
          acquisitions: rewardKernelDeclarations.acquisitions.map((acquisition) =>
            acquisition.gameName === 'TalentDrop'
              ? ({ ...acquisition, pathPointGrant: 5 } as never)
              : acquisition,
          ),
        }),
      ),
    ).toThrow(/pathPointGrant.*must equal 3/);
  });

  it('normalizes declaration-owned Sea Star capability without reward-kind inference', () => {
    expect(
      rewardKernelCatalog.acquisitions.values
        .filter((acquisition) => acquisition.canDuplicate)
        .map((acquisition) => acquisition.gameName)
        .sort(),
    ).toEqual(
      [
        'AirBoost',
        'ArmorBigBoost',
        'ArmorBoost',
        'CardUpgradePointsDrop',
        'ChaosWeaponUpgrade',
        'CharonPointsDrop',
        'Currency',
        'EarthBoost',
        'ElementalBoost',
        'EmptyMaxHealthDrop',
        'EmptyMaxHealthSmallDrop',
        'FireBoost',
        'GiftDrop',
        'HealBigDrop',
        'HealDrop',
        'LastStandDrop',
        'MaxHealthDrop',
        'MaxHealthDropBig',
        'MaxHealthDropSmall',
        'MaxManaDrop',
        'MaxManaDropBig',
        'MaxManaDropSmall',
        'MemPointsCommonDrop',
        'MetaCardPointsCommonBigDrop',
        'MetaCardPointsCommonDrop',
        'MetaCurrencyBigDrop',
        'MetaCurrencyDrop',
        'MinorTalentDrop',
        'RoomMoneyDrop',
        'RoomMoneySmallDrop',
        'RoomMoneyTinyDrop',
        'RoomMoneyTripleDrop',
        'RoomRewardConsolationPrize',
        'RoomRewardHealDrop',
        'StackUpgrade',
        'StackUpgradeBig',
        'StackUpgradeTriple',
        'StoreRewardRandomStack',
        'TalentBigDrop',
        'TalentDrop',
        'WaterBoost',
        'WeaponPointsRareDrop',
      ].sort(),
    );
    expect(rewardKernelCatalog.acquisitions.byKey.StackUpgrade?.canDuplicate).toBe(true);
    expect(rewardKernelCatalog.acquisitions.byKey.HealDropMinor?.canDuplicate).toBe(false);
    expect(rewardKernelCatalog.acquisitions.byKey.WeaponUpgrade?.canDuplicate).toBe(false);
    expect(() =>
      createRewardKernelCatalog(
        rawInput({
          ...rewardKernelDeclarations,
          acquisitions: rewardKernelDeclarations.acquisitions.map((acquisition) =>
            acquisition.gameName === 'RoomMoneyDrop'
              ? ({ ...acquisition, canDuplicate: undefined } as unknown)
              : acquisition,
          ),
        }),
      ),
    ).toThrow('canDuplicate');
  });

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
      EmptyMaxHealthDrop: 'Empty Max Health',
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
      HealDrop: 'Heal',
      HealDropMinor: 'Minor Heal',
      HealBigDrop: 'Big Heal',
      RoomRewardConsolationPrize: 'Red Onion',
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
      'EmptyMaxHealthDrop',
      'MaxManaDrop',
      'MaxManaDropBig',
      'MaxManaDropSmall',
      'Currency',
      'RoomMoneyDrop',
      'RoomMoneySmallDrop',
      'RoomMoneyTripleDrop',
      'RoomMoneyTinyDrop',
      'HealDropMinor',
      'HealDrop',
      'TalentDrop',
      'TalentBigDrop',
      'MinorTalentDrop',
      'RoomRewardHealDrop',
      'RoomRewardConsolationPrize',
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
    expect(rewardKernelCatalog.acquisitions.values).toHaveLength(58);
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
});

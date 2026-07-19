import type { RawRewardStoreDeclaration } from '../types';

export const rewardStores = [
  {
    key: 'RunProgress',
    defaultRewardType: 'Boon',
    refill: 'appendWhenNoEligibleEntry',
    entries: [
      { rewardType: 'MaxHealthDrop' },
      {
        rewardType: 'MaxHealthDrop',
        requirement: {
          kind: 'recordCount',
          record: 'lootTypeHistory',
          keys: [
            'AphroditeUpgrade',
            'ApolloUpgrade',
            'DemeterUpgrade',
            'HephaestusUpgrade',
            'HestiaUpgrade',
            'HeraUpgrade',
            'PoseidonUpgrade',
            'ZeusUpgrade',
            'AresUpgrade',
          ],
          range: { min: 1 },
        },
      },
      { rewardType: 'MaxManaDrop' },
      {
        rewardType: 'MaxManaDrop',
        requirement: {
          kind: 'recordCount',
          record: 'lootTypeHistory',
          keys: [
            'AphroditeUpgrade',
            'ApolloUpgrade',
            'DemeterUpgrade',
            'HephaestusUpgrade',
            'HestiaUpgrade',
            'HeraUpgrade',
            'PoseidonUpgrade',
            'ZeusUpgrade',
            'AresUpgrade',
          ],
          range: { min: 1 },
        },
      },
      { rewardType: 'RoomMoneyDrop' },
      {
        rewardType: 'RoomMoneyDrop',
        requirement: {
          kind: 'recordCount',
          record: 'lootTypeHistory',
          keys: [
            'AphroditeUpgrade',
            'ApolloUpgrade',
            'DemeterUpgrade',
            'HephaestusUpgrade',
            'HestiaUpgrade',
            'HeraUpgrade',
            'PoseidonUpgrade',
            'ZeusUpgrade',
            'AresUpgrade',
          ],
          range: { min: 1 },
        },
      },
      {
        rewardType: 'StackUpgrade',
        requirement: {
          kind: 'counterRange',
          axis: 'upgradableTraitCount',
          range: { min: 1 },
        },
      },
      {
        rewardType: 'StackUpgrade',
        requirement: {
          kind: 'all',
          requirements: [
            {
              kind: 'counterRange',
              axis: 'upgradableTraitCount',
              range: { min: 1 },
            },
            {
              kind: 'recordCount',
              record: 'lootTypeHistory',
              keys: [
                'AphroditeUpgrade',
                'ApolloUpgrade',
                'DemeterUpgrade',
                'HephaestusUpgrade',
                'HestiaUpgrade',
                'HeraUpgrade',
                'PoseidonUpgrade',
                'ZeusUpgrade',
                'AresUpgrade',
              ],
              range: { min: 1 },
            },
          ],
        },
      },
      {
        rewardType: 'WeaponUpgrade',
        requirement: {
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
      },
      {
        rewardType: 'WeaponUpgrade',
        requirement: {
          kind: 'all',
          requirements: [
            { kind: 'notInCurrentRoomShopOptions', rewardType: 'WeaponUpgradeDrop' },
            { kind: 'counterRange', axis: 'enteredBiomes', range: { min: 3 } },
            {
              kind: 'recordCount',
              record: 'lootTypeHistory',
              keys: ['WeaponUpgrade'],
              range: { min: 1, max: 1 },
            },
          ],
        },
      },
      {
        rewardType: 'HermesUpgrade',
        requirement: {
          kind: 'all',
          requirements: [
            { kind: 'notInCurrentRoomShopOptions', rewardType: 'ShopHermesUpgrade' },
            {
              kind: 'recordCount',
              record: 'biomeUseRecord',
              keys: ['HermesUpgrade', 'ShopHermesUpgrade'],
              range: { max: 0 },
            },
            {
              kind: 'recordCount',
              record: 'lootTypeHistory',
              keys: ['HermesUpgrade'],
              range: { max: 1 },
            },
          ],
        },
      },
      {
        rewardType: 'Devotion',
        requirement: {
          kind: 'all',
          requirements: [
            { kind: 'counterRange', axis: 'encounterDepth', range: { min: 7 } },
            { kind: 'counterRange', axis: 'biomeEncounterDepth', range: { min: 2 } },
            {
              kind: 'recordCount',
              record: 'lootTypeHistory',
              keys: [
                'AphroditeUpgrade',
                'ApolloUpgrade',
                'DemeterUpgrade',
                'HephaestusUpgrade',
                'HestiaUpgrade',
                'HeraUpgrade',
                'PoseidonUpgrade',
                'ZeusUpgrade',
              ],
              range: { min: 2 },
            },
            { kind: 'minRoomsSinceEvent', event: 'Devotion', count: 15 },
            { kind: 'minExits', count: 2 },
          ],
        },
      },
      {
        rewardType: 'SpellDrop',
        requirement: {
          kind: 'all',
          requirements: [
            { kind: 'notInCurrentRoomShopOptions', rewardType: 'SpellDrop' },
            { kind: 'currentRoomRewardExcludes', rewardTypes: ['SpellDrop'] },
            {
              kind: 'recordCount',
              record: 'useRecord',
              keys: ['SpellDrop'],
              range: { max: 0 },
            },
            { kind: 'flagEquals', flag: 'pendingSpellDrop', value: false },
          ],
        },
      },
      {
        rewardType: 'TalentDrop',
        requirement: {
          kind: 'all',
          requirements: [
            { kind: 'notInCurrentRoomShopOptions', rewardType: 'TalentDrop' },
            {
              kind: 'recordCount',
              record: 'useRecord',
              keys: ['SpellDrop'],
              range: { min: 1 },
            },
            { kind: 'flagEquals', flag: 'allSpellInvested', value: false },
            { kind: 'counterRange', axis: 'enteredBiomes', range: { min: 2 } },
            {
              kind: 'recordCount',
              record: 'biomeUseRecord',
              keys: ['TalentDrop'],
              range: { max: 0 },
            },
          ],
        },
      },
      { rewardType: 'Boon' },
      { rewardType: 'Boon' },
      { rewardType: 'Boon' },
      { rewardType: 'Boon' },
    ],
  },
  {
    key: 'MetaProgress',
    defaultRewardType: 'GiftDrop',
    refill: 'appendWhenNoEligibleEntry',
    entries: [
      { rewardType: 'GiftDrop' },
      {
        rewardType: 'MetaCurrencyDrop',
        requirement: {
          kind: 'counterRange',
          axis: 'enteredBiomes',
          range: { max: 1 },
        },
      },
      {
        rewardType: 'MetaCurrencyDrop',
        requirement: {
          kind: 'counterRange',
          axis: 'enteredBiomes',
          range: { max: 1 },
        },
      },
      {
        rewardType: 'MetaCurrencyDrop',
        requirement: {
          kind: 'counterRange',
          axis: 'enteredBiomes',
          range: { min: 2 },
        },
      },
      {
        rewardType: 'MetaCurrencyDrop',
        requirement: {
          kind: 'counterRange',
          axis: 'enteredBiomes',
          range: { min: 2 },
        },
      },
      {
        rewardType: 'MetaCurrencyBigDrop',
        requirement: {
          kind: 'counterRange',
          axis: 'enteredBiomes',
          range: { min: 2 },
        },
      },
      {
        rewardType: 'MetaCurrencyBigDrop',
        requirement: {
          kind: 'counterRange',
          axis: 'enteredBiomes',
          range: { min: 2 },
        },
      },
      {
        rewardType: 'MetaCardPointsCommonDrop',
        requirement: {
          kind: 'counterRange',
          axis: 'enteredBiomes',
          range: { max: 1 },
        },
      },
      {
        rewardType: 'MetaCardPointsCommonDrop',
        requirement: {
          kind: 'counterRange',
          axis: 'enteredBiomes',
          range: { max: 1 },
        },
      },
      {
        rewardType: 'MetaCardPointsCommonDrop',
        requirement: {
          kind: 'counterRange',
          axis: 'enteredBiomes',
          range: { max: 1 },
        },
      },
      {
        rewardType: 'MetaCardPointsCommonDrop',
        requirement: {
          kind: 'counterRange',
          axis: 'enteredBiomes',
          range: { max: 1 },
        },
      },
      {
        rewardType: 'MetaCardPointsCommonDrop',
        requirement: {
          kind: 'counterRange',
          axis: 'enteredBiomes',
          range: { min: 2 },
        },
      },
      {
        rewardType: 'MetaCardPointsCommonDrop',
        requirement: {
          kind: 'counterRange',
          axis: 'enteredBiomes',
          range: { min: 2 },
        },
      },
      {
        rewardType: 'MetaCardPointsCommonDrop',
        requirement: {
          kind: 'counterRange',
          axis: 'enteredBiomes',
          range: { min: 2 },
        },
      },
      {
        rewardType: 'MetaCardPointsCommonDrop',
        requirement: {
          kind: 'counterRange',
          axis: 'enteredBiomes',
          range: { min: 2 },
        },
      },
      {
        rewardType: 'MetaCardPointsCommonBigDrop',
        requirement: {
          kind: 'counterRange',
          axis: 'enteredBiomes',
          range: { min: 2 },
        },
      },
      {
        rewardType: 'MetaCardPointsCommonBigDrop',
        requirement: {
          kind: 'counterRange',
          axis: 'enteredBiomes',
          range: { min: 2 },
        },
      },
      {
        rewardType: 'MetaCardPointsCommonBigDrop',
        requirement: {
          kind: 'counterRange',
          axis: 'enteredBiomes',
          range: { min: 2 },
        },
      },
      {
        rewardType: 'MetaCardPointsCommonBigDrop',
        requirement: {
          kind: 'counterRange',
          axis: 'enteredBiomes',
          range: { min: 2 },
        },
      },
    ],
  },
] as const satisfies readonly RawRewardStoreDeclaration[];

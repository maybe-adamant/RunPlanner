import type { RawTraitDeclaration, RawTraitGiverDeclaration } from '../traits';

/** Source-closed trait declarations. Giver membership remains separate below. */
export const demeterTraits = [
  {
    key: 'DemeterWeaponBoon',
    label: 'Ice Strike',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Water: 1,
    },
    usesBoonRarity: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
    equipmentSlot: 'Melee',
  },
  {
    key: 'DemeterSpecialBoon',
    label: 'Ice Flourish',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Water: 1,
    },
    usesBoonRarity: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
    equipmentSlot: 'Secondary',
  },
  {
    key: 'DemeterCastBoon',
    label: 'Arctic Ring',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Water: 1,
    },
    usesBoonRarity: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
    equipmentSlot: 'Ranged',
  },
  {
    key: 'DemeterSprintBoon',
    label: 'Frigid Rush',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Water: 1,
    },
    usesBoonRarity: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
    equipmentSlot: 'Rush',
  },
  {
    key: 'DemeterManaBoon',
    label: 'Tranquil Gain',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Earth: 1,
    },
    usesBoonRarity: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
    equipmentSlot: 'Mana',
  },
  {
    key: 'CastNovaBoon',
    label: 'Arctic Gale',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Water: 1,
    },
    usesBoonRarity: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'PlantHealthBoon',
    label: 'Plentiful Forage',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [
      {
        kind: 'offerContext',
        context: 'blockGiftBoons',
        required: false,
      },
    ],
    elementContributions: {
      Earth: 1,
    },
    usesBoonRarity: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'BoonGrowthBoon',
    label: 'Steady Growth',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [
      {
        kind: 'rarifiableTrait',
      },
    ],
    elementContributions: {
      Earth: 1,
    },
    usesBoonRarity: true,
    blockStacking: true,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
    selectedDisposition: {
      kind: 'steadyGrowth',
      intervalsByRarity: { Common: 6, Rare: 5, Epic: 4, Heroic: 3 },
    },
  },
  {
    key: 'ReserveManaHitShieldBoon',
    label: 'Snow Queen',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Earth: 1,
    },
    usesBoonRarity: true,
    blockStacking: true,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'SlowExAttackBoon',
    label: 'Weed Killer',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [
      {
        kind: 'anyEquippedTrait',
        traitKeys: [
          'AphroditeWeaponBoon',
          'ApolloWeaponBoon',
          'DemeterWeaponBoon',
          'HephaestusWeaponBoon',
          'HeraWeaponBoon',
          'HestiaWeaponBoon',
          'PoseidonWeaponBoon',
          'ZeusWeaponBoon',
          'AresWeaponBoon',
        ],
      },
    ],
    elementContributions: {
      Earth: 1,
    },
    usesBoonRarity: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'CastAttachBoon',
    label: 'Local Climate',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [
      {
        kind: 'anyEquippedTrait',
        traitKeys: [
          'AphroditeCastBoon',
          'ApolloCastBoon',
          'DemeterCastBoon',
          'HephaestusCastBoon',
          'HeraCastBoon',
          'HestiaCastBoon',
          'PoseidonCastBoon',
          'ZeusCastBoon',
          'AresCastBoon',
        ],
      },
    ],
    elementContributions: {
      Earth: 1,
    },
    usesBoonRarity: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'RootDurationBoon',
    label: 'Cold Storage',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [
      {
        kind: 'anyEquippedTrait',
        traitKeys: ['DemeterWeaponBoon', 'DemeterSpecialBoon', 'DemeterCastBoon'],
      },
    ],
    elementContributions: {
      Water: 1,
    },
    usesBoonRarity: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'ElementalDamageCapBoon',
    label: 'Frosty Veneer',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic'],
    offerRequirements: [
      {
        kind: 'elementCount',
        element: 'Water',
        minimum: 4,
      },
    ],
    elementContributions: {},
    usesBoonRarity: true,
    blockStacking: true,
    blockInRunRarify: true,
    excludeFromRarityCount: true,
  },
  {
    key: 'InstantRootKill',
    label: 'Winter Harvest',
    freshOfferRarities: ['Legendary'],
    equippedRarities: ['Legendary'],
    offerRequirements: [
      {
        kind: 'all',
        requirements: [
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['DemeterWeaponBoon', 'DemeterSpecialBoon', 'DemeterCastBoon'],
          },
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['PlantHealthBoon', 'ReserveManaHitShieldBoon', 'BoonGrowthBoon'],
          },
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['SlowExAttackBoon', 'RootDurationBoon', 'CastAttachBoon'],
          },
        ],
      },
    ],
    elementContributions: {
      Earth: 1,
    },
    usesBoonRarity: true,
    blockStacking: true,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'RootStrikeBoon',
    label: 'Hail Storm',
    freshOfferRarities: ['Duo'],
    equippedRarities: ['Duo'],
    offerRequirements: [
      {
        kind: 'all',
        requirements: [
          {
            kind: 'anyEquippedTrait',
            traitKeys: [
              'ZeusWeaponBoon',
              'ZeusSpecialBoon',
              'ZeusCastBoon',
              'ZeusSprintBoon',
              'ZeusManaBoon',
            ],
          },
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['DemeterWeaponBoon', 'DemeterSpecialBoon', 'DemeterCastBoon'],
          },
        ],
      },
    ],
    elementContributions: {
      Aether: 1,
    },
    usesBoonRarity: true,
    blockStacking: true,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'KeepsakeLevelBoon',
    label: 'Cherished Heirloom',
    freshOfferRarities: ['Duo'],
    equippedRarities: ['Duo'],
    offerRequirements: [
      {
        kind: 'all',
        requirements: [
          {
            kind: 'anyEquippedTrait',
            traitKeys: [
              'DemeterWeaponBoon',
              'DemeterSpecialBoon',
              'DemeterCastBoon',
              'DemeterSprintBoon',
              'DemeterManaBoon',
            ],
          },
          {
            kind: 'anyEquippedTrait',
            traitKeys: [
              'HeraWeaponBoon',
              'HeraSpecialBoon',
              'HeraCastBoon',
              'HeraSprintBoon',
              'HeraManaBoon',
            ],
          },
        ],
      },
    ],
    elementContributions: {
      Aether: 1,
    },
    usesBoonRarity: true,
    blockStacking: true,
    blockOfferIfPreviouslyPicked: true,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
    selectedDisposition: {
      kind: 'advanceCurrentKeepsake',
      rankBonus: 1,
    },
  },
  {
    key: 'GoodStuffBoon',
    label: 'Natural Selection',
    freshOfferRarities: ['Duo'],
    equippedRarities: ['Duo'],
    offerRequirements: [
      {
        kind: 'all',
        requirements: [
          {
            kind: 'anyEquippedTrait',
            traitKeys: [
              'PoseidonWeaponBoon',
              'PoseidonSpecialBoon',
              'PoseidonCastBoon',
              'PoseidonSprintBoon',
              'PoseidonManaBoon',
            ],
          },
          {
            kind: 'anyEquippedTrait',
            traitKeys: [
              'DemeterWeaponBoon',
              'DemeterSpecialBoon',
              'DemeterCastBoon',
              'DemeterSprintBoon',
              'DemeterManaBoon',
            ],
          },
          {
            kind: 'anyEquippedTrait',
            traitKeys: [
              'RoomRewardBonusBoon',
              'DoubleRewardBoon',
              'BoonGrowthBoon',
              'PlantHealthBoon',
            ],
          },
        ],
      },
    ],
    elementContributions: {
      Aether: 1,
    },
    usesBoonRarity: true,
    blockStacking: true,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
    selectedDisposition: {
      kind: 'naturalSelection',
      slots: ['Melee', 'Secondary', 'Ranged', 'Rush', 'Mana'],
      levelCount: 8,
    },
  },
  {
    key: 'BurnConsumeBoon',
    label: 'Freezer Burn',
    freshOfferRarities: ['Duo'],
    equippedRarities: ['Duo'],
    offerRequirements: [
      {
        kind: 'all',
        requirements: [
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['DemeterWeaponBoon', 'DemeterSpecialBoon', 'DemeterCastBoon'],
          },
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['HestiaWeaponBoon', 'HestiaSpecialBoon', 'HestiaCastBoon'],
          },
        ],
      },
    ],
    elementContributions: {
      Aether: 1,
    },
    usesBoonRarity: true,
    blockStacking: true,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'ClearRootBoon',
    label: 'Cryo Pounder',
    freshOfferRarities: ['Duo'],
    equippedRarities: ['Duo'],
    offerRequirements: [
      {
        kind: 'all',
        requirements: [
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['HephaestusWeaponBoon', 'HephaestusSpecialBoon', 'HephaestusSprintBoon'],
          },
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['DemeterWeaponBoon', 'DemeterSpecialBoon', 'DemeterCastBoon'],
          },
        ],
      },
    ],
    elementContributions: {
      Aether: 1,
    },
    usesBoonRarity: true,
    blockStacking: true,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
] as const satisfies readonly RawTraitDeclaration[];

export const demeterGiver = {
  key: 'Demeter',
  label: 'Demeter',
  providerKind: 'olympian',
  shopAwareGodTrait: true,
  denialParticipates: true,
  priorityTraitKeys: [
    'DemeterWeaponBoon',
    'DemeterSpecialBoon',
    'DemeterCastBoon',
    'DemeterSprintBoon',
    'DemeterManaBoon',
  ],
  traitKeys: [
    'DemeterWeaponBoon',
    'DemeterSpecialBoon',
    'DemeterCastBoon',
    'DemeterSprintBoon',
    'DemeterManaBoon',
    'CastNovaBoon',
    'PlantHealthBoon',
    'BoonGrowthBoon',
    'ReserveManaHitShieldBoon',
    'SlowExAttackBoon',
    'CastAttachBoon',
    'RootDurationBoon',
    'ElementalDamageCapBoon',
    'InstantRootKill',
    'RootStrikeBoon',
    'KeepsakeLevelBoon',
    'GoodStuffBoon',
    'StormSpawnBoon',
    'MaxHealthDamageBoon',
    'BurnConsumeBoon',
    'ClearRootBoon',
    'SelfCastBoon',
  ],
  rarityPolicy: {
    kind: 'selectable',
    rarities: ['Common', 'Rare', 'Epic'],
  },
} as const satisfies RawTraitGiverDeclaration;

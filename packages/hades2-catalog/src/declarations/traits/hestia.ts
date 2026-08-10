import type { RawTraitDeclaration, RawTraitGiverDeclaration } from '../traits';

/** Source-closed trait declarations. Giver membership remains separate below. */
export const hestiaTraits = [
  {
    key: 'HestiaWeaponBoon',
    label: 'Flame Strike',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Fire: 1,
    },
    usesBoonRarity: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
    ordinaryBoonSlot: 'Melee',
  },
  {
    key: 'HestiaSpecialBoon',
    label: 'Flame Flourish',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Fire: 1,
    },
    usesBoonRarity: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
    ordinaryBoonSlot: 'Secondary',
  },
  {
    key: 'HestiaCastBoon',
    label: 'Smolder Ring',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Fire: 1,
    },
    usesBoonRarity: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
    ordinaryBoonSlot: 'Ranged',
  },
  {
    key: 'HestiaSprintBoon',
    label: 'Heat Rush',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Fire: 1,
    },
    usesBoonRarity: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
    ordinaryBoonSlot: 'Rush',
  },
  {
    key: 'HestiaManaBoon',
    label: 'Cardio Gain',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Fire: 1,
    },
    usesBoonRarity: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
    ordinaryBoonSlot: 'Mana',
  },
  {
    key: 'OmegaZeroBurnBoon',
    label: 'Highly Flammable',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [
      {
        kind: 'anyEquippedTrait',
        traitKeys: ['HestiaWeaponBoon', 'HestiaSpecialBoon', 'HestiaCastBoon'],
      },
    ],
    elementContributions: {
      Fire: 1,
    },
    usesBoonRarity: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'CastProjectileBoon',
    label: 'Glowing Coal',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [
      {
        kind: 'notEquippedTrait',
        traitKeys: ['HadesCastProjectileBoon', 'CastAnywhereBoon', 'CastLobBoon', 'SelfCastBoon'],
      },
    ],
    elementContributions: {
      Fire: 1,
    },
    usesBoonRarity: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'FireballManaSpecialBoon',
    label: 'Controlled Burn',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Fire: 1,
    },
    usesBoonRarity: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'BurnExplodeBoon',
    label: 'Flash Fry',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Fire: 1,
    },
    usesBoonRarity: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'BurnArmorBoon',
    label: 'Hot Pot',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [
      {
        kind: 'anyEquippedTrait',
        traitKeys: ['HestiaWeaponBoon', 'HestiaSpecialBoon', 'HestiaCastBoon'],
      },
    ],
    elementContributions: {
      Fire: 1,
    },
    usesBoonRarity: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'BurnStackBoon',
    label: 'Pyro Technique',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [
      {
        kind: 'anyEquippedTrait',
        traitKeys: ['HestiaWeaponBoon', 'HestiaSpecialBoon', 'HestiaCastBoon'],
      },
    ],
    elementContributions: {
      Fire: 1,
    },
    usesBoonRarity: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'AloneDamageBoon',
    label: 'Snuffed Candle',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Fire: 1,
    },
    usesBoonRarity: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'ElementalBaseDamageBoon',
    label: 'Slow Cooker',
    freshOfferRarities: ['Common'],
    equippedRarities: ['Common'],
    offerRequirements: [
      {
        kind: 'elementCount',
        element: 'Fire',
        minimum: 2,
      },
    ],
    elementContributions: {},
    usesBoonRarity: true,
    blockStacking: true,
    blockInRunRarify: true,
    excludeFromRarityCount: true,
  },
  {
    key: 'BurnSprintBoon',
    label: 'Fire Away',
    freshOfferRarities: ['Legendary'],
    equippedRarities: ['Legendary'],
    offerRequirements: [
      {
        kind: 'all',
        requirements: [
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['HestiaWeaponBoon', 'HestiaSpecialBoon', 'HestiaCastBoon'],
          },
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['BurnExplodeBoon', 'BurnArmorBoon', 'BurnStackBoon', 'OmegaZeroBurnBoon'],
          },
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['CastProjectileBoon', 'FireballManaSpecialBoon'],
          },
        ],
      },
    ],
    elementContributions: {
      Fire: 1,
    },
    usesBoonRarity: true,
    blockStacking: true,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'EchoBurnBoon',
    label: 'Thermal Dynamics',
    freshOfferRarities: ['Duo'],
    equippedRarities: ['Duo'],
    offerRequirements: [
      {
        kind: 'all',
        requirements: [
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['ZeusWeaponBoon', 'ZeusSpecialBoon'],
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
    key: 'SteamBoon',
    label: 'Scalding Vapor',
    freshOfferRarities: ['Duo'],
    equippedRarities: ['Duo'],
    offerRequirements: [
      {
        kind: 'all',
        requirements: [
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['PoseidonCastBoon', 'PoseidonStatusBoon'],
          },
          {
            kind: 'anyEquippedTrait',
            traitKeys: [
              'HestiaWeaponBoon',
              'HestiaSpecialBoon',
              'HestiaCastBoon',
              'HestiaSprintBoon',
              'FireballManaSpecialBoon',
              'CastProjectileBoon',
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
  },
] as const satisfies readonly RawTraitDeclaration[];

export const hestiaGiver = {
  key: 'Hestia',
  label: 'Hestia',
  providerKind: 'olympian',
  priorityTraitKeys: [
    'HestiaWeaponBoon',
    'HestiaSpecialBoon',
    'HestiaCastBoon',
    'HestiaSprintBoon',
    'HestiaManaBoon',
  ],
  traitKeys: [
    'HestiaWeaponBoon',
    'HestiaSpecialBoon',
    'HestiaCastBoon',
    'HestiaSprintBoon',
    'HestiaManaBoon',
    'OmegaZeroBurnBoon',
    'CastProjectileBoon',
    'FireballManaSpecialBoon',
    'BurnExplodeBoon',
    'BurnArmorBoon',
    'BurnStackBoon',
    'AloneDamageBoon',
    'ElementalBaseDamageBoon',
    'BurnSprintBoon',
    'EchoBurnBoon',
    'SteamBoon',
    'BurnConsumeBoon',
    'CoverRegenerationBoon',
    'BurnRefreshBoon',
    'DoubleMassiveAttackBoon',
    'ManaRestoreDamageBoon',
    'FireballRendBoon',
  ],
  rarityPolicy: {
    kind: 'selectable',
    rarities: ['Common', 'Rare', 'Epic'],
  },
  defaultOffer: {
    options: [
      {
        traitKey: 'HestiaWeaponBoon',
        rarity: 'Common',
      },
      {
        traitKey: 'HestiaSpecialBoon',
        rarity: 'Common',
      },
      {
        traitKey: 'HestiaCastBoon',
        rarity: 'Common',
      },
    ],
    selectedOption: 0,
  },
} as const satisfies RawTraitGiverDeclaration;

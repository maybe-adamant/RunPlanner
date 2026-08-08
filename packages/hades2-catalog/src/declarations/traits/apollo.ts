import type { RawTraitDeclaration, RawTraitGiverDeclaration } from '../traits';

/** Source-closed trait declarations. Giver membership remains separate below. */
export const apolloTraits = [
  {
    key: 'ApolloWeaponBoon',
    label: 'Nova Strike',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Air: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
    ordinaryBoonSlot: 'Melee',
  },
  {
    key: 'ApolloSpecialBoon',
    label: 'Nova Flourish',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Air: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
    ordinaryBoonSlot: 'Secondary',
  },
  {
    key: 'ApolloCastBoon',
    label: 'Solar Ring',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Fire: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
    ordinaryBoonSlot: 'Ranged',
  },
  {
    key: 'ApolloSprintBoon',
    label: 'Blinding Rush',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Fire: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
    ordinaryBoonSlot: 'Rush',
  },
  {
    key: 'ApolloManaBoon',
    label: 'Lucid Gain',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Air: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
    ordinaryBoonSlot: 'Mana',
  },
  {
    key: 'ApolloRetaliateBoon',
    label: 'Light Smite',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Fire: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'PerfectDamageBonusBoon',
    label: 'Perfect Image',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Air: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'BlindChanceBoon',
    label: 'Dazzling Display',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [
      {
        kind: 'anyEquippedTrait',
        traitKeys: ['ApolloWeaponBoon'],
      },
    ],
    elementContributions: {
      Fire: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'ApolloBlindBoon',
    label: 'Back Burner',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [
      {
        kind: 'anyEquippedTrait',
        traitKeys: ['ApolloCastBoon', 'ApolloSprintBoon', 'ApolloRetaliateBoon', 'BlindChanceBoon'],
      },
    ],
    elementContributions: {
      Fire: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'ApolloExCastBoon',
    label: 'Prominence Flare',
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
      Fire: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'ApolloCastAreaBoon',
    label: 'Super Nova',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Air: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'DoubleStrikeChanceBoon',
    label: 'Extra Dose',
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
      Air: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'ElementalRallyBoon',
    label: 'Self Healing',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic'],
    offerRequirements: [
      {
        kind: 'elementCount',
        element: 'Fire',
        minimum: 2,
      },
    ],
    elementContributions: {},
    isPersistentGodTrait: true,
    blockStacking: true,
    blockInRunRarify: true,
    excludeFromRarityCount: true,
  },
  {
    key: 'DoubleExManaBoon',
    label: 'Exceptional Talent',
    freshOfferRarities: ['Legendary'],
    equippedRarities: ['Legendary'],
    offerRequirements: [
      {
        kind: 'all',
        requirements: [
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['ApolloWeaponBoon', 'ApolloSpecialBoon'],
          },
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['ApolloCastBoon', 'ApolloSprintBoon', 'ApolloManaBoon'],
          },
          {
            kind: 'anyEquippedTrait',
            traitKeys: [
              'DoubleStrikeChanceBoon',
              'ApolloCastAreaBoon',
              'ApolloBlindBoon',
              'ApolloExCastBoon',
            ],
          },
        ],
      },
    ],
    elementContributions: {
      Fire: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: true,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'ApolloSecondStageCastBoon',
    label: 'Glorious Disaster',
    freshOfferRarities: ['Duo'],
    equippedRarities: ['Duo'],
    offerRequirements: [
      {
        kind: 'all',
        requirements: [
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['ApolloExCastBoon'],
          },
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['ZeusWeaponBoon', 'ZeusSpecialBoon', 'ZeusCastBoon', 'ZeusSprintBoon'],
          },
        ],
      },
    ],
    elementContributions: {
      Aether: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: true,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'RaiseDeadBoon',
    label: 'Sun Worshiper',
    freshOfferRarities: ['Duo'],
    equippedRarities: ['Duo'],
    offerRequirements: [
      {
        kind: 'all',
        requirements: [
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['HeraCastBoon', 'HeraSprintBoon', 'HeraManaBoon'],
          },
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['ApolloCastBoon', 'ApolloSprintBoon', 'ApolloManaBoon'],
          },
        ],
      },
    ],
    elementContributions: {
      Aether: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: true,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'PoseidonSplashSprintBoon',
    label: 'Beach Ball',
    freshOfferRarities: ['Duo'],
    equippedRarities: ['Duo'],
    offerRequirements: [
      {
        kind: 'all',
        requirements: [
          {
            kind: 'anyEquippedTrait',
            traitKeys: [
              'ApolloWeaponBoon',
              'ApolloSpecialBoon',
              'ApolloCastBoon',
              'ApolloSprintBoon',
              'ApolloManaBoon',
            ],
          },
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
            traitKeys: ['ApolloSprintBoon', 'PoseidonSprintBoon'],
          },
        ],
      },
    ],
    elementContributions: {
      Aether: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: true,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'StormSpawnBoon',
    label: 'Tropical Cyclone',
    freshOfferRarities: ['Duo'],
    equippedRarities: ['Duo'],
    offerRequirements: [
      {
        kind: 'all',
        requirements: [
          {
            kind: 'anyEquippedTrait',
            traitKeys: [
              'ApolloWeaponBoon',
              'ApolloSpecialBoon',
              'ApolloCastBoon',
              'ApolloSprintBoon',
              'ApolloManaBoon',
            ],
          },
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['DemeterSprintBoon', 'CastNovaBoon'],
          },
        ],
      },
    ],
    elementContributions: {
      Aether: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: true,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'CoverRegenerationBoon',
    label: 'Warm Breeze',
    freshOfferRarities: ['Duo'],
    equippedRarities: ['Duo'],
    offerRequirements: [
      {
        kind: 'all',
        requirements: [
          {
            kind: 'anyEquippedTrait',
            traitKeys: [
              'ApolloCastBoon',
              'ApolloSprintBoon',
              'ApolloRetaliateBoon',
              'BlindChanceBoon',
            ],
          },
          {
            kind: 'anyEquippedTrait',
            traitKeys: [
              'HestiaWeaponBoon',
              'HestiaSpecialBoon',
              'HestiaCastBoon',
              'HestiaSprintBoon',
              'HestiaManaBoon',
            ],
          },
        ],
      },
    ],
    elementContributions: {
      Aether: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: true,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'BlindClearBoon',
    label: 'Rude Awakening',
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
            traitKeys: [
              'ApolloCastBoon',
              'ApolloSprintBoon',
              'ApolloRetaliateBoon',
              'BlindChanceBoon',
            ],
          },
        ],
      },
    ],
    elementContributions: {
      Aether: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: true,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'DoubleSwordBoon',
    label: 'Cutting Edge',
    freshOfferRarities: ['Duo'],
    equippedRarities: ['Duo'],
    offerRequirements: [
      {
        kind: 'all',
        requirements: [
          {
            kind: 'anyEquippedTrait',
            traitKeys: [
              'AresCastBoon',
              'AresSprintBoon',
              'OmegaDelayedDamageBoon',
              'RendBloodDropBoon',
            ],
          },
          {
            kind: 'anyEquippedTrait',
            traitKeys: [
              'ApolloWeaponBoon',
              'ApolloSpecialBoon',
              'ApolloCastBoon',
              'ApolloSprintBoon',
              'ApolloManaBoon',
            ],
          },
        ],
      },
    ],
    elementContributions: {
      Aether: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: true,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
] as const satisfies readonly RawTraitDeclaration[];

export const apolloGiver = {
  key: 'Apollo',
  label: 'Apollo',
  providerKind: 'olympian',
  priorityTraitKeys: [
    'ApolloWeaponBoon',
    'ApolloSpecialBoon',
    'ApolloCastBoon',
    'ApolloSprintBoon',
    'ApolloManaBoon',
  ],
  traitKeys: [
    'ApolloWeaponBoon',
    'ApolloSpecialBoon',
    'ApolloCastBoon',
    'ApolloSprintBoon',
    'ApolloManaBoon',
    'ApolloRetaliateBoon',
    'PerfectDamageBonusBoon',
    'BlindChanceBoon',
    'ApolloBlindBoon',
    'ApolloExCastBoon',
    'ApolloCastAreaBoon',
    'DoubleStrikeChanceBoon',
    'ElementalRallyBoon',
    'DoubleExManaBoon',
    'ApolloSecondStageCastBoon',
    'RaiseDeadBoon',
    'PoseidonSplashSprintBoon',
    'StormSpawnBoon',
    'ManaBurstCountBoon',
    'CoverRegenerationBoon',
    'BlindClearBoon',
    'DoubleSwordBoon',
  ],
  rarityPolicy: {
    kind: 'selectable',
    rarities: ['Common', 'Rare', 'Epic'],
  },
  defaultOffer: {
    options: [
      {
        traitKey: 'ApolloWeaponBoon',
        rarity: 'Common',
      },
      {
        traitKey: 'ApolloSpecialBoon',
        rarity: 'Common',
      },
      {
        traitKey: 'ApolloCastBoon',
        rarity: 'Common',
      },
    ],
    selectedOption: 0,
  },
} as const satisfies RawTraitGiverDeclaration;

import type { RawTraitDeclaration, RawTraitGiverDeclaration } from '../traits';

/** Source-closed trait declarations. Giver membership remains separate below. */
export const aresTraits = [
  {
    key: 'AresWeaponBoon',
    label: 'Vicious Strike',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Earth: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
    ordinaryBoonSlot: 'Melee',
  },
  {
    key: 'AresSpecialBoon',
    label: 'Vicious Flourish',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Earth: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
    ordinaryBoonSlot: 'Secondary',
  },
  {
    key: 'AresCastBoon',
    label: 'Sword Ring',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Earth: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
    ordinaryBoonSlot: 'Ranged',
  },
  {
    key: 'AresSprintBoon',
    label: 'Stabbing Rush',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Earth: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
    ordinaryBoonSlot: 'Rush',
  },
  {
    key: 'AresManaBoon',
    label: 'Grisly Gain',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Earth: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
    ordinaryBoonSlot: 'Mana',
  },
  {
    key: 'AresExCastBoon',
    label: 'Meat Grinder',
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
    isPersistentGodTrait: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'RendBloodDropBoon',
    label: 'Profuse Bleeding',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [
      {
        kind: 'anyEquippedTrait',
        traitKeys: ['AresWeaponBoon', 'AresSpecialBoon', 'AresManaBoon', 'BloodDropRevengeBoon'],
      },
    ],
    elementContributions: {
      Earth: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'AresStatusDoubleDamageBoon',
    label: 'Grievous Blow',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [
      {
        kind: 'anyEquippedTrait',
        traitKeys: ['AresWeaponBoon', 'AresSpecialBoon'],
      },
    ],
    elementContributions: {
      Earth: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'BloodDropRevengeBoon',
    label: 'Visceral Impact',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Earth: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'MissingHealthCritBoon',
    label: 'Mutual Destruction',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Earth: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: true,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'LowHealthLifestealBoon',
    label: 'Blood Spree',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Earth: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: true,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'OmegaDelayedDamageBoon',
    label: 'Cut Above',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Earth: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'ElementalOlympianDamageBoon',
    label: 'Rallying Cry',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic'],
    offerRequirements: [
      {
        kind: 'elementCount',
        element: 'Earth',
        minimum: 4,
      },
    ],
    elementContributions: {},
    isPersistentGodTrait: true,
    blockStacking: true,
    blockInRunRarify: true,
    excludeFromRarityCount: true,
  },
  {
    key: 'DoubleBloodDropBoon',
    label: 'Sanguinary Savor',
    freshOfferRarities: ['Legendary'],
    equippedRarities: ['Legendary'],
    offerRequirements: [
      {
        kind: 'all',
        requirements: [
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['AresWeaponBoon', 'AresSpecialBoon'],
          },
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['AresManaBoon', 'BloodDropRevengeBoon'],
          },
          {
            kind: 'anyEquippedTrait',
            traitKeys: [
              'AresExCastBoon',
              'AresStatusDoubleDamageBoon',
              'MissingHealthCritBoon',
              'LowHealthLifestealBoon',
              'OmegaDelayedDamageBoon',
            ],
          },
        ],
      },
    ],
    elementContributions: {
      Earth: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: true,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'SelfCastBoon',
    label: 'Hostile Environment',
    freshOfferRarities: ['Duo'],
    equippedRarities: ['Duo'],
    offerRequirements: [
      {
        kind: 'all',
        requirements: [
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['AresCastBoon', 'AresExCastBoon', 'OmegaDelayedDamageBoon'],
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
        ],
      },
      {
        kind: 'notEquippedTrait',
        traitKeys: [
          'CastProjectileBoon',
          'CastAnywhereBoon',
          'HadesCastProjectileBoon',
          'CastLobBoon',
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
    key: 'AutoRevengeBoon',
    label: 'Heinous Affront',
    freshOfferRarities: ['Duo'],
    equippedRarities: ['Duo'],
    offerRequirements: [
      {
        kind: 'all',
        requirements: [
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['AresWeaponBoon', 'AresSpecialBoon'],
          },
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
            traitKeys: ['BloodDropRevengeBoon', 'ApolloRetaliateBoon', 'BoltRetaliateBoon'],
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
    key: 'BloodRetentionBoon',
    label: 'Universal Donor',
    freshOfferRarities: ['Duo'],
    equippedRarities: ['Duo'],
    offerRequirements: [
      {
        kind: 'all',
        requirements: [
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['AresManaBoon', 'BloodDropRevengeBoon'],
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
    isPersistentGodTrait: true,
    blockStacking: true,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'RapidSwordBoon',
    label: 'Coffin Nail',
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
              'HephaestusWeaponBoon',
              'HephaestusSpecialBoon',
              'HephaestusCastBoon',
              'HephaestusSprintBoon',
              'HephaestusManaBoon',
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
    key: 'DoubleSplashBoon',
    label: 'Arterial Spray',
    freshOfferRarities: ['Duo'],
    equippedRarities: ['Duo'],
    offerRequirements: [
      {
        kind: 'all',
        requirements: [
          {
            kind: 'anyEquippedTrait',
            traitKeys: [
              'AresWeaponBoon',
              'AresSpecialBoon',
              'AresCastBoon',
              'AresSprintBoon',
              'AresManaBoon',
            ],
          },
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['PoseidonWeaponBoon', 'PoseidonSpecialBoon'],
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
    key: 'FireballRendBoon',
    label: 'Fourth Degree',
    freshOfferRarities: ['Duo'],
    equippedRarities: ['Duo'],
    offerRequirements: [
      {
        kind: 'all',
        requirements: [
          {
            kind: 'anyEquippedTrait',
            traitKeys: [
              'AresWeaponBoon',
              'AresSpecialBoon',
              'AresCastBoon',
              'AresSprintBoon',
              'AresManaBoon',
            ],
          },
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['FireballManaSpecialBoon', 'CastProjectileBoon'],
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

export const aresGiver = {
  key: 'Ares',
  label: 'Ares',
  providerKind: 'olympian',
  traitKeys: [
    'AresWeaponBoon',
    'AresSpecialBoon',
    'AresCastBoon',
    'AresSprintBoon',
    'AresManaBoon',
    'AresExCastBoon',
    'RendBloodDropBoon',
    'AresStatusDoubleDamageBoon',
    'BloodDropRevengeBoon',
    'MissingHealthCritBoon',
    'LowHealthLifestealBoon',
    'OmegaDelayedDamageBoon',
    'ElementalOlympianDamageBoon',
    'DoubleBloodDropBoon',
    'SelfCastBoon',
    'AutoRevengeBoon',
    'BloodRetentionBoon',
    'RapidSwordBoon',
    'DoubleSplashBoon',
    'DoubleSwordBoon',
    'FireballRendBoon',
    'BloodManaBurstBoon',
  ],
  rarityPolicy: {
    kind: 'selectable',
    rarities: ['Common', 'Rare', 'Epic'],
  },
  defaultOffer: {
    options: [
      {
        traitKey: 'AresWeaponBoon',
        rarity: 'Common',
      },
      {
        traitKey: 'AresSpecialBoon',
        rarity: 'Common',
      },
      {
        traitKey: 'AresCastBoon',
        rarity: 'Common',
      },
    ],
    selectedOption: 0,
  },
} as const satisfies RawTraitGiverDeclaration;

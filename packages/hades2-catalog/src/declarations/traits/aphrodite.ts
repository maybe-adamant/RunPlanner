import type { RawTraitDeclaration, RawTraitGiverDeclaration } from '../traits';

/** Source-closed trait declarations. Giver membership remains separate below. */
export const aphroditeTraits = [
  {
    key: 'AphroditeWeaponBoon',
    label: 'Flutter Strike',
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
    key: 'AphroditeSpecialBoon',
    label: 'Flutter Flourish',
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
    key: 'AphroditeCastBoon',
    label: 'Rapture Ring',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Air: 1,
    },
    usesBoonRarity: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
    equipmentSlot: 'Ranged',
  },
  {
    key: 'AphroditeSprintBoon',
    label: 'Passion Rush',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Air: 1,
    },
    usesBoonRarity: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
    equipmentSlot: 'Rush',
  },
  {
    key: 'AphroditeManaBoon',
    label: 'Glamour Gain',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Air: 1,
    },
    usesBoonRarity: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
    equipmentSlot: 'Mana',
  },
  {
    key: 'HighHealthOffenseBoon',
    label: 'Shameless Attitude',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Air: 1,
    },
    usesBoonRarity: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'HealthRewardBonusBoon',
    label: 'Spiritual Affirmation',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Air: 1,
    },
    usesBoonRarity: true,
    blockStacking: true,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'DoorHealToFullBoon',
    label: 'Healthy Rebound',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [
      {
        kind: 'anyEquippedTrait',
        traitKeys: ['HighHealthOffenseBoon'],
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
    key: 'WeakPotencyBoon',
    label: 'Broken Resolve',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [
      {
        kind: 'anyEquippedTrait',
        traitKeys: ['AphroditeCastBoon', 'AphroditeSprintBoon', 'AphroditeManaBoon'],
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
    key: 'WeakVulnerabilityBoon',
    label: 'Sweet Surrender',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [
      {
        kind: 'anyEquippedTrait',
        traitKeys: ['AphroditeCastBoon', 'AphroditeSprintBoon', 'AphroditeManaBoon'],
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
    key: 'ManaBurstBoon',
    label: 'Heart Breaker',
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
    key: 'FocusRawDamageBoon',
    label: 'Secret Crush',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Air: 1,
    },
    usesBoonRarity: true,
    blockStacking: true,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'ElementalDodgeBoon',
    label: 'Wispy Wiles',
    freshOfferRarities: ['Common'],
    equippedRarities: ['Common'],
    offerRequirements: [
      {
        kind: 'elementCount',
        element: 'Air',
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
    key: 'RandomStatusBoon',
    label: 'Nervous Wreck',
    freshOfferRarities: ['Legendary'],
    equippedRarities: ['Legendary'],
    offerRequirements: [
      {
        kind: 'all',
        requirements: [
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['AphroditeCastBoon', 'AphroditeSprintBoon', 'AphroditeManaBoon'],
          },
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['AphroditeWeaponBoon', 'AphroditeSpecialBoon'],
          },
          {
            kind: 'anyEquippedTrait',
            traitKeys: [
              'WeakPotencyBoon',
              'WeakVulnerabilityBoon',
              'HighHealthOffenseBoon',
              'FocusRawDamageBoon',
            ],
          },
        ],
      },
    ],
    elementContributions: {
      Air: 1,
    },
    usesBoonRarity: true,
    blockStacking: true,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'SprintEchoBoon',
    label: 'Romantic Spark',
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
            traitKeys: [
              'AphroditeWeaponBoon',
              'AphroditeSpecialBoon',
              'AphroditeCastBoon',
              'AphroditeSprintBoon',
              'AphroditeManaBoon',
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
  {
    key: 'CharmCrowdBoon',
    label: 'Ecstatic Obsession',
    freshOfferRarities: ['Duo'],
    equippedRarities: ['Duo'],
    offerRequirements: [
      {
        kind: 'all',
        requirements: [
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['HeraWeaponBoon', 'HeraSpecialBoon', 'HeraCastBoon', 'HeraSprintBoon'],
          },
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['AphroditeCastBoon', 'AphroditeSprintBoon', 'AphroditeManaBoon'],
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
    key: 'AllCloseBoon',
    label: 'Island Getaway',
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
            traitKeys: ['AphroditeWeaponBoon', 'AphroditeSpecialBoon'],
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
    key: 'MaxHealthDamageBoon',
    label: 'Hearty Appetite',
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
              'DemeterManaBoon',
              'DemeterSprintBoon',
              'PlantHealthBoon',
            ],
          },
          {
            kind: 'anyEquippedTrait',
            traitKeys: [
              'AphroditeWeaponBoon',
              'AphroditeSpecialBoon',
              'AphroditeManaBoon',
              'AphroditeSprintBoon',
              'DoorHealToFullBoon',
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
  {
    key: 'ManaBurstCountBoon',
    label: 'Sunny Disposition',
    freshOfferRarities: ['Duo'],
    equippedRarities: ['Duo'],
    offerRequirements: [
      {
        kind: 'all',
        requirements: [
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['ManaBurstBoon'],
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
    usesBoonRarity: true,
    blockStacking: true,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'BurnRefreshBoon',
    label: 'Burning Desire',
    freshOfferRarities: ['Duo'],
    equippedRarities: ['Duo'],
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
            traitKeys: ['AphroditeCastBoon', 'AphroditeSprintBoon', 'AphroditeManaBoon'],
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
    key: 'SlamManaBurstBoon',
    label: 'Love Handles',
    freshOfferRarities: ['Duo'],
    equippedRarities: ['Duo'],
    offerRequirements: [
      {
        kind: 'all',
        requirements: [
          {
            kind: 'anyEquippedTrait',
            traitKeys: [
              'AphroditeWeaponBoon',
              'AphroditeSpecialBoon',
              'AphroditeCastBoon',
              'AphroditeSprintBoon',
              'AphroditeManaBoon',
            ],
          },
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['HephaestusWeaponBoon', 'HephaestusSpecialBoon', 'HephaestusSprintBoon'],
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
    key: 'BloodManaBurstBoon',
    label: 'Carnal Pleasure',
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
              'AphroditeWeaponBoon',
              'AphroditeSpecialBoon',
              'AphroditeCastBoon',
              'AphroditeSprintBoon',
              'AphroditeManaBoon',
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

export const aphroditeGiver = {
  key: 'Aphrodite',
  label: 'Aphrodite',
  providerKind: 'olympian',
  denialParticipates: true,
  priorityTraitKeys: [
    'AphroditeWeaponBoon',
    'AphroditeSpecialBoon',
    'AphroditeCastBoon',
    'AphroditeSprintBoon',
    'AphroditeManaBoon',
  ],
  traitKeys: [
    'AphroditeWeaponBoon',
    'AphroditeSpecialBoon',
    'AphroditeCastBoon',
    'AphroditeSprintBoon',
    'AphroditeManaBoon',
    'HighHealthOffenseBoon',
    'HealthRewardBonusBoon',
    'DoorHealToFullBoon',
    'WeakPotencyBoon',
    'WeakVulnerabilityBoon',
    'ManaBurstBoon',
    'FocusRawDamageBoon',
    'ElementalDodgeBoon',
    'RandomStatusBoon',
    'SprintEchoBoon',
    'CharmCrowdBoon',
    'AllCloseBoon',
    'MaxHealthDamageBoon',
    'ManaBurstCountBoon',
    'BurnRefreshBoon',
    'SlamManaBurstBoon',
    'BloodManaBurstBoon',
  ],
  rarityPolicy: {
    kind: 'selectable',
    rarities: ['Common', 'Rare', 'Epic'],
  },
} as const satisfies RawTraitGiverDeclaration;

import type { RawTraitDeclaration, RawTraitGiverDeclaration } from '../traits';

/** Source-closed trait declarations. Giver membership remains separate below. */
export const hephaestusTraits = [
  {
    key: 'HephaestusWeaponBoon',
    label: 'Volcanic Strike',
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
    key: 'HephaestusSpecialBoon',
    label: 'Volcanic Flourish',
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
    key: 'HephaestusCastBoon',
    label: 'Anvil Ring',
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
    ordinaryBoonSlot: 'Ranged',
  },
  {
    key: 'HephaestusSprintBoon',
    label: 'Smithy Rush',
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
    key: 'HephaestusManaBoon',
    label: 'Tough Gain',
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
    ordinaryBoonSlot: 'Mana',
  },
  {
    key: 'MassiveDamageBoon',
    label: 'Grand Caldera',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [
      {
        kind: 'anyEquippedTrait',
        traitKeys: ['HephaestusWeaponBoon', 'HephaestusSpecialBoon', 'HephaestusSprintBoon'],
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
    key: 'AntiArmorBoon',
    label: 'Molten Touch',
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
    key: 'HeavyArmorBoon',
    label: 'Heavy Metal',
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
    key: 'ArmorBoon',
    label: 'Trusty Shield',
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
  },
  {
    key: 'EncounterStartDefenseBuffBoon',
    label: 'Security System',
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
  },
  {
    key: 'ManaToHealthBoon',
    label: 'Uncanny Fortitude',
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
    key: 'MassiveKnockupBoon',
    label: 'Furnace Blast',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [
      {
        kind: 'anyEquippedTrait',
        traitKeys: ['HephaestusWeaponBoon', 'HephaestusSpecialBoon', 'HephaestusSprintBoon'],
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
    key: 'ElementalDamageBoon',
    label: 'Martial Art',
    freshOfferRarities: ['Common'],
    equippedRarities: ['Common'],
    offerRequirements: [
      {
        kind: 'elementCount',
        element: 'Earth',
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
    key: 'WeaponUpgradeBoon',
    label: 'Premium Service',
    freshOfferRarities: ['Legendary'],
    equippedRarities: ['Legendary'],
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
            traitKeys: ['HeavyArmorBoon', 'ArmorBoon', 'EncounterStartDefenseBuffBoon'],
          },
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['MassiveDamageBoon', 'AntiArmorBoon', 'MassiveKnockupBoon'],
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
    key: 'ManaShieldBoon',
    label: 'Brave Face',
    freshOfferRarities: ['Duo'],
    equippedRarities: ['Duo'],
    offerRequirements: [
      {
        kind: 'all',
        requirements: [
          {
            kind: 'anyEquippedTrait',
            traitKeys: [
              'DamageShareRetaliateBoon',
              'LinkedDeathDamageBoon',
              'DamageSharePotencyBoon',
              'SpawnCastDamageBoon',
              'OmegaHeraProjectileBoon',
            ],
          },
          {
            kind: 'anyEquippedTrait',
            traitKeys: [
              'MassiveDamageBoon',
              'AntiArmorBoon',
              'HeavyArmorBoon',
              'ArmorBoon',
              'EncounterStartDefenseBuffBoon',
              'ManaToHealthBoon',
              'MassiveKnockupBoon',
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
    key: 'ReboundingSparkBoon',
    label: 'Master Conductor',
    freshOfferRarities: ['Duo'],
    equippedRarities: ['Duo'],
    offerRequirements: [
      {
        kind: 'all',
        requirements: [
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['FocusLightningBoon'],
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
    usesBoonRarity: true,
    blockStacking: true,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'MassiveCastBoon',
    label: 'Seismic Servo',
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
    key: 'DoubleMassiveAttackBoon',
    label: 'Chain Reaction',
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
    usesBoonRarity: true,
    blockStacking: true,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
] as const satisfies readonly RawTraitDeclaration[];

export const hephaestusGiver = {
  key: 'Hephaestus',
  label: 'Hephaestus',
  providerKind: 'olympian',
  priorityTraitKeys: [
    'HephaestusWeaponBoon',
    'HephaestusSpecialBoon',
    'HephaestusCastBoon',
    'HephaestusSprintBoon',
    'HephaestusManaBoon',
  ],
  traitKeys: [
    'HephaestusWeaponBoon',
    'HephaestusSpecialBoon',
    'HephaestusCastBoon',
    'HephaestusSprintBoon',
    'HephaestusManaBoon',
    'MassiveDamageBoon',
    'AntiArmorBoon',
    'HeavyArmorBoon',
    'ArmorBoon',
    'EncounterStartDefenseBuffBoon',
    'ManaToHealthBoon',
    'MassiveKnockupBoon',
    'ElementalDamageBoon',
    'WeaponUpgradeBoon',
    'ManaShieldBoon',
    'ReboundingSparkBoon',
    'MassiveCastBoon',
    'ClearRootBoon',
    'BlindClearBoon',
    'SlamManaBurstBoon',
    'DoubleMassiveAttackBoon',
    'RapidSwordBoon',
  ],
  rarityPolicy: {
    kind: 'selectable',
    rarities: ['Common', 'Rare', 'Epic'],
  },
  defaultOffer: {
    options: [
      {
        traitKey: 'HephaestusWeaponBoon',
        rarity: 'Common',
      },
      {
        traitKey: 'HephaestusSpecialBoon',
        rarity: 'Common',
      },
      {
        traitKey: 'HephaestusCastBoon',
        rarity: 'Common',
      },
    ],
    selectedOption: 0,
  },
} as const satisfies RawTraitGiverDeclaration;

import type { RawTraitDeclaration, RawTraitGiverDeclaration } from '../traits';

/** Source-closed trait declarations. Giver membership remains separate below. */
export const heraTraits = [
  {
    key: 'HeraWeaponBoon',
    label: 'Sworn Strike',
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
    key: 'HeraSpecialBoon',
    label: 'Sworn Flourish',
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
    key: 'HeraCastBoon',
    label: 'Engagement Ring',
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
    ordinaryBoonSlot: 'Ranged',
  },
  {
    key: 'HeraSprintBoon',
    label: 'Nexus Rush',
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
    key: 'HeraManaBoon',
    label: 'Born Gain',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Water: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
    ordinaryBoonSlot: 'Mana',
  },
  {
    key: 'DamageShareRetaliateBoon',
    label: 'Extended Family',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [],
    elementContributions: {
      Fire: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: true,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'LinkedDeathDamageBoon',
    label: 'Dying Wish',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [
      {
        kind: 'anyEquippedTrait',
        traitKeys: ['HeraWeaponBoon', 'HeraSpecialBoon', 'HeraCastBoon', 'HeraSprintBoon'],
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
    key: 'BoonDecayBoon',
    label: 'Bridal Glow',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [
      {
        kind: 'superchargeableTrait',
      },
    ],
    elementContributions: {
      Water: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: true,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'DamageSharePotencyBoon',
    label: 'Hereditary Bane',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [
      {
        kind: 'anyEquippedTrait',
        traitKeys: ['HeraWeaponBoon', 'HeraSpecialBoon', 'HeraCastBoon', 'HeraSprintBoon'],
      },
    ],
    elementContributions: {
      Water: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'SpawnCastDamageBoon',
    label: 'Rousing Reception',
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
      Air: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'CommonGlobalDamageBoon',
    label: 'Uncommon Grace',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    offerRequirements: [
      {
        kind: 'godBoonRarityCount',
        rarity: 'Common',
        minimum: 0,
        maximum: 0,
      },
    ],
    elementContributions: {
      Fire: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: false,
    blockInRunRarify: false,
    excludeFromRarityCount: true,
  },
  {
    key: 'OmegaHeraProjectileBoon',
    label: 'Fine Line',
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
    key: 'ElementalRarityUpgradeBoon',
    label: 'Proper Upbringing',
    freshOfferRarities: ['Common', 'Rare', 'Epic'],
    equippedRarities: ['Common', 'Rare', 'Epic'],
    offerRequirements: [
      {
        kind: 'all',
        requirements: [
          {
            kind: 'elementCount',
            element: 'Fire',
            minimum: 1,
          },
          {
            kind: 'elementCount',
            element: 'Earth',
            minimum: 1,
          },
          {
            kind: 'elementCount',
            element: 'Air',
            minimum: 1,
          },
          {
            kind: 'elementCount',
            element: 'Water',
            minimum: 1,
          },
        ],
      },
    ],
    elementContributions: {},
    isPersistentGodTrait: true,
    blockStacking: true,
    blockInRunRarify: true,
    excludeFromRarityCount: true,
    rarityFloorEffect: {
      activationElementMinimums: {
        Fire: 2,
        Earth: 2,
        Air: 2,
        Water: 2,
      },
      fromRarity: 'Common',
      minimumRarity: 'Rare',
    },
  },
  {
    key: 'AllElementalBoon',
    label: 'All Together',
    freshOfferRarities: ['Legendary'],
    equippedRarities: ['Legendary'],
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
            traitKeys: ['BoonDecayBoon', 'CommonGlobalDamageBoon', 'OmegaHeraProjectileBoon'],
          },
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['DamageSharePotencyBoon', 'SpawnCastDamageBoon'],
          },
        ],
      },
    ],
    elementContributions: {
      Aether: 1,
      Earth: 1,
      Air: 1,
      Fire: 1,
      Water: 1,
    },
    isPersistentGodTrait: true,
    blockStacking: true,
    blockInRunRarify: false,
    excludeFromRarityCount: false,
  },
  {
    key: 'SuperSacrificeBoonHera',
    label: "Queen's Ransom",
    freshOfferRarities: ['Duo'],
    equippedRarities: ['Duo'],
    offerRequirements: [
      {
        kind: 'all',
        requirements: [
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
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['ZeusCastBoon', 'ZeusManaBoon', 'ZeusSprintBoon'],
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
    key: 'MoneyDamageBoon',
    label: 'Ripple Effect',
    freshOfferRarities: ['Duo'],
    equippedRarities: ['Duo'],
    offerRequirements: [
      {
        kind: 'all',
        requirements: [
          {
            kind: 'anyEquippedTrait',
            traitKeys: [
              'HeraWeaponBoon',
              'HeraSpecialBoon',
              'HeraCastBoon',
              'OmegaHeraProjectileBoon',
            ],
          },
          {
            kind: 'anyEquippedTrait',
            traitKeys: [
              'PoseidonWeaponBoon',
              'PoseidonSpecialBoon',
              'PoseidonCastBoon',
              'OmegaPoseidonProjectileBoon',
            ],
          },
          {
            kind: 'anyEquippedTrait',
            traitKeys: ['OmegaHeraProjectileBoon', 'OmegaPoseidonProjectileBoon'],
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
    key: 'ManaRestoreDamageBoon',
    label: 'Incandescent Aura',
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
] as const satisfies readonly RawTraitDeclaration[];

export const heraGiver = {
  key: 'Hera',
  label: 'Hera',
  providerKind: 'olympian',
  priorityTraitKeys: [
    'HeraWeaponBoon',
    'HeraSpecialBoon',
    'HeraCastBoon',
    'HeraSprintBoon',
    'HeraManaBoon',
  ],
  traitKeys: [
    'HeraWeaponBoon',
    'HeraSpecialBoon',
    'HeraCastBoon',
    'HeraSprintBoon',
    'HeraManaBoon',
    'DamageShareRetaliateBoon',
    'LinkedDeathDamageBoon',
    'BoonDecayBoon',
    'DamageSharePotencyBoon',
    'SpawnCastDamageBoon',
    'CommonGlobalDamageBoon',
    'OmegaHeraProjectileBoon',
    'ElementalRarityUpgradeBoon',
    'AllElementalBoon',
    'SuperSacrificeBoonHera',
    'MoneyDamageBoon',
    'KeepsakeLevelBoon',
    'RaiseDeadBoon',
    'ManaRestoreDamageBoon',
    'CharmCrowdBoon',
    'ManaShieldBoon',
    'BloodRetentionBoon',
  ],
  rarityPolicy: {
    kind: 'selectable',
    rarities: ['Common', 'Rare', 'Epic'],
  },
  defaultOffer: {
    options: [
      {
        traitKey: 'HeraWeaponBoon',
        rarity: 'Common',
      },
      {
        traitKey: 'HeraSpecialBoon',
        rarity: 'Common',
      },
      {
        traitKey: 'HeraCastBoon',
        rarity: 'Common',
      },
    ],
    selectedOption: 0,
  },
} as const satisfies RawTraitGiverDeclaration;

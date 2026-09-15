import type { RawTraitDeclaration, RawTraitGiverDeclaration } from './types';

const raritylessNpcTrait = {
  rarityDomain: 'none',
  elementContributions: {},
  usesBoonRarity: false,
  blockStacking: false,
  blockInRunRarify: false,
  excludeFromRarityCount: false,
} as const;

/** Icarus' player-rarityless field-NPC pool under the supported normal-run baseline. */
export const icarusTraits = [
  {
    key: 'FocusAttackDamageTrait',
    label: 'Ingenious Strike',
    ...raritylessNpcTrait,
    linkedBoonRequirements: [],
    eligibilityRequirements: [
      {
        kind: 'anyEquippedTrait',
        traitKeys: [
          'AphroditeWeaponBoon',
          'ApolloWeaponBoon',
          'AresWeaponBoon',
          'DemeterWeaponBoon',
          'HephaestusWeaponBoon',
          'HeraWeaponBoon',
          'HestiaWeaponBoon',
          'PoseidonWeaponBoon',
          'ZeusWeaponBoon',
        ],
      },
    ],
    selectedDisposition: {
      kind: 'upgradeOccupiedBoonSlot',
      slot: 'Melee',
      levelCount: 3,
    },
  },
  {
    key: 'FocusSpecialDamageTrait',
    label: 'Ingenious Flourish',
    ...raritylessNpcTrait,
    linkedBoonRequirements: [],
    eligibilityRequirements: [
      {
        kind: 'anyEquippedTrait',
        traitKeys: [
          'AphroditeSpecialBoon',
          'ApolloSpecialBoon',
          'AresSpecialBoon',
          'DemeterSpecialBoon',
          'HephaestusSpecialBoon',
          'HeraSpecialBoon',
          'HestiaSpecialBoon',
          'PoseidonSpecialBoon',
          'ZeusSpecialBoon',
        ],
      },
    ],
    selectedDisposition: {
      kind: 'upgradeOccupiedBoonSlot',
      slot: 'Secondary',
      levelCount: 3,
    },
  },
  {
    key: 'OmegaExplodeBoon',
    label: 'Explosive Intent',
    ...raritylessNpcTrait,
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    key: 'CastHazardBoon',
    label: 'Hazard Boom',
    ...raritylessNpcTrait,
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    key: 'BreakInvincibleArmorBoon',
    label: 'Protective Coating',
    ...raritylessNpcTrait,
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    key: 'BreakExplosiveArmorBoon',
    label: 'Volatile Coating',
    ...raritylessNpcTrait,
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    key: 'SupplyDropBoon',
    label: 'Supply Chain',
    ...raritylessNpcTrait,
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
    selectedDisposition: {
      kind: 'producePickups',
      producerLifecycleKey: 'GeneratedTraitPickup',
      pickups: [
        { key: 'pom1', rewardType: 'StoreRewardRandomStack' },
        { key: 'pom2', rewardType: 'StoreRewardRandomStack' },
      ],
      clock: { kind: 'qualifyingEncounterEndEffects', interval: 7 },
    },
  },
  {
    key: 'UpgradeHammerBoon',
    label: 'Latest Model',
    ...raritylessNpcTrait,
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
    targetedAcquisition: {
      kind: 'upgradeHammerToRank2',
      target: 'upgradableHammer',
    },
  },
] as const satisfies readonly RawTraitDeclaration[];

export const icarusGiver = {
  key: 'Icarus',
  label: 'Icarus',
  providerKind: 'npc',
  priorityTraitKeys: [],
  traitKeys: [
    'FocusAttackDamageTrait',
    'FocusSpecialDamageTrait',
    'OmegaExplodeBoon',
    'CastHazardBoon',
    'BreakInvincibleArmorBoon',
    'BreakExplosiveArmorBoon',
    'SupplyDropBoon',
    'UpgradeHammerBoon',
  ],
  rarityPolicy: { kind: 'none' },
} as const satisfies RawTraitGiverDeclaration;

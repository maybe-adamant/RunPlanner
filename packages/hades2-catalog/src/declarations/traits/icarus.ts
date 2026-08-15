import type { RawTraitDeclaration, RawTraitGiverDeclaration } from '../traits';

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
    offerRequirements: [{ kind: 'ordinaryBoonSlotOccupied', slot: 'Melee' }],
  },
  {
    key: 'FocusSpecialDamageTrait',
    label: 'Ingenious Flourish',
    ...raritylessNpcTrait,
    offerRequirements: [{ kind: 'ordinaryBoonSlotOccupied', slot: 'Secondary' }],
  },
  {
    key: 'OmegaExplodeBoon',
    label: 'Explosive Intent',
    ...raritylessNpcTrait,
    offerRequirements: [],
  },
  {
    key: 'CastHazardBoon',
    label: 'Hazard Boom',
    ...raritylessNpcTrait,
    offerRequirements: [],
  },
  {
    key: 'BreakInvincibleArmorBoon',
    label: 'Protective Coating',
    ...raritylessNpcTrait,
    offerRequirements: [],
  },
  {
    key: 'BreakExplosiveArmorBoon',
    label: 'Volatile Coating',
    ...raritylessNpcTrait,
    offerRequirements: [],
  },
  {
    key: 'SupplyDropBoon',
    label: 'Supply Chain',
    ...raritylessNpcTrait,
    offerRequirements: [],
  },
  {
    key: 'UpgradeHammerBoon',
    label: 'Latest Model',
    ...raritylessNpcTrait,
    offerRequirements: [],
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
  defaultOffer: {
    options: [
      { traitKey: 'FocusAttackDamageTrait' },
      { traitKey: 'FocusSpecialDamageTrait' },
      { traitKey: 'OmegaExplodeBoon' },
    ],
    selectedOption: 0,
  },
} as const satisfies RawTraitGiverDeclaration;

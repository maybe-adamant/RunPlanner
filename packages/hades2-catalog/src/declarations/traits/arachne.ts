import type { RawTraitDeclaration, RawTraitGiverDeclaration } from './types';

const raritylessNpcTrait = {
  rarityDomain: 'none',
  elementContributions: {},
  usesBoonRarity: false,
  blockStacking: false,
  blockInRunRarify: false,
  excludeFromRarityCount: false,
} as const;

/** Arachne's Story-room costume choices. Armor is `CostumeArmor` `BaseAmount`,
 * full under no damage; only Onyx's scales with the Dream menu rarity. */
export const arachneTraits = [
  {
    key: 'AgilityCostume',
    label: 'Lavender Dress',
    ...raritylessNpcTrait,
    armor: { source: 'Robe', amount: 30 },
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    key: 'ManaCostume',
    label: 'Azure Dress',
    ...raritylessNpcTrait,
    armor: { source: 'Robe', amount: 40 },
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    key: 'VitalityCostume',
    label: 'Emerald Dress',
    ...raritylessNpcTrait,
    armor: { source: 'Robe', amount: 50 },
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    key: 'HighArmorCostume',
    label: 'Onyx Dress',
    ...raritylessNpcTrait,
    // BaseValue 60 scaled by the Dream menu rarity: 80/60, 100/60, 140/60.
    armor: { source: 'Robe', amount: [60, 80, 100, 140] },
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    key: 'CastDamageCostume',
    label: 'Fuchsia Dress',
    ...raritylessNpcTrait,
    armor: { source: 'Robe', amount: 20 },
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    key: 'IncomeCostume',
    label: 'Gilded Dress',
    ...raritylessNpcTrait,
    armor: { source: 'Robe', amount: 10 },
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    key: 'SpellCostume',
    label: 'Moonlight Dress',
    ...raritylessNpcTrait,
    armor: { source: 'Robe', amount: 55 },
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    key: 'EscalatingCostume',
    label: 'Crimson Dress',
    ...raritylessNpcTrait,
    armor: { source: 'Robe', amount: 5 },
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
] as const satisfies readonly RawTraitDeclaration[];

export const arachneGiver = {
  key: 'Arachne',
  label: 'Arachne',
  providerKind: 'npc',
  priorityTraitKeys: [],
  traitKeys: [
    'AgilityCostume',
    'ManaCostume',
    'VitalityCostume',
    'HighArmorCostume',
    'CastDamageCostume',
    'IncomeCostume',
    'SpellCostume',
    'EscalatingCostume',
  ],
  rarityPolicy: { kind: 'none' },
} as const satisfies RawTraitGiverDeclaration;

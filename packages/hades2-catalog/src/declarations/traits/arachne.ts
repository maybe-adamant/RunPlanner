import type { RawTraitDeclaration, RawTraitGiverDeclaration } from './types';

const raritylessNpcTrait = {
  rarityDomain: 'none',
  elementContributions: {},
  usesBoonRarity: false,
  blockStacking: false,
  blockInRunRarify: false,
  excludeFromRarityCount: false,
} as const;

/** Arachne's Story-room costume choices. Armor depletion is intentionally
 * collapsed: the selected costume remains in the equipped-trait ledger. */
export const arachneTraits = [
  {
    key: 'AgilityCostume',
    label: 'Lavender Dress',
    ...raritylessNpcTrait,
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    key: 'ManaCostume',
    label: 'Azure Dress',
    ...raritylessNpcTrait,
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    key: 'VitalityCostume',
    label: 'Emerald Dress',
    ...raritylessNpcTrait,
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    key: 'HighArmorCostume',
    label: 'Onyx Dress',
    ...raritylessNpcTrait,
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    key: 'CastDamageCostume',
    label: 'Fuchsia Dress',
    ...raritylessNpcTrait,
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    key: 'IncomeCostume',
    label: 'Gilded Dress',
    ...raritylessNpcTrait,
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    key: 'SpellCostume',
    label: 'Moonlight Dress',
    ...raritylessNpcTrait,
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    key: 'EscalatingCostume',
    label: 'Crimson Dress',
    ...raritylessNpcTrait,
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

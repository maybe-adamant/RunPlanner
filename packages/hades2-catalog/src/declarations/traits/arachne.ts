import type { RawTraitDeclaration, RawTraitGiverDeclaration } from '../traits';

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
    offerRequirements: [],
  },
  {
    key: 'ManaCostume',
    label: 'Azure Dress',
    ...raritylessNpcTrait,
    offerRequirements: [],
  },
  {
    key: 'VitalityCostume',
    label: 'Emerald Dress',
    ...raritylessNpcTrait,
    offerRequirements: [],
  },
  {
    key: 'HighArmorCostume',
    label: 'Onyx Dress',
    ...raritylessNpcTrait,
    offerRequirements: [],
  },
  {
    key: 'CastDamageCostume',
    label: 'Fuchsia Dress',
    ...raritylessNpcTrait,
    offerRequirements: [],
  },
  {
    key: 'IncomeCostume',
    label: 'Gilded Dress',
    ...raritylessNpcTrait,
    offerRequirements: [],
  },
  {
    key: 'SpellCostume',
    label: 'Moonlight Dress',
    ...raritylessNpcTrait,
    offerRequirements: [],
  },
  {
    key: 'EscalatingCostume',
    label: 'Crimson Dress',
    ...raritylessNpcTrait,
    offerRequirements: [],
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
  defaultOffer: {
    options: [
      { traitKey: 'AgilityCostume' },
      { traitKey: 'ManaCostume' },
      { traitKey: 'VitalityCostume' },
    ],
    selectedOption: 0,
  },
} as const satisfies RawTraitGiverDeclaration;

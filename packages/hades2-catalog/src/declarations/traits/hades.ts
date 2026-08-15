import type { RawTraitDeclaration, RawTraitGiverDeclaration } from '../traits';

const raritylessHadesTrait = {
  rarityDomain: 'none',
  elementContributions: {},
  usesBoonRarity: false,
  blockStacking: false,
  blockInRunRarify: true,
  excludeFromRarityCount: false,
} as const;

/** Hades's player-rarityless Story-room choices. */
export const hadesTraits = [
  {
    ...raritylessHadesTrait,
    key: 'HadesLifestealBoon',
    label: 'Life Tax',
    offerRequirements: [],
  },
  {
    ...raritylessHadesTrait,
    key: 'HadesCastProjectileBoon',
    label: 'Howling Soul',
    offerRequirements: [
      {
        kind: 'notEquippedTrait',
        traitKeys: ['CastProjectileBoon', 'CastAnywhereBoon', 'CastLobBoon', 'SelfCastBoon'],
      },
    ],
  },
  {
    ...raritylessHadesTrait,
    key: 'HadesPreDamageBoon',
    label: 'Old Grudge',
    offerRequirements: [],
  },
  {
    ...raritylessHadesTrait,
    key: 'HadesChronosDebuffBoon',
    label: 'Deep Dissent',
    offerRequirements: [],
  },
  {
    ...raritylessHadesTrait,
    key: 'HadesDashSweepBoon',
    label: 'Gigaros Dash',
    offerRequirements: [],
  },
  {
    ...raritylessHadesTrait,
    key: 'HadesDeathDefianceDamageBoon',
    label: 'Last Gasp',
    offerRequirements: [
      {
        kind: 'offerContext',
        context: 'deathDefianceConditionMet',
        required: true,
      },
    ],
  },
  {
    ...raritylessHadesTrait,
    key: 'HadesManaUrnBoon',
    label: 'Cinerary Circle',
    offerRequirements: [],
  },
  {
    ...raritylessHadesTrait,
    key: 'HadesInvisibilityRetaliateBoon',
    label: 'Unseen Ire',
    offerRequirements: [],
  },
] as const satisfies readonly RawTraitDeclaration[];

export const hadesGiver = {
  key: 'Hades',
  label: 'Hades',
  providerKind: 'npc',
  priorityTraitKeys: [],
  traitKeys: [
    'HadesLifestealBoon',
    'HadesCastProjectileBoon',
    'HadesPreDamageBoon',
    'HadesChronosDebuffBoon',
    'HadesDashSweepBoon',
    'HadesDeathDefianceDamageBoon',
    'HadesManaUrnBoon',
    'HadesInvisibilityRetaliateBoon',
  ],
  rarityPolicy: { kind: 'none' },
  defaultOffer: {
    options: [
      { traitKey: 'HadesLifestealBoon' },
      { traitKey: 'HadesCastProjectileBoon' },
      { traitKey: 'HadesPreDamageBoon' },
    ],
    selectedOption: 0,
  },
} as const satisfies RawTraitGiverDeclaration;

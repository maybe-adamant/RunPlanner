import type { RawTraitDeclaration, RawTraitGiverDeclaration } from '../traits';

const fixedCommonHadesTrait = {
  freshOfferRarities: ['Common'],
  equippedRarities: ['Common'],
  elementContributions: {},
  usesBoonRarity: true,
  blockStacking: false,
  blockInRunRarify: true,
  excludeFromRarityCount: false,
} as const;

/** Hades's effectively fixed-Common Story-room choices. */
export const hadesTraits = [
  {
    ...fixedCommonHadesTrait,
    key: 'HadesLifestealBoon',
    label: 'Life Tax',
    offerRequirements: [],
  },
  {
    ...fixedCommonHadesTrait,
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
    ...fixedCommonHadesTrait,
    key: 'HadesPreDamageBoon',
    label: 'Old Grudge',
    offerRequirements: [],
  },
  {
    ...fixedCommonHadesTrait,
    key: 'HadesChronosDebuffBoon',
    label: 'Deep Dissent',
    offerRequirements: [],
  },
  {
    ...fixedCommonHadesTrait,
    key: 'HadesDashSweepBoon',
    label: 'Gigaros Dash',
    offerRequirements: [],
  },
  {
    ...fixedCommonHadesTrait,
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
    ...fixedCommonHadesTrait,
    key: 'HadesManaUrnBoon',
    label: 'Cinerary Circle',
    offerRequirements: [],
  },
  {
    ...fixedCommonHadesTrait,
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
  rarityPolicy: { kind: 'fixed', rarity: 'Common' },
  defaultOffer: {
    options: [
      { traitKey: 'HadesLifestealBoon', rarity: 'Common' },
      { traitKey: 'HadesCastProjectileBoon', rarity: 'Common' },
      { traitKey: 'HadesPreDamageBoon', rarity: 'Common' },
    ],
    selectedOption: 0,
  },
} as const satisfies RawTraitGiverDeclaration;

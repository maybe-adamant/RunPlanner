import type { RawTraitDeclaration, RawTraitGiverDeclaration } from './types';

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
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    ...raritylessHadesTrait,
    key: 'HadesCastProjectileBoon',
    label: 'Howling Soul',
    linkedBoonRequirements: [],
    eligibilityRequirements: [
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
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    ...raritylessHadesTrait,
    key: 'HadesChronosDebuffBoon',
    label: 'Deep Dissent',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    ...raritylessHadesTrait,
    key: 'HadesDashSweepBoon',
    label: 'Gigaros Dash',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    ...raritylessHadesTrait,
    key: 'HadesDeathDefianceDamageBoon',
    label: 'Last Gasp',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    ...raritylessHadesTrait,
    key: 'HadesManaUrnBoon',
    label: 'Cinerary Circle',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    ...raritylessHadesTrait,
    key: 'HadesInvisibilityRetaliateBoon',
    label: 'Unseen Ire',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
] as const satisfies readonly RawTraitDeclaration[];

export const hadesGiver = {
  key: 'Hades',
  label: 'Hades',
  providerKind: 'npc',
  shopAwareGodTrait: true,
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
} as const satisfies RawTraitGiverDeclaration;

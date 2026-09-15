import type { RawTraitDeclaration, RawTraitGiverDeclaration } from './types';

const variableDionysusTrait = {
  freshOfferRarities: ['Common', 'Rare', 'Epic'],
  equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
  elementContributions: { Water: 1 },
  usesBoonRarity: true,
  blockStacking: false,
  blockInRunRarify: false,
  excludeFromRarityCount: false,
} as const;

/** Dionysus's variable-rarity Story-room choices. */
export const dionysusTraits = [
  {
    ...variableDionysusTrait,
    key: 'CastLobBoon',
    label: 'Tipsy Shot',
    linkedBoonRequirements: [],
    eligibilityRequirements: [
      {
        kind: 'notEquippedTrait',
        traitKeys: [
          'CastProjectileBoon',
          'CastAnywhereBoon',
          'HadesCastProjectileBoon',
          'SelfCastBoon',
        ],
      },
    ],
  },
  {
    ...variableDionysusTrait,
    key: 'HiddenMaxHealthBoon',
    label: 'Worry Free',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    ...variableDionysusTrait,
    key: 'FirstHangoverBoon',
    label: 'Drunken Stupor',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    ...variableDionysusTrait,
    key: 'CombatEncounterHealBoon',
    label: 'Bounce Back',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    ...variableDionysusTrait,
    key: 'PowerDrinkBoon',
    label: 'Bottomless Drink',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    ...variableDionysusTrait,
    key: 'FogDamageBonusBoon',
    label: 'Happy Haze',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    ...variableDionysusTrait,
    key: 'BankBoon',
    label: 'Personal Loan',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    ...variableDionysusTrait,
    key: 'RandomBaseDamageBoon',
    label: 'Reckless Abandon',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
] as const satisfies readonly RawTraitDeclaration[];

export const dionysusGiver = {
  key: 'Dionysus',
  label: 'Dionysus',
  providerKind: 'npc',
  shopAwareGodTrait: true,
  callingCardMenu: true,
  priorityTraitKeys: [],
  traitKeys: [
    'CastLobBoon',
    'HiddenMaxHealthBoon',
    'FirstHangoverBoon',
    'CombatEncounterHealBoon',
    'PowerDrinkBoon',
    'FogDamageBonusBoon',
    'BankBoon',
    'RandomBaseDamageBoon',
  ],
  rarityPolicy: { kind: 'selectable', rarities: ['Common', 'Rare', 'Epic'] },
} as const satisfies RawTraitGiverDeclaration;

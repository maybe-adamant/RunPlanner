import type { RawTraitDeclaration, RawTraitGiverDeclaration } from '../traits';

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
    offerRequirements: [
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
    offerRequirements: [],
  },
  {
    ...variableDionysusTrait,
    key: 'FirstHangoverBoon',
    label: 'Drunken Stupor',
    offerRequirements: [],
  },
  {
    ...variableDionysusTrait,
    key: 'CombatEncounterHealBoon',
    label: 'Bounce Back',
    offerRequirements: [],
  },
  {
    ...variableDionysusTrait,
    key: 'PowerDrinkBoon',
    label: 'Bottomless Drink',
    offerRequirements: [],
  },
  {
    ...variableDionysusTrait,
    key: 'FogDamageBonusBoon',
    label: 'Happy Haze',
    offerRequirements: [],
  },
  {
    ...variableDionysusTrait,
    key: 'BankBoon',
    label: 'Personal Loan',
    offerRequirements: [],
  },
  {
    ...variableDionysusTrait,
    key: 'RandomBaseDamageBoon',
    label: 'Reckless Abandon',
    offerRequirements: [],
  },
] as const satisfies readonly RawTraitDeclaration[];

export const dionysusGiver = {
  key: 'Dionysus',
  label: 'Dionysus',
  providerKind: 'npc',
  shopAwareGodTrait: true,
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

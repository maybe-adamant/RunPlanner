import type { RawTraitDeclaration, RawTraitGiverDeclaration } from './types';

const raritylessEchoTrait = {
  rarityDomain: 'none',
  elementContributions: {},
  usesBoonRarity: false,
  blockStacking: false,
  blockInRunRarify: false,
  excludeFromRarityCount: false,
} as const;

export const echoTraits = [
  {
    ...raritylessEchoTrait,
    key: 'EchoLastReward',
    label: 'Reward Reward Reward',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
    selectedDisposition: { kind: 'echo', effect: 'lastReward' },
  },
  {
    ...raritylessEchoTrait,
    key: 'EchoDeathDefianceRefill',
    label: 'Survive Survive Survive',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
    selectedDisposition: { kind: 'echo', effect: 'survive' },
  },
  {
    ...raritylessEchoTrait,
    key: 'DiminishingDodgeBoon',
    label: 'Evade Evade Evade',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
    selectedDisposition: { kind: 'echo', effect: 'numericNoOp' },
  },
  {
    ...raritylessEchoTrait,
    key: 'DiminishingHealthAndManaBoon',
    label: 'Fight Fight Fight',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
    selectedDisposition: { kind: 'echo', effect: 'numericNoOp' },
  },
  {
    ...raritylessEchoTrait,
    key: 'EchoLastRunBoon',
    label: 'Boon Boon Boon',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
    selectedDisposition: { kind: 'echo', effect: 'lastRunBoon' },
  },
  {
    ...raritylessEchoTrait,
    key: 'EchoDoubleLevelBoon',
    label: 'Pom Pom Pom',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
    selectedDisposition: { kind: 'echo', effect: 'doubleLevel' },
  },
  {
    ...raritylessEchoTrait,
    key: 'EchoDoubleShop',
    label: 'Gold Gold Gold',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
    selectedDisposition: {
      kind: 'echo',
      effect: 'doubleShop',
      excludedRewardTypes: ['SpellDrop'],
    },
  },
  {
    ...raritylessEchoTrait,
    key: 'EchoRepeatKeepsakeBoon',
    label: 'Gift Gift Gift',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
    selectedDisposition: {
      kind: 'echo',
      effect: 'repeatKeepsake',
      excludedKeepsakeKeys: [
        'AthenaEncounterKeepsake',
        'HadesAndPersephoneKeepsake',
        'EscalatingKeepsake',
        'FountainRarityKeepsake',
      ],
    },
  },
] as const satisfies readonly RawTraitDeclaration[];

export const echoGiver = {
  key: 'Echo',
  label: 'Echo',
  providerKind: 'npc',
  priorityTraitKeys: [],
  traitKeys: echoTraits.map((trait) => trait.key),
  rarityPolicy: { kind: 'none' },
} as const satisfies RawTraitGiverDeclaration;

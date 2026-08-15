import type { RawTraitDeclaration, RawTraitGiverDeclaration } from '../traits';

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
    offerRequirements: [],
    selectedDisposition: { kind: 'echo', effect: 'lastReward' },
  },
  {
    ...raritylessEchoTrait,
    key: 'EchoDeathDefianceRefill',
    label: 'Survive Survive Survive',
    offerRequirements: [
      { kind: 'offerContext', context: 'deathDefianceConditionMet', required: true },
    ],
    selectedDisposition: { kind: 'echo', effect: 'survive' },
  },
  {
    ...raritylessEchoTrait,
    key: 'DiminishingDodgeBoon',
    label: 'Evade Evade Evade',
    offerRequirements: [],
    selectedDisposition: { kind: 'echo', effect: 'numericNoOp' },
  },
  {
    ...raritylessEchoTrait,
    key: 'DiminishingHealthAndManaBoon',
    label: 'Fight Fight Fight',
    offerRequirements: [],
    selectedDisposition: { kind: 'echo', effect: 'numericNoOp' },
  },
  {
    ...raritylessEchoTrait,
    key: 'EchoLastRunBoon',
    label: 'Boon Boon Boon',
    offerRequirements: [],
    selectedDisposition: { kind: 'echo', effect: 'lastRunBoon' },
  },
  {
    ...raritylessEchoTrait,
    key: 'EchoDoubleLevelBoon',
    label: 'Pom Pom Pom',
    offerRequirements: [],
    selectedDisposition: { kind: 'echo', effect: 'doubleLevel' },
  },
  {
    ...raritylessEchoTrait,
    key: 'EchoDoubleShop',
    label: 'Gold Gold Gold',
    offerRequirements: [],
    selectedDisposition: {
      kind: 'echo',
      effect: 'doubleShop',
      excludedRewardTypes: ['SpellDrop'],
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
  defaultOffer: {
    options: [
      { traitKey: 'DiminishingDodgeBoon' },
      { traitKey: 'DiminishingHealthAndManaBoon' },
      { traitKey: 'EchoDoubleLevelBoon' },
    ],
    selectedOption: 0,
  },
} as const satisfies RawTraitGiverDeclaration;

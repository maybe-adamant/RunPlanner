import type { RawTraitDeclaration, RawTraitGiverDeclaration } from '../traits';

const fixedCommon = {
  freshOfferRarities: ['Common'],
  equippedRarities: ['Common'],
  elementContributions: {},
  usesBoonRarity: false,
  blockStacking: false,
  blockInRunRarify: false,
  excludeFromRarityCount: false,
} as const;

export const echoTraits = [
  {
    ...fixedCommon,
    key: 'EchoDeathDefianceRefill',
    label: 'Survive Survive Survive',
    offerRequirements: [
      { kind: 'offerContext', context: 'deathDefianceConditionMet', required: true },
    ],
    selectedDisposition: { kind: 'echo', effect: 'survive' },
  },
  {
    ...fixedCommon,
    key: 'DiminishingDodgeBoon',
    label: 'Evade Evade Evade',
    offerRequirements: [],
    selectedDisposition: { kind: 'echo', effect: 'numericNoOp' },
  },
  {
    ...fixedCommon,
    key: 'DiminishingHealthAndManaBoon',
    label: 'Fight Fight Fight',
    offerRequirements: [],
    selectedDisposition: { kind: 'echo', effect: 'numericNoOp' },
  },
  {
    ...fixedCommon,
    key: 'EchoDoubleLevelBoon',
    label: 'Pom Pom Pom',
    offerRequirements: [],
    selectedDisposition: { kind: 'echo', effect: 'doubleLevel' },
  },
] as const satisfies readonly RawTraitDeclaration[];

export const echoGiver = {
  key: 'Echo',
  label: 'Echo',
  providerKind: 'npc',
  priorityTraitKeys: [],
  traitKeys: echoTraits.map((trait) => trait.key),
  rarityPolicy: { kind: 'fixed', rarity: 'Common' },
  defaultOffer: {
    options: [
      { traitKey: 'DiminishingDodgeBoon', rarity: 'Common' },
      { traitKey: 'DiminishingHealthAndManaBoon', rarity: 'Common' },
      { traitKey: 'EchoDoubleLevelBoon', rarity: 'Common' },
    ],
    selectedOption: 0,
  },
} as const satisfies RawTraitGiverDeclaration;

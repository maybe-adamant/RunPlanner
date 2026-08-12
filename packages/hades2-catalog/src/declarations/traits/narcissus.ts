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

export const narcissusTraits = [
  {
    ...fixedCommon,
    key: 'NarcissusA',
    label: 'Verdure Sampler',
    offerRequirements: [{ kind: 'upgradableTrait' }],
    selectedDisposition: {
      kind: 'producePickups',
      producerLifecycleKey: 'NarcissusPickup',
      pickups: [{ key: 'pom', rewardType: 'StoreRewardRandomStack' }],
    },
  },
  {
    ...fixedCommon,
    key: 'NarcissusB',
    label: 'Heartfelt Condolences',
    offerRequirements: [],
    selectedDisposition: { kind: 'noOp' },
  },
  {
    ...fixedCommon,
    key: 'NarcissusC',
    label: 'Precious Metals',
    offerRequirements: [],
    selectedDisposition: {
      kind: 'producePickups',
      producerLifecycleKey: 'NarcissusPickup',
      pickups: [{ key: 'currency', rewardType: 'Currency' }],
    },
  },
  {
    ...fixedCommon,
    key: 'NarcissusD',
    label: 'Mystic Secrets',
    offerRequirements: [],
    selectedDisposition: {
      kind: 'producePickups',
      producerLifecycleKey: 'NarcissusPickup',
      pickups: [{ key: 'maxMana', rewardType: 'MaxManaDrop' }],
    },
  },
  {
    ...fixedCommon,
    key: 'NarcissusE',
    label: 'Ancestral Offering',
    offerRequirements: [],
    selectedDisposition: {
      kind: 'producePickups',
      producerLifecycleKey: 'NarcissusPickup',
      pickups: [{ key: 'maxHealth', rewardType: 'MaxHealthDrop' }],
    },
  },
  {
    ...fixedCommon,
    key: 'NarcissusF',
    label: "Fates' Trimmings",
    offerRequirements: [],
    selectedDisposition: { kind: 'noOp' },
  },
  {
    ...fixedCommon,
    key: 'NarcissusG',
    label: 'Heavenly Splendor',
    offerRequirements: [],
    selectedDisposition: {
      kind: 'producePickups',
      producerLifecycleKey: 'NarcissusPickup',
      pickups: [
        { key: 'elementalBoost1', rewardType: 'ElementalBoost' },
        { key: 'elementalBoost2', rewardType: 'ElementalBoost' },
      ],
    },
  },
  {
    ...fixedCommon,
    key: 'NarcissusH',
    label: 'Life Savings',
    offerRequirements: [
      { kind: 'offerContext', context: 'deathDefianceConditionMet', required: true },
    ],
    selectedDisposition: {
      kind: 'producePickups',
      producerLifecycleKey: 'NarcissusPickup',
      pickups: [{ key: 'lastStand', rewardType: 'LastStandDrop' }],
    },
  },
  {
    ...fixedCommon,
    key: 'NarcissusI',
    label: 'Mixed Blessings',
    offerRequirements: [],
    selectedDisposition: {
      kind: 'producePickups',
      producerLifecycleKey: 'NarcissusPickup',
      pickups: [{ key: 'mysteryBoon', rewardType: 'BlindBoxLoot' }],
    },
  },
] as const satisfies readonly RawTraitDeclaration[];

export const narcissusGiver = {
  key: 'Narcissus',
  label: 'Narcissus',
  providerKind: 'npc',
  priorityTraitKeys: [],
  traitKeys: narcissusTraits.map((trait) => trait.key),
  rarityPolicy: { kind: 'fixed', rarity: 'Common' },
  defaultOffer: {
    options: [
      { traitKey: 'NarcissusA', rarity: 'Common' },
      { traitKey: 'NarcissusD', rarity: 'Common' },
      { traitKey: 'NarcissusE', rarity: 'Common' },
    ],
    selectedOption: 0,
  },
} as const satisfies RawTraitGiverDeclaration;

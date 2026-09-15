import type { RawTraitDeclaration, RawTraitGiverDeclaration } from './types';

const raritylessNpcTrait = {
  rarityDomain: 'none',
  elementContributions: {},
  usesBoonRarity: false,
  blockStacking: false,
  blockInRunRarify: false,
  excludeFromRarityCount: false,
} as const;

export const narcissusTraits = [
  {
    ...raritylessNpcTrait,
    key: 'NarcissusA',
    label: 'Verdure Sampler',
    linkedBoonRequirements: [],
    eligibilityRequirements: [{ kind: 'upgradableTrait' }],
    selectedDisposition: {
      kind: 'producePickups',
      producerLifecycleKey: 'NarcissusPickup',
      pickups: [{ key: 'pom', rewardType: 'StoreRewardRandomStack' }],
    },
  },
  {
    ...raritylessNpcTrait,
    key: 'NarcissusB',
    label: 'Heartfelt Condolences',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
    selectedDisposition: {
      kind: 'producePickups',
      producerLifecycleKey: 'NarcissusPickup',
      pickups: [{ key: 'ashes', rewardType: 'MetaCardPointsCommonDrop' }],
    },
  },
  {
    ...raritylessNpcTrait,
    key: 'NarcissusC',
    label: 'Precious Metals',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
    selectedDisposition: {
      kind: 'producePickups',
      producerLifecycleKey: 'NarcissusPickup',
      pickups: [{ key: 'currency', rewardType: 'Currency' }],
    },
  },
  {
    ...raritylessNpcTrait,
    key: 'NarcissusD',
    label: 'Mystic Secrets',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
    selectedDisposition: {
      kind: 'producePickups',
      producerLifecycleKey: 'NarcissusPickup',
      pickups: [
        { key: 'psyche', rewardType: 'MemPointsCommonDrop' },
        { key: 'maxMana', rewardType: 'MaxManaDrop' },
      ],
    },
  },
  {
    ...raritylessNpcTrait,
    key: 'NarcissusE',
    label: 'Ancestral Offering',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
    selectedDisposition: {
      kind: 'producePickups',
      producerLifecycleKey: 'NarcissusPickup',
      pickups: [
        { key: 'bones', rewardType: 'MetaCurrencyDrop' },
        { key: 'maxHealth', rewardType: 'MaxHealthDrop' },
      ],
    },
  },
  {
    ...raritylessNpcTrait,
    key: 'NarcissusF',
    label: "Fates' Trimmings",
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
    selectedDisposition: { kind: 'equip' },
  },
  {
    ...raritylessNpcTrait,
    key: 'NarcissusG',
    label: 'Heavenly Splendor',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
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
    ...raritylessNpcTrait,
    key: 'NarcissusH',
    label: 'Life Savings',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
    selectedDisposition: {
      kind: 'producePickups',
      producerLifecycleKey: 'NarcissusPickup',
      pickups: [{ key: 'lastStand', rewardType: 'LastStandDrop' }],
    },
  },
  {
    ...raritylessNpcTrait,
    key: 'NarcissusI',
    label: 'Mixed Blessings',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
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
  rarityPolicy: { kind: 'none' },
} as const satisfies RawTraitGiverDeclaration;

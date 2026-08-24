import type { RawTraitDeclaration, RawTraitGiverDeclaration } from '../traits';

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
    offerRequirements: [{ kind: 'upgradableTrait' }],
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
    offerRequirements: [],
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
    offerRequirements: [],
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
    offerRequirements: [],
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
    offerRequirements: [],
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
    offerRequirements: [],
    selectedDisposition: { kind: 'equip' },
  },
  {
    ...raritylessNpcTrait,
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
    ...raritylessNpcTrait,
    key: 'NarcissusH',
    label: 'Life Savings',
    offerRequirements: [],
    runtimeOfferRequirement: 'missingLastStand',
    runtimeOfferFallbackTraitKeys: ['NarcissusB', 'NarcissusC', 'NarcissusD'],
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
  rarityPolicy: { kind: 'none' },
} as const satisfies RawTraitGiverDeclaration;

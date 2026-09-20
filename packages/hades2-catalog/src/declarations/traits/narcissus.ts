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
      pickups: [
        { key: 'pom', rewardType: 'StoreRewardRandomStack' },
        { key: 'pom2', rewardType: 'StoreRewardRandomStack', minimumAcquisitionOrdinal: 3 },
        { key: 'pom3', rewardType: 'StoreRewardRandomStack', minimumAcquisitionOrdinal: 4 },
        { key: 'pom4', rewardType: 'StoreRewardRandomStack', minimumAcquisitionOrdinal: 4 },
      ],
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
        { key: 'maxMana2', rewardType: 'MaxManaDrop', minimumAcquisitionOrdinal: 3 },
        { key: 'maxMana3', rewardType: 'MaxManaDrop', minimumAcquisitionOrdinal: 4 },
        { key: 'maxMana4', rewardType: 'MaxManaDrop', minimumAcquisitionOrdinal: 4 },
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
        { key: 'maxHealth2', rewardType: 'MaxHealthDrop', minimumAcquisitionOrdinal: 3 },
        { key: 'maxHealth3', rewardType: 'MaxHealthDrop', minimumAcquisitionOrdinal: 4 },
        { key: 'maxHealth4', rewardType: 'MaxHealthDrop', minimumAcquisitionOrdinal: 4 },
      ],
    },
  },
  {
    ...raritylessNpcTrait,
    key: 'NarcissusF',
    label: "Fates' Trimmings",
    linkedBoonRequirements: [],
    eligibilityRequirements: [
      {
        kind: 'anyActiveArcana',
        traitKeys: ['PanelRerollMetaUpgrade', 'RerollTradeOffMetaUpgrade', 'DoorRerollMetaUpgrade'],
      },
    ],
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
        { key: 'elementalBoost3', rewardType: 'ElementalBoost', minimumAcquisitionOrdinal: 3 },
        { key: 'elementalBoost4', rewardType: 'ElementalBoost', minimumAcquisitionOrdinal: 4 },
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
      pickups: [
        { key: 'lastStand', rewardType: 'LastStandDrop' },
        { key: 'lastStand2', rewardType: 'LastStandDrop', minimumAcquisitionOrdinal: 3 },
        { key: 'lastStand3', rewardType: 'LastStandDrop', minimumAcquisitionOrdinal: 4 },
      ],
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

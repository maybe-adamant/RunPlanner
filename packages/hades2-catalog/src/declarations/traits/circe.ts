import type { RawTraitDeclaration, RawTraitGiverDeclaration } from './types';

const raritylessNpcTrait = {
  rarityDomain: 'none',
  elementContributions: {},
  usesBoonRarity: false,
  blockStacking: false,
  blockInRunRarify: false,
  excludeFromRarityCount: false,
} as const;

/** Circe's menu is player-rarityless; the three stateful choices are marked
 * with a closed acquisition policy consumed by the engine. */
export const circeTraits = [
  {
    ...raritylessNpcTrait,
    key: 'CirceShrinkTrait',
    label: 'Word of Smaller Stature',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    ...raritylessNpcTrait,
    key: 'CirceEnlargeTrait',
    label: 'Word of Greater Girth',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    ...raritylessNpcTrait,
    key: 'ArcanaRarityTrait',
    label: 'Lapis Lazuli Insight',
    linkedBoonRequirements: [],
    eligibilityRequirements: [{ kind: 'manualArcanaGraspCost', minimum: 1 }],
    selectedDisposition: { kind: 'circe', effect: 'promoteArcana' },
  },
  {
    ...raritylessNpcTrait,
    key: 'HealAmplifyTrait',
    label: 'Old Herbal Remedy',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    ...raritylessNpcTrait,
    key: 'DoubleFamiliarTrait',
    label: 'Primal Psychic Connection',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    ...raritylessNpcTrait,
    key: 'RemoveShrineTrait',
    label: 'Black Night Banishment',
    linkedBoonRequirements: [],
    eligibilityRequirements: [
      { kind: 'offerContext', context: 'circeRemovableFearVow', required: true },
    ],
    selectedDisposition: { kind: 'circe', effect: 'disableFear' },
  },
  {
    ...raritylessNpcTrait,
    key: 'RandomArcanaTrait',
    label: 'Red Citrine Divination',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
    selectedDisposition: { kind: 'circe', effect: 'activateArcana' },
  },
  {
    ...raritylessNpcTrait,
    key: 'CirceSorceryDamageBoon',
    label: 'Hymn to the Eye of Night',
    linkedBoonRequirements: [],
    eligibilityRequirements: [
      {
        kind: 'anyEquippedTrait',
        traitKeys: [
          'SpellLaserTrait',
          'SpellLeapTrait',
          'SpellSummonTrait',
          'SpellMeteorTrait',
          'SpellTransformTrait',
          'SpellMoonBeamTrait',
          'SpellPolymorphTrait',
        ],
      },
    ],
  },
  {
    ...raritylessNpcTrait,
    key: 'ExPolymorphBoon',
    label: 'Turning to a Simple Form',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
] as const satisfies readonly RawTraitDeclaration[];

export const circeGiver = {
  key: 'Circe',
  label: 'Circe',
  providerKind: 'npc',
  priorityTraitKeys: [],
  traitKeys: circeTraits.map((trait) => trait.key),
  rarityPolicy: { kind: 'none' },
} as const satisfies RawTraitGiverDeclaration;

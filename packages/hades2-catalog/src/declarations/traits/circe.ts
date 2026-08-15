import type { RawTraitDeclaration, RawTraitGiverDeclaration } from '../traits';

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
    offerRequirements: [],
  },
  {
    ...raritylessNpcTrait,
    key: 'CirceEnlargeTrait',
    label: 'Word of Greater Girth',
    offerRequirements: [],
  },
  {
    ...raritylessNpcTrait,
    key: 'ArcanaRarityTrait',
    label: 'Lapis Lazuli Insight',
    offerRequirements: [{ kind: 'manualArcanaGraspCost', minimum: 1 }],
    selectedDisposition: { kind: 'circe', effect: 'promoteArcana' },
  },
  {
    ...raritylessNpcTrait,
    key: 'HealAmplifyTrait',
    label: 'Old Herbal Remedy',
    offerRequirements: [],
  },
  {
    ...raritylessNpcTrait,
    key: 'DoubleFamiliarTrait',
    label: 'Primal Psychic Connection',
    offerRequirements: [],
  },
  {
    ...raritylessNpcTrait,
    key: 'RemoveShrineTrait',
    label: 'Black Night Banishment',
    offerRequirements: [{ kind: 'offerContext', context: 'circeRemovableFearVow', required: true }],
    selectedDisposition: { kind: 'circe', effect: 'disableFear' },
  },
  {
    ...raritylessNpcTrait,
    key: 'RandomArcanaTrait',
    label: 'Red Citrine Divination',
    offerRequirements: [],
    selectedDisposition: { kind: 'circe', effect: 'activateArcana' },
  },
  {
    ...raritylessNpcTrait,
    key: 'CirceSorceryDamageBoon',
    label: 'Hymn to the Eye of Night',
    offerRequirements: [
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
    offerRequirements: [],
  },
] as const satisfies readonly RawTraitDeclaration[];

export const circeGiver = {
  key: 'Circe',
  label: 'Circe',
  providerKind: 'npc',
  priorityTraitKeys: [],
  traitKeys: circeTraits.map((trait) => trait.key),
  rarityPolicy: { kind: 'none' },
  defaultOffer: {
    options: [
      { traitKey: 'CirceShrinkTrait' },
      { traitKey: 'CirceEnlargeTrait' },
      { traitKey: 'HealAmplifyTrait' },
    ],
    selectedOption: 0,
  },
} as const satisfies RawTraitGiverDeclaration;

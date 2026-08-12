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

/** Circe's menu is a fixed Common pool; the three stateful choices are marked
 * with a closed acquisition policy consumed by the engine. */
export const circeTraits = [
  {
    ...fixedCommon,
    key: 'CirceShrinkTrait',
    label: 'Word of Smaller Stature',
    offerRequirements: [],
  },
  {
    ...fixedCommon,
    key: 'CirceEnlargeTrait',
    label: 'Word of Greater Girth',
    offerRequirements: [],
  },
  {
    ...fixedCommon,
    key: 'ArcanaRarityTrait',
    label: 'Lapis Lazuli Insight',
    offerRequirements: [{ kind: 'manualArcanaGraspCost', minimum: 1 }],
    selectedDisposition: { kind: 'circe', effect: 'promoteArcana' },
  },
  { ...fixedCommon, key: 'HealAmplifyTrait', label: 'Old Herbal Remedy', offerRequirements: [] },
  {
    ...fixedCommon,
    key: 'DoubleFamiliarTrait',
    label: 'Primal Psychic Connection',
    offerRequirements: [],
  },
  {
    ...fixedCommon,
    key: 'RemoveShrineTrait',
    label: 'Black Night Banishment',
    offerRequirements: [{ kind: 'offerContext', context: 'circeRemovableFearVow', required: true }],
    selectedDisposition: { kind: 'circe', effect: 'disableFear' },
  },
  {
    ...fixedCommon,
    key: 'RandomArcanaTrait',
    label: 'Red Citrine Divination',
    offerRequirements: [],
    selectedDisposition: { kind: 'circe', effect: 'activateArcana' },
  },
  {
    ...fixedCommon,
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
    ...fixedCommon,
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
  rarityPolicy: { kind: 'fixed', rarity: 'Common' },
  defaultOffer: {
    options: [
      { traitKey: 'CirceShrinkTrait', rarity: 'Common' },
      { traitKey: 'CirceEnlargeTrait', rarity: 'Common' },
      { traitKey: 'HealAmplifyTrait', rarity: 'Common' },
    ],
    selectedOption: 0,
  },
} as const satisfies RawTraitGiverDeclaration;

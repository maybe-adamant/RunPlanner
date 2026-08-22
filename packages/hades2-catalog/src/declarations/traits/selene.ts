import type { RawTraitDeclaration, RawTraitGiverDeclaration } from '../traits';

const raritylessSpell = {
  rarityDomain: 'none',
  offerRequirements: [],
  equipmentSlot: 'Spell',
  elementContributions: {},
  usesBoonRarity: false,
  blockStacking: false,
  blockInRunRarify: false,
  excludeFromRarityCount: false,
} as const;

export const seleneTraits = [
  { ...raritylessSpell, key: 'SpellPolymorphTrait', label: 'Twilight Curse' },
  { ...raritylessSpell, key: 'SpellMeteorTrait', label: 'Total Eclipse' },
  { ...raritylessSpell, key: 'SpellTransformTrait', label: 'Dark Side' },
  { ...raritylessSpell, key: 'SpellLeapTrait', label: 'Wolf Howl' },
  { ...raritylessSpell, key: 'SpellLaserTrait', label: 'Lunar Ray' },
  { ...raritylessSpell, key: 'SpellSummonTrait', label: 'Night Bloom' },
  { ...raritylessSpell, key: 'SpellTimeSlowTrait', label: 'Phase Shift' },
  { ...raritylessSpell, key: 'SpellPotionTrait', label: 'Moon Water' },
  { ...raritylessSpell, key: 'SpellMoonBeamTrait', label: 'Sky Fall' },
] as const satisfies readonly RawTraitDeclaration[];

export const seleneGiver = {
  key: 'SpellDrop',
  label: "Selene's Gift",
  providerKind: 'spell',
  traitKeys: [
    'SpellPolymorphTrait',
    'SpellMeteorTrait',
    'SpellTransformTrait',
    'SpellLeapTrait',
    'SpellLaserTrait',
    'SpellSummonTrait',
    'SpellTimeSlowTrait',
    'SpellPotionTrait',
  ],
  priorityTraitKeys: [],
  rarityPolicy: { kind: 'none' },
} as const satisfies RawTraitGiverDeclaration;

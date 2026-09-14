import type { TraitRarity } from '@run-planner/engine/catalog-schema';

// Native UnityTrait presentation; internal rarity and candidate support stay unchanged.
const infusionTraitKeys = new Set([
  'ElementalUnifiedBoon',
  'ElementalRarityUpgradeBoon',
  'ElementalDamageBoon',
  'ElementalOlympianDamageBoon',
  'ElementalBaseDamageBoon',
  'ElementalRallyBoon',
  'ElementalDamageFloorBoon',
  'ElementalDodgeBoon',
  'ElementalDamageCapBoon',
  'ElementalHealthBoon',
]);

export function traitRarityPresentation(traitKey: string | undefined, rarity: TraitRarity) {
  const infusion = traitKey !== undefined && infusionTraitKeys.has(traitKey);
  return {
    label: infusion ? `Infusion (${rarity[0]})` : rarity,
    accessibleLabel: infusion ? `Infusion (${rarity})` : rarity,
    effectiveLabel: infusion ? 'Infusion' : rarity,
  };
}

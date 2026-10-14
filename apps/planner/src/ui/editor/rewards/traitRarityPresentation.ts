import type { TraitRarity } from '@run-planner/engine/catalog-schema';

// Native UnityTrait presentation; internal rarity and candidate support stay unchanged.
export function traitRarityPresentation(infusion: boolean, rarity: TraitRarity) {
  return {
    label: infusion ? `Infusion (${rarity[0]})` : rarity,
    accessibleLabel: infusion ? `Infusion (${rarity})` : rarity,
    effectiveLabel: infusion ? 'Infusion' : rarity,
  };
}

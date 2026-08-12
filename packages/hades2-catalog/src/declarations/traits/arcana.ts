import { arcanaCards } from '../arcana-fear';
import type { RawTraitDeclaration } from '../traits';

/**
 * Arcana installs these traits from the route loadout rather than a giver
 * offer. Their combat effects are intentionally outside the planner; their
 * identity and Epic/Heroic run-local rarity support Arcana state and Circe.
 */
export const arcanaTraits = arcanaCards.map((card): RawTraitDeclaration => ({
  key: card.traitKey,
  label: card.label,
  freshOfferRarities: ['Epic'],
  equippedRarities: ['Epic', 'Heroic'],
  offerRequirements: [],
  elementContributions: {},
  usesBoonRarity: false,
  blockStacking: true,
  blockInRunRarify: false,
  excludeFromRarityCount: true,
}));

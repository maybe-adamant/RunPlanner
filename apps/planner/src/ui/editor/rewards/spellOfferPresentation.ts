import type { TraitGiverDeclaration } from '@run-planner/engine/catalog-schema';

const MOONGLOW_BY_OPTION = ['Crescent Moonglow', 'Half Moonglow', 'Full Moonglow'] as const;

export function spellOfferSlotPresentation(
  giver: TraitGiverDeclaration,
  optionIndex: number,
): { readonly bonus: number; readonly moonglow: string } {
  const moonglow = MOONGLOW_BY_OPTION[optionIndex];
  const bonus = giver.selectedOptionPathPointBonuses?.[optionIndex];
  if (moonglow === undefined || bonus === undefined) {
    throw new Error(`Spell offer is missing its fixed slot ${optionIndex + 1} presentation`);
  }
  return Object.freeze({ bonus, moonglow });
}

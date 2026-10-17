import type { Catalog } from '../catalog-schema';

/**
 * The in-run traits snap's trait step owns, sorted: every catalog trait less
 * Arcana card traits, Chaos curses and blessings, Arachne's costumes, Gift Gift
 * Gift and the Spells the Hex step installs.
 */
export function snapModeledTraitKeys(catalog: Catalog): readonly string[] {
  const owned = new Set([
    ...catalog.arcanaCards.values.map((card) => card.traitKey),
    ...catalog.chaos.curses.values.map((curse) => curse.key),
    ...catalog.chaos.blessings.values.map((blessing) => blessing.key),
  ]);
  return Object.freeze(
    catalog.traits.values
      .filter(
        (trait) =>
          !owned.has(trait.key) &&
          trait.armor?.source !== 'Robe' &&
          trait.equipmentSlot !== 'Spell' &&
          !(
            trait.selectedDisposition.kind === 'echo' &&
            trait.selectedDisposition.effect === 'repeatKeepsake'
          ),
      )
      .map((trait) => trait.key)
      .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0)),
  );
}

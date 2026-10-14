import type { AuthoredTraitOffer } from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { WorkspaceTraitOfferNote } from '@planner/projections/structured-workspace/contracts/traits';

/** One note per listed trait whose native offer condition reads unmodeled Death Defiance state. */
export function projectTraitOfferNotes(
  catalog: Catalog,
  value: AuthoredTraitOffer,
): readonly WorkspaceTraitOfferNote[] {
  if (value.kind !== 'traits') return Object.freeze([]);
  const traitKeys = new Set(value.options.map((option) => option.traitKey));
  return Object.freeze(
    [...traitKeys].flatMap((traitKey) => {
      const trait = catalog.traits.byKey[traitKey];
      return trait?.offerDependsOnDeathDefiance === true
        ? [
            Object.freeze({
              traitKey,
              title: `${trait.label}'s offer depends on Death Defiance`,
              description: 'Make sure you meet its offer condition.',
            }),
          ]
        : [];
    }),
  );
}

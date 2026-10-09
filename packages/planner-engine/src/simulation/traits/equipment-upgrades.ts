import type { Catalog } from '../../catalog-schema';
import type { TraitHistoryState } from './history/model';

type PickedTraits = Pick<TraitHistoryState, 'previouslyPickedTraitKeys'>;

/** A picked trait (Premium Service) permanently raised the equipped aspect to Perfect. */
export function aspectIsPerfect(catalog: Catalog, history: PickedTraits): boolean {
  return history.previouslyPickedTraitKeys.some(
    (traitKey) => catalog.traits.byKey[traitKey]?.raisesAspectToPerfect === true,
  );
}

/** The familiar stack multiplier from picked traits (Circe); 1 without one. */
export function familiarStackMultiplier(catalog: Catalog, history: PickedTraits): number {
  let multiplier = 1;
  for (const traitKey of history.previouslyPickedTraitKeys) {
    const effect = catalog.traits.byKey[traitKey]?.maxStatEffect;
    if (effect?.kind === 'familiarStackMultiplier') multiplier *= effect.multiplier;
  }
  return multiplier;
}

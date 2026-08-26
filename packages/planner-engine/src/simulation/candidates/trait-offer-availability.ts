import type { TraitOfferAddress } from '../../authored-project/addresses';
import type { ProjectEvaluation } from '../evaluation-products';
import { unavailableForBiome, type CandidateContextUnavailable } from './availability';

/**
 * Resolves the common coverage boundary for every trait-offer candidate
 * family. Offer evaluators retain their own semantic policy above it.
 */
export function unavailableForTraitOffer(
  evaluation: ProjectEvaluation,
  trait: TraitOfferAddress,
): CandidateContextUnavailable {
  return unavailableForBiome(
    evaluation,
    trait.routeKey,
    trait.biomeKey,
    trait.owner,
    'afterRoomLifecycle',
  );
}

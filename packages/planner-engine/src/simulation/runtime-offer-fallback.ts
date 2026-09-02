import type { SemanticAddress } from '../authored-project/addresses';

/**
 * The native contact used to ask whether a planner-selected runtime fallback
 * can be realized.  These are contact families, not the game predicates that
 * make an individual result eligible.
 */
export type RuntimeOfferAvailabilityContact =
  'traitEligibility' | 'storeInventoryGeneration' | 'storePurchase' | 'npcConsumableSelection';

/** One normalized planner-owned fallback relation, before execution assembly. */
export interface RuntimeOfferFallback {
  readonly address: SemanticAddress;
  readonly preferredKey: string;
  readonly fallbackKey: string;
  readonly availabilityContact: RuntimeOfferAvailabilityContact;
}

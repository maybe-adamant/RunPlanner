/**
 * A Ship wheel offer's label: a one-offer wheel's only offer, or the side a
 * two-offer wheel's offer stands on (offer 1 is the Left wheel, drawn first).
 * A one-offer wheel's dormant second offer keeps its side.
 */
export function rewardWheelOfferLabel(offerKey: string, offerCount: number): string {
  if (offerCount === 1 && offerKey === 'offer1') return 'Offer';
  return offerKey === 'offer1' ? 'Left Offer' : offerKey === 'offer2' ? 'Right Offer' : offerKey;
}

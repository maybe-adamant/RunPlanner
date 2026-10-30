import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { createBiomeAddress, createOccurrenceAddress } from '@run-planner/engine/authored-project';
import { purchasePriceContextPublication } from '../../../../src/simulation/commerce/gold/price-context';
import type { SimulationState } from '../../../../src/simulation/state/model';

const room = createOccurrenceAddress(createBiomeAddress('Underworld', 'F'), 'room' as never);

/** Only the facts a price context reads. */
function state(travelDeal?: 'Rare' | 'Epic'): SimulationState {
  return {
    traitHistory: {
      equippedTraits:
        travelDeal === undefined
          ? {}
          : { RestockBoon: { traitKey: 'RestockBoon', rarity: travelDeal } },
    },
    arcanaFear: { fear: { effectiveRanks: { ShopPricesShrineUpgrade: 1 } } },
    stygianWell: { timedInstances: [] },
  } as unknown as SimulationState;
}

describe('purchase price contexts', () => {
  it('publishes one context per distinct branch reading', () => {
    const publish = (states: readonly SimulationState[], firstPaidPurchase = true) =>
      purchasePriceContextPublication({
        catalog,
        sequence: 1,
        room,
        firstPaidPurchase,
        states,
        venue: { kind: 'worldShop', profileKey: 'WorldShop', itemKey: 'RandomLoot' },
      }).contexts.map((context) => context.travelDealRarity ?? null);
    expect(publish([state('Rare'), state('Rare')])).toEqual(['Rare']);
    expect(publish([state('Rare'), state('Epic'), state('Rare')])).toEqual(['Rare', 'Epic']);
    // Travel Deal is read only on the first paid purchase, so a later one agrees.
    expect(publish([state('Rare'), state('Epic')], false)).toEqual([null]);
  });
});

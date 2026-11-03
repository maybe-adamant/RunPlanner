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
  it('reads Travel Deal only on the first paid purchase', () => {
    const publish = (rarity: 'Rare' | 'Epic', firstPaidPurchase = true) =>
      purchasePriceContextPublication({
        catalog,
        sequence: 1,
        room,
        firstPaidPurchase,
        state: state(rarity),
        venue: { kind: 'worldShop', profileKey: 'WorldShop', itemKey: 'RandomLoot' },
      }).context?.travelDealRarity ?? null;
    expect(publish('Rare')).toBe('Rare');
    expect(publish('Rare', false)).toBeNull();
  });
});

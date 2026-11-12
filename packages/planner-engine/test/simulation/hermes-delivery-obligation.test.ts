import { describe, expect, it } from 'vitest';
import {
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
} from '../../src/authored-project/addresses';
import {
  isDeliveryFlushHost,
  isSameRoomDelivery,
  purchasedOfferFor,
} from '../../src/authored-project/hermes-shrine-delivery';
import type { HermesShrineState } from '../../src/authored-project/model';

const biome = createBiomeAddress('Surface', 'O');
const source = createOccurrenceAddress(biome, createOccurrenceId('shrine'));

describe('isSameRoomDelivery', () => {
  it('matches only the identical route, biome and occurrence', () => {
    expect(isSameRoomDelivery(source, source)).toBe(true);
    expect(isSameRoomDelivery(source, { ...source })).toBe(true);
    expect(
      isSameRoomDelivery(source, createOccurrenceAddress(biome, createOccurrenceId('host'))),
    ).toBe(false);
    expect(
      isSameRoomDelivery(
        source,
        createOccurrenceAddress(createBiomeAddress('Surface', 'P'), source.occurrenceId),
      ),
    ).toBe(false);
  });
});

describe('purchasedOfferFor', () => {
  const shrine: HermesShrineState = {
    offerBySlot: {
      first: { rewardType: 'HealBigDrop', delay: 3 },
      secondLeft: { rewardType: 'MaxHealthDrop', delay: 4 },
      secondRight: null,
    },
    travelDealRefill: { offer: { rewardType: 'MaxManaDrop', delay: 2 } },
  };
  const order = [
    { kind: 'purchaseHermesShrineOffer', generationKey: 'initial:secondLeft' },
    { kind: 'purchaseHermesShrineOffer', generationKey: 'travelDealRefill' },
    { kind: 'rushHermesShrineOffer', generationKey: 'travelDealRefill' },
  ] as const;

  it('reads the item, with its delay, of a bought slot or Travel Deal refill', () => {
    expect(purchasedOfferFor(shrine, order, 'initial:secondLeft')).toEqual({
      rewardType: 'MaxHealthDrop',
      delay: 4,
    });
    expect(purchasedOfferFor(shrine, order, 'travelDealRefill')?.delay).toBe(2);
  });

  it('is undefined for an unbought slot or a missing Shrine', () => {
    expect(purchasedOfferFor(shrine, order, 'initial:first')).toBeUndefined();
    expect(purchasedOfferFor(shrine, order, 'initial:secondRight')).toBeUndefined();
    expect(purchasedOfferFor(undefined, order, 'initial:secondLeft')).toBeUndefined();
  });
});

describe('isDeliveryFlushHost', () => {
  it('is the Preboss of the fourth entered biome only', () => {
    expect(isDeliveryFlushHost({ kind: 'Preboss' }, { ordinal: 4 })).toBe(true);
    expect(isDeliveryFlushHost({ kind: 'Preboss' }, { ordinal: 3 })).toBe(false);
    expect(isDeliveryFlushHost({ kind: 'Boss' }, { ordinal: 4 })).toBe(false);
    expect(isDeliveryFlushHost(undefined, { ordinal: 4 })).toBe(false);
  });
});

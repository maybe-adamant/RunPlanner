import { describe, expect, it } from 'vitest';
import {
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
} from '../../src/authored-project/addresses';
import {
  dueContactMatches,
  isDeliveryFlushHost,
  isSameRoomDelivery,
  purchasedOfferFor,
  type HermesDeliveryObligation,
} from '../../src/authored-project/hermes-shrine-delivery';
import type { HermesShrineState } from '../../src/authored-project/model';

const biome = createBiomeAddress('Surface', 'O');
const source = createOccurrenceAddress(biome, createOccurrenceId('shrine'));
const host = createOccurrenceAddress(biome, createOccurrenceId('host'));
const other = createOccurrenceAddress(biome, createOccurrenceId('other'));

function obligation(due?: HermesDeliveryObligation['due']): HermesDeliveryObligation {
  return Object.freeze({
    entryKey: 'entry',
    source,
    generationKey: 'initial:first',
    rewardType: 'HealBigDrop',
    rushed: due?.cause === 'rush',
    ...(due === undefined ? {} : { due }),
  });
}

describe('isSameRoomDelivery', () => {
  it('matches only the identical route, biome and occurrence', () => {
    expect(isSameRoomDelivery(source, source)).toBe(true);
    expect(isSameRoomDelivery(source, { ...source })).toBe(true);
    expect(isSameRoomDelivery(source, host)).toBe(false);
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
    { kind: 'purchaseHermesShrineOffer', generationKey: 'initial:secondLeft', rushed: false },
    { kind: 'purchaseHermesShrineOffer', generationKey: 'travelDealRefill', rushed: true },
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

describe('dueContactMatches', () => {
  const countdown = obligation({
    host,
    encounterPhaseKey: 'Encounter',
    cause: 'countdown',
    historySequence: 7,
  });
  const rush = obligation({ host: source, cause: 'rush', historySequence: 2 });
  const flush = obligation({ host, cause: 'flush', historySequence: 11 });

  it('never matches while the obligation is still counting down', () => {
    expect(dueContactMatches(obligation(), host)).toBe(false);
    expect(dueContactMatches(obligation(), host, { encounterPhaseKey: 'Encounter' })).toBe(false);
  });

  it('matches the due host at any phase when no contact phase is given', () => {
    expect(dueContactMatches(countdown, host)).toBe(true);
    expect(dueContactMatches(rush, source)).toBe(true);
    expect(dueContactMatches(flush, host)).toBe(true);
  });

  it('requires the exact due phase when a contact phase is given', () => {
    expect(dueContactMatches(countdown, host, { encounterPhaseKey: 'Encounter' })).toBe(true);
    expect(dueContactMatches(countdown, host, { encounterPhaseKey: 'Combat2' })).toBe(false);
    expect(dueContactMatches(countdown, host, {})).toBe(false);
  });

  it('treats a rush or flush as a phase-less contact', () => {
    expect(dueContactMatches(rush, source, {})).toBe(true);
    expect(dueContactMatches(rush, source, { encounterPhaseKey: 'Encounter' })).toBe(false);
    expect(dueContactMatches(flush, host, {})).toBe(true);
    expect(dueContactMatches(flush, host, { encounterPhaseKey: 'Encounter' })).toBe(false);
  });

  it('rejects another host regardless of phase', () => {
    expect(dueContactMatches(countdown, other)).toBe(false);
    expect(dueContactMatches(countdown, other, { encounterPhaseKey: 'Encounter' })).toBe(false);
    expect(dueContactMatches(rush, host)).toBe(false);
    expect(dueContactMatches(flush, source, {})).toBe(false);
  });
});

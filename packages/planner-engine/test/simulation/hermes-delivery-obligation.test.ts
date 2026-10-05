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
  purchaseFor,
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

describe('purchaseFor', () => {
  const shrine: HermesShrineState = {
    offerBySlot: {
      first: { rewardType: 'HealBigDrop' },
      secondLeft: { rewardType: 'MaxHealthDrop' },
      secondRight: null,
    },
    purchaseBySlot: { secondLeft: { delay: 4 } },
    travelDealRefill: {
      offer: { rewardType: 'MaxManaDrop' },
      purchase: { delay: 2 },
    },
  };

  it('reads the initial slot purchase or the Travel Deal refill purchase', () => {
    expect(purchaseFor(shrine, 'initial:secondLeft')).toEqual({ delay: 4 });
    expect(purchaseFor(shrine, 'travelDealRefill')).toEqual({ delay: 2 });
  });

  it('is undefined for an unpurchased slot or a missing Shrine', () => {
    expect(purchaseFor(shrine, 'initial:first')).toBeUndefined();
    expect(purchaseFor(shrine, 'initial:secondRight')).toBeUndefined();
    expect(purchaseFor(undefined, 'initial:first')).toBeUndefined();
    expect(purchaseFor({ offerBySlot: shrine.offerBySlot }, 'travelDealRefill')).toBeUndefined();
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

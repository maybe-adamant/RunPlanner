import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { loadSurfaceNQuickBuckCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import { nBiome, nOccurrenceIds } from '@run-planner/test-fixtures/surface';

import {
  createAcquisitionRoleAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createIncomingRewardAddress,
  createNemesisRandomEventAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  createTraitOfferAddress,
  semanticAddressKey,
} from '../../src/authored-project/addresses';
import { artificerReplacementEntryKey } from '../../src/authored-project/acquisition/artificer';
import { acquisitionEntrySourceFamily } from '../../src/authored-project/acquisition/entry-source-family';
import {
  ERIS_GIFT_ENTRY_KEY,
  ERIS_GIFT_SITE_KEY,
} from '../../src/authored-project/acquisition/eris-gift';
import {
  clockedTraitGeneratedPickupEntryKey,
  echoLastRewardPickupEntryKey,
  nemesisGeneratedPickupSiteKey,
  selectedPickupProducers,
  type SelectedPickupProducer,
} from '../../src/authored-project/acquisition/pickup-producers';
import {
  SEA_STAR_DUPLICATE_ENTRY_KEY,
  seaStarDuplicateSiteKey,
} from '../../src/authored-project/acquisition/sea-star';
import { hermesShrineDeliveryEntryKey } from '../../src/authored-project/hermes-shrine-delivery';
import { composeStartingReward } from '../../src/authored-project/room-state/starting-reward';
import {
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  TRAVEL_DEAL_REFILL_ENTRY_KEY,
} from '../../src/authored-project/shop';

const biome = createBiomeAddress('Surface', 'O');
const occurrenceId = createOccurrenceId('source-family-host');
const host = createOccurrenceAddress(biome, occurrenceId);
const phase = createEncounterPhaseAddress(biome, { kind: 'occurrence', occurrenceId }, 'Combat1');

function quickBuckProducer(): SelectedPickupProducer {
  const project = loadSurfaceNQuickBuckCheckpoint();
  const occurrence = project.route.biomes
    .find((candidate) => candidate.biomeKey === 'N')
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === nOccurrenceIds.opening);
  if (occurrence === undefined) throw new Error('Quick Buck source occurrence is missing');
  const producer = selectedPickupProducers(
    catalog,
    nBiome,
    occurrence,
    catalog.rooms.byKey[occurrence.gameName]!,
    1,
    composeStartingReward(
      project.route.loadout.startingReward,
      occurrence.startingRewardAcquisition,
    ) ?? undefined,
  ).find((candidate) => candidate.traitKey === 'MoneyMultiplierBoon');
  if (producer === undefined) throw new Error('Quick Buck producer is missing');
  return producer;
}

function declaredTraitKey(
  predicate: (
    disposition: NonNullable<(typeof catalog.traits.values)[number]['selectedDisposition']>,
  ) => boolean,
): string {
  const trait = catalog.traits.values.find(
    (candidate) =>
      candidate.selectedDisposition !== undefined && predicate(candidate.selectedDisposition),
  );
  if (trait === undefined) throw new Error('declared trait is missing');
  return trait.key;
}

describe('acquisition entry source family', () => {
  it('names a selected trait producer’s pickup by its trait', () => {
    const producer = quickBuckProducer();
    expect(
      acquisitionEntrySourceFamily(catalog, producer.siteKey, producer.pickups[0]!.key, producer),
    ).toEqual({ kind: 'trait', traitKey: 'MoneyMultiplierBoon' });
  });

  it('names a clocked pickup by the trait that declares it', () => {
    const supplyChain = catalog.traits.byKey.SupplyDropBoon?.selectedDisposition;
    if (supplyChain?.kind !== 'producePickups') throw new Error('Supply Chain is not a producer');
    const identity = semanticAddressKey(createTraitOfferAddress(phase, 'selection'));
    for (const pickup of supplyChain.pickups)
      expect(
        acquisitionEntrySourceFamily(
          catalog,
          'roomExit',
          clockedTraitGeneratedPickupEntryKey(identity, pickup.key),
          undefined,
        ),
      ).toEqual({ kind: 'trait', traitKey: 'SupplyDropBoon' });
    expect(
      acquisitionEntrySourceFamily(
        catalog,
        'roomExit',
        clockedTraitGeneratedPickupEntryKey(identity, 'undeclared'),
        undefined,
      ),
    ).toBeUndefined();
  });

  it('names Echo’s replay and Gold duplicate as Echo', () => {
    const echoTraitKey = declaredTraitKey(
      (disposition) => disposition.kind === 'echo' && disposition.effect === 'lastReward',
    );
    const entryKey = echoLastRewardPickupEntryKey('Combat1', 'selection', 'option1');
    const producer: SelectedPickupProducer = {
      traitKey: echoTraitKey,
      producerLifecycleKey: 'EchoLastReward',
      placement: 'afterSource',
      source: createTraitOfferAddress(phase, 'selection'),
      sourceAction: { kind: 'interactEncounter', phaseKey: 'Combat1' },
      sourceNormal: true,
      siteKey: 'roomExit',
      pickups: [{ key: entryKey, required: true }],
    };
    expect(acquisitionEntrySourceFamily(catalog, 'roomExit', entryKey, producer)).toEqual({
      kind: 'echo',
    });
    expect(
      acquisitionEntrySourceFamily(
        catalog,
        'roomExit',
        ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
        undefined,
      ),
    ).toEqual({ kind: 'echo' });
  });

  it('names an Artificer replacement wherever its site is', () => {
    const entryKey = artificerReplacementEntryKey(
      createIncomingRewardAddress(biome, occurrenceId),
      'self',
    );
    for (const siteKey of ['artificerSource:x', 'hermesShrineDelivery', 'roomExit'])
      expect(acquisitionEntrySourceFamily(catalog, siteKey, entryKey, undefined)).toEqual({
        kind: 'artificer',
      });
  });

  it('names a Sea Star duplicate', () => {
    const siteKey = seaStarDuplicateSiteKey(
      createAcquisitionRoleAddress(createIncomingRewardAddress(biome, occurrenceId), 'self'),
    );
    expect(
      acquisitionEntrySourceFamily(catalog, siteKey, SEA_STAR_DUPLICATE_ENTRY_KEY, undefined),
    ).toEqual({ kind: 'seaStar' });
  });

  it('names a Nemesis random event result and the Eris gift by their producers', () => {
    const nemesisSiteKey = nemesisGeneratedPickupSiteKey('Combat1');
    const nemesis: SelectedPickupProducer = {
      producerLifecycleKey: 'NemesisEventPickup',
      placement: 'afterSource',
      source: createNemesisRandomEventAddress(phase),
      sourceAction: { kind: 'interactEncounter', phaseKey: 'Combat1' },
      sourceNormal: true,
      siteKey: nemesisSiteKey,
      pickups: [{ key: 'result', required: false }],
    };
    expect(acquisitionEntrySourceFamily(catalog, nemesisSiteKey, 'result', nemesis)).toEqual({
      kind: 'nemesisEvent',
    });
    const eris: SelectedPickupProducer = {
      producerLifecycleKey: 'ErisGift',
      placement: 'afterSource',
      source: createRoomActionAddress(biome, occurrenceId, 'interactEris'),
      sourceAction: { kind: 'interactEris' },
      sourceNormal: true,
      siteKey: ERIS_GIFT_SITE_KEY,
      pickups: [{ key: ERIS_GIFT_ENTRY_KEY, required: true }],
    };
    expect(
      acquisitionEntrySourceFamily(catalog, ERIS_GIFT_SITE_KEY, ERIS_GIFT_ENTRY_KEY, eris),
    ).toEqual({ kind: 'erisGift' });
  });

  it('names a Hermes Shrine delivery and the World Shop Travel Deal restock', () => {
    expect(
      acquisitionEntrySourceFamily(
        catalog,
        'hermesShrineDelivery',
        hermesShrineDeliveryEntryKey(host, 'initial:first'),
        undefined,
      ),
    ).toEqual({ kind: 'hermesShrineDelivery' });
    expect(
      acquisitionEntrySourceFamily(catalog, 'roomExit', TRAVEL_DEAL_REFILL_ENTRY_KEY, undefined),
    ).toEqual({ kind: 'shopTravelDealRefill' });
  });

  it('names nothing for an entry no declared source owns', () => {
    expect(acquisitionEntrySourceFamily(catalog, 'roomExit', 'unowned', undefined)).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { loadSurfaceNQuickBuckCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import { nBiome, nOccurrenceIds } from '@run-planner/test-fixtures/surface';

import { createBiomeAddress, createOccurrenceId } from '../../src/authored-project/addresses';
import type { RoomOccurrence } from '../../src/authored-project/model';
import {
  parseTraitGeneratedPickupSiteKey,
  reconcileSelectedPickupProducerState,
  selectedPickupProducers,
} from '../../src/authored-project/pickup-producers';

const biome = createBiomeAddress('Surface', 'N');

function occurrenceWithStaleProducerSite(): RoomOccurrence {
  return {
    occurrenceId: createOccurrenceId('pickup-producer-test'),
    gameName: 'N_Opening01',
    state: { kind: 'none' },
    encounters: { encounterKeyByPhase: {} },
    roomActions: {
      order: [
        {
          kind: 'interactAcquisitionEntry',
          siteKey: 'traitGenerated:stale-source:option1',
          entryKey: 'stale',
        },
      ],
    },
    acquisitionSites: {
      'traitGenerated:stale-source:option1': { pickupEntries: { stale: null } },
    },
    additionalExits: [],
  } as unknown as RoomOccurrence;
}

describe('authored pickup producers', () => {
  it('accepts only the closed generated-trait site-key shape', () => {
    expect(parseTraitGeneratedPickupSiteKey('traitGenerated:source%3Akey:option2')).toEqual({
      sourceKey: 'source:key',
      optionKey: 'option2',
    });
    expect(parseTraitGeneratedPickupSiteKey('traitGenerated:source:option4')).toBeUndefined();
  });

  it('removes an unselected generated producer site and its action', () => {
    const occurrence = occurrenceWithStaleProducerSite();
    expect(selectedPickupProducers(catalog, biome, occurrence)).toEqual([]);

    const reconciled = reconcileSelectedPickupProducerState(catalog, biome, occurrence);
    expect(reconciled.acquisitionSites).toBeUndefined();
    expect(reconciled.roomActions.order).toEqual([]);
  });

  it('discovers and preserves Quick Buck’s selected producer site, entry, and source action', () => {
    const project = loadSurfaceNQuickBuckCheckpoint();
    const occurrence = project.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((candidate) => candidate.biomeKey === 'N')
      ?.topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === nOccurrenceIds.opening,
      );
    if (occurrence === undefined) throw new Error('Quick Buck source occurrence is missing');

    const producer = selectedPickupProducers(catalog, nBiome, occurrence).find(
      (candidate) => candidate.traitKey === 'MoneyMultiplierBoon',
    );
    if (producer === undefined) throw new Error('Quick Buck producer is missing');
    expect(producer.sourceNormal).toBe(true);
    expect(producer.pickups).toEqual([
      { key: 'quickBuckGold', rewardType: 'RoomMoneyDrop', required: false },
    ]);

    const reconciled = reconcileSelectedPickupProducerState(catalog, nBiome, occurrence);
    expect(reconciled.acquisitionSites?.[producer.siteKey]?.pickupEntries).toMatchObject({
      quickBuckGold: { offer: { rewardType: 'RoomMoneyDrop' } },
    });
    expect(reconciled.roomActions.order).toContainEqual(producer.sourceAction);
  });
});

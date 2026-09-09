import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { loadSurfaceNQuickBuckCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import { nBiome, nOccurrenceIds } from '@run-planner/test-fixtures/surface';

import {
  createBiomeAddress,
  createEncounterPhaseAddress,
  createOccurrenceId,
  createTraitOfferAddress,
  semanticAddressKey,
} from '../../src/authored-project/addresses';
import type { ProjectDocument, RoomOccurrence } from '../../src/authored-project/model';
import {
  clockedTraitGeneratedPickupEntryKey,
  parseTraitGeneratedPickupSiteKey,
  reconcileSelectedPickupProducerState,
  retractInactiveClockedTraitPickupActions,
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
    const occurrence = project.route.biomes
      .find((candidate) => candidate.biomeKey === 'N')
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

  it('retracts only a removed Supply Chain source’s later clocked action and retains its payload', () => {
    const sourceId = createOccurrenceId('supply-source');
    const hostId = createOccurrenceId('supply-host');
    const sourceOwner = createEncounterPhaseAddress(
      biome,
      { kind: 'occurrence', occurrenceId: sourceId },
      'Encounter',
    );
    const sourceIdentity = `${semanticAddressKey(createTraitOfferAddress(sourceOwner, 'selection'))}:7`;
    const entryKey = clockedTraitGeneratedPickupEntryKey(sourceIdentity, 'pomSlice1');
    const unrelated = clockedTraitGeneratedPickupEntryKey('other-source:7', 'pomSlice1');
    const supplyOffer = {
      kind: 'traits' as const,
      giverKey: 'Icarus',
      options: [
        { traitKey: 'SupplyDropBoon' },
        { traitKey: 'OmegaExplodeBoon' },
        { traitKey: 'CastHazardBoon' },
      ] as const,
      selectedOptionKey: 'option1' as const,
    };
    const source = {
      occurrenceId: sourceId,
      gameName: 'N_Opening01',
      state: { kind: 'none' },
      encounters: {
        encounterKeyByPhase: { Encounter: 'Icarus' },
        traitOffersByPhase: { Encounter: { Icarus: supplyOffer } },
      },
      roomActions: { order: [{ kind: 'interactEncounter', phaseKey: 'Encounter' }] },
      additionalExits: [],
    } as unknown as RoomOccurrence;
    const host = {
      occurrenceId: hostId,
      gameName: 'N_Opening01',
      state: { kind: 'none' },
      encounters: {},
      roomActions: {
        order: [
          { kind: 'interactAcquisitionEntry', siteKey: 'roomExit', entryKey },
          { kind: 'interactAcquisitionEntry', siteKey: 'roomExit', entryKey: unrelated },
        ],
      },
      acquisitionSites: { roomExit: { pickupEntries: { [entryKey]: null, [unrelated]: null } } },
      additionalExits: [],
    } as unknown as RoomOccurrence;
    const previous = {
      route: {
        routeKey: 'Surface',
        biomes: [{ biomeKey: 'N', topology: { occurrences: [source, host] } }],
      },
    } as unknown as ProjectDocument;
    const replacedSource = {
      ...source,
      encounters: {
        traitOffersByPhase: {
          Encounter: { Icarus: { ...supplyOffer, selectedOptionKey: 'option2' as const } },
        },
      },
    } as unknown as RoomOccurrence;
    const replaced = {
      ...previous,
      route: {
        ...previous.route,
        biomes: [
          { ...previous.route.biomes[0]!, topology: { occurrences: [replacedSource, host] } },
        ],
      },
    } as unknown as ProjectDocument;
    const result = retractInactiveClockedTraitPickupActions(catalog, previous, replaced);
    const resultHost = result.route.biomes[0]!.topology!.occurrences[1]!;
    expect(resultHost.roomActions.order).toEqual([
      { kind: 'interactAcquisitionEntry', siteKey: 'roomExit', entryKey: unrelated },
    ]);
    expect(resultHost.acquisitionSites?.roomExit?.pickupEntries).toEqual({
      [entryKey]: null,
      [unrelated]: null,
    });
  });

  it('recognizes Supply Chain acquired by a Concave Stone secondary', () => {
    const sourceId = createOccurrenceId('concave-supply-source');
    const hostId = createOccurrenceId('concave-supply-host');
    const sourceOwner = createEncounterPhaseAddress(
      biome,
      { kind: 'occurrence', occurrenceId: sourceId },
      'Encounter',
    );
    const sourceIdentity = `${semanticAddressKey(createTraitOfferAddress(sourceOwner, 'concaveStoneSecondary'))}:8`;
    const entryKey = clockedTraitGeneratedPickupEntryKey(sourceIdentity, 'pomSlice1');
    const offer = {
      kind: 'traits' as const,
      giverKey: 'Icarus',
      options: [
        { traitKey: 'OmegaExplodeBoon' },
        { traitKey: 'SupplyDropBoon' },
        { traitKey: 'CastHazardBoon' },
      ] as const,
      selectedOptionKey: 'option1' as const,
      concaveStoneResult: { kind: 'proc' as const, optionKey: 'option2' as const },
    };
    const source = {
      occurrenceId: sourceId,
      gameName: 'N_Opening01',
      state: { kind: 'none' },
      encounters: {
        encounterKeyByPhase: { Encounter: 'Icarus' },
        traitOffersByPhase: { Encounter: { Icarus: offer } },
      },
      roomActions: { order: [{ kind: 'interactEncounter', phaseKey: 'Encounter' }] },
      additionalExits: [],
    } as unknown as RoomOccurrence;
    const host = {
      occurrenceId: hostId,
      gameName: 'N_Opening01',
      state: { kind: 'none' },
      encounters: {},
      roomActions: { order: [{ kind: 'interactAcquisitionEntry', siteKey: 'roomExit', entryKey }] },
      acquisitionSites: { roomExit: { pickupEntries: { [entryKey]: null } } },
      additionalExits: [],
    } as unknown as RoomOccurrence;
    const previous = {
      route: {
        routeKey: 'Surface',
        biomes: [{ biomeKey: 'N', topology: { occurrences: [source, host] } }],
      },
    } as unknown as ProjectDocument;
    const noProc = {
      ...previous,
      route: {
        ...previous.route,
        biomes: [
          {
            ...previous.route.biomes[0]!,
            topology: {
              occurrences: [
                {
                  ...source,
                  encounters: {
                    traitOffersByPhase: {
                      Encounter: { Icarus: { ...offer, concaveStoneResult: { kind: 'noProc' } } },
                    },
                  },
                } as unknown as RoomOccurrence,
                host,
              ],
            },
          },
        ],
      },
    } as unknown as ProjectDocument;
    const result = retractInactiveClockedTraitPickupActions(catalog, previous, noProc);
    expect(result.route.biomes[0]!.topology!.occurrences[1]!.roomActions.order).toEqual([]);
    expect(
      result.route.biomes[0]!.topology!.occurrences[1]!.acquisitionSites?.roomExit?.pickupEntries,
    ).toEqual({
      [entryKey]: null,
    });
  });
});

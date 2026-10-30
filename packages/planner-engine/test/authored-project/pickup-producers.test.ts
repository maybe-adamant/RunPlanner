import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { loadSurfaceNQuickBuckCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import { loadUnderworldFGCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  loadSurfaceNOProject,
  nBiome,
  nOccurrenceIds,
  oBiome,
  oOccurrenceIds,
} from '@run-planner/test-fixtures/surface';

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
} from '../../src/authored-project/acquisition/pickup-producers';
import { composeStartingReward } from '../../src/authored-project/room-state/starting-reward';

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
    expect(
      selectedPickupProducers(
        catalog,
        biome,
        occurrence,
        catalog.rooms.byKey[occurrence.gameName]!,
        1,
      ),
    ).toEqual([]);

    const reconciled = reconcileSelectedPickupProducerState(
      catalog,
      biome,
      occurrence,
      catalog.rooms.byKey[occurrence.gameName]!,
      1,
    );
    expect(reconciled.acquisitionSites).toBeUndefined();
    expect(reconciled.roomActions.order).toEqual([]);
  });

  it('discovers a producer on the rerolled reward, not on the first draw', () => {
    const underworldF = createBiomeAddress('Underworld', 'F');
    const room = loadUnderworldFGCheckpoint().route.biomes[0]!.topology!.occurrences.find(
      (candidate) => candidate.occurrenceId === 'golden-f-b3-e2',
    )!;
    const rerolled = {
      ...room,
      rerolledIncomingReward: {
        offer: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' } },
        traitOffersByAcquisitionRole: {
          source: {
            kind: 'traits',
            giverKey: 'Poseidon',
            options: [
              { traitKey: 'RoomRewardBonusBoon', rarity: 'Common' },
              { traitKey: 'PoseidonWeaponBoon', rarity: 'Common' },
              { traitKey: 'PoseidonSpecialBoon', rarity: 'Common' },
            ],
            selectedOptionKey: 'option1',
            rarificationActions: [],
          },
        },
        dispositionByAcquisitionRole: { source: { kind: 'normal' } },
      },
    } as unknown as RoomOccurrence;
    const producers = (occurrence: RoomOccurrence) =>
      selectedPickupProducers(
        catalog,
        underworldF,
        occurrence,
        catalog.rooms.byKey[occurrence.gameName]!,
        1,
      ).map((producer) => producer.traitKey);
    expect(producers(room)).toEqual([]);
    expect(producers(rerolled)).toEqual(['RoomRewardBonusBoon']);
  });

  it('keeps a producer on an unpicked wheel offer out of acquisition', () => {
    const room = loadSurfaceNOProject()
      .route.biomes.find((biome) => biome.biomeKey === 'O')!
      .topology!.occurrences.find(
        (occurrence) => occurrence.occurrenceId === oOccurrenceIds.combat04,
      )!;
    const ship = room.state;
    if (ship.kind !== 'shipCombat') throw new Error('combat04 is not a Ship room');
    const wheel = ship.wheels.wheel1!;
    const withPick = (pickedOfferIndex: number) =>
      ({
        ...room,
        state: {
          ...ship,
          wheels: {
            ...ship.wheels,
            wheel1: {
              ...wheel,
              offerCount: 2,
              pickedOfferIndex,
              offers: {
                ...wheel.offers,
                offer2: {
                  offer: {
                    rewardType: 'Boon',
                    payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' },
                  },
                  traitOffersByAcquisitionRole: {
                    source: {
                      kind: 'traits',
                      giverKey: 'Poseidon',
                      options: [
                        { traitKey: 'RoomRewardBonusBoon', rarity: 'Common' },
                        { traitKey: 'PoseidonWeaponBoon', rarity: 'Common' },
                        { traitKey: 'PoseidonSpecialBoon', rarity: 'Common' },
                      ],
                      selectedOptionKey: 'option1',
                      rarificationActions: [],
                    },
                  },
                  dispositionByAcquisitionRole: { source: { kind: 'normal' } },
                },
              },
            },
          },
        },
      }) as unknown as RoomOccurrence;
    const buriedTreasureNormal = (occurrence: RoomOccurrence) =>
      selectedPickupProducers(
        catalog,
        oBiome,
        occurrence,
        catalog.rooms.byKey[occurrence.gameName]!,
        1,
      ).map((producer) => [producer.traitKey, producer.sourceNormal]);

    expect(buriedTreasureNormal(withPick(2))).toEqual([['RoomRewardBonusBoon', true]]);
    expect(buriedTreasureNormal(withPick(1))).toEqual([['RoomRewardBonusBoon', false]]);
  });

  it('discovers and preserves Quick Buck’s selected producer site, entry, and source action', () => {
    const project = loadSurfaceNQuickBuckCheckpoint();
    const occurrence = project.route.biomes
      .find((candidate) => candidate.biomeKey === 'N')
      ?.topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === nOccurrenceIds.opening,
      );
    if (occurrence === undefined) throw new Error('Quick Buck source occurrence is missing');
    const routeStartIncoming = composeStartingReward(
      project.route.loadout.startingReward,
      occurrence.startingRewardAcquisition,
    );
    if (routeStartIncoming === null) throw new Error('Quick Buck source reward is missing');

    const producer = selectedPickupProducers(
      catalog,
      nBiome,
      occurrence,
      catalog.rooms.byKey[occurrence.gameName]!,
      1,
      routeStartIncoming,
    ).find((candidate) => candidate.traitKey === 'MoneyMultiplierBoon');
    if (producer === undefined) throw new Error('Quick Buck producer is missing');
    expect(producer.sourceNormal).toBe(true);
    expect(producer.pickups).toEqual([
      { key: 'quickBuckGold', rewardType: 'RoomMoneyDrop', required: false },
    ]);

    const reconciled = reconcileSelectedPickupProducerState(
      catalog,
      nBiome,
      occurrence,
      catalog.rooms.byKey[occurrence.gameName]!,
      1,
      routeStartIncoming,
    );
    expect(reconciled.acquisitionSites?.[producer.siteKey]?.pickupEntries).toMatchObject({
      quickBuckGold: { offer: { rewardType: 'RoomMoneyDrop' } },
    });
    expect(reconciled.roomActions.order).toContainEqual(producer.sourceAction);
  });

  it('retracts only a removed Supply Chain source’s later clocked action and retains its payload', () => {
    const sourceId = createOccurrenceId('supply-source');
    const hostId = createOccurrenceId('supply-host');
    const sourceBiome = createBiomeAddress('Surface', 'O');
    const sourceOwner = createEncounterPhaseAddress(
      sourceBiome,
      { kind: 'occurrence', occurrenceId: sourceId },
      'Combat1',
    );
    const sourceIdentity = semanticAddressKey(createTraitOfferAddress(sourceOwner, 'selection'));
    const entryKey = clockedTraitGeneratedPickupEntryKey(sourceIdentity, 'pomSlice1');
    const siblingEntryKey = clockedTraitGeneratedPickupEntryKey(sourceIdentity, 'pomSlice2');
    const legacyPrefixedIdentity = clockedTraitGeneratedPickupEntryKey(
      `${sourceIdentity}:7`,
      'pomSlice1',
    );
    const unrelated = clockedTraitGeneratedPickupEntryKey('other-source', 'pomSlice1');
    const unrelatedSibling = clockedTraitGeneratedPickupEntryKey('other-source', 'pomSlice2');
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
      gameName: 'O_Combat01',
      state: { kind: 'none' },
      encounters: {
        encounterKeyByPhase: { Intro: 'GeneratedO_Intro01', Combat1: 'IcarusCombatO' },
        traitOffersByPhase: { Combat1: { IcarusCombatO: supplyOffer } },
      },
      roomActions: { order: [{ kind: 'interactEncounter', phaseKey: 'Combat1' }] },
      additionalExits: [],
    } as unknown as RoomOccurrence;
    const host = {
      occurrenceId: hostId,
      gameName: 'O_Combat01',
      state: { kind: 'none' },
      encounters: {},
      roomActions: {
        order: [
          { kind: 'interactAcquisitionEntry', siteKey: 'roomExit', entryKey },
          { kind: 'interactAcquisitionEntry', siteKey: 'roomExit', entryKey: siblingEntryKey },
          {
            kind: 'interactAcquisitionEntry',
            siteKey: 'roomExit',
            entryKey: legacyPrefixedIdentity,
          },
          { kind: 'interactAcquisitionEntry', siteKey: 'roomExit', entryKey: unrelated },
          {
            kind: 'interactAcquisitionEntry',
            siteKey: 'roomExit',
            entryKey: unrelatedSibling,
          },
        ],
      },
      acquisitionSites: {
        roomExit: {
          pickupEntries: {
            [entryKey]: null,
            [siblingEntryKey]: null,
            [legacyPrefixedIdentity]: null,
            [unrelated]: null,
            [unrelatedSibling]: null,
          },
        },
      },
      additionalExits: [],
    } as unknown as RoomOccurrence;
    const previous = {
      route: {
        routeKey: 'Surface',
        itineraryBiomeKeys: ['N', 'O', 'P', 'Q'],
        biomes: [{ biomeKey: 'O', topology: { occurrences: [source, host] } }],
      },
    } as unknown as ProjectDocument;
    expect(retractInactiveClockedTraitPickupActions(catalog, previous, previous)).toBe(previous);
    const replacedSource = {
      ...source,
      encounters: {
        encounterKeyByPhase: source.encounters.encounterKeyByPhase,
        traitOffersByPhase: {
          Combat1: {
            IcarusCombatO: { ...supplyOffer, selectedOptionKey: 'option2' as const },
          },
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
      {
        kind: 'interactAcquisitionEntry',
        siteKey: 'roomExit',
        entryKey: legacyPrefixedIdentity,
      },
      { kind: 'interactAcquisitionEntry', siteKey: 'roomExit', entryKey: unrelated },
      {
        kind: 'interactAcquisitionEntry',
        siteKey: 'roomExit',
        entryKey: unrelatedSibling,
      },
    ]);
    expect(resultHost.acquisitionSites?.roomExit?.pickupEntries).toEqual({
      [entryKey]: null,
      [siblingEntryKey]: null,
      [legacyPrefixedIdentity]: null,
      [unrelated]: null,
      [unrelatedSibling]: null,
    });
  });
});

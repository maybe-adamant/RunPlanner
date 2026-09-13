import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { oBiome, oOccurrenceIds } from '@run-planner/test-fixtures/surface';
import {
  applyProjectCommand,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createOccurrenceAddress,
  createRoomActionAddress,
  parseClockedTraitGeneratedPickupEntryKey,
  roomActionKey,
  type ProjectDocument,
} from '../../../src/authored-project';
import { activeRoomActionReferences } from '../../../src/authored-project/room-actions/state';
import {
  derivedAcquisitionEntriesForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '../../../src/simulation';
import { surfaceScheduledLifecycleWithQSupplyChainSlicesProject } from '../../execution-plan/support/scheduled-lifecycle-fixture';

function placements(project: ProjectDocument) {
  return project.route.biomes.flatMap((biome) =>
    (biome.topology?.occurrences ?? []).flatMap((occurrence) =>
      occurrence.roomActions.order.flatMap((reference) =>
        reference.kind === 'interactAcquisitionEntry' &&
        parseClockedTraitGeneratedPickupEntryKey(reference.entryKey) !== undefined
          ? [
              {
                biome: createBiomeAddress(project.route.routeKey, biome.biomeKey),
                occurrence,
                reference,
              },
            ]
          : [],
      ),
    ),
  );
}

describe('clocked pickup placement cleanup', () => {
  it('can discard an obsolete host placement without resurrecting it or erasing the actual due host', () => {
    const project = surfaceScheduledLifecycleWithQSupplyChainSlicesProject();
    const before = placements(project);
    const { biome, occurrence, reference } = before.find((entry) => entry.biome.biomeKey === 'Q')!;
    const oldHost = project.route.biomes
      .find((candidate) => candidate.biomeKey === 'Q')!
      .topology!.occurrences.find(
        (candidate) =>
          candidate.gameName.startsWith('Q_Combat') &&
          candidate.occurrenceId !== occurrence.occurrenceId,
      )!;
    const site = createAcquisitionSiteAddress(
      createOccurrenceAddress(biome, oldHost.occurrenceId),
      'roomExit',
    );
    // A saved placement can outlive its timing after an upstream edit. Keep
    // the same recurring source key at a different host to exercise repair.
    const stale = applyProjectCommand(project, catalog, {
      kind: 'PlaceClockedTraitPickup',
      entry: createAcquisitionEntryAddress(site, reference.entryKey),
      encounterPhaseKey: 'Encounter',
      rewardType: 'StoreRewardRandomStack',
      producerLifecycleKey: 'GeneratedTraitPickup',
    });
    const placed = placements(stale).find(
      (entry) => entry.occurrence.occurrenceId === oldHost.occurrenceId,
    )!;
    expect(placed).toBeDefined();
    const removed = applyProjectCommand(stale, catalog, {
      kind: 'RemoveRoomAction',
      action: createRoomActionAddress(biome, oldHost.occurrenceId, roomActionKey(placed.reference)),
    });
    expect(placements(removed)).toEqual(before);
    const host = removed.route.biomes
      .find((candidate) => candidate.biomeKey === 'Q')!
      .topology!.occurrences.find((candidate) => candidate.occurrenceId === oldHost.occurrenceId)!;
    expect(host.acquisitionSites?.roomExit?.pickupEntries?.[reference.entryKey]).toBeUndefined();
    expect(activeRoomActionReferences(catalog, biome, host).map(roomActionKey)).not.toContain(
      roomActionKey(placed.reference),
    );
  });

  it('removes a placement and its payload without removing the due drop or other recurring placements', () => {
    const project = surfaceScheduledLifecycleWithQSupplyChainSlicesProject();
    const before = placements(project);
    const selected = before.find((entry) => entry.biome.biomeKey === 'Q')!;
    const { biome, occurrence, reference } = selected;
    const action = createRoomActionAddress(
      biome,
      occurrence.occurrenceId,
      roomActionKey(reference),
    );
    const removed = applyProjectCommand(project, catalog, { kind: 'RemoveRoomAction', action });
    expect(placements(removed)).toEqual(
      before
        .filter((entry) => entry !== selected)
        .map((entry) => ({
          ...entry,
          occurrence: removed.route.biomes
            .find((candidate) => candidate.biomeKey === entry.biome.biomeKey)!
            .topology!.occurrences.find(
              (candidate) => candidate.occurrenceId === entry.occurrence.occurrenceId,
            )!,
        })),
    );
    const host = removed.route.biomes
      .find((candidate) => candidate.biomeKey === biome.biomeKey)!
      .topology!.occurrences.find(
        (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
      )!;
    expect(host.acquisitionSites?.roomExit?.pickupEntries?.[reference.entryKey]).toBeUndefined();
    expect(activeRoomActionReferences(catalog, biome, host)).not.toContainEqual(reference);
    const assembly = simulateProjectAssembly(catalog, removed);
    const site = createAcquisitionSiteAddress(
      createOccurrenceAddress(biome, occurrence.occurrenceId),
      'roomExit',
    );
    expect(derivedAcquisitionEntriesForProjectEvaluationAssembly(assembly, site)).toContainEqual(
      expect.objectContaining({
        address: expect.objectContaining({ entryKey: reference.entryKey }),
      }),
    );
    expect(
      occurrence.acquisitionSites?.roomExit?.pickupEntries?.[reference.entryKey],
    ).toBeDefined();
  });

  it('keeps retracted source payload dormant rather than resurrecting optional pickup actions', () => {
    const project = surfaceScheduledLifecycleWithQSupplyChainSlicesProject();
    const before = placements(project);
    expect(before.length).toBeGreaterThan(2);
    const removed = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase: createEncounterPhaseAddress(
        oBiome,
        { kind: 'occurrence', occurrenceId: oOccurrenceIds.combat01 },
        'Combat1',
      ),
      encounterKey: 'GeneratedO',
    });
    expect(placements(removed)).toEqual([]);
    for (const { biome, occurrence, reference } of before) {
      const host = removed.route.biomes
        .find((candidate) => candidate.biomeKey === biome.biomeKey)!
        .topology!.occurrences.find(
          (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
        )!;
      expect(host.acquisitionSites?.roomExit?.pickupEntries?.[reference.entryKey]).toEqual(
        occurrence.acquisitionSites?.roomExit?.pickupEntries?.[reference.entryKey],
      );
      expect(activeRoomActionReferences(catalog, biome, host).map(roomActionKey)).not.toContain(
        roomActionKey(reference),
      );
    }
  });
});

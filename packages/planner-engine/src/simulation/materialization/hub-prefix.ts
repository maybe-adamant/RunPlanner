import type { BiomeAddress } from '../../authored-project/addresses';
import type { HubBiomePlan, OccurrenceId, RoomOccurrence } from '../../authored-project/model';
import type { Catalog } from '../../catalog-schema';
import {
  fixedHubDescriptors,
  fixedHubOccurrence,
  materializeHubAuthoredRoom,
  materializeHubBoard,
  materializeHubRoom,
  materializeHubVisits,
  requireHubMaterializationLayout,
  requireHubRoom,
} from './hub';
import type { MaterializedHubBiomePrefix } from './model';

function occurrenceMap(
  occurrences: readonly RoomOccurrence[],
): ReadonlyMap<OccurrenceId, RoomOccurrence> {
  return new Map(occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence]));
}

export function materializeHubBiomePrefix(
  catalog: Catalog,
  biome: BiomeAddress,
  plan: HubBiomePlan,
): MaterializedHubBiomePrefix | null {
  const layout = requireHubMaterializationLayout(catalog, biome);
  const topology = plan.topology;
  if (topology === null) {
    return null;
  }
  const occurrences = occurrenceMap(topology.occurrences);
  const entryRooms = Object.freeze(
    fixedHubDescriptors(layout)
      .slice(0, -1)
      .map((descriptor) => {
        const occurrence = fixedHubOccurrence(topology, occurrences, descriptor);
        return materializeHubAuthoredRoom(
          catalog,
          biome,
          occurrence,
          requireHubRoom(catalog, occurrence.gameName),
          true,
          descriptor.state,
        );
      }),
  );
  const hubRoom = materializeHubRoom(catalog, biome, layout);
  const boardComplete =
    topology.openTargets.length >= layout.hub.openCount.min &&
    topology.openTargets.length <= layout.hub.openCount.max;
  if (!boardComplete) {
    return Object.freeze({
      kind: 'HubBiomePrefix',
      routeKey: biome.routeKey,
      biomeKey: biome.biomeKey,
      entryRooms,
      hubRoom,
      visits: Object.freeze([]),
      biomeState: Object.freeze({}),
    });
  }
  const hubBoard = materializeHubBoard(catalog, biome, layout, topology, occurrences, hubRoom);
  return Object.freeze({
    kind: 'HubBiomePrefix',
    routeKey: biome.routeKey,
    biomeKey: biome.biomeKey,
    entryRooms,
    hubRoom,
    hubBoard,
    visits: materializeHubVisits(catalog, biome, topology, hubBoard),
    biomeState: Object.freeze({}),
  });
}

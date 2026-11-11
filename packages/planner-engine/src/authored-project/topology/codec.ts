import type { BiomeLayout, Catalog } from '../../catalog-schema';
import type { BiomeTopology } from '../model';
import type { ResolvedRewardOffer } from '../../reward-kernel/model';
import type { ResolvedRoutePosition } from '../route-context';
import { decodeRoomOccurrence } from './occurrence-codec';
import { decodeTopologyStructure } from './decoding/coordinator';
import { validateRerollResults } from './decoding/reroll-results';

export function decodeBiomeTopology(
  value: unknown,
  catalog: Catalog,
  layout: BiomeLayout,
  routePosition: ResolvedRoutePosition,
  startingReward: ResolvedRewardOffer | null,
  path: string,
): BiomeTopology {
  const structure = decodeTopologyStructure(value, catalog, layout, routePosition, path);
  const topology: BiomeTopology = Object.freeze({
    startOccurrenceId: structure.startOccurrenceId,
    occurrences: Object.freeze(
      structure.occurrences.map((occurrence) =>
        decodeRoomOccurrence({
          occurrence,
          catalog,
          layout,
          routeKey: routePosition.routeKey,
          routePosition,
          startingReward,
          isTopologyStart: occurrence.raw.occurrenceId === structure.startOccurrenceId,
        }),
      ),
    ),
    decisions: structure.decisions,
    fixedRoomLinks: structure.fixedRoomLinks,
  });
  validateRerollResults(catalog, routePosition, layout.biomeKey, topology, path);
  return topology;
}

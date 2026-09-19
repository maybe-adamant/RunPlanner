import type { BiomeLayout, Catalog } from '../../catalog-schema';
import type { BiomeTopology } from '../model';
import type { ResolvedRoutePosition } from '../route-context';
import { decodeRoomOccurrence } from './occurrence-codec';
import { decodeTopologyStructure } from './decoding/coordinator';

export function decodeBiomeTopology(
  value: unknown,
  catalog: Catalog,
  layout: BiomeLayout,
  routePosition: ResolvedRoutePosition,
  path: string,
): BiomeTopology {
  const structure = decodeTopologyStructure(value, catalog, layout, routePosition, path);
  return Object.freeze({
    startOccurrenceId: structure.startOccurrenceId,
    occurrences: Object.freeze(
      structure.occurrences.map((occurrence) =>
        decodeRoomOccurrence({
          occurrence,
          catalog,
          layout,
          routeKey: routePosition.routeKey,
          routePosition,
        }),
      ),
    ),
    decisions: structure.decisions,
    fixedRoomLinks: structure.fixedRoomLinks,
  });
}

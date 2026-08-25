import type { BiomeLayout, Catalog } from '../../catalog-schema';
import type { BiomeTopology } from '../model';
import { decodeRoomOccurrence } from './occurrence-codec';
import { decodeTopologyStructure } from './structure-codec';

export function decodeBiomeTopology(
  value: unknown,
  catalog: Catalog,
  layout: BiomeLayout,
  routeKey: string,
  path: string,
): BiomeTopology {
  const structure = decodeTopologyStructure(value, catalog, layout, path);
  return Object.freeze({
    startOccurrenceId: structure.startOccurrenceId,
    occurrences: Object.freeze(
      structure.occurrences.map((occurrence) =>
        decodeRoomOccurrence({ occurrence, catalog, layout, routeKey }),
      ),
    ),
    decisions: structure.decisions,
  });
}

import type { BiomeTopology, ProjectDocument, RoomOccurrence } from '../model';

import { withBiome, type LocatedBiome } from './contract';

/**
 * Applies an occurrence-local replacement while retaining the topology's
 * structural decisions. Both room replacement and room-local leaf commands
 * use this one immutable mutation; their validation and state policy stay
 * with their respective handlers.
 */
export function replaceOccurrence(
  topology: BiomeTopology,
  replacement: RoomOccurrence,
): BiomeTopology {
  return Object.freeze({
    ...topology,
    occurrences: Object.freeze(
      topology.occurrences.map((occurrence) =>
        occurrence.occurrenceId === replacement.occurrenceId ? replacement : occurrence,
      ),
    ),
  });
}

export function updateOccurrenceTopology(
  document: ProjectDocument,
  located: LocatedBiome,
  topology: BiomeTopology,
): ProjectDocument {
  return withBiome(document, located, { ...located.plan, topology });
}

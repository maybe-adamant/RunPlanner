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

/** Replaces an authored occurrence while retaining topology ownership. */
export function updateOccurrence(
  document: ProjectDocument,
  located: LocatedBiome,
  occurrence: RoomOccurrence,
): ProjectDocument {
  const topology = located.plan.topology;
  if (
    topology === null ||
    !topology.occurrences.some((candidate) => candidate.occurrenceId === occurrence.occurrenceId)
  ) {
    throw new Error(`unknown topology occurrence ${occurrence.occurrenceId}`);
  }
  return withBiome(document, located, {
    ...located.plan,
    topology: replaceOccurrence(topology, occurrence),
  });
}

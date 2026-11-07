import { legacySchema101Body } from './legacy-schema-101';

type Json = Record<string, unknown>;

function record(value: unknown): Json | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Json)
    : undefined;
}

/** The kill-race outcomes a schema-100 save stored: a win by omission, an empty map omitted. */
function sparseOutcomes(occurrence: unknown): unknown {
  const encounters = record(record(occurrence)?.encounters);
  const outcomes = record(encounters?.nemesisBetOutcomeByPhase);
  if (encounters === undefined || outcomes === undefined) return occurrence;
  const kept = Object.entries(outcomes).filter(([, outcome]) => outcome !== 'win');
  const { nemesisBetOutcomeByPhase: _dropped, ...rest } = encounters;
  void _dropped;
  return {
    ...(occurrence as Json),
    encounters:
      kept.length === 0 ? rest : { ...rest, nemesisBetOutcomeByPhase: Object.fromEntries(kept) },
  };
}

/**
 * A current document body in its schema-100 shape, for tests that relabel a
 * current document as schema 100 and load it through the 100 -> 101 transition.
 * Schema 100's final revision is 0, so the current major's revision is dropped.
 */
export function legacySchema100Body<T>(value: T): T {
  const document = record(legacySchema101Body(value));
  const route = record(document?.route);
  if (document === undefined || route === undefined || !Array.isArray(route.biomes)) return value;
  const { schemaRevision: _revision, ...body } = document;
  void _revision;
  return {
    ...body,
    route: {
      ...route,
      biomes: route.biomes.map((biome) => {
        const topology = record(record(biome)?.topology);
        if (topology === undefined || !Array.isArray(topology.occurrences)) return biome;
        return {
          ...(biome as Json),
          topology: { ...topology, occurrences: topology.occurrences.map(sparseOutcomes) },
        };
      }),
    },
  } as T;
}

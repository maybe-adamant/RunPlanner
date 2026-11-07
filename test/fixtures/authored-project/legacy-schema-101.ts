type Json = Record<string, unknown>;

function record(value: unknown): Json | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Json)
    : undefined;
}

const ANCHORED_OBJECTS = ['stygianWell', 'purgingPool', 'hermesShrine', 'challengeSwitch'];

/**
 * One occurrence in its schema-101 shape: a Fields room keeps its entry point
 * in its spatial state, and no room has a layout or object anchors.
 */
function legacyOccurrence(occurrence: unknown): unknown {
  const source = record(occurrence);
  if (source === undefined) return occurrence;
  const { layout, ...copy } = source;
  for (const object of ANCHORED_OBJECTS) {
    const leaf = record(copy[object]);
    if (leaf === undefined || !Object.hasOwn(leaf, 'anchorId')) continue;
    const { anchorId: _anchor, ...rest } = leaf;
    void _anchor;
    copy[object] = rest;
  }
  const state = record(copy.state);
  const spatial = record(state?.spatial);
  if (state?.kind === 'fieldsCombat' && spatial !== undefined)
    copy.state = {
      ...state,
      spatial: {
        entryStartPointId: record(layout)?.entryStartPointId ?? null,
        ...spatial,
      },
    };
  return copy;
}

/**
 * A current document body in its schema-101 shape, for tests that relabel a
 * current document as schema 101 and load it through the 101 -> 102 transition.
 */
export function legacySchema101Body<T>(value: T): T {
  const document = record(value);
  const route = record(document?.route);
  if (document === undefined || route === undefined || !Array.isArray(route.biomes)) return value;
  return {
    ...document,
    route: {
      ...route,
      biomes: route.biomes.map((biome) => {
        const topology = record(record(biome)?.topology);
        if (topology === undefined || !Array.isArray(topology.occurrences)) return biome;
        return {
          ...(biome as Json),
          topology: { ...topology, occurrences: topology.occurrences.map(legacyOccurrence) },
        };
      }),
    },
  } as T;
}

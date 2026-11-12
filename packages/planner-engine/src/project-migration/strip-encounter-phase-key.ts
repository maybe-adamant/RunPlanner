type RawRecord = Record<string, unknown>;

function rawRecord(value: unknown): RawRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as RawRecord)
    : undefined;
}

function stripAction(action: unknown): unknown {
  const reference = rawRecord(action);
  if (reference?.kind !== 'interactAcquisitionEntry' || !('encounterPhaseKey' in reference))
    return action;
  const { encounterPhaseKey: _phase, ...rest } = reference;
  void _phase;
  return rest;
}

function stripOccurrence(occurrence: unknown): unknown {
  const record = rawRecord(occurrence);
  const roomActions = rawRecord(record?.roomActions);
  const order = roomActions?.order;
  if (record === undefined || roomActions === undefined || !Array.isArray(order)) return occurrence;
  return { ...record, roomActions: { ...roomActions, order: order.map(stripAction) } };
}

function stripBiome(biome: unknown): unknown {
  const record = rawRecord(biome);
  const topology = rawRecord(record?.topology);
  const occurrences = topology?.occurrences;
  if (record === undefined || topology === undefined || !Array.isArray(occurrences)) return biome;
  return { ...record, topology: { ...topology, occurrences: occurrences.map(stripOccurrence) } };
}

/**
 * Schema 103 no longer stores the phase a delivery or clocked drop fell due
 * at: the walk names its due spawn. Every stored pickup row loses the field;
 * nothing else changes.
 */
export function stripEncounterPhaseKey(raw: unknown): unknown {
  const document = rawRecord(raw);
  const route = rawRecord(document?.route);
  const biomes = route?.biomes;
  if (document === undefined || route === undefined || !Array.isArray(biomes)) return raw;
  return { ...document, route: { ...route, biomes: biomes.map(stripBiome) } };
}

type RawRecord = Record<string, unknown>;

function rawRecord(value: unknown): RawRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as RawRecord)
    : undefined;
}

/**
 * One stored room action: a Shrine purchase loses its `rushed` flag, and a
 * rushed one is followed by its own rush action.
 */
function splitAction(action: unknown): readonly unknown[] {
  const reference = rawRecord(action);
  // A malformed flag stays for strict decoding to reject.
  if (reference?.kind !== 'purchaseHermesShrineOffer' || typeof reference.rushed !== 'boolean')
    return [action];
  const { rushed, ...purchase } = reference;
  return rushed === true
    ? [purchase, { kind: 'rushHermesShrineOffer', generationKey: purchase.generationKey }]
    : [purchase];
}

function splitOccurrence(occurrence: unknown): unknown {
  const record = rawRecord(occurrence);
  const roomActions = rawRecord(record?.roomActions);
  const order = roomActions?.order;
  if (record === undefined || roomActions === undefined || !Array.isArray(order)) return occurrence;
  return { ...record, roomActions: { ...roomActions, order: order.flatMap(splitAction) } };
}

function splitBiome(biome: unknown): unknown {
  const record = rawRecord(biome);
  const topology = rawRecord(record?.topology);
  const occurrences = topology?.occurrences;
  if (record === undefined || topology === undefined || !Array.isArray(occurrences)) return biome;
  return { ...record, topology: { ...topology, occurrences: occurrences.map(splitOccurrence) } };
}

/**
 * Schema 103 makes a Shrine rush its own room action on the bought item. A
 * stored rushed purchase becomes the purchase directly followed by its rush,
 * so the order of every other action is kept; an unrushed purchase only loses
 * the flag. Anything that is not a stored Shrine purchase with a boolean flag
 * passes unchanged.
 */
export function splitShrineRush(raw: unknown): unknown {
  const document = rawRecord(raw);
  const route = rawRecord(document?.route);
  const biomes = route?.biomes;
  if (document === undefined || route === undefined || !Array.isArray(biomes)) return raw;
  return { ...document, route: { ...route, biomes: biomes.map(splitBiome) } };
}

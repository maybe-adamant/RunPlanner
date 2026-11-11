type RawRecord = Record<string, unknown>;

function rawRecord(value: unknown): RawRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as RawRecord)
    : undefined;
}

/** Each occurrence of the document, raw; empty where the structure is malformed. */
function rawOccurrences(document: RawRecord): readonly unknown[] {
  const biomes = rawRecord(document.route)?.biomes;
  if (!Array.isArray(biomes)) return [];
  return biomes.flatMap((biome) => {
    const occurrences = rawRecord(rawRecord(biome)?.topology)?.occurrences;
    return Array.isArray(occurrences) ? occurrences : [];
  });
}

/** Whether a raw row is a locked door's press carrying its fight. */
function customizedPress(row: unknown): boolean {
  const reference = rawRecord(row);
  return reference?.kind === 'unlockExit' && Object.hasOwn(reference, 'customization');
}

/**
 * A press saved before schema 103 carried its locked door's fight; the fight
 * now belongs to the door. Moves each press's `customization` unchanged to
 * `encounters.customizationByLockedExit[exitKey]`, leaving the press thin, and
 * returns the input itself when no press carries one. Strict decoding admitted
 * a press only of a locked door, once per door, so nothing is lost. Malformed
 * structure is left for strict decoding to reject.
 */
export function moveLockedDoorFightOntoDoor(value: unknown): unknown {
  const document = rawRecord(value);
  if (
    document === undefined ||
    !rawOccurrences(document).some((occurrence) =>
      ((rawRecord(rawRecord(occurrence)?.roomActions)?.order as unknown[] | undefined) ?? []).some(
        customizedPress,
      ),
    )
  )
    return value;
  const copy = JSON.parse(JSON.stringify(document)) as RawRecord;
  for (const rawOccurrence of rawOccurrences(copy)) {
    const occurrence = rawRecord(rawOccurrence);
    const order = rawRecord(occurrence?.roomActions)?.order;
    const encounters = rawRecord(occurrence?.encounters);
    if (!Array.isArray(order) || encounters === undefined) continue;
    for (const row of order) {
      if (!customizedPress(row)) continue;
      const press = row as RawRecord;
      if (typeof press.exitKey !== 'string') continue;
      encounters.customizationByLockedExit = {
        ...rawRecord(encounters.customizationByLockedExit),
        [press.exitKey]: press.customization,
      };
      delete press.customization;
    }
  }
  return copy;
}

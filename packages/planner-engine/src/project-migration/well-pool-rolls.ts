import type { Catalog } from '../catalog-schema';

type RawRecord = Record<string, unknown>;

function rawRecord(value: unknown): RawRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as RawRecord)
    : undefined;
}

/** Moves one occurrence's rolls in place; true when anything moved. */
function moveOccurrenceRolls(occurrence: RawRecord): boolean {
  const order = rawRecord(occurrence.roomActions)?.order;
  if (!Array.isArray(order)) return false;
  let moved = false;
  const wellPins: RawRecord = {};
  const poolPins: RawRecord = {};
  const twists: RawRecord = {};
  for (const entry of order) {
    const action = rawRecord(entry);
    if (action === undefined || typeof action.rerollId !== 'string') continue;
    if (action.kind === 'rerollStygianWell') {
      const pins = rawRecord(action.offerKeyBySlot);
      if (pins !== undefined && Object.keys(pins).length > 0) wellPins[action.rerollId] = pins;
      for (const [slotKey, result] of Object.entries(rawRecord(action.twistResultKeyBySlot) ?? {}))
        twists[`${action.rerollId}:${slotKey}`] = result;
      moved ||= 'offerKeyBySlot' in action || 'twistResultKeyBySlot' in action;
      delete action.offerKeyBySlot;
      delete action.twistResultKeyBySlot;
    } else if (action.kind === 'rerollPurgingPool') {
      const pins = rawRecord(action.traitKeyBySlot);
      if (pins !== undefined && Object.keys(pins).length > 0) poolPins[action.rerollId] = pins;
      moved ||= 'traitKeyBySlot' in action;
      delete action.traitKeyBySlot;
    }
  }
  const well = rawRecord(occurrence.stygianWell);
  if (well !== undefined) {
    const initialTwists = rawRecord(well.twistResultKeyBySlot);
    const generationTwists: RawRecord = {};
    for (const [slotKey, result] of Object.entries(initialTwists ?? {}))
      generationTwists[slotKey === 'travelDealRefill' ? slotKey : `initial:${slotKey}`] = result;
    Object.assign(generationTwists, twists);
    moved ||= 'twistResultKeyBySlot' in well || 'purchasedGenerationKeys' in well;
    // Purchases are the room's purchase actions, which the codec held equal to this list.
    delete well.purchasedGenerationKeys;
    delete well.twistResultKeyBySlot;
    const rest = { ...well };
    for (const key of Object.keys(well)) delete well[key];
    Object.assign(
      well,
      { offerKeyBySlot: rest.offerKeyBySlot },
      Object.keys(wellPins).length === 0 ? {} : { rerollOfferKeyBySlot: wellPins },
      Object.keys(generationTwists).length === 0
        ? {}
        : { twistResultKeyByGeneration: generationTwists },
      rest,
    );
  }
  const pool = rawRecord(occurrence.purgingPool);
  if (pool !== undefined && Object.keys(poolPins).length > 0) {
    const rest = { ...pool };
    for (const key of Object.keys(pool)) delete pool[key];
    Object.assign(
      pool,
      { traitKeyBySlot: rest.traitKeyBySlot },
      { rerollTraitKeyBySlot: poolPins },
      rest,
    );
  }
  return moved;
}

/**
 * Schema 103's Well and Pool rolls on their objects: a reroll action's pins
 * and Fateful Twist results move onto the Well or Pool by its `rerollId`, the
 * Well's Twist results are keyed by generation, and the Well's purchase list,
 * which duplicated its purchase actions, goes. Lossless; a plan already in
 * this shape, or malformed structure, is returned as it is for strict
 * decoding to judge.
 */
export function moveWellPoolRollsOntoObjects(value: unknown, _catalog?: Catalog): unknown {
  void _catalog;
  const route = rawRecord(rawRecord(value)?.route);
  if (route === undefined || !Array.isArray(route.biomes)) return value;
  const copy = JSON.parse(JSON.stringify(value)) as RawRecord;
  let moved = false;
  for (const biome of (copy.route as RawRecord).biomes as unknown[]) {
    const occurrences = rawRecord(rawRecord(biome)?.topology)?.occurrences;
    if (!Array.isArray(occurrences)) continue;
    for (const occurrence of occurrences) {
      const raw = rawRecord(occurrence);
      if (raw !== undefined && moveOccurrenceRolls(raw)) moved = true;
    }
  }
  return moved ? copy : value;
}

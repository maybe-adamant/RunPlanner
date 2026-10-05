export const SOURCE_SCHEMA_VERSION = 90;
export const OUTPUT_SCHEMA_VERSION = 91;
export const CATALOG_VERSION = '0.55.0-anvil-of-fates';

const SHRINE_SLOT_KEYS = ['first', 'secondLeft', 'secondRight'];
const DELIVERY_PREFIX = 'hermesShrineDelivery:';

function record(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}

function purchaseTerms(purchase, label) {
  const terms = record(purchase, label);
  if (typeof terms.rushed !== 'boolean') throw new Error(`${label}.rushed must be boolean`);
  const { rushed, ...rest } = terms;
  return { rushed, terms: rest };
}

/** Whether an action is the Shrine room's own rushed pickup. */
function isSameRoomShrinePickup(reference, routeKey, biomeKey, occurrenceId) {
  if (
    reference?.kind !== 'interactAcquisitionEntry' ||
    reference.siteKey !== 'hermesShrineDelivery' ||
    typeof reference.entryKey !== 'string' ||
    !reference.entryKey.startsWith(DELIVERY_PREFIX)
  )
    return false;
  try {
    const source = JSON.parse(decodeURIComponent(reference.entryKey.slice(DELIVERY_PREFIX.length)));
    return (
      Array.isArray(source) &&
      source[0] === routeKey &&
      source[1] === biomeKey &&
      source[2] === occurrenceId
    );
  } catch {
    return false;
  }
}

/**
 * Moves each Shrine purchase's rush onto a timeline purchase action. Actions
 * follow slot order, then the Travel Deal refill, so the first rushed initial
 * purchase is unchanged. They precede the Shrine room's own pickups; without
 * one they close an ordinary room and open an Ephyra side room, whose purchase
 * window precedes combat because it has no outgoing generation.
 */
function migrateShrineOccurrence(occurrence, routeKey, biomeKey, sideRoom) {
  const shrine = occurrence.hermesShrine;
  if (shrine === undefined) return;
  const actions = [];
  for (const slotKey of SHRINE_SLOT_KEYS) {
    const purchase = shrine.purchaseBySlot?.[slotKey];
    if (purchase === undefined) continue;
    const { rushed, terms } = purchaseTerms(purchase, `hermesShrine.purchaseBySlot.${slotKey}`);
    shrine.purchaseBySlot[slotKey] = terms;
    actions.push({
      kind: 'purchaseHermesShrineOffer',
      generationKey: `initial:${slotKey}`,
      rushed,
    });
  }
  if (shrine.travelDealRefill?.purchase !== undefined) {
    const { rushed, terms } = purchaseTerms(
      shrine.travelDealRefill.purchase,
      'hermesShrine.travelDealRefill.purchase',
    );
    shrine.travelDealRefill.purchase = terms;
    actions.push({ kind: 'purchaseHermesShrineOffer', generationKey: 'travelDealRefill', rushed });
  }
  if (actions.length === 0) return;
  const order = record(occurrence.roomActions, 'roomActions').order;
  if (!Array.isArray(order)) throw new Error('roomActions.order must be an array');
  const firstPickup = order.findIndex((reference) =>
    isSameRoomShrinePickup(reference, routeKey, biomeKey, occurrence.occurrenceId),
  );
  order.splice(firstPickup >= 0 ? firstPickup : sideRoom ? 0 : order.length, 0, ...actions);
}

/** Browser-safe schema transform; the CLI supplies only file I/O. */
export function migrateProjectDocument(value) {
  const source = record(value, 'project document');
  if (source.schemaVersion !== SOURCE_SCHEMA_VERSION)
    throw new Error(
      `schema 90 -> 91 migration expects schema 90, received ${String(source.schemaVersion)}`,
    );
  if (source.catalogVersion !== CATALOG_VERSION)
    throw new Error(
      `schema 90 -> 91 migration expects catalog ${CATALOG_VERSION}, received ${String(source.catalogVersion)}`,
    );
  const migrated = JSON.parse(JSON.stringify(source));
  const route = record(migrated.route, 'route');
  for (const biome of route.biomes ?? []) {
    const sideRoomIds = new Set(
      (biome.topology?.decisions ?? []).flatMap((decision) =>
        decision.kind === 'localVisit'
          ? Object.values(decision.targetsBySlot ?? {}).map((target) => target.occurrenceId)
          : [],
      ),
    );
    for (const occurrence of biome.topology?.occurrences ?? [])
      migrateShrineOccurrence(
        occurrence,
        route.routeKey,
        biome.biomeKey,
        sideRoomIds.has(occurrence.occurrenceId),
      );
  }
  migrated.schemaVersion = OUTPUT_SCHEMA_VERSION;
  return migrated;
}

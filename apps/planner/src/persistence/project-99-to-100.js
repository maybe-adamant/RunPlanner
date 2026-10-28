export const SOURCE_SCHEMA_VERSION = 99;
export const OUTPUT_SCHEMA_VERSION = 100;
export const CATALOG_VERSION = '0.55.0-anvil-of-fates';

// Every Preboss that declares a Contract pedestal destination in this catalog.
export const PEDESTAL_ROOMS = new Set([
  'F_PreBoss01',
  'G_PreBoss01',
  'H_PreBoss01',
  'I_PreBoss01',
  'I_PreBoss02',
  'N_PreBoss01',
  'O_PreBoss01',
  'P_PreBoss01',
  'Q_PreBoss01',
]);
const ENTRY_KEY = 'infernalContractReward';
const SITE_KEY = 'infernalContractPedestal';

function record(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}

// Moves one Preboss's Shop-owned pedestal item, its collect action and its
// acquisition-resolved source onto the room's pedestal feature.
function migrateOccurrence(occurrence) {
  if (Object.hasOwn(occurrence, 'infernalContractPedestal'))
    throw new Error(`${String(occurrence.occurrenceId)} already has a schema 100 pedestal`);
  if (!PEDESTAL_ROOMS.has(occurrence.gameName)) return;
  const offers = occurrence.state?.kind === 'shop' ? occurrence.state.shop?.offers : undefined;
  const item = offers?.[ENTRY_KEY];
  if (offers !== undefined) delete offers[ENTRY_KEY];
  occurrence.infernalContractPedestal = item ?? { optionKey: null, reward: null };
  const order = occurrence.roomActions?.order;
  if (Array.isArray(order))
    occurrence.roomActions.order = order.map((action) =>
      action?.kind === 'interactShopOffer' && action.offerKey === ENTRY_KEY
        ? { kind: 'interactInfernalContractPedestal' }
        : action,
    );
  const entries = occurrence.acquisitionSites?.roomExit?.pickupEntries;
  if (entries !== undefined && Object.hasOwn(entries, ENTRY_KEY)) {
    occurrence.acquisitionSites[SITE_KEY] = { pickupEntries: { [ENTRY_KEY]: entries[ENTRY_KEY] } };
    delete entries[ENTRY_KEY];
  }
}

// Browser-safe transform: the Contract pedestal becomes a Preboss room feature in either form.
export function migrateProjectDocument(value) {
  const source = record(value, 'project document');
  if (source.schemaVersion !== SOURCE_SCHEMA_VERSION)
    throw new Error(
      `schema 99 -> 100 migration expects schema 99, received ${String(source.schemaVersion)}`,
    );
  if (source.catalogVersion !== CATALOG_VERSION)
    throw new Error(
      `schema 99 -> 100 migration expects catalog ${CATALOG_VERSION}, received ${String(source.catalogVersion)}`,
    );
  const copy = JSON.parse(JSON.stringify(source));
  delete copy.schemaRevision;
  for (const biome of copy.route?.biomes ?? [])
    for (const occurrence of biome?.topology?.occurrences ?? []) migrateOccurrence(occurrence);
  return { ...copy, schemaVersion: OUTPUT_SCHEMA_VERSION };
}

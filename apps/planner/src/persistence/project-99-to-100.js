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
// Every Ephyra combat, Mini-Boss and side room, whose hidden return door fills a placeholder.
const two = (value) => String(value).padStart(2, '0');
export const PHANTOM_EXIT_ROOMS = new Set([
  ...Array.from({ length: 23 }, (_, index) => `N_Combat${two(index + 1)}`),
  'N_MiniBoss01',
  'N_MiniBoss02',
  ...Array.from({ length: 15 }, (_, index) => `N_Sub${two(index + 1)}`),
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
function migratePedestal(occurrence) {
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

// Every visit's hidden return door is left to the simulation, which settles
// the first eligible placeholder room and reward.
function migratePhantomExit(occurrence) {
  if (Object.hasOwn(occurrence, 'phantomExit'))
    throw new Error(`${String(occurrence.occurrenceId)} already has a schema 100 phantom exit`);
  if (PHANTOM_EXIT_ROOMS.has(occurrence.gameName))
    occurrence.phantomExit = { placeholderRoomGameName: null, rewardType: null };
}

// The Well and Pool hold no interaction flag: use follows from the room's
// actions, and a blank slot stays native. An uninteracted feature had no
// actions and left the game to roll, so its retained slots are cleared.
const FEATURE_SLOTS = [
  ['stygianWell', 'offerKeyBySlot'],
  ['purgingPool', 'traitKeyBySlot'],
];

function dropFeatureInteraction(occurrence) {
  let changed = false;
  for (const [field, slots] of FEATURE_SLOTS) {
    const feature = occurrence?.[field];
    if (feature === null || typeof feature !== 'object' || !Object.hasOwn(feature, 'interacted'))
      continue;
    changed = true;
    if (feature.interacted === true) {
      delete feature.interacted;
      continue;
    }
    const cleared = Object.fromEntries(
      Object.keys(feature[slots] ?? {}).map((slotKey) => [slotKey, null]),
    );
    occurrence[field] = { [slots]: cleared };
  }
  return changed;
}

function migrateOccurrence(occurrence) {
  migratePedestal(occurrence);
  migratePhantomExit(occurrence);
  dropFeatureInteraction(occurrence);
}

// Schema 100 is unpushed: a local plan saved while a Well or Pool held a reroll
// count gains that many unpinned reroll actions at the end of its room's actions.
const FEATURE_REROLLS = [
  ['stygianWell', 'rerollStygianWell', 'offerKeyBySlot'],
  ['purgingPool', 'rerollPurgingPool', 'traitKeyBySlot'],
];

function normalizeOccurrenceRerollCounts(occurrence) {
  let changed = false;
  for (const [field, kind, slots] of FEATURE_REROLLS) {
    const feature = occurrence?.[field];
    if (feature === null || typeof feature !== 'object' || !Object.hasOwn(feature, 'rerollCount'))
      continue;
    const count = feature.rerollCount;
    delete feature.rerollCount;
    changed = true;
    const order = occurrence.roomActions?.order;
    if (!Array.isArray(order) || !Number.isInteger(count) || feature.interacted !== true) continue;
    const used = new Set(
      order.flatMap((action) => (action?.kind === kind ? [action.rerollId] : [])),
    );
    for (let index = 1, added = 0; added < count; index += 1) {
      if (used.has(`r${index}`)) continue;
      order.push({ kind, rerollId: `r${index}`, [slots]: {} });
      added += 1;
    }
  }
  return changed;
}

/**
 * Reshapes a schema 100 document saved with Well or Pool reroll counts or
 * interaction flags; returns the input itself when it holds none.
 */
export function normalizeUnpushedSchema100(value) {
  const source = record(value, 'project document');
  const copy = JSON.parse(JSON.stringify(source));
  let changed = false;
  for (const biome of copy.route?.biomes ?? [])
    for (const occurrence of biome?.topology?.occurrences ?? [])
      if (
        [normalizeOccurrenceRerollCounts(occurrence), dropFeatureInteraction(occurrence)].some(
          Boolean,
        )
      )
        changed = true;
  return changed ? copy : source;
}

// Browser-safe transform: the Contract pedestal becomes a Preboss room feature in either form,
// and every Ephyra combat, Mini-Boss and side room gains its unpinned phantom exit.
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

export const SOURCE_SCHEMA_VERSION = 92;
export const OUTPUT_SCHEMA_VERSION = 93;
export const CATALOG_VERSION = '0.55.0-anvil-of-fates';
// The catalog's default familiar; a fresh profile has none.
const DEFAULT_FAMILIAR_KEY = 'FrogFamiliar';
const FRESH_FILE_ROUTE_KEY = 'FreshFile';

function record(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}

/** Browser-safe schema transform; the CLI supplies only file I/O. */
export function migrateProjectDocument(value) {
  const source = record(value, 'project document');
  if (source.schemaVersion !== SOURCE_SCHEMA_VERSION)
    throw new Error(
      `schema 92 -> 93 migration expects schema 92, received ${String(source.schemaVersion)}`,
    );
  if (source.catalogVersion !== CATALOG_VERSION)
    throw new Error(
      `schema 92 -> 93 migration expects catalog ${CATALOG_VERSION}, received ${String(source.catalogVersion)}`,
    );
  const migrated = JSON.parse(JSON.stringify(source));
  const route = record(migrated.route, 'route');
  const loadout = record(route.loadout, 'route.loadout');
  const familiarKey = route.routeKey === FRESH_FILE_ROUTE_KEY ? null : DEFAULT_FAMILIAR_KEY;
  // The familiar follows the starting keepsake; an omitted Worry Free roll is its minimum.
  route.loadout = Object.fromEntries(
    Object.entries(loadout).flatMap((entry) =>
      entry[0] === 'startingKeepsakeKey' ? [entry, ['familiarKey', familiarKey]] : [entry],
    ),
  );
  if (!Object.hasOwn(route.loadout, 'familiarKey'))
    throw new Error('route.loadout.startingKeepsakeKey is required');
  migrated.schemaVersion = OUTPUT_SCHEMA_VERSION;
  return migrated;
}

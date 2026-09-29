export const SOURCE_SCHEMA_VERSION = 89;
export const OUTPUT_SCHEMA_VERSION = 90;
export const CATALOG_VERSION = '0.55.0-anvil-of-fates';

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
      `schema 89 -> 90 migration expects schema 89, received ${String(source.schemaVersion)}`,
    );
  if (source.catalogVersion !== CATALOG_VERSION)
    throw new Error(
      `schema 89 -> 90 migration expects catalog ${CATALOG_VERSION}, received ${String(source.catalogVersion)}`,
    );
  const migrated = JSON.parse(JSON.stringify(source));
  // Schema 90 only admits null equipment selections on a fresh profile; every
  // schema-89 route keeps its authored weapon, aspect and keepsake.
  migrated.schemaVersion = OUTPUT_SCHEMA_VERSION;
  return migrated;
}

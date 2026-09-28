export const SOURCE_SCHEMA_VERSION = 88;
export const OUTPUT_SCHEMA_VERSION = 89;
export const CATALOG_VERSION = '0.55.0-anvil-of-fates';
const SHARED_DEFAULT_PROJECT_ID = 'run-plan';

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
      `schema 88 -> 89 migration expects schema 88, received ${String(source.schemaVersion)}`,
    );
  if (source.catalogVersion !== CATALOG_VERSION)
    throw new Error(
      `schema 88 -> 89 migration expects catalog ${CATALOG_VERSION}, received ${String(source.catalogVersion)}`,
    );
  const migrated = JSON.parse(JSON.stringify(source));
  // Schema 88 gave every new project one shared default identity; schema 89 identities are unique.
  if (migrated.projectId === SHARED_DEFAULT_PROJECT_ID)
    migrated.projectId = `${SHARED_DEFAULT_PROJECT_ID}-${globalThis.crypto.randomUUID()}`;
  migrated.schemaVersion = OUTPUT_SCHEMA_VERSION;
  return migrated;
}

export const SOURCE_SCHEMA_VERSION = 94;
export const OUTPUT_SCHEMA_VERSION = 95;
export const CATALOG_VERSION = '0.55.0-anvil-of-fates';

function record(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}

function rejectActivations(value, label) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => rejectActivations(entry, `${label}[${index}]`));
    return;
  }
  if (value === null || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'hexActivationsByAcquisitionRole')
      throw new Error(`${label}.${key} is not a schema 94 field`);
    rejectActivations(entry, `${label}.${key}`);
  }
}

/**
 * Browser-safe schema transform; the CLI supplies only file I/O. Every Path of
 * Stars screen stays unresolved; a reached one reports its missing selection.
 */
export function migrateProjectDocument(value) {
  const source = record(value, 'project document');
  if (source.schemaVersion !== SOURCE_SCHEMA_VERSION)
    throw new Error(
      `schema 94 -> 95 migration expects schema 94, received ${String(source.schemaVersion)}`,
    );
  if (source.catalogVersion !== CATALOG_VERSION)
    throw new Error(
      `schema 94 -> 95 migration expects catalog ${CATALOG_VERSION}, received ${String(source.catalogVersion)}`,
    );
  rejectActivations(source, 'project');
  const migrated = JSON.parse(JSON.stringify(source));
  migrated.schemaVersion = OUTPUT_SCHEMA_VERSION;
  return migrated;
}

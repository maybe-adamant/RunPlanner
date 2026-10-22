export const SOURCE_SCHEMA_VERSION = 97;
export const OUTPUT_SCHEMA_VERSION = 98;
export const CATALOG_VERSION = '0.55.0-anvil-of-fates';
export const DEFAULT_NAME = 'New plan';
const NAME_MAX = 200;

function record(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}

// The given name trimmed and bounded, or the default when none is given or it is blank.
function planName(name) {
  const trimmed = Array.from(typeof name === 'string' ? name.trim() : '')
    .slice(0, NAME_MAX)
    .join('')
    .trim();
  return trimmed.length === 0 ? DEFAULT_NAME : trimmed;
}

// Browser-safe transform: names the plan after `options.name` (the file's stem when known).
export function migrateProjectDocument(value, options = {}) {
  const source = record(value, 'project document');
  if (source.schemaVersion !== SOURCE_SCHEMA_VERSION)
    throw new Error(
      `schema 97 -> 98 migration expects schema 97, received ${String(source.schemaVersion)}`,
    );
  if (source.catalogVersion !== CATALOG_VERSION)
    throw new Error(
      `schema 97 -> 98 migration expects catalog ${CATALOG_VERSION}, received ${String(source.catalogVersion)}`,
    );
  const copy = JSON.parse(JSON.stringify(source));
  const { projectId, ...rest } = copy;
  delete rest.schemaVersion;
  delete rest.schemaRevision;
  delete rest.name;
  return {
    schemaVersion: OUTPUT_SCHEMA_VERSION,
    projectId,
    name: planName(options.name),
    ...rest,
  };
}

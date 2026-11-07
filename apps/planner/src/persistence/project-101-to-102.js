export const SOURCE_SCHEMA_VERSION = 101;
export const OUTPUT_SCHEMA_VERSION = 102;
export const CATALOG_VERSION = '0.55.0-anvil-of-fates';
/** Schema 101 closed at revision 2; a later one comes from an unknown build. */
const FINAL_SOURCE_SCHEMA_REVISION = 2;

function record(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}

function list(value, label) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

// A Fields room's entry point becomes the room's own layout entry; an unset one is omitted.
function moveFieldsEntry(occurrence) {
  const state = occurrence?.state;
  const spatial = state?.kind === 'fieldsCombat' ? state.spatial : undefined;
  if (
    spatial === null ||
    typeof spatial !== 'object' ||
    !Object.hasOwn(spatial, 'entryStartPointId')
  )
    return;
  const entryStartPointId = spatial.entryStartPointId;
  delete spatial.entryStartPointId;
  if (entryStartPointId !== null && entryStartPointId !== undefined)
    occurrence.layout = { entryStartPointId };
}

/**
 * The transform: a Fields room's entry point moves to the room's layout, and
 * nothing else changes, so it needs no catalog.
 */
export function migrateProjectDocument(value) {
  const source = record(value, 'project document');
  if (source.schemaVersion !== SOURCE_SCHEMA_VERSION)
    throw new Error(
      `schema 101 -> 102 migration expects schema 101, received ${String(source.schemaVersion)}`,
    );
  if (source.catalogVersion !== CATALOG_VERSION)
    throw new Error(
      `schema 101 -> 102 migration expects catalog ${CATALOG_VERSION}, received ${String(source.catalogVersion)}`,
    );
  const revision = source.schemaRevision ?? 0;
  if (!Number.isInteger(revision) || revision > FINAL_SOURCE_SCHEMA_REVISION)
    throw new Error(
      `Project schema 101.${String(revision)} is newer than schema 101's final revision ${FINAL_SOURCE_SCHEMA_REVISION}.`,
    );
  const copy = JSON.parse(JSON.stringify(source));
  delete copy.schemaRevision;
  for (const [index, biome] of list(copy.route?.biomes, 'route.biomes').entries())
    for (const occurrence of list(
      biome?.topology?.occurrences,
      `route.biomes[${index}].topology.occurrences`,
    ))
      moveFieldsEntry(occurrence);
  return { ...copy, schemaVersion: OUTPUT_SCHEMA_VERSION };
}

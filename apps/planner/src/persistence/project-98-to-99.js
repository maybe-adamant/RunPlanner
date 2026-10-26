export const SOURCE_SCHEMA_VERSION = 98;
export const OUTPUT_SCHEMA_VERSION = 99;
export const CATALOG_VERSION = '0.55.0-anvil-of-fates';

const DROPPED_ENCOUNTER_KEYS = ['steadyGrowthTargetByPhase', 'transcendentEmbryoBlessingByPhase'];

function record(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}

// Removes the phase-keyed outcomes from every room's encounter state.
function dropPhaseOutcomes(value) {
  if (Array.isArray(value)) {
    value.forEach(dropPhaseOutcomes);
    return;
  }
  if (value === null || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (key === 'encounters' && child !== null && typeof child === 'object')
      for (const dropped of DROPPED_ENCOUNTER_KEYS) delete child[dropped];
    dropPhaseOutcomes(child);
  }
}

// Browser-safe transform: Steady Growth and Embryo outcomes move to their source and are re-authored.
export function migrateProjectDocument(value) {
  const source = record(value, 'project document');
  if (source.schemaVersion !== SOURCE_SCHEMA_VERSION)
    throw new Error(
      `schema 98 -> 99 migration expects schema 98, received ${String(source.schemaVersion)}`,
    );
  if (source.catalogVersion !== CATALOG_VERSION)
    throw new Error(
      `schema 98 -> 99 migration expects catalog ${CATALOG_VERSION}, received ${String(source.catalogVersion)}`,
    );
  const copy = JSON.parse(JSON.stringify(source));
  delete copy.schemaRevision;
  dropPhaseOutcomes(copy.route);
  return { ...copy, schemaVersion: OUTPUT_SCHEMA_VERSION };
}

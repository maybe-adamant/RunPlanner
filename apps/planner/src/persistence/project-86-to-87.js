export const SOURCE_SCHEMA_VERSION = 86;
export const OUTPUT_SCHEMA_VERSION = 87;
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
      `schema 86 -> 87 migration expects schema 86, received ${String(source.schemaVersion)}`,
    );
  if (source.catalogVersion !== CATALOG_VERSION)
    throw new Error(
      `schema 86 -> 87 migration expects catalog ${CATALOG_VERSION}, received ${String(source.catalogVersion)}`,
    );
  const migrated = JSON.parse(JSON.stringify(source));
  for (const biome of migrated.route?.biomes ?? [])
    for (const occurrence of biome?.topology?.occurrences ?? []) {
      const customizations = occurrence?.encounters?.customizationByPhase;
      if (customizations === null || typeof customizations !== 'object') continue;
      for (const decisions of Object.values(customizations)) {
        if (decisions === null || typeof decisions !== 'object') continue;
        for (const decision of Object.values(decisions)) {
          if (decision?.kind !== 'generated' || !Array.isArray(decision.waves)) continue;
          for (const wave of decision.waves)
            if (wave && typeof wave === 'object') delete wave.weights;
        }
      }
    }
  migrated.schemaVersion = OUTPUT_SCHEMA_VERSION;
  return migrated;
}

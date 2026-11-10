import { settleProjectUpgrade } from '@run-planner/engine/project-migration';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';

export const SOURCE_SCHEMA_VERSION = 102;
export const OUTPUT_SCHEMA_VERSION = 103;
export const CATALOG_VERSION = '0.55.0-anvil-of-fates';
/** Schema 102 closed at revision 1; a later one comes from an unknown build. */
const FINAL_SOURCE_SCHEMA_REVISION = 1;

function record(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}

/**
 * The transform: schema 103 keeps schema 102's shape, so only the version
 * changes. What makes 103 differ is the settlement every plan opened from an
 * older schema receives once, `settleUpgradedProject`, which needs the
 * document decoded at 103.
 */
export function migrateProjectDocument(value) {
  const source = record(value, 'project document');
  if (source.schemaVersion !== SOURCE_SCHEMA_VERSION)
    throw new Error(
      `schema 102 -> 103 migration expects schema 102, received ${String(source.schemaVersion)}`,
    );
  if (source.catalogVersion !== CATALOG_VERSION)
    throw new Error(
      `schema 102 -> 103 migration expects catalog ${CATALOG_VERSION}, received ${String(source.catalogVersion)}`,
    );
  const revision = source.schemaRevision ?? 0;
  if (!Number.isInteger(revision) || revision > FINAL_SOURCE_SCHEMA_REVISION)
    throw new Error(
      `Project schema 102.${String(revision)} is newer than schema 102's final revision ${FINAL_SOURCE_SCHEMA_REVISION}.`,
    );
  const copy = JSON.parse(JSON.stringify(source));
  delete copy.schemaRevision;
  return { ...copy, schemaVersion: OUTPUT_SCHEMA_VERSION };
}

/**
 * A plan saved before schema 103, read at 103, settled once as the current
 * rules would have left it: its stale and source-gone rows removed and its
 * batches' doors settled, every removal announced. Runs exactly once, on
 * opening a document whose source schema is older than 103.
 */
export function settleUpgradedProject(project, catalog) {
  return settleProjectUpgrade({
    catalog,
    project,
    evaluate: (document) => simulateProjectAssembly(catalog, document),
  });
}

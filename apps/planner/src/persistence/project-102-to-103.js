import { encodeProjectDocument, parseProjectDocument } from '@run-planner/engine/authored-project';
import { settleProjectUpgrade, splitShrineRush } from '@run-planner/engine/project-migration';
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
 * The item-model slice transforms, in order: each rewrites the raw lifted plan
 * into schema 103's shape before the strict parse.
 */
const SLICE_TRANSFORMS = [splitShrineRush];

/** Lifts the version, then applies the slice transforms that reshape schema 102's plan. */
export function liftProjectDocument(value) {
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
  return SLICE_TRANSFORMS.reduce((lifted, transform) => transform(lifted), {
    ...copy,
    schemaVersion: OUTPUT_SCHEMA_VERSION,
  });
}

/**
 * Catalog-aware transform: the lifted plan, saved under the earlier settlement
 * rules, is settled once as the current rules would have left it. A plan that
 * does not decode, or whose settlement throws or faults, keeps the bare lift.
 * It settles only while 103 is the current schema; later it keeps the bare lift.
 */
export function migrateProjectDocument(value, { catalog }) {
  const lifted = liftProjectDocument(value);
  try {
    const settled = settleProjectUpgrade({
      catalog,
      project: parseProjectDocument(JSON.stringify(lifted), catalog),
      evaluate: (document) => simulateProjectAssembly(catalog, document),
    });
    if (settled.fault !== undefined) return lifted;
    return JSON.parse(encodeProjectDocument(settled.assembly.project));
  } catch {
    return lifted;
  }
}

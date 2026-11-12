import { encodeProjectDocument, parseProjectDocument } from '@run-planner/engine/authored-project';
import {
  moveLockedDoorFightOntoDoor,
  moveRerollResultsOntoItems,
  moveWellPoolRollsOntoObjects,
  settleProjectUpgrade,
  splitShrineRush,
  stampRoomActionItemContent,
  stripEncounterPhaseKey,
} from '@run-planner/engine/project-migration';
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
 * Schema 103's item-model moves, in order: each a pure, lossless transform of
 * the raw plan from row state onto its item, which leaves a plan already in
 * that shape as it is and runs before strict decoding. The moves touch
 * disjoint fields; the Shrine split adds rows to an order, the reroll move
 * clears the content of rows whose item it adopts, and the content stamp,
 * which reads every row and item, runs after them, last.
 */
const ITEM_MODEL_TRANSFORMS = Object.freeze([
  // Well and Pool rolls move from their reroll actions onto the Well and Pool.
  moveWellPoolRollsOntoObjects,
  // A locked door's fight moves from its press onto the door.
  moveLockedDoorFightOntoDoor,
  // A rushed Shrine purchase becomes the purchase followed by its own rush.
  splitShrineRush,
  // Door, cage, wheel and Hub press results move onto the rerolled item.
  moveRerollResultsOntoItems,
  // A delivery or clocked drop no longer stores the phase it fell due at.
  stripEncounterPhaseKey,
  // Each pickup, purchase and sale row records the content of the item it acts on.
  stampRoomActionItemContent,
]);

/** The version lift with schema 103's item-model moves; the catalog is for moves that read it. */
export function liftProjectDocument(value, catalog) {
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
  return ITEM_MODEL_TRANSFORMS.reduce((document, transform) => transform(document, catalog), {
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
  const lifted = liftProjectDocument(value, catalog);
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

import { encodeProjectDocument, parseProjectDocument } from '@run-planner/engine/authored-project';
import {
  moveLockedDoorFightOntoDoor,
  moveRerollResultsOntoItems,
  moveWellPoolRollsOntoObjects,
  recoverLegacyTimedOutcomes,
  settleProjectFills,
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

/** Recovery and upgrade settlement alternate at most this many times. */
const MAX_RECOVERY_PASSES = 4;

/**
 * One recovery pass over the outcomes a pre-99 save held: the plan with those
 * put back, and the outcomes no cycle landed at yet, which a later pass may
 * retry. A recovery that throws or faults recovers none and leaves none to retry.
 */
function recoveryPass(project, catalog, outcomes, recover) {
  const none = { project, recovered: 0, unlanded: [] };
  if (outcomes.length === 0) return none;
  try {
    const recovery = recover({ catalog, project, outcomes });
    if (recovery.fault !== undefined) return none;
    return {
      project: recovery.project,
      recovered: recovery.recovered.length,
      unlanded: recovery.dropped
        .filter(({ reason }) => reason === 'unlanded')
        .map(({ legacy }) => legacy),
    };
  } catch {
    return none;
  }
}

/** The plan settled as the current rules would have left it; undefined when that throws or faults. */
function settledUpgrade(project, catalog) {
  try {
    const settled = settleProjectUpgrade({
      catalog,
      project,
      evaluate: (document) => simulateProjectAssembly(catalog, document),
    });
    return settled.fault === undefined ? settled.assembly.project : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The transform with its timed-outcome recovery supplied: the lifted plan,
 * saved under the earlier settlement rules, first recovers the timed outcomes
 * a save from before schema 99 held, then is settled as the current rules
 * would have left it. A blank only that settlement fills can hold back where
 * an outcome lands, so while outcomes remain unlanded, recovery runs again on
 * the settled plan, which settles again after each pass that recovers one; a
 * pass whose settlement fails leaves the plan before it. A plan that does not
 * decode, or whose first settlement throws or faults, keeps the bare lift. It
 * settles only while 103 is the current schema; later it keeps the bare lift.
 */
export function migrateProjectDocumentRecoveredBy(
  value,
  { catalog, legacyTimedOutcomes = [] },
  recover,
) {
  const lifted = liftProjectDocument(value, catalog);
  let pass;
  try {
    pass = recoveryPass(
      parseProjectDocument(JSON.stringify(lifted), catalog),
      catalog,
      legacyTimedOutcomes,
      recover,
    );
  } catch {
    return lifted;
  }
  let settled = settledUpgrade(pass.project, catalog);
  if (settled === undefined) return lifted;
  for (let passes = 1; passes < MAX_RECOVERY_PASSES && pass.unlanded.length > 0; passes += 1) {
    pass = recoveryPass(settled, catalog, pass.unlanded, recover);
    if (pass.recovered === 0) break;
    const resettled = settledUpgrade(pass.project, catalog);
    if (resettled === undefined) break;
    settled = resettled;
  }
  return JSON.parse(encodeProjectDocument(settled));
}

export function migrateProjectDocument(value, context) {
  return migrateProjectDocumentRecoveredBy(value, context, recoverLegacyTimedOutcomes);
}

/**
 * Schema 103 revision 1 stores reached stock and revision 2 reached positions
 * that earlier revisions left blank for the game to roll: an older 103 plan
 * is filled once on load. A plan whose filling throws or faults keeps its blanks.
 */
export function fillReachedBlanksProject(project, catalog) {
  try {
    const settled = settleProjectFills({
      catalog,
      project,
      evaluate: (document) => simulateProjectAssembly(catalog, document),
    });
    return settled.fault === undefined ? settled.assembly.project : project;
  } catch {
    return project;
  }
}

/**
 * Schema 103 revision 3 holds no Well or Pool its route never spawns: a plan
 * saved earlier, such as a Fresh File Postboss kept from before Fresh File
 * excluded them, loses them with their rows on load.
 */
export { dropRouteExcludedObjects } from '@run-planner/engine/project-migration';

/**
 * No plan holds a pickup row for a reward granted with no pickup: a plan that
 * does, such as one with the Zagreus contract's Champion row, loses it on load.
 */
export { dropAutomaticRewardRows } from '@run-planner/engine/project-migration';

/**
 * No plan holds a Sea Star copy of a reward its room's encounter spawns as
 * never duplicating: a plan that does, such as one copying an Anomaly's reward,
 * loses the copy and its row on load.
 */
export { dropUnduplicableSeaStarDuplicates } from '@run-planner/engine/project-migration';

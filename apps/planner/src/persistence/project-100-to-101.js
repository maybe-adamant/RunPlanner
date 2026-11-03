import {
  exchangeBlockedWheelOffers,
  fillNemesisBetOutcomeWins,
} from '@run-planner/engine/project-migration';
import { simulateProject } from '@run-planner/engine/simulation';
import { dropFeatureInteraction, moveShrineDelays } from './project-99-to-100.js';

export const SOURCE_SCHEMA_VERSION = 100;
export const OUTPUT_SCHEMA_VERSION = 101;
export const CATALOG_VERSION = '0.55.0-anvil-of-fates';
/** Schema 100 closed at its first revision; a later one comes from an unknown build. */
const FINAL_SOURCE_SCHEMA_REVISION = 0;

function record(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}

// A schema 100 plan saved while a Well or Pool held a reroll count gains that
// many unpinned reroll actions at the end of its room's actions.
const FEATURE_REROLLS = [
  ['stygianWell', 'rerollStygianWell', 'offerKeyBySlot'],
  ['purgingPool', 'rerollPurgingPool', 'traitKeyBySlot'],
];

function convertFeatureRerollCounts(occurrence) {
  for (const [field, kind, slots] of FEATURE_REROLLS) {
    const feature = occurrence?.[field];
    if (feature === null || typeof feature !== 'object' || !Object.hasOwn(feature, 'rerollCount'))
      continue;
    const count = feature.rerollCount;
    delete feature.rerollCount;
    const order = occurrence.roomActions?.order;
    if (!Array.isArray(order) || !Number.isInteger(count) || feature.interacted !== true) continue;
    const used = new Set(
      order.flatMap((action) => (action?.kind === kind ? [action.rerollId] : [])),
    );
    for (let index = 1, added = 0; added < count; index += 1) {
      if (used.has(`r${index}`)) continue;
      order.push({ kind, rerollId: `r${index}`, [slots]: {} });
      added += 1;
    }
  }
}

// A trait, Chaos or Pom screen saved with a reroll count gains that many
// earlier screens, each left unauthored: what they showed is not guessed.
const SCREEN_KINDS = new Set(['traits', 'chaos', 'choice']);

function convertScreenRerollCounts(value) {
  if (Array.isArray(value)) {
    value.forEach(convertScreenRerollCounts);
    return;
  }
  if (value === null || typeof value !== 'object') return;
  if (SCREEN_KINDS.has(value.kind) && Object.hasOwn(value, 'rerollCount')) {
    const count = value.rerollCount;
    delete value.rerollCount;
    if (Number.isInteger(count) && count > 0)
      value.rerolledScreens = Array.from({ length: count }, () => null);
  }
  for (const entry of Object.values(value)) convertScreenRerollCounts(entry);
}

// Schema 100 admitted plans saved with reroll counts, Well and Pool interaction
// flags or Shrine purchase delays; each takes the shape the 99 -> 100 step writes.
function list(value, label) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function reshapeSchema100(document) {
  for (const [index, biome] of list(document.route?.biomes, 'route.biomes').entries())
    for (const occurrence of list(
      biome?.topology?.occurrences,
      `route.biomes[${index}].topology.occurrences`,
    )) {
      convertFeatureRerollCounts(occurrence);
      dropFeatureInteraction(occurrence);
      moveShrineDelays(occurrence);
    }
  convertScreenRerollCounts(document.route);
}

/**
 * The transform with its wheel judge supplied: reshapes every schema 100 save,
 * fills each sparse Nemesis kill race with wins, then gives each two-offer Ship
 * wheel its side order, exchanging the offers of a wheel the judge's block
 * names when the exchange clears that wheel.
 */
export function migrateProjectDocumentJudgedBy(value, catalog, blockOf) {
  const source = record(value, 'project document');
  if (source.schemaVersion !== SOURCE_SCHEMA_VERSION)
    throw new Error(
      `schema 100 -> 101 migration expects schema 100, received ${String(source.schemaVersion)}`,
    );
  if (source.catalogVersion !== CATALOG_VERSION)
    throw new Error(
      `schema 100 -> 101 migration expects catalog ${CATALOG_VERSION}, received ${String(source.catalogVersion)}`,
    );
  const revision = source.schemaRevision ?? 0;
  if (!Number.isInteger(revision) || revision > FINAL_SOURCE_SCHEMA_REVISION)
    throw new Error(
      `Project schema 100.${String(revision)} is newer than schema 100's final revision ${FINAL_SOURCE_SCHEMA_REVISION}.`,
    );
  const copy = JSON.parse(JSON.stringify(source));
  delete copy.schemaRevision;
  reshapeSchema100(copy);
  const filled = fillNemesisBetOutcomeWins(
    { ...copy, schemaVersion: OUTPUT_SCHEMA_VERSION },
    catalog,
  );
  return exchangeBlockedWheelOffers(filled, catalog, blockOf);
}

// Catalog-aware transform: the plan's own evaluation judges which wheels to exchange.
export function migrateProjectDocument(value, { catalog }) {
  return migrateProjectDocumentJudgedBy(
    value,
    catalog,
    (project) => simulateProject(catalog, project).issue,
  );
}

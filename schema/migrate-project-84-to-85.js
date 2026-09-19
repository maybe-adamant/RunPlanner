#!/usr/bin/env node

import { access, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SOURCE_SCHEMA_VERSION = 84;
export const OUTPUT_SCHEMA_VERSION = 85;
export const CATALOG_VERSION = '0.55.0-anvil-of-fates';

const ORDINARY_ITINERARIES = Object.freeze({
  Underworld: Object.freeze(['F', 'G', 'H', 'I']),
  Surface: Object.freeze(['N', 'O', 'P', 'Q']),
});

function expectRecord(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}

function migratePayloads(value) {
  if (Array.isArray(value)) {
    value.forEach(migratePayloads);
    return;
  }
  if (value === null || typeof value !== 'object') return;
  for (const child of Object.values(value)) migratePayloads(child);
  if (value.kind === 'disableFear' && (typeof value.vowKey === 'string' || value.vowKey === null)) {
    value.vowKeys = value.vowKey === null ? [] : [value.vowKey];
    delete value.vowKey;
  }
  if (value.traitKey === 'UpgradeHammerBoon' && typeof value.targetTraitKey === 'string') {
    value.icarusHammerTargets = [value.targetTraitKey];
    delete value.targetTraitKey;
  }
}

/**
 * Schema 85 records the full ordinary itinerary and finalizes the plural
 * Circe/Icarus authored payloads. It preserves every existing authored ID,
 * prefix, loadout, timeline, and selected singleton outcome. A null Fear
 * singleton remains the final model's repairable empty selection.
 */
export function migrateProjectDocument(value) {
  const source = expectRecord(value, 'project document');
  if (source.schemaVersion !== SOURCE_SCHEMA_VERSION)
    throw new Error(
      `schema 84 -> 85 migration expects schema 84, received ${String(source.schemaVersion)}`,
    );
  if (source.catalogVersion !== CATALOG_VERSION)
    throw new Error(
      `schema 84 -> 85 migration expects catalog ${CATALOG_VERSION}, received ${String(source.catalogVersion)}`,
    );
  const migrated = structuredClone(source);
  const legacyRoute = expectRecord(migrated.route, 'project document route');
  const itinerary = ORDINARY_ITINERARIES[legacyRoute.routeKey];
  if (itinerary === undefined) {
    throw new Error(
      `schema 84 -> 85 migration cannot infer an itinerary for ${String(legacyRoute.routeKey)}`,
    );
  }
  const { routeKey, ...legacyRoutePayload } = legacyRoute;
  migrated.route = {
    routeKey,
    itineraryBiomeKeys: [...itinerary],
    ...legacyRoutePayload,
  };
  migratePayloads(migrated.route);
  migrated.schemaVersion = OUTPUT_SCHEMA_VERSION;
  return migrated;
}

export function outputPath(inputPath) {
  const extension = extname(inputPath);
  return join(
    dirname(inputPath),
    `${basename(inputPath, extension)}-schema${OUTPUT_SCHEMA_VERSION}${extension}`,
  );
}

async function main(argv) {
  if (argv.length !== 1 || argv[0].startsWith('-'))
    throw new Error('exactly one input file is required');
  const destination = outputPath(argv[0]);
  try {
    await access(destination);
    throw new Error(`refusing to overwrite existing output: ${destination}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const document = migrateProjectDocument(JSON.parse(await readFile(argv[0], 'utf8')));
  await writeFile(destination, `${JSON.stringify(document, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  console.log(`Wrote ${destination}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href)
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });

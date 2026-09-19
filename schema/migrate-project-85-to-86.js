#!/usr/bin/env node

import { access, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SOURCE_SCHEMA_VERSION = 85;
export const OUTPUT_SCHEMA_VERSION = 86;
export const CATALOG_VERSION = '0.55.0-anvil-of-fates';

function expectRecord(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}

/**
 * Moves only the first itinerary entry's old room offer into Loadout. Its
 * acquisition fields remain on that exact occurrence; later entry state is
 * never consulted as a migration source.
 */
export function migrateProjectDocument(value) {
  const source = expectRecord(value, 'project document');
  if (source.schemaVersion !== SOURCE_SCHEMA_VERSION)
    throw new Error(
      `schema 85 -> 86 migration expects schema 85, received ${String(source.schemaVersion)}`,
    );
  if (source.catalogVersion !== CATALOG_VERSION)
    throw new Error(
      `schema 85 -> 86 migration expects catalog ${CATALOG_VERSION}, received ${String(source.catalogVersion)}`,
    );
  const migrated = structuredClone(source);
  const route = expectRecord(migrated.route, 'project document route');
  const loadout = expectRecord(route.loadout, 'project document route loadout');
  const firstBiome = Array.isArray(route.biomes) ? route.biomes[0] : undefined;
  const topology = firstBiome === undefined ? undefined : firstBiome.topology;
  const startOccurrenceId = topology?.startOccurrenceId;
  const occurrence =
    typeof startOccurrenceId === 'string' && Array.isArray(topology?.occurrences)
      ? topology.occurrences.find((candidate) => candidate?.occurrenceId === startOccurrenceId)
      : undefined;
  const reward = occurrence?.state?.reward;
  loadout.startingReward = reward?.offer ?? null;
  if (occurrence !== undefined) {
    if (reward !== null && reward !== undefined) {
      const { offer: _offer, ...acquisition } = reward;
      void _offer;
      occurrence.startingRewardAcquisition = acquisition;
    }
    occurrence.state = { kind: 'none' };
  }
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

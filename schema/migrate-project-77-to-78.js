#!/usr/bin/env node

import { access, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SOURCE_SCHEMA_VERSION = 77;
export const OUTPUT_SCHEMA_VERSION = 78;
export const CATALOG_VERSION = '0.55.0-anvil-of-fates';

function expectRecord(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}

function emptyMap(keys) {
  return Object.fromEntries(keys.map((key) => [key, null]));
}

/** Adds the occurrence-owned, unresolved Fields spatial leaves. */
export function migrateProjectDocument(value) {
  const source = expectRecord(value, 'project document');
  if (source.schemaVersion !== SOURCE_SCHEMA_VERSION)
    throw new Error(
      `schema 77 -> 78 migration expects schema ${SOURCE_SCHEMA_VERSION}, received ${String(source.schemaVersion)}`,
    );
  if (source.catalogVersion !== CATALOG_VERSION)
    throw new Error(
      `schema 77 -> 78 migration expects catalog ${CATALOG_VERSION}, received ${String(source.catalogVersion)}`,
    );
  const migrated = structuredClone(source);
  const biomes = migrated.route?.biomes;
  if (!Array.isArray(biomes)) throw new Error('project document route.biomes must be an array');
  for (const [biomeIndex, biome] of biomes.entries()) {
    const topology = biome?.topology;
    if (topology === null || topology === undefined) continue;
    if (!Array.isArray(topology.occurrences))
      throw new Error(`route.biomes[${biomeIndex}].topology.occurrences must be an array`);
    for (const occurrence of topology.occurrences) {
      const state = occurrence?.state;
      if (state?.kind !== 'fieldsCombat' || state.spatial !== undefined) continue;
      state.spatial = {
        entryStartPointId: null,
        cagePointIdBySlot: emptyMap(Object.keys(state.cages ?? {})),
        optionalPointIdBySlot: emptyMap(Object.keys(state.optionalRewards ?? {})),
        nemesisPointId: null,
      };
    }
  }
  migrated.schemaVersion = OUTPUT_SCHEMA_VERSION;
  return migrated;
}

export function outputPath(inputPath) {
  const extension = extname(inputPath);
  const stem = basename(inputPath, extension);
  return join(dirname(inputPath), `${stem}-schema${OUTPUT_SCHEMA_VERSION}${extension}`);
}

async function main(argv) {
  if (argv.length !== 1 || argv[0].startsWith('-'))
    throw new Error('exactly one input file is required');
  const inputPath = argv[0];
  const destination = outputPath(inputPath);
  try {
    await access(destination);
    throw new Error(`refusing to overwrite existing output: ${destination}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const document = migrateProjectDocument(JSON.parse(await readFile(inputPath, 'utf8')));
  await writeFile(destination, `${JSON.stringify(document, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  console.log(`Wrote ${destination}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

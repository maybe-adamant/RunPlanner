#!/usr/bin/env node

import { access, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SOURCE_SCHEMA_VERSION = 73;
export const OUTPUT_SCHEMA_VERSION = 74;
export const SOURCE_CATALOG_VERSION = '0.53.0-chaos-return-batches';
export const OUTPUT_CATALOG_VERSION = '0.54.0-required-boss-rewards';

const REQUIRED_REWARD_ROOMS = new Set(
  ['C', 'F', 'G', 'H', 'I', 'N', 'O', 'P', 'Q'].flatMap((biomeKey) => [
    `${biomeKey}_Boss01`,
    `${biomeKey}_Boss02`,
  ]),
);

function expectRecord(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function validateSource(value) {
  const source = expectRecord(value, 'project document');
  if (source.schemaVersion !== SOURCE_SCHEMA_VERSION) {
    throw new Error(
      `schema 73 -> 74 migration expects schema ${SOURCE_SCHEMA_VERSION}, received ${String(source.schemaVersion)}`,
    );
  }
  if (source.catalogVersion !== SOURCE_CATALOG_VERSION) {
    throw new Error(
      `schema 73 -> 74 migration expects catalog ${SOURCE_CATALOG_VERSION}, received ${String(source.catalogVersion)}`,
    );
  }
  const route = expectRecord(source.route, 'project document.route');
  if (!Array.isArray(route.biomes)) {
    throw new Error('schema 73 -> 74 migration expects route.biomes to be an array');
  }
  return source;
}

/** Add the declaration-owned required Boss pickup to each persisted Boss chronology. */
export function migrateProjectDocument(value) {
  const source = validateSource(value);
  const document = structuredClone(source);
  document.schemaVersion = OUTPUT_SCHEMA_VERSION;
  document.catalogVersion = OUTPUT_CATALOG_VERSION;
  for (const [biomeIndex, biome] of document.route.biomes.entries()) {
    const occurrences = biome?.topology?.occurrences;
    if (!Array.isArray(occurrences)) continue;
    for (const [occurrenceIndex, occurrence] of occurrences.entries()) {
      if (!REQUIRED_REWARD_ROOMS.has(occurrence?.gameName)) continue;
      const roomActions = expectRecord(
        occurrence.roomActions,
        `route.biomes[${biomeIndex}].topology.occurrences[${occurrenceIndex}].roomActions`,
      );
      if (!Array.isArray(roomActions.order)) {
        throw new Error(
          `route.biomes[${biomeIndex}].topology.occurrences[${occurrenceIndex}].roomActions.order must be an array`,
        );
      }
      if (!roomActions.order.some((reference) => reference?.kind === 'collectRequiredReward')) {
        roomActions.order.push({ kind: 'collectRequiredReward' });
      }
    }
  }
  return document;
}

export function outputPath(inputPath) {
  const extension = extname(inputPath);
  const stem = basename(inputPath, extension);
  return join(dirname(inputPath), `${stem}-schema${OUTPUT_SCHEMA_VERSION}${extension}`);
}

function usage() {
  return [
    'Usage:',
    '  node schema/migrate-project-73-to-74.js INPUT',
    '',
    'Writes one schema-74 sibling and never overwrites the source.',
  ].join('\n');
}

async function main(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(usage());
    return;
  }
  if (argv.length !== 1 || argv[0].startsWith('-')) {
    throw new Error('exactly one input file is required');
  }
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

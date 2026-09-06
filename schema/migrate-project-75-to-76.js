#!/usr/bin/env node

import { access, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SOURCE_SCHEMA_VERSION = 75;
export const OUTPUT_SCHEMA_VERSION = 76;
export const SOURCE_CATALOG_VERSION = '0.54.0-required-boss-rewards';
export const OUTPUT_CATALOG_VERSION = '0.55.0-anvil-of-fates';

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
      `schema 75 -> 76 migration expects schema ${SOURCE_SCHEMA_VERSION}, received ${String(source.schemaVersion)}`,
    );
  }
  if (source.catalogVersion !== SOURCE_CATALOG_VERSION) {
    throw new Error(
      `schema 75 -> 76 migration expects catalog ${SOURCE_CATALOG_VERSION}, received ${String(source.catalogVersion)}`,
    );
  }
  return source;
}

function migrateValue(value) {
  if (Array.isArray(value)) return value.map(migrateValue);
  if (value === null || typeof value !== 'object') return value;
  const record = expectRecord(value, 'project value');
  const migrated = Object.fromEntries(
    Object.entries(record).map(([key, child]) => [key, migrateValue(child)]),
  );
  const reward = migrated.reward;
  if (
    reward !== null &&
    typeof reward === 'object' &&
    reward.offer !== null &&
    typeof reward.offer === 'object' &&
    reward.offer.rewardType === 'ChaosWeaponUpgrade' &&
    migrated.anvilResult === undefined
  ) {
    migrated.anvilResult = null;
  }
  return migrated;
}

/** Preserve an authored Anvil purchase while leaving its result unresolved. */
export function migrateProjectDocument(value) {
  const source = validateSource(value);
  const document = migrateValue(source);
  document.schemaVersion = OUTPUT_SCHEMA_VERSION;
  document.catalogVersion = OUTPUT_CATALOG_VERSION;
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
    '  node schema/migrate-project-75-to-76.js INPUT',
    '',
    'Writes one schema-76 sibling and never overwrites the source.',
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

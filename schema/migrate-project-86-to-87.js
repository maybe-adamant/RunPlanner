#!/usr/bin/env node

import { access, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SOURCE_SCHEMA_VERSION = 86;
export const OUTPUT_SCHEMA_VERSION = 87;
export const CATALOG_VERSION = '0.55.0-anvil-of-fates';

function expectRecord(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}

function migratePersephoneRolls(value) {
  if (Array.isArray(value)) {
    value.forEach(migratePersephoneRolls);
    return;
  }
  if (value === null || typeof value !== 'object') return;
  for (const child of Object.values(value)) migratePersephoneRolls(child);
  if (!Object.hasOwn(value, 'persephoneLevelBonus')) return;
  const bonus = value.persephoneLevelBonus;
  if (!Number.isInteger(bonus) || bonus < 0 || bonus > 8)
    throw new Error('persephoneLevelBonus must be an integer from 0 to 8');
  value.persephoneRoll = bonus > 0 ? bonus + 1 : 0;
  delete value.persephoneLevelBonus;
}

/**
 * Replaces the prior additive approximation with the native raw roll. Positive
 * contributions receive their native +1 offset; zero remains zero and omitted
 * values remain omitted.
 */
export function migrateProjectDocument(value) {
  const source = expectRecord(value, 'project document');
  if (source.schemaVersion !== SOURCE_SCHEMA_VERSION)
    throw new Error(
      `schema 86 -> 87 migration expects schema 86, received ${String(source.schemaVersion)}`,
    );
  if (source.catalogVersion !== CATALOG_VERSION)
    throw new Error(
      `schema 86 -> 87 migration expects catalog ${CATALOG_VERSION}, received ${String(source.catalogVersion)}`,
    );
  const migrated = structuredClone(source);
  migratePersephoneRolls(migrated.route);
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

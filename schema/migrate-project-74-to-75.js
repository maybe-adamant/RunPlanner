#!/usr/bin/env node

import { access, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SOURCE_SCHEMA_VERSION = 74;
export const OUTPUT_SCHEMA_VERSION = 75;
export const SOURCE_CATALOG_VERSION = '0.54.0-required-boss-rewards';
export const OUTPUT_CATALOG_VERSION = SOURCE_CATALOG_VERSION;

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
      `schema 74 -> 75 migration expects schema ${SOURCE_SCHEMA_VERSION}, received ${String(source.schemaVersion)}`,
    );
  }
  if (source.catalogVersion !== SOURCE_CATALOG_VERSION) {
    throw new Error(
      `schema 74 -> 75 migration expects catalog ${SOURCE_CATALOG_VERSION}, received ${String(source.catalogVersion)}`,
    );
  }
  return source;
}

function migrateEquipResults(results) {
  if (results === undefined || results === null) return results;
  const record = expectRecord(results, 'keepsake equip results');
  const embryo = record.transcendentEmbryo;
  if (embryo === undefined) return record;
  const embryoRecord = expectRecord(embryo, 'transcendentEmbryo');
  if (embryoRecord.blessingValues !== undefined) return record;
  return {
    ...record,
    transcendentEmbryo: { ...embryoRecord, blessingValues: {} },
  };
}

/** Preserve Embryo identities while explicitly marking old operands for repair. */
export function migrateProjectDocument(value) {
  const source = validateSource(value);
  const document = structuredClone(source);
  document.schemaVersion = OUTPUT_SCHEMA_VERSION;
  document.catalogVersion = OUTPUT_CATALOG_VERSION;
  const route = document.route;
  if (route?.loadout !== undefined) {
    route.loadout.keepsakeEquipResults = migrateEquipResults(route.loadout.keepsakeEquipResults);
  }
  for (const biome of route?.biomes ?? []) {
    if (biome.echoKeepsakeReplayResults !== undefined) {
      biome.echoKeepsakeReplayResults = migrateEquipResults(biome.echoKeepsakeReplayResults);
    }
    for (const occurrence of biome.topology?.occurrences ?? []) {
      if (occurrence.keepsakeRack !== undefined) {
        occurrence.keepsakeRack.equipResults = migrateEquipResults(
          occurrence.keepsakeRack.equipResults,
        );
      }
      const byPhase = occurrence.encounters?.transcendentEmbryoBlessingByPhase;
      if (byPhase === undefined) continue;
      const next = {};
      for (const [phaseKey, blessing] of Object.entries(
        expectRecord(byPhase, 'Embryo phase outcomes'),
      )) {
        if (typeof blessing === 'string') {
          next[phaseKey] = { blessingKey: blessing, blessingValues: {} };
        } else {
          const outcome = expectRecord(blessing, `Embryo phase outcome ${phaseKey}`);
          next[phaseKey] =
            outcome.blessingValues === undefined ? { ...outcome, blessingValues: {} } : outcome;
        }
      }
      occurrence.encounters.transcendentEmbryoBlessingByPhase = next;
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
    '  node schema/migrate-project-74-to-75.js INPUT',
    '',
    'Writes one schema-75 sibling and never overwrites the source.',
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

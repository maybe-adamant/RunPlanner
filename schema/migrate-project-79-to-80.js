#!/usr/bin/env node

import { access, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SOURCE_SCHEMA_VERSION = 79;
export const OUTPUT_SCHEMA_VERSION = 80;
export const CATALOG_VERSION = '0.55.0-anvil-of-fates';

const CLOCKED_PICKUP_ENTRY_PREFIX = 'clockedTraitGenerated:';

function expectRecord(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}

function isTraitOfferSemanticAddress(value) {
  let address;
  try {
    address = JSON.parse(value);
  } catch {
    return false;
  }
  return (
    Array.isArray(address) &&
    address.length === 5 &&
    address[0] === 'traitOffer' &&
    typeof address[1] === 'string' &&
    typeof address[2] === 'string' &&
    typeof address[3] === 'string' &&
    typeof address[4] === 'string' &&
    address[4].length > 0
  );
}

function legacyClockedPickupEntryKey(key) {
  if (!key.startsWith(CLOCKED_PICKUP_ENTRY_PREFIX)) return undefined;
  const encoded = key.slice(CLOCKED_PICKUP_ENTRY_PREFIX.length);
  const separator = encoded.lastIndexOf(':');
  if (separator <= 0 || separator === encoded.length - 1) return undefined;
  try {
    const acquisitionIdentity = decodeURIComponent(encoded.slice(0, separator));
    const pickupKey = decodeURIComponent(encoded.slice(separator + 1));
    const match = /^(.*):([0-9]+)$/.exec(acquisitionIdentity);
    if (match === null || !isTraitOfferSemanticAddress(match[1]) || pickupKey.length === 0)
      return undefined;
    return {
      oldKey: key,
      newKey: `${CLOCKED_PICKUP_ENTRY_PREFIX}${encodeURIComponent(match[1])}:${encodeURIComponent(pickupKey)}`,
    };
  } catch {
    return undefined;
  }
}

function migrateOccurrence(occurrence, occurrencePath) {
  const acquisitionSites = occurrence?.acquisitionSites;
  if (
    acquisitionSites === null ||
    typeof acquisitionSites !== 'object' ||
    Array.isArray(acquisitionSites)
  )
    return;

  const mappingsBySite = new Map();
  for (const [siteKey, site] of Object.entries(acquisitionSites)) {
    const pickupEntries = site?.pickupEntries;
    if (pickupEntries === null || typeof pickupEntries !== 'object' || Array.isArray(pickupEntries))
      continue;
    const mappings = new Map();
    const migratedKeys = new Set();
    for (const key of Object.keys(pickupEntries)) {
      const migration = legacyClockedPickupEntryKey(key);
      if (migration === undefined) continue;
      if (
        migratedKeys.has(migration.newKey) ||
        (Object.hasOwn(pickupEntries, migration.newKey) && migration.newKey !== key)
      )
        throw new Error(
          `${occurrencePath}.acquisitionSites.${siteKey}.pickupEntries has a migrated-key collision for ${migration.newKey}`,
        );
      migratedKeys.add(migration.newKey);
      mappings.set(migration.oldKey, migration.newKey);
    }
    if (mappings.size > 0) mappingsBySite.set(siteKey, mappings);
  }

  if (mappingsBySite.size === 0) return;

  for (const [siteKey, mappings] of mappingsBySite) {
    const site = acquisitionSites[siteKey];
    const pickupEntries = site.pickupEntries;
    const migratedEntries = {};
    for (const [key, value] of Object.entries(pickupEntries))
      migratedEntries[mappings.get(key) ?? key] = value;
    site.pickupEntries = migratedEntries;
  }

  const order = occurrence.roomActions?.order;
  if (!Array.isArray(order)) return;
  occurrence.roomActions.order = order.map((action) => {
    const mappings =
      action?.kind === 'interactAcquisitionEntry' ? mappingsBySite.get(action.siteKey) : undefined;
    const entryKey = mappings?.get(action.entryKey);
    return entryKey === undefined ? action : { ...action, entryKey };
  });
}

/** Rekeys legacy clocked generated-pickup entries and their local action references. */
export function migrateProjectDocument(value) {
  const source = expectRecord(value, 'project document');
  if (source.schemaVersion !== SOURCE_SCHEMA_VERSION)
    throw new Error(
      `schema 79 -> 80 migration expects schema ${SOURCE_SCHEMA_VERSION}, received ${String(source.schemaVersion)}`,
    );
  if (source.catalogVersion !== CATALOG_VERSION)
    throw new Error(
      `schema 79 -> 80 migration expects catalog ${CATALOG_VERSION}, received ${String(source.catalogVersion)}`,
    );
  const migrated = structuredClone(source);
  const biomes = migrated.route?.biomes;
  if (!Array.isArray(biomes)) throw new Error('project document route.biomes must be an array');
  for (const [biomeIndex, biome] of biomes.entries()) {
    const topology = biome?.topology;
    if (topology === null || topology === undefined) continue;
    if (!Array.isArray(topology.occurrences))
      throw new Error(`route.biomes[${biomeIndex}].topology.occurrences must be an array`);
    for (const [occurrenceIndex, occurrence] of topology.occurrences.entries())
      migrateOccurrence(
        occurrence,
        `route.biomes[${biomeIndex}].topology.occurrences[${occurrenceIndex}]`,
      );
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

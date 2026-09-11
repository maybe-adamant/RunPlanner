#!/usr/bin/env node

import { access, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SOURCE_SCHEMA_VERSION = 80;
export const OUTPUT_SCHEMA_VERSION = 81;
export const CATALOG_VERSION = '0.55.0-anvil-of-fates';

function expectRecord(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}

function inferOptionKey(profileKey, offerKey, rewardType) {
  if (profileKey === 'Q_WorldShop') {
    if (
      (offerKey === 'MixedProgress1' || offerKey === 'MixedProgress2') &&
      rewardType === 'RandomLoot'
    )
      return null;
    if (offerKey === 'PremiumProgress' && rewardType === 'RandomLoot') return 'BoostedRandomLoot';
  }
  if (profileKey === 'I_WorldShop') {
    if (
      (offerKey === 'BoostedBoon' || offerKey === 'PremiumProgress') &&
      rewardType === 'RandomLoot'
    )
      return 'BoostedRandomLoot';
  }
  if (profileKey === 'WorldShop' && rewardType === 'WeaponUpgradeDrop') return null;
  return rewardType;
}

function migrateOccurrence(occurrence, profilePath) {
  const state = occurrence?.state;
  if (state?.kind !== 'shop') return;
  if (state.shop === undefined) return;
  const shop = expectRecord(state.shop, `${profilePath}.state.shop`);
  const profileKey = shop.profileKey;
  if (typeof profileKey !== 'string')
    throw new Error(`${profilePath}.state.shop.profileKey must be a string`);
  const offers = expectRecord(shop.offers, `${profilePath}.state.shop.offers`);
  for (const [offerKey, rawOffer] of Object.entries(offers)) {
    const offer = expectRecord(rawOffer, `${profilePath}.state.shop.offers.${offerKey}`);
    const reward = offer.reward;
    let optionKey = null;
    if (reward !== null) {
      const rewardRecord = expectRecord(
        reward,
        `${profilePath}.state.shop.offers.${offerKey}.reward`,
      );
      const resolved = expectRecord(
        rewardRecord.offer,
        `${profilePath}.state.shop.offers.${offerKey}.reward.offer`,
      );
      if (typeof resolved.rewardType !== 'string')
        throw new Error(
          `${profilePath}.state.shop.offers.${offerKey}.reward.offer.rewardType must be a string`,
        );
      optionKey = inferOptionKey(profileKey, offerKey, resolved.rewardType);
    }
    offers[offerKey] = { ...offer, optionKey };
  }
}

/** Adds exact World Shop option identity, retaining only genuine legacy ambiguity. */
export function migrateProjectDocument(value) {
  const source = expectRecord(value, 'project document');
  if (source.schemaVersion !== SOURCE_SCHEMA_VERSION)
    throw new Error(
      `schema 80 -> 81 migration expects schema ${SOURCE_SCHEMA_VERSION}, received ${String(source.schemaVersion)}`,
    );
  if (source.catalogVersion !== CATALOG_VERSION)
    throw new Error(
      `schema 80 -> 81 migration expects catalog ${CATALOG_VERSION}, received ${String(source.catalogVersion)}`,
    );
  const migrated = structuredClone(source);
  const biomes = migrated.route?.biomes;
  if (!Array.isArray(biomes)) throw new Error('project document route.biomes must be an array');
  for (const [biomeIndex, biome] of biomes.entries()) {
    if (typeof biome?.biomeKey !== 'string')
      throw new Error(`route.biomes[${biomeIndex}].biomeKey must be a string`);
    const occurrences = biome.topology?.occurrences;
    if (occurrences === undefined) continue;
    if (!Array.isArray(occurrences))
      throw new Error(`route.biomes[${biomeIndex}].topology.occurrences must be an array`);
    for (const [occurrenceIndex, occurrence] of occurrences.entries())
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

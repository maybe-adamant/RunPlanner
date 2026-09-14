#!/usr/bin/env node

import { access, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SOURCE_SCHEMA_VERSION = 82;
export const OUTPUT_SCHEMA_VERSION = 83;
export const CATALOG_VERSION = '0.55.0-anvil-of-fates';
const TRAVEL = 'travelDealRefill';
// These profiles otherwise name every option by its reward type. Do not infer
// an early/late Hammer or ordinary/boosted Boon from later acquisition outcomes.
function optionFor(profileKey, rewardType) {
  if (rewardType === undefined) return null;
  if (!['WorldShop', 'I_WorldShop', 'Q_WorldShop'].includes(profileKey))
    throw new Error(`unknown World Shop profile ${String(profileKey)}`);
  if (profileKey === 'WorldShop' && rewardType === 'WeaponUpgradeDrop') return null;
  if (profileKey !== 'WorldShop' && rewardType === 'RandomLoot') return null;
  return rewardType;
}

function expectRecord(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}

function purchased(occurrence) {
  return (
    occurrence.roomActions?.order?.some(
      (action) =>
        action?.kind === 'interactAcquisitionEntry' &&
        action.siteKey === 'roomExit' &&
        action.entryKey === TRAVEL,
    ) === true
  );
}

/** Moves legacy Travel pickup inventory into its dynamic Shop carrier without guessing option identity. */
export function migrateProjectDocument(value) {
  const source = expectRecord(value, 'project document');
  if (source.schemaVersion !== SOURCE_SCHEMA_VERSION)
    throw new Error(
      `schema 82 -> 83 migration expects schema 82, received ${String(source.schemaVersion)}`,
    );
  if (source.catalogVersion !== CATALOG_VERSION)
    throw new Error(
      `schema 82 -> 83 migration expects catalog ${CATALOG_VERSION}, received ${String(source.catalogVersion)}`,
    );
  const migrated = structuredClone(source);
  const biomes = migrated.route?.biomes;
  if (!Array.isArray(biomes)) throw new Error('project document route.biomes must be an array');
  for (const biome of biomes)
    for (const occurrence of biome?.topology?.occurrences ?? []) {
      const shop = occurrence?.state?.kind === 'shop' ? occurrence.state.shop : undefined;
      const entries = occurrence?.acquisitionSites?.roomExit?.pickupEntries;
      const legacy = entries?.[TRAVEL];
      if (legacy === undefined) continue;
      if (shop === undefined) throw new Error('Travel refill has no Shop owner');
      if (Object.hasOwn(shop, TRAVEL))
        throw new Error('Travel migration refuses an existing Shop slot collision');
      const mystery = legacy?.offer?.rewardType === 'BlindBoxLoot';
      const rewardType = legacy?.offer?.rewardType;
      const optionKey = optionFor(shop.profileKey, rewardType);
      shop[TRAVEL] = mystery
        ? {
            optionKey,
            reward: {
              offer: { rewardType: 'BlindBoxLoot' },
              traitOffersByAcquisitionRole: {},
              dispositionByAcquisitionRole: {},
            },
          }
        : {
            optionKey,
            reward: legacy,
            ...(rewardType === 'ChaosWeaponUpgrade' ? { anvilResult: null } : {}),
          };
      if (!mystery || !purchased(occurrence)) delete entries[TRAVEL];
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

#!/usr/bin/env node

import { access, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SOURCE_SCHEMA_VERSION = 81;
export const OUTPUT_SCHEMA_VERSION = 82;
export const CATALOG_VERSION = '0.55.0-anvil-of-fates';

function expectRecord(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}

function rewriteContractAction(occurrence) {
  const order = occurrence.roomActions?.order;
  if (!Array.isArray(order)) return false;
  let selected = false;
  occurrence.roomActions.order = order.map((action) => {
    if (
      action?.kind === 'interactAcquisitionEntry' &&
      action.siteKey === 'roomExit' &&
      action.entryKey === 'infernalContractReward'
    ) {
      selected = true;
      return { kind: 'interactShopOffer', offerKey: 'infernalContractReward' };
    }
    return action;
  });
  return selected;
}

/** Moves the old Contract inventory carrier into its actual Shop slot. */
export function migrateProjectDocument(value) {
  const source = expectRecord(value, 'project document');
  if (source.schemaVersion !== SOURCE_SCHEMA_VERSION)
    throw new Error(
      `schema 81 -> 82 migration expects schema ${SOURCE_SCHEMA_VERSION}, received ${String(source.schemaVersion)}`,
    );
  if (source.catalogVersion !== CATALOG_VERSION)
    throw new Error(
      `schema 81 -> 82 migration expects catalog ${CATALOG_VERSION}, received ${String(source.catalogVersion)}`,
    );
  const migrated = structuredClone(source);
  const biomes = migrated.route?.biomes;
  if (!Array.isArray(biomes)) throw new Error('project document route.biomes must be an array');
  for (const biome of biomes)
    for (const occurrence of biome?.topology?.occurrences ?? []) {
      const shop = occurrence?.state?.kind === 'shop' ? occurrence.state.shop : undefined;
      const entries = occurrence?.acquisitionSites?.roomExit?.pickupEntries;
      const old = entries?.infernalContractReward;
      if (shop === undefined || old === undefined) continue;
      shop.offers ??= {};
      if (Object.hasOwn(shop.offers, 'infernalContractReward'))
        throw new Error('Contract migration refuses an existing Shop slot collision');
      const selected = rewriteContractAction(occurrence);
      const mystery = old?.offer?.rewardType === 'BlindBoxLoot';
      shop.offers.infernalContractReward = mystery
        ? {
            optionKey: 'BlindBoxLoot',
            reward: {
              offer: { rewardType: 'BlindBoxLoot' },
              traitOffersByAcquisitionRole: {},
              dispositionByAcquisitionRole: {},
            },
          }
        : { optionKey: old?.offer?.rewardType ?? null, reward: old };
      if (!mystery || !selected) delete entries.infernalContractReward;
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
  main(process.argv.slice(2)).catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  });

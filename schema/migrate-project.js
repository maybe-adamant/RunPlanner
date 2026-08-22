#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const CURRENT_SCHEMA_VERSION = 50;
const SCHEMA_49_CATALOG_VERSION = '0.27.0-arcana-fear-loadout';
const SCHEMA_50_CATALOG_VERSION = '0.28.0-selene-spells';

function expectRecord(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function visitRecords(value, visitor) {
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) visitRecords(item, visitor);
    return;
  }
  visitor(value);
  for (const child of Object.values(value)) visitRecords(child, visitor);
}

function migrate49To50(document) {
  if (document.catalogVersion !== SCHEMA_49_CATALOG_VERSION) {
    throw new Error(
      `schema 49 migration expects catalog ${SCHEMA_49_CATALOG_VERSION}, received ${String(document.catalogVersion)}`,
    );
  }

  let unresolvedSpellDropsAdded = 0;
  visitRecords(document, (record) => {
    const offer = record.offer;
    if (
      offer === null ||
      typeof offer !== 'object' ||
      Array.isArray(offer) ||
      offer.rewardType !== 'SpellDrop'
    ) {
      return;
    }

    const traitOffers = expectRecord(
      record.traitOffersByAcquisitionRole,
      'SpellDrop.traitOffersByAcquisitionRole',
    );
    if (!Object.hasOwn(traitOffers, 'self')) {
      traitOffers.self = null;
      unresolvedSpellDropsAdded += 1;
    }
  });

  document.schemaVersion = 50;
  document.catalogVersion = SCHEMA_50_CATALOG_VERSION;
  return { unresolvedSpellDropsAdded };
}

const migrations = new Map([[49, migrate49To50]]);

export function migrateProjectDocument(value, targetVersion = CURRENT_SCHEMA_VERSION) {
  const document = structuredClone(expectRecord(value, 'project document'));
  const sourceVersion = document.schemaVersion;
  if (!Number.isInteger(sourceVersion)) throw new Error('schemaVersion must be an integer');
  if (!Number.isInteger(targetVersion)) throw new Error('target schema must be an integer');
  if (sourceVersion > targetVersion) {
    throw new Error(`cannot migrate schema ${sourceVersion} backwards to ${targetVersion}`);
  }

  const steps = [];
  const changes = {};
  while (document.schemaVersion < targetVersion) {
    const from = document.schemaVersion;
    const migrate = migrations.get(from);
    if (migrate === undefined) {
      throw new Error(`no migration is registered for schema ${from} -> ${from + 1}`);
    }
    const stepChanges = migrate(document);
    if (document.schemaVersion !== from + 1) {
      throw new Error(`schema ${from} migration did not produce schema ${from + 1}`);
    }
    steps.push(`${from}->${from + 1}`);
    changes[`${from}->${from + 1}`] = stepChanges;
  }

  return Object.freeze({
    document,
    sourceVersion,
    targetVersion,
    steps: Object.freeze(steps),
    changes: Object.freeze(changes),
  });
}

function defaultOutputPath(inputPath, targetVersion) {
  const extension = extname(inputPath);
  const stem = basename(inputPath, extension);
  const migratedStem = /-schema\d+$/.test(stem)
    ? stem.replace(/-schema\d+$/, `-schema${targetVersion}`)
    : `${stem}-schema${targetVersion}`;
  return join(dirname(inputPath), `${migratedStem}${extension}`);
}

function usage() {
  return [
    'Usage:',
    '  node schema/migrate-project.js [--target VERSION] [--output FILE | --in-place] INPUT',
    '',
    'Without --output or --in-place, writes a sibling file suffixed with the target schema.',
  ].join('\n');
}

function parseArguments(argv) {
  let targetVersion = CURRENT_SCHEMA_VERSION;
  let outputPath;
  let inPlace = false;
  let inputPath;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--target') {
      const raw = argv[index + 1];
      if (raw === undefined) throw new Error('--target requires a version');
      targetVersion = Number(raw);
      index += 1;
    } else if (argument === '--output') {
      outputPath = argv[index + 1];
      if (outputPath === undefined) throw new Error('--output requires a file');
      index += 1;
    } else if (argument === '--in-place') {
      inPlace = true;
    } else if (argument === '--help' || argument === '-h') {
      return { help: true };
    } else if (argument.startsWith('-')) {
      throw new Error(`unknown option ${argument}`);
    } else if (inputPath === undefined) {
      inputPath = argument;
    } else {
      throw new Error(`unexpected argument ${argument}`);
    }
  }

  if (inputPath === undefined) throw new Error('an input file is required');
  if (inPlace && outputPath !== undefined)
    throw new Error('choose --output or --in-place, not both');
  return { help: false, inputPath, outputPath, inPlace, targetVersion };
}

async function main(argv) {
  const options = parseArguments(argv);
  if (options.help) {
    console.log(usage());
    return;
  }

  const raw = await readFile(options.inputPath, 'utf8');
  const result = migrateProjectDocument(JSON.parse(raw), options.targetVersion);
  const outputPath = options.inPlace
    ? options.inputPath
    : (options.outputPath ?? defaultOutputPath(options.inputPath, options.targetVersion));
  await writeFile(outputPath, `${JSON.stringify(result.document, null, 2)}\n`, 'utf8');

  const detail = result.steps
    .map((step) => {
      const changes = result.changes[step];
      return `${step} (${Object.entries(changes)
        .map(([key, count]) => `${key}: ${count}`)
        .join(', ')})`;
    })
    .join(', ');
  console.log(`Migrated ${options.inputPath}`);
  console.log(`Wrote ${outputPath}`);
  console.log(detail.length === 0 ? `Already at schema ${result.targetVersion}` : detail);
}

const invokedPath = process.argv[1] === undefined ? undefined : pathToFileURL(process.argv[1]).href;
if (invokedPath === import.meta.url) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(usage());
    process.exitCode = 1;
  });
}

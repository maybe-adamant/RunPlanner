#!/usr/bin/env node

// Offline project migration: chains the application's own schema transitions from a
// saved document's schema to the current one and writes a sibling file.

import { access, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PROJECT_TRANSITION_STEPS } from '../apps/planner/src/persistence/project-transitions.js';

const PROJECT_SUFFIX = '.runplanner.json';

/** The application's transitions in schema order (`project-transitions.js` owns the list). */
export const TRANSITIONS = Object.freeze(
  PROJECT_TRANSITION_STEPS.map((step) =>
    Object.freeze({
      source: step.SOURCE_SCHEMA_VERSION,
      target: step.OUTPUT_SCHEMA_VERSION,
      migrate: step.migrateProjectDocument,
    }),
  ),
);

for (let index = 1; index < TRANSITIONS.length; index += 1)
  if (TRANSITIONS[index].source !== TRANSITIONS[index - 1].target)
    throw new Error(
      `schema transitions must chain: ${TRANSITIONS[index - 1].target} is followed by ${TRANSITIONS[index].source}`,
    );

export const OLDEST_SCHEMA_VERSION = TRANSITIONS[0].source;
export const CURRENT_SCHEMA_VERSION = TRANSITIONS[TRANSITIONS.length - 1].target;

/** The input file's stem, which names a plan migrated across schema 98. */
export function planNameFromPath(inputPath) {
  const base = basename(inputPath);
  return base.toLowerCase().endsWith(PROJECT_SUFFIX)
    ? base.slice(0, -PROJECT_SUFFIX.length)
    : basename(base, extname(base));
}

export function outputPath(inputPath, schemaVersion = CURRENT_SCHEMA_VERSION) {
  const extension = extname(inputPath);
  return join(
    dirname(inputPath),
    `${basename(inputPath, extension)}-schema${schemaVersion}${extension}`,
  );
}

/**
 * Migrates a document from its own `schemaVersion` to `target` (the current schema by
 * default), applying each transition in order. `context.name` names the plan when the
 * chain crosses schema 98.
 */
export function migrateProjectDocumentTo(
  document,
  { target = CURRENT_SCHEMA_VERSION, context = {} } = {},
) {
  if (document === null || typeof document !== 'object' || Array.isArray(document))
    throw new Error('project document must be an object');
  const source = document.schemaVersion;
  if (!Number.isInteger(source)) throw new Error('project document has no integer schemaVersion');
  if (source < OLDEST_SCHEMA_VERSION)
    throw new Error(`schema ${source} is older than the supported floor ${OLDEST_SCHEMA_VERSION}`);
  if (target > CURRENT_SCHEMA_VERSION)
    throw new Error(`schema ${target} is newer than the current schema ${CURRENT_SCHEMA_VERSION}`);
  if (source > target) throw new Error(`schema ${source} is already newer than ${target}`);
  let migrated = document;
  for (const transition of TRANSITIONS) {
    if (transition.source < source) continue;
    if (transition.target > target) break;
    migrated = transition.migrate(migrated, context);
  }
  return migrated;
}

function parseArguments(argv) {
  let target = CURRENT_SCHEMA_VERSION;
  const files = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--to') {
      index += 1;
      target = Number(argv[index]);
      if (!Number.isInteger(target)) throw new Error('--to needs an integer schema version');
    } else if (argument.startsWith('-')) throw new Error(`unknown option: ${argument}`);
    else files.push(argument);
  }
  if (files.length !== 1)
    throw new Error(
      'usage: npm run schema:migrate -- [--to <schema>] path/to/project.runplanner.json',
    );
  return { target, inputPath: files[0] };
}

async function main(argv) {
  const { target, inputPath } = parseArguments(argv);
  const destination = outputPath(inputPath, target);
  try {
    await access(destination);
    throw new Error(`refusing to overwrite existing output: ${destination}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const source = JSON.parse(await readFile(inputPath, 'utf8'));
  const migrated = migrateProjectDocumentTo(source, {
    target,
    context: { name: planNameFromPath(inputPath) },
  });
  await writeFile(destination, `${JSON.stringify(migrated, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  console.log(`Wrote ${destination} (schema ${source.schemaVersion} -> ${target})`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href)
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });

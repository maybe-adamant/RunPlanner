#!/usr/bin/env node

import { access, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
export {
  SOURCE_SCHEMA_VERSION,
  OUTPUT_SCHEMA_VERSION,
  CATALOG_VERSION,
  migrateProjectDocument,
} from '../apps/planner/src/persistence/project-86-to-87.js';
import {
  OUTPUT_SCHEMA_VERSION,
  migrateProjectDocument,
} from '../apps/planner/src/persistence/project-86-to-87.js';

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
  await writeFile(
    destination,
    `${JSON.stringify(migrateProjectDocument(JSON.parse(await readFile(argv[0], 'utf8'))), null, 2)}\n`,
    { encoding: 'utf8', flag: 'wx' },
  );
  console.log(`Wrote ${destination}`);
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href)
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });

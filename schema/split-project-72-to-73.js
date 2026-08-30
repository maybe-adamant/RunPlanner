#!/usr/bin/env node

import { access, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SOURCE_SCHEMA_VERSION = 72;
export const OUTPUT_SCHEMA_VERSION = 73;
export const SOURCE_CATALOG_VERSION = '0.51.0-biome-i-encounter-profiles';
export const SPLIT_ROUTE_KEYS = Object.freeze(['Underworld', 'Surface']);

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
      `schema 72 -> 73 splitter expects schema ${SOURCE_SCHEMA_VERSION}, received ${String(source.schemaVersion)}`,
    );
  }
  if (source.catalogVersion !== SOURCE_CATALOG_VERSION) {
    throw new Error(
      `schema 72 -> 73 splitter expects catalog ${SOURCE_CATALOG_VERSION}, received ${String(source.catalogVersion)}`,
    );
  }
  if (!Array.isArray(source.routes)) {
    throw new Error('schema 72 -> 73 splitter expects a routes array');
  }
  const routeKeys = source.routes.map((route) => route?.routeKey);
  if (routeKeys.length !== SPLIT_ROUTE_KEYS.length) {
    throw new Error(`schema 72 -> 73 splitter expects exactly ${SPLIT_ROUTE_KEYS.length} routes`);
  }
  for (const routeKey of SPLIT_ROUTE_KEYS) {
    const count = routeKeys.filter((candidate) => candidate === routeKey).length;
    if (count !== 1) {
      throw new Error(
        `schema 72 -> 73 splitter expects route ${routeKey} exactly once (found ${count})`,
      );
    }
  }
  return source;
}

/** Split the immediately preceding two-route document into two independent documents. */
export function splitProjectDocument(value) {
  const source = validateSource(value);
  const sourceClone = structuredClone(source);
  const documents = Object.fromEntries(
    SPLIT_ROUTE_KEYS.map((routeKey) => {
      const route = sourceClone.routes.find((candidate) => candidate.routeKey === routeKey);
      if (route === undefined) throw new Error(`missing route ${routeKey}`);
      const document = { ...sourceClone, route: structuredClone(route) };
      delete document.routes;
      document.schemaVersion = OUTPUT_SCHEMA_VERSION;
      return [routeKey, document];
    }),
  );
  return Object.freeze({
    sourceVersion: SOURCE_SCHEMA_VERSION,
    targetVersion: OUTPUT_SCHEMA_VERSION,
    documents: Object.freeze(documents),
  });
}

function normalizedRouteKey(routeKey) {
  return routeKey.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function outputPaths(inputPath) {
  const extension = extname(inputPath);
  const stem = basename(inputPath, extension);
  return Object.fromEntries(
    SPLIT_ROUTE_KEYS.map((routeKey) => [
      routeKey,
      join(
        dirname(inputPath),
        `${stem}-${normalizedRouteKey(routeKey)}-schema${OUTPUT_SCHEMA_VERSION}${extension}`,
      ),
    ]),
  );
}

async function assertOutputsAbsent(paths) {
  const existing = [];
  for (const path of Object.values(paths)) {
    try {
      await access(path);
      existing.push(path);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  if (existing.length > 0) {
    throw new Error(`refusing to overwrite existing output: ${existing.join(', ')}`);
  }
}

function usage() {
  return [
    'Usage:',
    '  node schema/split-project-72-to-73.js INPUT',
    '',
    'Writes one schema-73 sibling for Underworld and one for Surface.',
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
  const raw = await readFile(inputPath, 'utf8');
  const split = splitProjectDocument(JSON.parse(raw));
  const paths = outputPaths(inputPath);
  await assertOutputsAbsent(paths);
  for (const routeKey of SPLIT_ROUTE_KEYS) {
    await writeFile(paths[routeKey], `${JSON.stringify(split.documents[routeKey], null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
  }
  console.log(`Split ${inputPath}`);
  for (const routeKey of SPLIT_ROUTE_KEYS) {
    console.log(`Wrote ${routeKey}: ${paths[routeKey]}`);
  }
}

const invokedPath = process.argv[1] === undefined ? undefined : pathToFileURL(process.argv[1]).href;
if (invokedPath === import.meta.url) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(usage());
    process.exitCode = 1;
  });
}

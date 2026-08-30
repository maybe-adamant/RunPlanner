#!/usr/bin/env node

import { access, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SOURCE_SCHEMA_VERSION = 72;
export const OUTPUT_SCHEMA_VERSION = 73;
export const SOURCE_CATALOG_VERSION = '0.51.0-biome-i-encounter-profiles';
export const OUTPUT_CATALOG_VERSION = '0.52.0-boss-preboss-variants';
export const SPLIT_ROUTE_KEYS = Object.freeze(['Underworld', 'Surface']);

// Migration-local historical mapping. Schema 72 persisted only Boss01; schema 73
// names the physical Rivals room selected by the already-stored Vow rank.
const RIVALS_BOSS_VARIANTS = Object.freeze({
  F: 'F_Boss02',
  G: 'G_Boss02',
  H: 'H_Boss02',
  N: 'N_Boss02',
  O: 'O_Boss02',
  Q: 'Q_Boss02',
});

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

function reconcileCompletionBossVariants(route) {
  const rank = route?.loadout?.fearRanks?.BossDifficultyShrineUpgrade;
  if (!Number.isInteger(rank) || rank <= 0 || !Array.isArray(route.biomes)) return route;
  return {
    ...route,
    biomes: route.biomes.map((biome, routePosition) => {
      const variant = RIVALS_BOSS_VARIANTS[biome?.biomeKey];
      const topology = biome?.topology;
      if (
        variant === undefined ||
        rank < routePosition + 1 ||
        !Array.isArray(topology?.occurrences)
      ) {
        return biome;
      }
      const fixedTargets = new Set(
        (Array.isArray(topology.fixedRoomLinks) ? topology.fixedRoomLinks : [])
          .filter(
            (link) =>
              typeof link?.sourceOccurrenceId === 'string' &&
              typeof link?.targetOccurrenceId === 'string' &&
              link.targetOccurrenceId === `${link.sourceOccurrenceId}:boss`,
          )
          .map((link) => link.targetOccurrenceId),
      );
      if (fixedTargets.size === 0) return biome;
      return {
        ...biome,
        topology: {
          ...topology,
          occurrences: topology.occurrences.map((occurrence) =>
            fixedTargets.has(occurrence?.occurrenceId) &&
            occurrence.gameName === `${biome.biomeKey}_Boss01`
              ? { ...occurrence, gameName: variant }
              : occurrence,
          ),
        },
      };
    }),
  };
}

/** Split the immediately preceding two-route document into two independent documents. */
export function splitProjectDocument(value) {
  const source = validateSource(value);
  const sourceClone = structuredClone(source);
  const documents = Object.fromEntries(
    SPLIT_ROUTE_KEYS.map((routeKey) => {
      const route = sourceClone.routes.find((candidate) => candidate.routeKey === routeKey);
      if (route === undefined) throw new Error(`missing route ${routeKey}`);
      const document = {
        ...sourceClone,
        route: reconcileCompletionBossVariants(structuredClone(route)),
      };
      delete document.routes;
      document.schemaVersion = OUTPUT_SCHEMA_VERSION;
      document.catalogVersion = OUTPUT_CATALOG_VERSION;
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

import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  decodeProjectDocument,
  encodeProjectDocument,
} from '@run-planner/engine/authored-project';

import { createCompleteNProject } from './support/complete-n-project';
import { nBiome } from './support/configured-projects';

function encodedFStart(): Record<string, unknown> {
  const biome = createBiomeAddress('Underworld', 'F');
  const project = applyProjectCommand(
    createProjectDocument(catalog, {
      projectId: 'codec-f',
      name: 'Codec F',
      configuredBiomeCounts: { Underworld: 1 },
    }),
    catalog,
    {
      kind: 'CreateStart',
      biome,
      occurrenceId: createOccurrenceId('codec-f-start'),
      gameName: 'F_Opening01',
    },
  );
  return JSON.parse(encodeProjectDocument(project)) as Record<string, unknown>;
}

function fTopology(document: Record<string, unknown>): Record<string, unknown> {
  const routes = document.routes as Array<Record<string, unknown>>;
  const underworld = routes.find((route) => route.routeKey === 'Underworld');
  const biome = (underworld?.biomes as Array<Record<string, unknown>> | undefined)?.[0];
  const topology = biome?.topology;
  if (topology === null || topology === undefined || typeof topology !== 'object') {
    throw new Error('missing encoded F topology');
  }
  return topology as Record<string, unknown>;
}

function replaceTopology(
  document: Record<string, unknown>,
  replacement: Record<string, unknown>,
): Record<string, unknown> {
  const routes = document.routes as Array<Record<string, unknown>>;
  return {
    routes: routes.map((route, index) =>
      index === 0
        ? {
            ...route,
            biomes: (route.biomes as Array<Record<string, unknown>>).map((biome, biomeIndex) =>
              biomeIndex === 0
                ? { ...biome, topology: { ...fTopology(document), ...replacement } }
                : biome,
            ),
          }
        : route,
    ),
  };
}

const codecRejections: readonly {
  readonly name: string;
  readonly mutate: (document: Record<string, unknown>) => unknown;
}[] = [
  { name: 'a null root', mutate: () => null },
  { name: 'an array root', mutate: () => [] },
  { name: 'a schema-10 document', mutate: (document) => ({ ...document, schemaVersion: 10 }) },
  { name: 'a blank project ID', mutate: (document) => ({ ...document, projectId: ' ' }) },
  { name: 'a blank project name', mutate: (document) => ({ ...document, name: ' ' }) },
  {
    name: 'an incompatible catalog version',
    mutate: (document) => ({ ...document, catalogVersion: 'incompatible' }),
  },
  { name: 'an undeclared root field', mutate: (document) => ({ ...document, extra: true }) },
  { name: 'a missing required route', mutate: (document) => ({ ...document, routes: [] }) },
  {
    name: 'a duplicate route',
    mutate: (document) => ({
      ...document,
      routes: [...(document.routes as unknown[]), (document.routes as unknown[])[0]],
    }),
  },
  {
    name: 'an unknown route',
    mutate: (document) => ({
      ...document,
      routes: (document.routes as Array<Record<string, unknown>>).map((route, index) =>
        index === 0 ? { ...route, routeKey: 'Missing' } : route,
      ),
    }),
  },
  {
    name: 'a route without biomes',
    mutate: (document) => ({
      ...document,
      routes: (document.routes as Array<Record<string, unknown>>).map((route, index) =>
        index === 0 ? { routeKey: route.routeKey } : route,
      ),
    }),
  },
  {
    name: 'a noncontiguous biome identity',
    mutate: (document) => ({
      ...document,
      routes: (document.routes as Array<Record<string, unknown>>).map((route, index) =>
        index === 0
          ? {
              ...route,
              biomes: [{ ...(route.biomes as Record<string, unknown>[])[0], biomeKey: 'G' }],
            }
          : route,
      ),
    }),
  },
  {
    name: 'unknown biome state data',
    mutate: (document) => ({
      ...document,
      routes: (document.routes as Array<Record<string, unknown>>).map((route, index) =>
        index === 0
          ? {
              ...route,
              biomes: [
                { ...(route.biomes as Record<string, unknown>[])[0], state: { unknown: true } },
              ],
            }
          : route,
      ),
    }),
  },
  {
    name: 'a missing topology start occurrence',
    mutate: (document) => ({
      ...document,
      ...replaceTopology(document, { startOccurrenceId: 'missing' }),
    }),
  },
  {
    name: 'an unknown topology room declaration',
    mutate: (document) => ({
      ...document,
      ...replaceTopology(document, {
        occurrences: [
          {
            ...(fTopology(document).occurrences as Record<string, unknown>[])[0],
            gameName: 'Missing',
          },
        ],
      }),
    }),
  },
  {
    name: 'a duplicated topology occurrence ID',
    mutate: (document) => {
      const occurrence = (fTopology(document).occurrences as Record<string, unknown>[])[0];
      return {
        ...document,
        ...replaceTopology(document, { occurrences: [occurrence, occurrence] }),
      };
    },
  },
];

describe('project document codec', () => {
  it('round-trips a non-empty Shop purchase order without changing its sequence', () => {
    const occurrenceId = createOccurrenceId('round-trip-n-preboss');
    const authored = applyProjectCommand(createCompleteNProject(), catalog, {
      kind: 'ReplaceShopPurchaseOrder',
      shop: createOccurrenceAddress(nBiome, occurrenceId),
      offerKeys: ['Minor', 'MajorNonBoon'],
    });

    const decoded = decodeProjectDocument(JSON.parse(encodeProjectDocument(authored)), catalog);
    const occurrence = decoded.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N')
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);

    expect(occurrence?.state).toMatchObject({
      kind: 'shop',
      shop: { purchaseOrder: ['Minor', 'MajorNonBoon'] },
    });
    expect(encodeProjectDocument(decoded)).toBe(encodeProjectDocument(authored));
  });

  it.each(codecRejections)('rejects %s', ({ mutate }) => {
    expect(() => decodeProjectDocument(mutate(encodedFStart()), catalog)).toThrow();
  });
});

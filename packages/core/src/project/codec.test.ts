import { describe, expect, it } from 'vitest';

import type { BiomeLayout, Catalog, CatalogCollection, RouteDeclaration } from '../catalog';
import {
  decodeProjectDocument,
  encodeProjectDocument,
  parseProjectDocument,
  ProjectDocumentContractError,
} from './codec';
import { createEmptyProjectDocument, createProjectDocument } from './defaults';
import { PROJECT_DOCUMENT_SCHEMA_VERSION } from './model';

function collection<T extends { readonly key: string }>(
  values: readonly T[],
): CatalogCollection<T> {
  return {
    values,
    byKey: Object.fromEntries(values.map((value) => [value.key, value])),
  };
}

function emptyCollection<T>(): CatalogCollection<T> {
  return { values: [], byKey: {} };
}

const underworld = {
  key: 'Underworld',
  label: 'Underworld',
  biomeKeys: ['F', 'G', 'H', 'I'],
} as const satisfies RouteDeclaration;

const surface = {
  key: 'Surface',
  label: 'Surface',
  biomeKeys: ['N', 'O', 'P', 'Q'],
} as const satisfies RouteDeclaration;

function linearLayout(biomeKey: string, terminalRoom: string): BiomeLayout {
  return {
    biomeKey,
    kind: 'LinearBiome',
    initialCounters: { biomeDepthCache: 1, biomeEncounterDepth: 1 },
    start: {
      kind: 'authoredStart',
      mode: 'fixed',
      roomGameNames: [`${biomeKey}_Start`],
    },
    entries: [],
    continuation: {
      progressionPolicy: { kind: 'eligibilityDriven' },
      batchPolicy: { kind: 'standard', fields: [] },
      rewardStorePolicy: {
        kind: 'authoredBaseStore',
        storeKeys: ['RunProgress'],
        defaultStoreKey: 'RunProgress',
        targetMetaRewardsRatio: 0.315,
        targetMetaRewardsAdjustSpeed: 10,
      },
      rewardStoreOverrides: [],
    },
    terminal: {
      kind: 'forkedTransition',
      roomGameName: terminalRoom,
      exitPolicy: { kind: 'allExitsTerminal' },
    },
    completion: {
      rooms: [{ role: 'boss', roomGameName: `${biomeKey}_Boss` }],
      transitionEffects: [
        { kind: 'resetCounter', axis: 'biomeDepthCache' },
        { kind: 'resetCounter', axis: 'biomeEncounterDepth' },
      ],
    },
    fields: [],
    bounds: { maxBatches: 10, maxTargets: 20 },
  };
}

const layouts = [linearLayout('F', 'F_PreBoss01'), linearLayout('G', 'G_PreBoss01')];

const catalog: Catalog = {
  version: 'fixture-catalog-1',
  biomes: collection(
    [...underworld.biomeKeys, ...surface.biomeKeys].map((key) => ({ key, label: `Biome ${key}` })),
  ),
  routes: collection([underworld, surface]),
  rewards: {
    payloadDomains: emptyCollection(),
    rewardTypes: emptyCollection(),
    acquisitions: emptyCollection(),
    stores: emptyCollection(),
    shops: emptyCollection(),
    producerLifecycles: emptyCollection(),
  },
  encounterProfiles: emptyCollection(),
  roomLifecycleProfiles: emptyCollection(),
  exitCompatibilityPolicies: emptyCollection(),
  exitTypes: emptyCollection(),
  rooms: emptyCollection(),
  biomeLayouts: {
    values: layouts,
    byKey: Object.fromEntries(layouts.map((layout) => [layout.biomeKey, layout])),
  },
};

function rawDocument(routes: readonly unknown[]): unknown {
  return {
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION,
    projectId: 'project-fixture',
    name: 'Fixture Project',
    catalogVersion: catalog.version,
    routes,
  };
}

describe('project document codec', () => {
  it('creates a complete empty project in catalog route order', () => {
    const widerOptions = {
      projectId: 'project-empty',
      name: 'Empty Project',
      configuredBiomeCounts: { Underworld: 2 },
    };
    const project = createEmptyProjectDocument(catalog, widerOptions);

    expect(project).toEqual({
      schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION,
      projectId: 'project-empty',
      name: 'Empty Project',
      catalogVersion: 'fixture-catalog-1',
      routes: [
        { routeKey: 'Underworld', biomes: [] },
        { routeKey: 'Surface', biomes: [] },
      ],
    });
    expect(Object.isFrozen(project)).toBe(true);
    expect(Object.isFrozen(project.routes)).toBe(true);
    expect(Object.isFrozen(project.routes[0]?.biomes)).toBe(true);
  });

  it('creates only the supported contiguous F/G prefix as incomplete biome plans', () => {
    const project = createProjectDocument(catalog, {
      projectId: 'project-fg',
      name: 'F and G',
      configuredBiomeCounts: { Underworld: 2 },
    });

    expect(project.routes[0]).toEqual({
      routeKey: 'Underworld',
      biomes: [
        { kind: 'LinearBiome', biomeKey: 'F', state: {}, topology: null },
        { kind: 'LinearBiome', biomeKey: 'G', state: {}, topology: null },
      ],
    });
    expect(project.routes[1]).toEqual({ routeKey: 'Surface', biomes: [] });
  });

  it('normalizes route order and round trips to deterministic JSON', () => {
    const decoded = decodeProjectDocument(
      rawDocument([
        { routeKey: 'Surface', biomes: [] },
        {
          routeKey: 'Underworld',
          biomes: [{ kind: 'LinearBiome', biomeKey: 'F', state: {}, topology: null }],
        },
      ]),
      catalog,
    );

    expect(decoded.routes.map((route) => route.routeKey)).toEqual(['Underworld', 'Surface']);
    const encoded = encodeProjectDocument(decoded);
    expect(encoded.endsWith('\n')).toBe(true);
    expect(parseProjectDocument(encoded, catalog)).toEqual(decoded);
    expect(encodeProjectDocument(parseProjectDocument(encoded, catalog))).toBe(encoded);
  });

  it('rejects non-contiguous biome plans instead of repairing their order', () => {
    expect(() =>
      decodeProjectDocument(
        rawDocument([
          {
            routeKey: 'Underworld',
            biomes: [{ kind: 'LinearBiome', biomeKey: 'G', state: {}, topology: null }],
          },
          { routeKey: 'Surface', biomes: [] },
        ]),
        catalog,
      ),
    ).toThrowError(
      new ProjectDocumentContractError(
        '$.routes[0].biomes[0].biomeKey',
        'expected contiguous biome F',
      ),
    );
  });

  it('rejects malformed, incompatible, and non-semantic project data at contact', () => {
    expect(() => parseProjectDocument('{', catalog)).toThrowError(
      new ProjectDocumentContractError('$', 'must be valid JSON'),
    );
    expect(() =>
      decodeProjectDocument(
        {
          ...(rawDocument([
            { routeKey: 'Underworld', biomes: [] },
            { routeKey: 'Surface', biomes: [] },
          ]) as Record<string, unknown>),
          schemaVersion: 1,
        },
        catalog,
      ),
    ).toThrowError(new ProjectDocumentContractError('$.schemaVersion', 'expected 4, received 1'));
    expect(() =>
      decodeProjectDocument(
        {
          ...(rawDocument([
            { routeKey: 'Underworld', biomes: [] },
            { routeKey: 'Surface', biomes: [] },
          ]) as Record<string, unknown>),
          schemaVersion: 2,
        },
        catalog,
      ),
    ).toThrowError(new ProjectDocumentContractError('$.schemaVersion', 'expected 4, received 2'));
    expect(() =>
      decodeProjectDocument(
        {
          ...(rawDocument([
            { routeKey: 'Underworld', biomes: [] },
            { routeKey: 'Surface', biomes: [] },
          ]) as Record<string, unknown>),
          schemaVersion: 3,
        },
        catalog,
      ),
    ).toThrowError(new ProjectDocumentContractError('$.schemaVersion', 'expected 4, received 3'));
    expect(() =>
      decodeProjectDocument(
        {
          ...(rawDocument([
            { routeKey: 'Underworld', biomes: [] },
            { routeKey: 'Surface', biomes: [] },
          ]) as Record<string, unknown>),
          catalogVersion: 'old-catalog',
        },
        catalog,
      ),
    ).toThrowError(
      new ProjectDocumentContractError(
        '$.catalogVersion',
        'expected compatible catalog fixture-catalog-1, received old-catalog',
      ),
    );
    expect(() =>
      decodeProjectDocument(
        {
          ...(rawDocument([
            { routeKey: 'Underworld', biomes: [] },
            { routeKey: 'Surface', biomes: [] },
          ]) as Record<string, unknown>),
          activeTab: 'underworld',
        },
        catalog,
      ),
    ).toThrowError(
      new ProjectDocumentContractError('$.activeTab', 'is not a project document field'),
    );
  });

  it('refuses to configure route steps without an authored layout', () => {
    expect(() =>
      createProjectDocument(catalog, {
        projectId: 'project-fgh',
        name: 'Missing H Layout',
        configuredBiomeCounts: { Underworld: 3 },
      }),
    ).toThrowError(
      new ProjectDocumentContractError(
        'configuredBiomeCounts.Underworld',
        'H has no supported linear plan initializer',
      ),
    );
  });
});

import { describe, expect, it } from 'vitest';

import type { BiomeLayout, Catalog, CatalogCollection, RouteDeclaration } from '../catalog';
import {
  decodeProjectDocument,
  encodeProjectDocument,
  parseProjectDocument,
  ProjectDocumentContractError,
} from './codec';
import { createEmptyProjectDocument, createProjectDocument } from './defaults';

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
  biomeSteps: [
    { key: 'Underworld_F', biome: 'F' },
    { key: 'Underworld_G', biome: 'G' },
    { key: 'Underworld_H', biome: 'H' },
    { key: 'Underworld_I', biome: 'I' },
  ],
} as const satisfies RouteDeclaration;

const surface = {
  key: 'Surface',
  label: 'Surface',
  biomeSteps: [
    { key: 'Surface_N', biome: 'N' },
    { key: 'Surface_O', biome: 'O' },
    { key: 'Surface_P', biome: 'P' },
    { key: 'Surface_Q', biome: 'Q' },
  ],
} as const satisfies RouteDeclaration;

function linearLayout(biomeStepKey: string, terminalRoom: string): BiomeLayout {
  return {
    biomeStepKey,
    kind: 'LinearBiome',
    start: { mode: 'fixed', roomGameNames: [`${biomeStepKey}_Start`] },
    continuation: { defaultBatchRuleKey: 'Standard' },
    terminal: {
      roomGameName: terminalRoom,
      transitionRuleKey: 'PrebossEntry',
      exitPolicy: { kind: 'allExitsTerminal' },
    },
    bounds: { maxBatches: 10, maxTargets: 20 },
  };
}

const layouts = [
  linearLayout('Underworld_F', 'F_PreBoss01'),
  linearLayout('Underworld_G', 'G_PreBoss01'),
];

const catalog: Catalog = {
  version: 'fixture-catalog-1',
  routes: collection([underworld, surface]),
  rewardPayloadDomains: emptyCollection(),
  rewardPrimitives: emptyCollection(),
  rewardStores: emptyCollection(),
  shopOptionSets: emptyCollection(),
  shopProfiles: emptyCollection(),
  encounterProfiles: emptyCollection(),
  rooms: emptyCollection(),
  biomeLayouts: {
    values: layouts,
    byKey: Object.fromEntries(layouts.map((layout) => [layout.biomeStepKey, layout])),
  },
};

function rawDocument(routes: readonly unknown[]): unknown {
  return {
    schemaVersion: 1,
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
      schemaVersion: 1,
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
        { kind: 'LinearBiome', biomeStepKey: 'Underworld_F', topology: null },
        { kind: 'LinearBiome', biomeStepKey: 'Underworld_G', topology: null },
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
          biomes: [{ kind: 'LinearBiome', biomeStepKey: 'Underworld_F', topology: null }],
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
            biomes: [{ kind: 'LinearBiome', biomeStepKey: 'Underworld_G', topology: null }],
          },
          { routeKey: 'Surface', biomes: [] },
        ]),
        catalog,
      ),
    ).toThrowError(
      new ProjectDocumentContractError(
        '$.routes[0].biomes[0].biomeStepKey',
        'expected contiguous step Underworld_F',
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
          schemaVersion: 2,
        },
        catalog,
      ),
    ).toThrowError(new ProjectDocumentContractError('$.schemaVersion', 'expected 1, received 2'));
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
        '$.routes[0].biomes[2]',
        'catalog has no authored layout for Underworld_H',
      ),
    );
  });
});

import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  createProjectDocument,
  encodeProjectDocument,
  parseProjectDocument,
} from '@run-planner/engine/authored-project';
import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';
import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
} from '@run-planner/test-fixtures/underworld';

import {
  applyProjectDocumentTransitions,
  loadProjectDocument,
} from '@planner/persistence/projectDocumentLoader';

const project = createProjectDocument(catalog, {
  configuredBiomeCount: 1,
  projectId: 'project-loader-current',
  routeKey: 'Underworld',
});

describe('project document loader', () => {
  it('loads a current schema-87 document through the strict parser without migration provenance', () => {
    const json = encodeProjectDocument(project);

    expect(loadProjectDocument(json, catalog)).toEqual({
      migrationProvenance: [],
      project,
    });
  });

  it('migrates schema-86 generated weights before strict decoding', () => {
    const occurrenceId = goldenFOccurrenceId(5, 1);
    const value = {
      kind: 'generated',
      waveCount: 1,
      highlightKey: 'Brawler',
      waves: [{ waveIndex: 1, typeKeys: ['Brawler', 'SiegeVine'] }],
    } as const;
    const expected = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase: createEncounterPhaseAddress(
        goldenFBiome,
        { kind: 'occurrence', occurrenceId },
        'Encounter',
      ),
      decisionKey: 'generatedComposition',
      value,
    });
    const legacy = {
      ...expected,
      schemaVersion: 86,
      route: {
        ...expected.route,
        biomes: expected.route.biomes.map((biome) => ({
          ...biome,
          topology:
            biome.topology === null
              ? null
              : {
                  ...biome.topology,
                  occurrences: biome.topology.occurrences.map((occurrence) =>
                    occurrence.occurrenceId !== occurrenceId
                      ? occurrence
                      : {
                          ...occurrence,
                          encounters: {
                            ...occurrence.encounters,
                            customizationByPhase: {
                              Encounter: {
                                generatedComposition: {
                                  ...value,
                                  waves: [
                                    { ...value.waves[0], weights: { Brawler: 10, SiegeVine: 1 } },
                                  ],
                                },
                              },
                            },
                          },
                        },
                  ),
                },
        })),
      },
    };
    expect(() =>
      parseProjectDocument(JSON.stringify({ ...legacy, schemaVersion: 87 }), catalog),
    ).toThrow(/weights/);
    const loaded = loadProjectDocument(JSON.stringify(legacy), catalog);

    expect(loaded).toMatchObject({
      migrationProvenance: [
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 86,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 87,
        },
      ],
      project: expected,
    });
  });

  it.each([
    ['malformed JSON', '{not json', /\$: must be valid JSON/],
    [
      'unsupported old schema',
      JSON.stringify({ ...project, schemaVersion: 85 }),
      /older than the supported schema floor 86/,
    ],
    [
      'future schema',
      JSON.stringify({ ...project, schemaVersion: 88 }),
      /newer than supported schema 87/,
    ],
    [
      'mismatched current catalog',
      JSON.stringify({ ...project, catalogVersion: 'stale-catalog' }),
      /expected compatible catalog/,
    ],
  ])('rejects %s without accepting it', (_description, json, message) => {
    expect(() => loadProjectDocument(json, catalog)).toThrow(message);
  });

  it('walks explicit test transitions in order and strictly decodes their final document', () => {
    const oldIdentity = { catalogVersion: 'catalog-85', schemaVersion: 85 } as const;
    const intermediateIdentity = {
      catalogVersion: 'catalog-85-normalized',
      schemaVersion: 85,
    } as const;
    const currentIdentity = { catalogVersion: catalog.version, schemaVersion: 87 } as const;
    const oldDocument = { ...project, ...oldIdentity };

    const migrated = applyProjectDocumentTransitions({
      document: oldDocument,
      source: oldIdentity,
      target: currentIdentity,
      transitions: [
        {
          migrate: (document) => ({
            ...(document as Record<string, unknown>),
            catalogVersion: intermediateIdentity.catalogVersion,
          }),
          source: oldIdentity,
          target: intermediateIdentity,
        },
        {
          migrate: (document) => ({
            ...(document as Record<string, unknown>),
            catalogVersion: currentIdentity.catalogVersion,
            schemaVersion: currentIdentity.schemaVersion,
          }),
          source: intermediateIdentity,
          target: currentIdentity,
        },
      ],
    });

    expect(migrated.migrationProvenance).toEqual([
      {
        sourceCatalogVersion: 'catalog-85',
        sourceSchemaVersion: 85,
        targetCatalogVersion: 'catalog-85-normalized',
        targetSchemaVersion: 85,
      },
      {
        sourceCatalogVersion: 'catalog-85-normalized',
        sourceSchemaVersion: 85,
        targetCatalogVersion: catalog.version,
        targetSchemaVersion: 87,
      },
    ]);
    expect(parseProjectDocument(JSON.stringify(migrated.document), catalog)).toEqual(project);
  });

  it('rejects a transition that does not reach its declared target identity', () => {
    const oldIdentity = { catalogVersion: 'catalog-85', schemaVersion: 85 } as const;
    const currentIdentity = { catalogVersion: catalog.version, schemaVersion: 87 } as const;

    expect(() =>
      applyProjectDocumentTransitions({
        document: { ...project, ...oldIdentity },
        source: oldIdentity,
        target: currentIdentity,
        transitions: [
          {
            migrate: (document) => ({
              ...(document as Record<string, unknown>),
              schemaVersion: 84,
            }),
            source: oldIdentity,
            target: currentIdentity,
          },
        ],
      }),
    ).toThrow(/did not produce its declared target identity/);
  });
});

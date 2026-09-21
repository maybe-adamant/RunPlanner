import {
  createProjectDocument,
  encodeProjectDocument,
  parseProjectDocument,
} from '@run-planner/engine/authored-project';
import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';

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
  it('loads a current schema-86 document through the strict parser without migration provenance', () => {
    const json = encodeProjectDocument(project);

    expect(loadProjectDocument(json, catalog)).toEqual({
      migrationProvenance: [],
      project,
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
      JSON.stringify({ ...project, schemaVersion: 87 }),
      /newer than supported schema 86/,
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
    const currentIdentity = { catalogVersion: catalog.version, schemaVersion: 86 } as const;
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
        targetSchemaVersion: 86,
      },
    ]);
    expect(parseProjectDocument(JSON.stringify(migrated.document), catalog)).toEqual(project);
  });

  it('rejects a transition that does not reach its declared target identity', () => {
    const oldIdentity = { catalogVersion: 'catalog-85', schemaVersion: 85 } as const;
    const currentIdentity = { catalogVersion: catalog.version, schemaVersion: 86 } as const;

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

import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  createHubDecisionAddress,
  createProjectDocument,
  encodeProjectDocument,
  parseProjectDocument,
} from '@run-planner/engine/authored-project';
import { catalog } from '@run-planner/hades2-catalog';
import { simulateProject } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';
import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import { hubVisitActions } from '@run-planner/test-fixtures/shared';
import { loadSurfaceNProject, nBiome, nVisitSlotKeys } from '@run-planner/test-fixtures/surface';

import {
  applyProjectDocumentTransitions,
  loadProjectDocument,
} from '@planner/persistence/projectDocumentLoader';
import schema90ShrinePurchases from './fixtures/shrine-purchases.schema-90.runplanner.json';

const project = createProjectDocument(catalog, {
  configuredBiomeCount: 1,
  projectId: 'project-loader-current',
  routeKey: 'Underworld',
});

describe('project document loader', () => {
  it('loads a current schema-91 document through the strict parser without migration provenance', () => {
    const json = encodeProjectDocument(project);

    expect(loadProjectDocument(json, catalog)).toEqual({
      migrationProvenance: [],
      project,
    });
  });

  it('migrates a schema-87 Hub to fountain use before its retained visits', () => {
    const current = loadSurfaceNProject();
    const legacy = JSON.parse(encodeProjectDocument(current)) as {
      schemaVersion: number;
      route: { biomes: { topology: { decisions: Record<string, unknown>[] } | null }[] };
    };
    legacy.schemaVersion = 87;
    for (const biome of legacy.route.biomes)
      for (const decision of biome.topology?.decisions ?? []) {
        if (decision.kind !== 'hub') continue;
        decision.visitOrder = [...nVisitSlotKeys];
        delete decision.actions;
      }
    expect(() =>
      parseProjectDocument(JSON.stringify({ ...legacy, schemaVersion: 91 }), catalog),
    ).toThrow(/visitOrder/);

    const loaded = loadProjectDocument(JSON.stringify(legacy), catalog);
    expect(loaded.migrationProvenance).toHaveLength(4);
    expect(loaded.project).toEqual(
      applyProjectCommand(current, catalog, {
        kind: 'ReplaceHubActionOrder',
        hub: createHubDecisionAddress(nBiome, 'hub'),
        actions: hubVisitActions(nVisitSlotKeys, 0),
      }),
    );
  });

  it('chains a schema-87 document without a Hub through 88, 89 and 90 to 91 by version only', () => {
    const legacy = JSON.parse(encodeProjectDocument(project)) as Record<string, unknown>;
    legacy.schemaVersion = 87;

    expect(loadProjectDocument(JSON.stringify(legacy), catalog)).toEqual({
      migrationProvenance: [
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 87,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 88,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 88,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 89,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 89,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 90,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 90,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 91,
        },
      ],
      project,
    });
  });

  it('gives a schema-88 document with the shared default identity a unique one', () => {
    const legacy = JSON.parse(encodeProjectDocument(project)) as Record<string, unknown>;
    legacy.schemaVersion = 88;
    legacy.projectId = 'run-plan';
    const first = loadProjectDocument(JSON.stringify(legacy), catalog);
    const second = loadProjectDocument(JSON.stringify(legacy), catalog).project;
    expect(first.migrationProvenance.map((step) => step.sourceSchemaVersion)).toEqual([88, 89, 90]);
    expect(first.project.projectId).toMatch(/^run-plan-[0-9a-f-]{36}$/);
    expect(second.projectId).not.toBe(first.project.projectId);
    expect({ ...first.project, projectId: project.projectId }).toEqual(project);

    const olderLegacy = { ...legacy, schemaVersion: 87 };
    expect(loadProjectDocument(JSON.stringify(olderLegacy), catalog).project.projectId).toMatch(
      /^run-plan-[0-9a-f-]{36}$/,
    );

    // Schema 89 identities are already unique; they keep the shared-looking one as written.
    const unique = { ...legacy, schemaVersion: 89 };
    expect(loadProjectDocument(JSON.stringify(unique), catalog).project).toEqual({
      ...project,
      projectId: 'run-plan',
    });
  });

  it.each([
    ['Underworld', () => createGoldenFGHIProject()],
    ['Surface', () => loadSurfaceNProject()],
  ])(
    'migrates a mature schema-89 %s document to schema 91 without reinterpreting it',
    (_route, current) => {
      const expected = current();
      const legacy = { ...JSON.parse(encodeProjectDocument(expected)), schemaVersion: 89 };
      const loaded = loadProjectDocument(JSON.stringify(legacy), catalog);
      expect(loaded.migrationProvenance).toEqual([
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 89,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 90,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 90,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 91,
        },
      ]);
      expect(loaded.project).toEqual(expected);
      expect(encodeProjectDocument(loaded.project)).toBe(
        JSON.stringify({ ...legacy, schemaVersion: 91 }, null, 2) + '\n',
      );
    },
  );

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
      parseProjectDocument(JSON.stringify({ ...legacy, schemaVersion: 91 }), catalog),
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
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 87,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 88,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 88,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 89,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 89,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 90,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 90,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 91,
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
      JSON.stringify({ ...project, schemaVersion: 92 }),
      /newer than supported schema 91/,
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
    const currentIdentity = { catalogVersion: catalog.version, schemaVersion: 91 } as const;
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
        targetSchemaVersion: 91,
      },
    ]);
    expect(parseProjectDocument(JSON.stringify(migrated.document), catalog)).toEqual(project);
  });

  it('rejects a transition that does not reach its declared target identity', () => {
    const oldIdentity = { catalogVersion: 'catalog-85', schemaVersion: 85 } as const;
    const currentIdentity = { catalogVersion: catalog.version, schemaVersion: 91 } as const;

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

  it('migrates schema-90 Shrine rush onto purchase actions and evaluates identically', () => {
    const shrine = 'surface-n-preboss:postboss';
    const source = {
      kind: 'occurrence',
      routeKey: 'Surface',
      biomeKey: 'N',
      occurrenceId: shrine,
    } as const;
    const entryKey = (generationKey: string) =>
      `hermesShrineDelivery:${encodeURIComponent(
        JSON.stringify(['Surface', 'N', shrine, generationKey]),
      )}`;
    const loaded = loadProjectDocument(JSON.stringify(schema90ShrinePurchases), catalog);
    expect(loaded.migrationProvenance.map((step) => step.targetSchemaVersion)).toEqual([91]);
    const occurrence = loaded.project.route.biomes
      .find((biome) => biome.biomeKey === 'N')
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === shrine);
    expect(occurrence?.hermesShrine?.purchaseBySlot).toEqual({
      first: { delay: 2 },
      secondRight: { delay: 5 },
    });
    expect(occurrence?.hermesShrine?.travelDealRefill?.purchase).toEqual({ delay: 2 });
    expect(occurrence?.roomActions.order).toEqual([
      { kind: 'useFountain' },
      { kind: 'purchaseHermesShrineOffer', generationKey: 'initial:first', rushed: true },
      { kind: 'purchaseHermesShrineOffer', generationKey: 'initial:secondRight', rushed: true },
      { kind: 'purchaseHermesShrineOffer', generationKey: 'travelDealRefill', rushed: false },
      {
        kind: 'interactAcquisitionEntry',
        siteKey: 'hermesShrineDelivery',
        entryKey: entryKey('initial:first'),
      },
      {
        kind: 'interactAcquisitionEntry',
        siteKey: 'hermesShrineDelivery',
        entryKey: entryKey('initial:secondRight'),
      },
    ]);

    // Recorded from the schema-90 engine evaluating the unmigrated fixture.
    const evaluation = simulateProject(catalog, loaded.project);
    expect(evaluation.status).toBe('valid');
    expect(evaluation.findings).toEqual([]);
    const [n, o] = evaluation.route.biomes.map((biome) =>
      'rewards' in biome ? biome.rewards : undefined,
    );
    expect(n?.hermesShrineDeliveries).toEqual([
      {
        entryKey: entryKey('travelDealRefill'),
        source,
        generationKey: 'travelDealRefill',
        rewardType: 'ArmorBoost',
        rushed: false,
        remainingUses: 2,
        deliveryKind: 'pending',
      },
    ]);
    expect(o?.hermesShrineDeliveries).toEqual([]);
    expect(
      n?.hermesShrineAssessments
        .find((entry) => entry.origin.occurrenceId === shrine)
        ?.assessments.map((assessment) => assessment.travelDealRefill?.sourceGenerationKey),
    ).toEqual(['initial:first']);
  });
});

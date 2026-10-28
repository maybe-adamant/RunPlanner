import {
  applyProjectCommand,
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createAcquisitionSiteAddress,
  createEncounterPhaseAddress,
  createHubDecisionAddress,
  createOccurrenceAddress,
  createProjectDocument,
  createRouteAddress,
  DEFAULT_PROJECT_NAME,
  encodeProjectDocument,
  parseProjectDocument,
  PROJECT_DOCUMENT_SCHEMA_REVISION,
} from '@run-planner/engine/authored-project';
import { catalog } from '@run-planner/hades2-catalog';
import { simulateProject } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';
import {
  createGoldenFGHIProject,
  echoGoldIPrebossShopId,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenIBiome,
} from '@run-planner/test-fixtures/underworld';
import { hubVisitActions, legacyRareEpicHexTrees } from '@run-planner/test-fixtures/shared';
import { loadSurfaceNProject, nBiome, nVisitSlotKeys } from '@run-planner/test-fixtures/surface';
import { surfaceCheckpointArtifacts } from '@run-planner/test-fixtures/checkpoints/surface';

import {
  applyProjectDocumentTransitions,
  loadProjectDocument,
} from '@planner/persistence/projectDocumentLoader';
import schema90ShrinePurchases from './fixtures/shrine-purchases.schema-90.runplanner.json';
import schema91AnvilResults from './fixtures/anvil-results.schema-91.runplanner.json';

/** Checkpoints keep the revision they were written under; a loaded project encodes the current one. */
/** The checkpoint as the current revision saves it: a zero revision is omitted. */
function currentRevisionText(checkpoint: unknown): string {
  const { schemaVersion, schemaRevision, ...rest } = checkpoint as Record<string, unknown>;
  void schemaRevision;
  return (
    JSON.stringify(
      {
        schemaVersion,
        ...(PROJECT_DOCUMENT_SCHEMA_REVISION === 0
          ? {}
          : { schemaRevision: PROJECT_DOCUMENT_SCHEMA_REVISION }),
        ...rest,
      },
      null,
      2,
    ) + '\n'
  );
}

const project = createProjectDocument(catalog, {
  configuredBiomeCount: 1,
  projectId: 'project-loader-current',
  routeKey: 'Underworld',
});

describe('project document loader', () => {
  it('loads a current schema-100 document through the strict parser without migration provenance', () => {
    const json = encodeProjectDocument(project);

    expect(loadProjectDocument(json, catalog)).toEqual({
      migrationProvenance: [],
      project,
    });
  });

  it('loads an earlier or current revision of the current major as is', () => {
    for (let revision = 0; revision <= PROJECT_DOCUMENT_SCHEMA_REVISION; revision += 1) {
      const json = JSON.stringify({ ...project, schemaRevision: revision });
      expect(loadProjectDocument(json, catalog)).toEqual({ migrationProvenance: [], project });
    }
  });

  it('runs transitions across majors without carrying an older major revision forward', () => {
    const legacy = JSON.parse(encodeProjectDocument(project)) as Record<string, unknown>;
    legacy.schemaVersion = 96;
    legacy.schemaRevision = PROJECT_DOCUMENT_SCHEMA_REVISION + 3;

    const loaded = loadProjectDocument(JSON.stringify(legacy), catalog);
    expect(loaded.migrationProvenance).toHaveLength(4);
    expect(loaded.project).toEqual(project);
  });

  it('migrates a schema-87 Hub to fountain use before its retained visits', () => {
    const current = loadSurfaceNProject();
    const legacy = legacyRareEpicHexTrees(JSON.parse(encodeProjectDocument(current))) as {
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
      parseProjectDocument(JSON.stringify({ ...legacy, schemaVersion: 100 }), catalog),
    ).toThrow(/visitOrder/);

    const loaded = loadProjectDocument(JSON.stringify(legacy), catalog);
    expect(loaded.migrationProvenance).toHaveLength(13);
    expect(loaded.project).toEqual(
      applyProjectCommand(current, catalog, {
        kind: 'ReplaceHubActionOrder',
        hub: createHubDecisionAddress(nBiome, 'hub'),
        actions: hubVisitActions(nVisitSlotKeys, 0),
      }),
    );
  });

  it('chains a schema-87 document without a Hub through 88 to 100', () => {
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
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 91,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 92,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 92,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 93,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 93,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 94,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 94,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 95,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 95,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 96,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 96,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 97,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 97,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 98,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 98,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 99,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 99,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 100,
        },
      ],
      project,
    });
  });

  it('loads a schema-92 checkpoint into schema 93 equipping only the default familiar', () => {
    const checkpoint = surfaceCheckpointArtifacts['surface-nop'].raw as {
      route: { loadout: Record<string, unknown> };
    };
    const current = currentRevisionText(checkpoint);
    const { familiarKey, ...loadout } = checkpoint.route.loadout;
    expect(familiarKey).toBe(catalog.defaultFamiliarKey);
    const legacy = JSON.stringify(
      legacyRareEpicHexTrees({
        ...checkpoint,
        schemaVersion: 92,
        route: { ...checkpoint.route, loadout },
      }),
      null,
      2,
    );
    expect(legacy).toContain('"traitKey": "HiddenMaxHealthBoon"');
    const loaded = loadProjectDocument(legacy, catalog);

    expect(loaded.migrationProvenance.map((step) => step.targetSchemaVersion)).toEqual([
      93, 94, 95, 96, 97, 98, 99, 100,
    ]);
    expect(encodeProjectDocument(loaded.project)).toBe(current);
  });

  it('loads a schema-93 Rare/Epic Hex tree as a complete tree with the picks in layout order', () => {
    const checkpoint = surfaceCheckpointArtifacts['surface-ordinary-hex-path'].raw;
    const current = currentRevisionText(checkpoint);
    const unresolved = JSON.parse(current, (key, value: unknown) =>
      key === 'hexActivationsByAcquisitionRole' ? undefined : value,
    ) as object;
    const legacy = JSON.stringify(legacyRareEpicHexTrees({ ...unresolved, schemaVersion: 93 }));
    expect(legacy).toContain(
      '"hexTree":{"layoutKey":"Lung","rareTalentKeys":["DamageBuffTalent","ShieldTalent"],"epicTalentKeys":["ClearCastTalent"]}',
    );
    const loaded = loadProjectDocument(legacy, catalog);

    expect(loaded.migrationProvenance.map((step) => step.targetSchemaVersion)).toEqual([
      94, 95, 96, 97, 98, 99, 100,
    ]);
    expect(encodeProjectDocument(loaded.project)).toBe(JSON.stringify(unresolved, null, 2) + '\n');
  });

  it('loads schema-94 Path screens unresolved, leaving each reached screen to its author', () => {
    const checkpoint = surfaceCheckpointArtifacts['surface-selene-hex-path'].raw;
    const current = currentRevisionText(checkpoint);
    expect(current.match(/hexActivationsByAcquisitionRole/g)).toHaveLength(2);
    const legacy = JSON.parse(current, (key, value: unknown) =>
      key === 'hexActivationsByAcquisitionRole' ? undefined : value,
    ) as Record<string, unknown>;
    legacy.schemaVersion = 94;
    const loaded = loadProjectDocument(JSON.stringify(legacy), catalog);

    expect(loaded.migrationProvenance.map((step) => step.targetSchemaVersion)).toEqual([
      95, 96, 97, 98, 99, 100,
    ]);
    expect(encodeProjectDocument(loaded.project)).toBe(
      JSON.stringify({ ...legacy, schemaVersion: 100 }, null, 2) + '\n',
    );
  });

  it('loads a schema-95 incomplete Hub with its completed-Hub chain added', () => {
    const checkpoint = surfaceCheckpointArtifacts['surface-n-partial-hub'];
    const legacy = JSON.parse(JSON.stringify(checkpoint.raw)) as {
      schemaVersion: number;
      route: {
        biomes: {
          topology: {
            occurrences: { gameName: string }[];
            decisions: { kind: string; source?: { kind: string } }[];
            fixedRoomLinks: unknown[];
          } | null;
        }[];
      };
    };
    legacy.schemaVersion = 95;
    const topology = legacy.route.biomes[0]!.topology!;
    topology.decisions = topology.decisions.filter(
      (decision) => decision.source?.kind !== 'hubDecision',
    );
    topology.occurrences = topology.occurrences.filter(
      (occurrence) => !['N_PreBoss01', 'N_Boss01', 'N_PostBoss01'].includes(occurrence.gameName),
    );
    topology.fixedRoomLinks = [];
    const loaded = loadProjectDocument(JSON.stringify(legacy), catalog);

    expect(loaded.migrationProvenance.map((step) => step.targetSchemaVersion)).toEqual([
      96, 97, 98, 99, 100,
    ]);
    expect(loaded.project).toEqual(checkpoint.load());
  });

  it('loads a schema-96 document with an unchanged rack, an empty draft and its Practice start', () => {
    const current = applyProjectCommand(loadSurfaceNProject(), catalog, {
      kind: 'ReplacePracticeStart',
      route: createRouteAddress('Surface'),
      startPoint: { biomeKey: 'O', point: 'opening', gold: 50 },
    });
    type Raw = {
      schemaVersion: number;
      route: {
        draft?: unknown;
        practiceStart?: unknown;
        loadout: Record<string, unknown>;
        biomes: {
          topology: {
            occurrences: { keepsakeRack?: unknown; roomActions: { order: { kind: string }[] } }[];
          } | null;
        }[];
      };
    };
    const legacy = JSON.parse(encodeProjectDocument(current)) as Raw;
    legacy.schemaVersion = 96;
    legacy.route.loadout.runModifiers = { startPoint: legacy.route.practiceStart };
    delete legacy.route.practiceStart;
    delete legacy.route.draft;
    let racks = 0;
    for (const biome of legacy.route.biomes)
      for (const occurrence of biome.topology?.occurrences ?? []) {
        if (occurrence.keepsakeRack === undefined) continue;
        racks += 1;
        delete occurrence.keepsakeRack;
        occurrence.roomActions.order = occurrence.roomActions.order.filter(
          (reference) => reference.kind !== 'interactKeepsakeRack',
        );
      }
    expect(racks).toBeGreaterThan(0);
    const loaded = loadProjectDocument(JSON.stringify(legacy), catalog);
    expect(loaded.migrationProvenance.map((step) => step.targetSchemaVersion)).toEqual([
      97, 98, 99, 100,
    ]);
    expect(loaded.project).toEqual(current);
  });

  it('heals a malformed or null schema-96 start point to a full run on load', () => {
    for (const startPoint of [null, { biomeKey: 'G', point: 'hub' }, 'G']) {
      const legacy = JSON.parse(encodeProjectDocument(project)) as {
        schemaVersion: number;
        route: { draft?: unknown; loadout: Record<string, unknown> };
      };
      legacy.schemaVersion = 96;
      delete legacy.route.draft;
      legacy.route.loadout.runModifiers = { startPoint, enemyGoldDropChance: 40 };
      const loaded = loadProjectDocument(JSON.stringify(legacy), catalog).project;
      expect(loaded.route).not.toHaveProperty('practiceStart');
      expect(loaded.route.loadout.runModifiers).toEqual({ enemyGoldDropChance: 40 });
    }
  });

  it('names a schema-97 document after its file, or the default without one', () => {
    const named = createProjectDocument(catalog, {
      projectId: project.projectId,
      name: 'Staff practice',
      routeKey: 'Underworld',
      configuredBiomeCount: 1,
    });
    const { name: _name, ...rest } = JSON.parse(encodeProjectDocument(named)) as Record<
      string,
      unknown
    >;
    void _name;
    const legacy = JSON.stringify({ ...rest, schemaVersion: 97, schemaRevision: 3 });
    const loaded = loadProjectDocument(legacy, catalog, { legacyName: 'Staff practice' });
    expect(loaded.migrationProvenance.map((step) => step.targetSchemaVersion)).toEqual([
      98, 99, 100,
    ]);
    expect(loaded.project).toEqual(named);
    expect(loadProjectDocument(legacy, catalog).project.name).toBe(DEFAULT_PROJECT_NAME);
    // A current document keeps its own name.
    expect(
      loadProjectDocument(encodeProjectDocument(named), catalog, { legacyName: 'Other' }).project
        .name,
    ).toBe('Staff practice');
  });

  it('gives a schema-88 document with the shared default identity a unique one', () => {
    const legacy = JSON.parse(encodeProjectDocument(project)) as Record<string, unknown>;
    legacy.schemaVersion = 88;
    legacy.projectId = 'run-plan';
    const first = loadProjectDocument(JSON.stringify(legacy), catalog);
    const second = loadProjectDocument(JSON.stringify(legacy), catalog).project;
    expect(first.migrationProvenance.map((step) => step.sourceSchemaVersion)).toEqual([
      88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99,
    ]);
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
    'migrates a mature schema-89 %s document to schema 100 without reinterpreting it',
    (_route, current) => {
      const expected = current();
      const legacy = legacyRareEpicHexTrees({
        ...JSON.parse(encodeProjectDocument(expected)),
        schemaVersion: 89,
      });
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
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 91,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 92,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 92,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 93,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 93,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 94,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 94,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 95,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 95,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 96,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 96,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 97,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 97,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 98,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 98,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 99,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 99,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 100,
        },
      ]);
      expect(loaded.project).toEqual(expected);
      expect(encodeProjectDocument(loaded.project)).toBe(encodeProjectDocument(expected));
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
    const legacy = legacyRareEpicHexTrees({
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
    }) as Record<string, unknown>;
    expect(() =>
      parseProjectDocument(JSON.stringify({ ...legacy, schemaVersion: 100 }), catalog),
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
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 91,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 92,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 92,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 93,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 93,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 94,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 94,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 95,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 95,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 96,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 96,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 97,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 97,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 98,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 98,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 99,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 99,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 100,
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
      JSON.stringify({ ...project, schemaVersion: 101 }),
      /newer than supported schema 100/,
    ],
    [
      'future revision of the current major',
      JSON.stringify({ ...project, schemaRevision: PROJECT_DOCUMENT_SCHEMA_REVISION + 1 }),
      /newer than supported schema 100\.\d+/,
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
    const currentIdentity = { catalogVersion: catalog.version, schemaVersion: 100 } as const;
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
        targetSchemaVersion: 100,
      },
    ]);
    expect(parseProjectDocument(JSON.stringify(migrated.document), catalog)).toEqual(project);
  });

  it('rejects a transition that does not reach its declared target identity', () => {
    const oldIdentity = { catalogVersion: 'catalog-85', schemaVersion: 85 } as const;
    const currentIdentity = { catalogVersion: catalog.version, schemaVersion: 100 } as const;

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
    expect(loaded.migrationProvenance.map((step) => step.targetSchemaVersion)).toEqual([
      91, 92, 93, 94, 95, 96, 97, 98, 99, 100,
    ]);
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
      { kind: 'interactKeepsakeRack' },
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

  it('migrates schema-91 Anvil results onto their reward roles and evaluates identically', () => {
    const loaded = loadProjectDocument(JSON.stringify(schema91AnvilResults), catalog);
    expect(loaded.migrationProvenance.map((step) => step.targetSchemaVersion)).toEqual([
      92, 93, 94, 95, 96, 97, 98, 99, 100,
    ]);
    const shop = loaded.project.route.biomes
      .find((biome) => biome.biomeKey === 'I')
      ?.topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === echoGoldIPrebossShopId,
      );
    const offer = shop?.state.kind === 'shop' ? shop.state.shop?.offers.PremiumProgress : undefined;
    expect(offer).toEqual({
      optionKey: 'ChaosWeaponUpgrade',
      reward: expect.objectContaining({
        anvilResultsByAcquisitionRole: {
          self: {
            kind: 'anvilOfFates',
            removedTraitKey: 'StaffDoubleAttackTrait',
            addedTraitKeys: ['StaffDashAttackTrait', 'StaffTripleShotTrait'],
          },
        },
      }),
    });
    expect(
      shop?.acquisitionSites?.roomExit?.pickupEntries?.echoDoubleShopReward
        ?.anvilResultsByAcquisitionRole,
    ).toEqual({ self: null });

    // Recorded from the schema-91 engine evaluating the unmigrated fixture.
    const duplicate = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(
        createOccurrenceAddress(goldenIBiome, echoGoldIPrebossShopId),
        'roomExit',
      ),
      'echoDoubleShopReward',
    );
    const evaluation = simulateProject(catalog, loaded.project);
    expect(evaluation.status).toBe('incomplete');
    expect(evaluation.findings).toEqual([
      expect.objectContaining({
        code: 'rewardMissing',
        origin: createAcquisitionRoleAddress(duplicate, 'self'),
        evidence: { acquisitionRole: 'self', pickupEffect: 'anvilOfFates' },
      }),
      expect.objectContaining({
        code: 'rewardAcquisitionUnavailable',
        origin: duplicate,
        evidence: { rewardType: 'ChaosWeaponUpgrade', role: 'self', lifecyclePoint: 'purchase' },
      }),
    ]);
  });
});

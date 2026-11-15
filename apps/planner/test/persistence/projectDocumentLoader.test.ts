import {
  applyProjectCommand,
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createAcquisitionSiteAddress,
  createEncounterPhaseAddress,
  createHubDecisionAddress,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createRouteAddress,
  DEFAULT_PROJECT_NAME,
  heraclesBountySiteKey,
  encodeProjectDocument,
  parseProjectDocument,
  PROJECT_DOCUMENT_SCHEMA_REVISION,
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  type ProjectCommand,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { fillNemesisBetOutcomeWins } from '@run-planner/engine/project-migration';
import { migrateProjectDocumentJudgedBy as migrate100To101JudgedBy } from '@planner/persistence/project-100-to-101.js';
import { migrateProjectDocument as migrate101To102 } from '@planner/persistence/project-101-to-102.js';
import { liftProjectDocument as migrate102To103 } from '@planner/persistence/project-102-to-103.js';
import { catalog } from '@run-planner/hades2-catalog';
import { simulateProject } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';
import {
  loadUnderworldFPoolCheckpoint,
  loadUnderworldZagreusContractCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  createGoldenFGHIProject,
  echoGoldIPrebossShopId,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenIBiome,
} from '@run-planner/test-fixtures/underworld';
import {
  hubVisitActions,
  legacyRareEpicHexTrees,
  legacySchema99Body,
  legacySchema100Body,
  legacySchema101Body,
  withItemContents,
} from '@run-planner/test-fixtures/shared';
import {
  loadSurfaceNOPQProject,
  loadSurfaceNProject,
  nBiome,
  nOccurrenceId,
  nVisitSlotKeys,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
  withFourthBoardGodBeforeCombat05,
} from '@run-planner/test-fixtures/surface';
import { surfaceCheckpointArtifacts } from '@run-planner/test-fixtures/checkpoints/surface';
import {
  createFreshFileFProject,
  freshFileFPostbossId,
  withRetainedFreshFilePostboss,
} from '@run-planner/test-fixtures/fresh-file';

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

/**
 * The plan without its stored positions, as a legacy save lacks them: its
 * migration stores only those of the rooms its walk reaches.
 */
function withoutPositions(document: unknown): unknown {
  return JSON.parse(JSON.stringify(document), (key, value: unknown) =>
    key === 'layout' || key === 'anchorId' || key === 'spawnPointIndex' ? undefined : value,
  );
}

/** The plan as opening it saved at schema 102 leaves it: settled once by its migration. */
const openedAt102 = (document: ProjectDocument) =>
  loadProjectDocument(
    JSON.stringify({
      ...JSON.parse(encodeProjectDocument(document)),
      schemaVersion: 102,
      schemaRevision: 1,
    }),
    catalog,
  ).project;

const project = createProjectDocument(catalog, {
  configuredBiomeCount: 1,
  projectId: 'project-loader-current',
  routeKey: 'Underworld',
});

describe('project document loader', () => {
  it('loads a current schema-103 document through the strict parser without migration provenance', () => {
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

  it('stocks the blank Well and Pool a schema 103.0 plan reaches, once, at load', () => {
    const saved = JSON.parse(
      encodeProjectDocument(loadUnderworldFPoolCheckpoint()),
    ) as ProjectDocument;
    const gPostboss = (document: ProjectDocument) =>
      document.route.biomes
        .find((biome) => biome.biomeKey === 'G')!
        .topology!.occurrences.find(
          (occurrence) => occurrence.occurrenceId === 'golden-g-preboss-shop:postboss',
        )!;
    const blank = gPostboss(saved) as unknown as {
      stygianWell: { offerKeyBySlot: Record<string, string | null> };
      purgingPool: { traitKeyBySlot: Record<string, string | null> };
    };
    blank.stygianWell.offerKeyBySlot = { healing: null, secondLeft: null, secondRight: null };
    blank.purgingPool.traitKeyBySlot = { left: null, middle: null, right: null };
    const loaded = (revision: number) =>
      loadProjectDocument(JSON.stringify({ ...saved, schemaRevision: revision }), catalog).project;

    const opened = loaded(0);
    const { stygianWell, purgingPool } = gPostboss(opened);
    expect(Object.values(stygianWell!.offerKeyBySlot)).not.toContain(null);
    expect(Object.values(purgingPool!.traitKeyBySlot)).not.toContain(null);
    expect(simulateProject(catalog, opened).findings.map((finding) => finding.code)).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/Missing$/)]),
    );
    // A plan saved at the current revision loads as is.
    expect(gPostboss(loaded(PROJECT_DOCUMENT_SCHEMA_REVISION)).stygianWell!.offerKeyBySlot).toEqual(
      blank.stygianWell.offerKeyBySlot,
    );
  });

  it('fills the blank positions a schema 103.1 plan reaches, once, at load', () => {
    const saved = JSON.parse(
      encodeProjectDocument(loadUnderworldFPoolCheckpoint()),
    ) as ProjectDocument;
    const layouts = (document: ProjectDocument) =>
      document.route.biomes.flatMap((biome) =>
        (biome.topology?.occurrences ?? []).map((occurrence) => occurrence.layout),
      );
    expect(layouts(saved).some((layout) => layout !== undefined)).toBe(true);
    for (const biome of saved.route.biomes)
      for (const occurrence of biome.topology?.occurrences ?? [])
        delete (occurrence as { layout?: unknown }).layout;
    const loaded = (revision: number) =>
      loadProjectDocument(JSON.stringify({ ...saved, schemaRevision: revision }), catalog).project;
    expect(layouts(loaded(1))).toEqual(layouts(loadUnderworldFPoolCheckpoint()));
    // A plan saved at the current revision loads as is.
    expect(
      layouts(loaded(PROJECT_DOCUMENT_SCHEMA_REVISION)).every((layout) => layout === undefined),
    ).toBe(true);
  });

  it('drops a Well and Pool its route never spawns, with their rows, from a plan before 103.3', () => {
    const retained = withRetainedFreshFilePostboss(createFreshFileFProject(), {
      well: true,
      poolSaleTraitKey: 'ApolloWeaponBoon',
    });
    const postboss = (document: ProjectDocument) =>
      document.route.biomes[0]!.topology!.occurrences.find(
        (occurrence) => occurrence.occurrenceId === freshFileFPostbossId,
      )!;
    const loaded = (revision: number) =>
      loadProjectDocument(
        JSON.stringify({
          ...JSON.parse(encodeProjectDocument(retained)),
          schemaRevision: revision,
        }),
        catalog,
      ).project;

    const opened = postboss(loaded(2));
    expect(opened.stygianWell).toBeUndefined();
    expect(opened.purgingPool).toBeUndefined();
    expect(opened.roomActions.order).not.toContainEqual(
      expect.objectContaining({ kind: 'sellPurgingPoolTrait' }),
    );
    expect(simulateProject(catalog, loaded(2)).findings).toEqual([]);
    // A plan saved at the current revision loads as is.
    expect(postboss(loaded(PROJECT_DOCUMENT_SCHEMA_REVISION))).toEqual(postboss(retained));
  });

  describe('a plan saved before Heracles’s bounty was a pickup (101.2)', () => {
    const heraclesPhases = [
      [nBiome, nOccurrenceId('combat05'), 'Encounter', 'HeraclesCombatN'],
      [oBiome, oOccurrenceIds.combat01, 'Intro', 'HeraclesCombatO'],
      [pBiome, pOccurrenceId('P_Combat02', 2, 1), 'Intro', 'HeraclesCombatP'],
    ] as const;
    // A two-offer wheel makes the schema 100 -> 101 migration judge the plan's evaluation.
    const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1');
    const wheelOffer = (offerKey: string) =>
      createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat04, 'wheel1', offerKey);
    const current = heraclesPhases.reduce(
      (document, [biome, occurrenceId, phaseKey, encounterKey]) =>
        applyProjectCommand(document, catalog, {
          kind: 'SelectEncounter',
          phase: createEncounterPhaseAddress(biome, { kind: 'occurrence', occurrenceId }, phaseKey),
          encounterKey,
        }),
      (
        [
          { kind: 'ReplaceRewardWheelOfferCount', wheel, offerCount: 2 },
          {
            kind: 'ReplaceRewardWheelOffer',
            offer: wheelOffer('offer1'),
            value: { rewardType: 'MaxHealthDrop' },
          },
          {
            kind: 'ReplaceRewardWheelOffer',
            offer: wheelOffer('offer2'),
            value: { rewardType: 'RoomMoneyDrop' },
          },
        ] satisfies ProjectCommand[]
      ).reduce(
        (document, command) => applyProjectCommand(document, catalog, command),
        loadSurfaceNOPQProject(),
      ),
    );
    const bountySite = (
      document: ProjectDocument,
      [biome, occurrenceId, phaseKey]: (typeof heraclesPhases)[number],
    ) =>
      document.route.biomes
        .find((plan) => plan.biomeKey === biome.biomeKey)!
        .topology!.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId)!
        .acquisitionSites?.[heraclesBountySiteKey(phaseKey)];
    /** The plan as an earlier save holds it: no bounty site or collect row. */
    const withoutBounties = (document: unknown) =>
      JSON.parse(JSON.stringify(document), (key, value: unknown) =>
        key.startsWith('heraclesBounty:')
          ? undefined
          : Array.isArray(value)
            ? value.filter(
                (entry: unknown) =>
                  !String((entry as { siteKey?: unknown } | null)?.siteKey).startsWith(
                    'heraclesBounty:',
                  ),
              )
            : value,
      ) as Record<string, unknown>;

    it('gains the bounty site of each phase Heracles fights in N, O and P, never its row', () => {
      for (const site of heraclesPhases.map((phase) => bountySite(current, phase)))
        expect(site).toBeDefined();
      const saved = JSON.parse(encodeProjectDocument(current)) as unknown;
      const at100 = withoutBounties(legacySchema100Body(saved));
      const at101 = withoutBounties(legacySchema101Body(saved));
      expect(JSON.stringify([at100, at101])).not.toContain('heraclesBounty');
      for (const legacy of [
        { ...at100, schemaVersion: 100 },
        { ...at101, schemaVersion: 101, schemaRevision: 1 },
      ]) {
        const loaded = loadProjectDocument(JSON.stringify(legacy), catalog).project;
        for (const phase of heraclesPhases)
          expect(bountySite(loaded, phase)).toEqual(bountySite(current, phase));
        // Collecting the bounty stays the owner's placement.
        expect(encodeProjectDocument(loaded)).not.toContain('"siteKey":"heraclesBounty');
      }
      // From 101.2 on a plan stored the site, so its absence is malformed.
      expect(() =>
        loadProjectDocument(
          JSON.stringify({ ...at101, schemaVersion: 101, schemaRevision: 2 }),
          catalog,
        ),
      ).toThrow(/heraclesBounty:Encounter\.pickupEntries: does not match selected descriptor/);
    });

    it('reaches the schema 100 -> 101 wheel judge decoded, its bounty sites added', () => {
      const legacy = {
        ...withoutBounties(legacySchema100Body(JSON.parse(encodeProjectDocument(current)))),
        schemaVersion: 100,
      };
      const judged: ProjectDocument[] = [];
      migrate100To101JudgedBy(legacy, catalog, (project) => {
        judged.push(project);
        return undefined;
      });
      expect(judged).toHaveLength(1);
      for (const phase of heraclesPhases)
        expect(bountySite(judged[0]!, phase)).toEqual(bountySite(current, phase));
      expect(() =>
        simulateProject(catalog, loadProjectDocument(JSON.stringify(legacy), catalog).project),
      ).not.toThrow();
    });
  });

  describe('the Zagreus contract Champion row, granted with no pickup', () => {
    const current = loadUnderworldZagreusContractCheckpoint();
    const championRow = {
      kind: 'interactIncomingReward',
      producerPoint: 'roomRewardPickup',
      acquisitionRole: 'self',
      content: ['native', 'InfernalContractBoon'],
    } as const;
    const contractRoomOrder = (document: ProjectDocument) =>
      document.route.biomes
        .flatMap((biome) => biome.topology?.occurrences ?? [])
        .find((occurrence) => occurrence.gameName === 'C_Boss01')!.roomActions.order;
    // Ranked before the gems, as the old roster proposed it.
    const withChampion = JSON.parse(encodeProjectDocument(current)) as ProjectDocument;
    (contractRoomOrder(withChampion) as unknown[]).unshift(championRow);
    const saved = (document: ProjectDocument, envelope: Record<string, number>) =>
      JSON.stringify({ ...JSON.parse(encodeProjectDocument(document)), ...envelope });

    it('is dropped on load at every revision, leaving every other row', () => {
      expect(contractRoomOrder(withChampion)).toEqual([
        championRow,
        { kind: 'collectRequiredReward' },
      ]);
      for (const revision of [0, 2, PROJECT_DOCUMENT_SCHEMA_REVISION]) {
        const loaded = loadProjectDocument(
          JSON.stringify({ ...withChampion, schemaRevision: revision }),
          catalog,
        ).project;
        expect(loaded).toEqual(current);
        expect(simulateProject(catalog, loaded).findings).toEqual(
          simulateProject(catalog, current).findings,
        );
      }
    });

    it('is dropped from a plan upgraded from schema 102', () => {
      const loaded = loadProjectDocument(
        JSON.stringify({ ...withChampion, schemaVersion: 102, schemaRevision: 1 }),
        catalog,
      );
      expect(loaded.migrationProvenance.map((step) => step.targetSchemaVersion)).toEqual([103]);
      expect(contractRoomOrder(loaded.project)).toEqual([{ kind: 'collectRequiredReward' }]);
    });

    it('leaves a plan without it unchanged', () => {
      expect(
        loadProjectDocument(
          saved(current, { schemaRevision: PROJECT_DOCUMENT_SCHEMA_REVISION }),
          catalog,
        ).project,
      ).toEqual(current);
    });
  });

  describe('a plan saved before schema 103', () => {
    // The G opening keeps a pickup of a role its reward no longer has.
    const stale = createGoldenFGHIProject();
    const gOpening = (document: ProjectDocument) =>
      document.route.biomes
        .find((biome) => biome.biomeKey === 'G')!
        .topology!.occurrences.find((occurrence) => occurrence.occurrenceId === 'golden-g-b1-e1')!
        .roomActions.order;
    const at102 = (revision: number) =>
      JSON.stringify({
        ...JSON.parse(encodeProjectDocument(stale)),
        schemaVersion: 102,
        schemaRevision: revision,
      });

    it('opens settled once by its migration', () => {
      for (const revision of [0, 1]) {
        const loaded = loadProjectDocument(at102(revision), catalog);
        expect(loaded.migrationProvenance.map((step) => step.targetSchemaVersion)).toEqual([103]);
        expect(gOpening(loaded.project)).toEqual(
          gOpening(stale).filter(
            (action) =>
              !(action.kind === 'interactIncomingReward' && action.acquisitionRole === 'source'),
          ),
        );
      }
    });

    it('rejects a later revision of schema 102', () => {
      expect(() => loadProjectDocument(at102(2), catalog)).toThrow(
        /schema 102\.2 is newer than schema 102's final revision 1/,
      );
    });

    it('opens as saved when settling changes nothing', () => {
      const clean = {
        ...JSON.parse(encodeProjectDocument(project)),
        schemaVersion: 102,
        schemaRevision: 1,
      };
      expect(loadProjectDocument(JSON.stringify(clean), catalog)).toEqual({
        migrationProvenance: [
          {
            sourceCatalogVersion: catalog.version,
            sourceSchemaVersion: 102,
            targetCatalogVersion: catalog.version,
            targetSchemaVersion: 103,
          },
        ],
        project,
      });
    });

    it('is never settled again once saved at schema 103', () => {
      const loaded = loadProjectDocument(encodeProjectDocument(stale), catalog);
      expect(loaded).toEqual({ migrationProvenance: [], project: stale });
    });
  });

  it('fills each unstored Nemesis kill race of a schema-100 or older document with a win', () => {
    const phase = (occurrenceId: ReturnType<typeof goldenFOccurrenceId>) =>
      createEncounterPhaseAddress(goldenFBiome, { kind: 'occurrence', occurrenceId }, 'Encounter');
    let current = createGoldenFGHIProject();
    for (const [occurrenceId, value] of [
      [goldenFOccurrenceId(5, 1), 'tie'],
      [goldenFOccurrenceId(4, 1), 'win'],
    ] as const) {
      current = applyProjectCommand(current, catalog, {
        kind: 'SelectEncounter',
        phase: phase(occurrenceId),
        encounterKey: 'NemesisCombatF',
      });
      current = applyProjectCommand(current, catalog, {
        kind: 'ReplaceNemesisBetOutcome',
        phase: phase(occurrenceId),
        value,
      });
    }
    // Schema 100 stored a win by omission.
    const sparse = legacySchema100Body(JSON.parse(encodeProjectDocument(current))) as Record<
      string,
      unknown
    >;
    expect(JSON.stringify(sparse)).toContain('"nemesisBetOutcomeByPhase":{"Encounter":"tie"}');
    expect(() => parseProjectDocument(JSON.stringify(sparse), catalog)).toThrow(
      /nemesisBetOutcomeByPhase: must be an object/,
    );
    const loaded = loadProjectDocument(JSON.stringify({ ...sparse, schemaVersion: 100 }), catalog);
    expect(loaded.migrationProvenance.map((step) => step.targetSchemaVersion)).toEqual([
      101, 102, 103,
    ]);
    expect(withoutPositions(loaded.project)).toEqual(withoutPositions(current));

    const won = applyProjectCommand(current, catalog, {
      kind: 'ReplaceNemesisBetOutcome',
      phase: phase(goldenFOccurrenceId(5, 1)),
      value: 'win',
    });
    const legacy = legacySchema99Body(JSON.parse(encodeProjectDocument(won))) as Record<
      string,
      unknown
    >;
    expect(JSON.stringify(legacy)).not.toContain('nemesisBetOutcomeByPhase');
    legacy.schemaVersion = 99;
    const migrated = loadProjectDocument(JSON.stringify(legacy), catalog);
    expect(migrated.migrationProvenance).toHaveLength(4);
    expect(withoutPositions(migrated.project)).toEqual(withoutPositions(won));
  });

  it('loads one plan saved at schema 98, 99 or 100 as the same current project', () => {
    const current = createGoldenFGHIProject();
    const at100 = { ...legacySchema100Body(JSON.parse(encodeProjectDocument(current))) };
    const at99 = legacySchema99Body(JSON.parse(encodeProjectDocument(current))) as Record<
      string,
      unknown
    >;
    const documents = [
      { ...at99, schemaVersion: 98 },
      { ...at99, schemaVersion: 99 },
      { ...at100, schemaVersion: 100 },
    ];
    for (const document of documents) {
      expect(() => parseProjectDocument(JSON.stringify(document), catalog)).toThrow(
        /schemaVersion/,
      );
      const loaded = loadProjectDocument(JSON.stringify(document), catalog);
      expect(loaded.migrationProvenance.at(-1)?.targetSchemaVersion).toBe(103);
      // Opened as the same plan saved at schema 102, settled by the same migration.
      expect(encodeProjectDocument(loaded.project)).toBe(
        encodeProjectDocument(openedAt102(current)),
      );
    }
  });

  it('runs transitions across majors without carrying an older major revision forward', () => {
    const legacy = legacySchema99Body(JSON.parse(encodeProjectDocument(project))) as Record<
      string,
      unknown
    >;
    legacy.schemaVersion = 96;
    legacy.schemaRevision = PROJECT_DOCUMENT_SCHEMA_REVISION + 3;

    const loaded = loadProjectDocument(JSON.stringify(legacy), catalog);
    expect(loaded.migrationProvenance).toHaveLength(7);
    expect(loaded.project).toEqual(project);
  });

  it('rejects a schema-100 document from an unknown revision or catalog', () => {
    const at100 = {
      ...legacySchema100Body(JSON.parse(encodeProjectDocument(project))),
      schemaVersion: 100,
    };
    expect(() =>
      loadProjectDocument(JSON.stringify({ ...at100, schemaRevision: 1 }), catalog),
    ).toThrow(/schema 100\.1 is newer than schema 100's final revision 0/);
    // Neither the old in-place load nor the transition opens a plan of another catalog.
    expect(() =>
      loadProjectDocument(JSON.stringify({ ...at100, catalogVersion: 'other' }), catalog),
    ).toThrow(/Project schema 100 with catalog other has no supported migration/);
  });

  it('migrates a schema-87 Hub to fountain use before its retained visits', () => {
    const current = loadSurfaceNProject();
    const legacy = legacyRareEpicHexTrees(
      legacySchema99Body(JSON.parse(encodeProjectDocument(current))),
    ) as {
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
      parseProjectDocument(
        JSON.stringify({ ...legacy, schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION }),
        catalog,
      ),
    ).toThrow(/visitOrder/);

    const loaded = loadProjectDocument(JSON.stringify(legacy), catalog);
    expect(loaded.migrationProvenance).toHaveLength(16);
    expect(loaded.project).toEqual(
      applyProjectCommand(current, catalog, {
        kind: 'ReplaceHubActionOrder',
        hub: createHubDecisionAddress(nBiome, 'hub'),
        actions: hubVisitActions(nVisitSlotKeys, 0),
      }),
    );
  });

  it('chains a schema-87 document without a Hub through 88 to 103', () => {
    const legacy = legacySchema99Body(JSON.parse(encodeProjectDocument(project))) as Record<
      string,
      unknown
    >;
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
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 100,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 101,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 101,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 102,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 102,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 103,
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
      legacyRareEpicHexTrees(
        legacySchema99Body({
          ...checkpoint,
          schemaVersion: 92,
          route: { ...checkpoint.route, loadout },
        }),
      ),
      null,
      2,
    );
    expect(legacy).toContain('"traitKey": "HiddenMaxHealthBoon"');
    const loaded = loadProjectDocument(legacy, catalog);

    expect(loaded.migrationProvenance.map((step) => step.targetSchemaVersion)).toEqual([
      93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103,
    ]);
    expect(encodeProjectDocument(loaded.project)).toBe(current);
  });

  it('loads a schema-93 Rare/Epic Hex tree as a complete tree with the picks in layout order', () => {
    const checkpoint = surfaceCheckpointArtifacts['surface-ordinary-hex-path'].raw;
    const current = currentRevisionText(checkpoint);
    const unresolved = JSON.parse(current, (key, value: unknown) =>
      key === 'hexActivationsByAcquisitionRole' ? undefined : value,
    ) as object;
    const legacy = JSON.stringify(
      legacyRareEpicHexTrees({ ...legacySchema99Body(unresolved), schemaVersion: 93 }),
    );
    expect(legacy).toContain(
      '"hexTree":{"layoutKey":"Lung","rareTalentKeys":["DamageBuffTalent","ShieldTalent"],"epicTalentKeys":["ClearCastTalent"]}',
    );
    const loaded = loadProjectDocument(legacy, catalog);

    expect(loaded.migrationProvenance.map((step) => step.targetSchemaVersion)).toEqual([
      94, 95, 96, 97, 98, 99, 100, 101, 102, 103,
    ]);
    expect(withoutPositions(JSON.parse(encodeProjectDocument(loaded.project)))).toEqual(
      withoutPositions(unresolved),
    );
  });

  it('loads schema-94 Path screens unresolved, leaving each reached screen to its author', () => {
    const checkpoint = surfaceCheckpointArtifacts['surface-selene-hex-path'].raw;
    const current = currentRevisionText(checkpoint);
    expect(current.match(/hexActivationsByAcquisitionRole/g)).toHaveLength(2);
    const legacy = JSON.parse(current, (key, value: unknown) =>
      key === 'hexActivationsByAcquisitionRole' ? undefined : value,
    ) as Record<string, unknown>;
    legacy.schemaVersion = 94;
    const loaded = loadProjectDocument(JSON.stringify(legacySchema99Body(legacy)), catalog);

    expect(loaded.migrationProvenance.map((step) => step.targetSchemaVersion)).toEqual([
      95, 96, 97, 98, 99, 100, 101, 102, 103,
    ]);
    expect(withoutPositions(JSON.parse(encodeProjectDocument(loaded.project)))).toEqual(
      withoutPositions(
        JSON.parse(
          currentRevisionText({ ...legacy, schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION }),
        ),
      ),
    );
  });

  it('loads a schema-95 incomplete Hub with its completed-Hub chain added', () => {
    const checkpoint = surfaceCheckpointArtifacts['surface-n-partial-hub'];
    const legacy = legacySchema99Body(JSON.parse(JSON.stringify(checkpoint.raw))) as {
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
      96, 97, 98, 99, 100, 101, 102, 103,
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
    const legacy = legacySchema99Body(JSON.parse(encodeProjectDocument(current))) as Raw;
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
      97, 98, 99, 100, 101, 102, 103,
    ]);
    expect(loaded.project).toEqual(current);
  });

  it('heals a malformed or null schema-96 start point to a full run on load', () => {
    for (const startPoint of [null, { biomeKey: 'G', point: 'hub' }, 'G']) {
      const legacy = legacySchema99Body(JSON.parse(encodeProjectDocument(project))) as {
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
    const { name: _name, ...rest } = legacySchema99Body(
      JSON.parse(encodeProjectDocument(named)),
    ) as Record<string, unknown>;
    void _name;
    const legacy = JSON.stringify({ ...rest, schemaVersion: 97, schemaRevision: 3 });
    const loaded = loadProjectDocument(legacy, catalog, { legacyName: 'Staff practice' });
    expect(loaded.migrationProvenance.map((step) => step.targetSchemaVersion)).toEqual([
      98, 99, 100, 101, 102, 103,
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
    const legacy = legacySchema99Body(JSON.parse(encodeProjectDocument(project))) as Record<
      string,
      unknown
    >;
    legacy.schemaVersion = 88;
    legacy.projectId = 'run-plan';
    const first = loadProjectDocument(JSON.stringify(legacy), catalog);
    const second = loadProjectDocument(JSON.stringify(legacy), catalog).project;
    expect(first.migrationProvenance.map((step) => step.sourceSchemaVersion)).toEqual([
      88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102,
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
    'migrates a mature schema-89 %s document to schema 103 without reinterpreting it',
    (_route, current) => {
      const expected = current();
      const legacy = legacyRareEpicHexTrees({
        ...legacySchema99Body(JSON.parse(encodeProjectDocument(expected))),
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
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 100,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 101,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 101,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 102,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 102,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 103,
        },
      ]);
      expect(loaded.project).toEqual(openedAt102(expected));
      expect(encodeProjectDocument(loaded.project)).toBe(
        encodeProjectDocument(openedAt102(expected)),
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
    const legacy = legacyRareEpicHexTrees(
      legacySchema99Body({
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
      }),
    ) as Record<string, unknown>;
    expect(() =>
      parseProjectDocument(
        JSON.stringify(
          migrate102To103(
            migrate101To102(fillNemesisBetOutcomeWins({ ...legacy, schemaVersion: 101 }, catalog), {
              catalog,
            }),
          ),
        ),
        catalog,
      ),
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
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 100,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 101,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 101,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 102,
        },
        {
          sourceCatalogVersion: catalog.version,
          sourceSchemaVersion: 102,
          targetCatalogVersion: catalog.version,
          targetSchemaVersion: 103,
        },
      ],
      project: withoutPositions(expected),
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
      JSON.stringify({ ...project, schemaVersion: 104 }),
      /newer than supported schema 103/,
    ],
    [
      'future revision of the current major',
      JSON.stringify({ ...project, schemaRevision: PROJECT_DOCUMENT_SCHEMA_REVISION + 1 }),
      /newer than supported schema 103\.\d+/,
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
    const currentIdentity = {
      catalogVersion: catalog.version,
      schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION,
    } as const;
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
        targetSchemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION,
      },
    ]);
    expect(parseProjectDocument(JSON.stringify(migrated.document), catalog)).toEqual(project);
  });

  it('rejects a transition that does not reach its declared target identity', () => {
    const oldIdentity = { catalogVersion: 'catalog-85', schemaVersion: 85 } as const;
    const currentIdentity = {
      catalogVersion: catalog.version,
      schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION,
    } as const;

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
      91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103,
    ]);
    const occurrence = loaded.project.route.biomes
      .find((biome) => biome.biomeKey === 'N')
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === shrine);
    // Each purchase's delay now belongs to its item.
    expect(occurrence?.hermesShrine?.offerBySlot.first?.delay).toBe(2);
    expect(occurrence?.hermesShrine?.offerBySlot.secondRight?.delay).toBe(5);
    expect(occurrence?.hermesShrine?.travelDealRefill?.offer?.delay).toBe(2);
    expect(occurrence?.roomActions.order).toEqual(
      withItemContents(
        loaded.project,
        createOccurrenceAddress(createBiomeAddress('Surface', 'N'), createOccurrenceId(shrine)),
        [
          { kind: 'useFountain' },
          { kind: 'interactKeepsakeRack' },
          { kind: 'purchaseHermesShrineOffer', generationKey: 'initial:first' },
          { kind: 'rushHermesShrineOffer', generationKey: 'initial:first' },
          { kind: 'purchaseHermesShrineOffer', generationKey: 'initial:secondRight' },
          { kind: 'rushHermesShrineOffer', generationKey: 'initial:secondRight' },
          { kind: 'purchaseHermesShrineOffer', generationKey: 'travelDealRefill' },
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
        ],
      ),
    );

    // The saved board repeats Ares on Combat05 before four distinct gods in the game's
    // assignment order; the unvisited Combat01/Combat10 swap restores it.
    expect(simulateProject(catalog, loaded.project).findings).toEqual([
      expect.objectContaining({ code: 'rewardSourceUnavailable' }),
    ]);
    // Recorded from the schema-90 engine evaluating the unmigrated fixture.
    const evaluation = simulateProject(catalog, withFourthBoardGodBeforeCombat05(loaded.project));
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
      n?.hermesShrineAssessments.find((entry) => entry.origin.occurrenceId === shrine)?.assessment
        .travelDealRefill?.sourceGenerationKey,
    ).toBe('initial:first');
  });

  it('migrates schema-91 Anvil results onto their reward roles and evaluates identically', () => {
    const loaded = loadProjectDocument(JSON.stringify(schema91AnvilResults), catalog);
    expect(loaded.migrationProvenance.map((step) => step.targetSchemaVersion)).toEqual([
      92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103,
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
    // The file's H Preboss source lost a door before settlement owned doors; its migration
    // lets the door go, and the route evaluates as it did.
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

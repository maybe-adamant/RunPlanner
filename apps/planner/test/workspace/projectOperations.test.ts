import { decodeSlotSource } from '@planner/persistence/slotSource';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createOccurrenceAddress,
  createEncounterPhaseAddress,
  createProjectAddress,
  createRouteAddress,
  createProjectDocument,
  encodeProjectDocument,
  PROJECT_DOCUMENT_SCHEMA_REVISION,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import {
  createCompleteFGProject,
  createGoldenFGHProject,
  goldenGBiome,
  goldenHStartId,
} from '@run-planner/test-fixtures/underworld';
import { surfaceCheckpointArtifacts } from '@run-planner/test-fixtures/checkpoints/surface';
import { describe, expect, it } from 'vitest';
import { dreamMixedPrefixProject } from '@run-planner/test-fixtures/dream';
import { createFreshFileRouteProject } from '@run-planner/test-fixtures/fresh-file';
import { legacyRareEpicHexTrees } from '@run-planner/test-fixtures/shared';

import { createApplication } from '@planner/composition/createApplication';
import { EXECUTION_PLAN_FORMAT } from '@run-planner/engine/execution-plan';
import { createFakeGameModuleHost, gameModuleStatus } from '@planner-test/fixtures/gameModuleHost';
import {
  createManualSaveScheduler,
  createMemoryProjectLibrary,
} from '@planner-test/support/memoryProjectLibrary';
import {
  authoredProjectCommandDispatched,
  authoredProjectReplaced,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import {
  selectPresentProject,
  selectProjectEvaluation,
  selectProjectHistory,
  selectRevertAvailable,
} from '@planner/state/store';
import {
  loadSurfaceNProject,
  loadSurfaceNOPProject,
  pBiome,
  pOccurrenceId,
} from '@run-planner/test-fixtures/surface';

function presentProject(application: ReturnType<typeof createApplication>) {
  const project = selectPresentProject(application.store.getState());
  if (project === undefined) throw new Error('expected an open project');
  return project;
}

function presentHistory(application: ReturnType<typeof createApplication>) {
  const history = selectProjectHistory(application.store.getState());
  if (history === undefined) throw new Error('expected project history');
  return history;
}

/** An application over an in-memory library whose debounced writes the test runs. */
function createLibraryApplication(options: Parameters<typeof createApplication>[0] = {}) {
  const library = createMemoryProjectLibrary();
  const saves = createManualSaveScheduler();
  let minted = 0;
  const application = createApplication({
    mintProjectId: () => `minted-${(minted += 1)}`,
    ...options,
    projectLibrary: library.adapter,
    saveScheduler: saves.scheduler,
  });
  return { application, library, saves };
}

const configure = (biomes: number) =>
  authoredProjectCommandDispatched({
    kind: 'ConfigureRoutePrefix',
    route: createRouteAddress('Underworld'),
    configuredBiomeCount: biomes,
  });
const rename = (name: string) =>
  authoredProjectCommandDispatched({
    kind: 'RenameProject',
    project: createProjectAddress(),
    name,
  });

describe('project operations', () => {
  it('creates a legal Dream Dive while rejecting a non-public itinerary atomically', async () => {
    const { application, library } = createLibraryApplication();
    await application.projectOperations.createNew('Underworld');
    const beforeInvalidDream = selectPresentProject(application.store.getState());
    await expect(
      application.projectOperations.createNew('Dream', ['F', 'G', 'N', 'P']),
    ).resolves.toMatchObject({ status: 'failure' });
    expect(selectPresentProject(application.store.getState())).toBe(beforeInvalidDream);
    expect(await library.plans(catalog)).toHaveLength(1);
    await expect(
      application.projectOperations.createNew('Dream', ['Q', 'F', 'N', 'H']),
    ).resolves.toMatchObject({ status: 'success' });
    const created = selectPresentProject(application.store.getState());
    expect(created?.route).toMatchObject({
      routeKey: 'Dream',
      itineraryBiomeKeys: ['Q', 'F', 'N', 'H'],
    });
    expect(created?.route.biomes.map((biome) => biome.biomeKey)).toEqual(['Q']);
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ConfigureRoutePrefix',
        route: createRouteAddress('Dream'),
        configuredBiomeCount: 2,
      }),
    );
    application.store.dispatch(authoredProjectUndoRequested());
    expect(selectPresentProject(application.store.getState())?.route).toMatchObject({
      itineraryBiomeKeys: ['Q', 'F', 'N', 'H'],
      biomes: [{ biomeKey: 'Q' }],
    });
  });

  it('files each new plan in the library under its own identity before opening it', async () => {
    const { application, library } = createLibraryApplication();
    await expect(application.projectOperations.createNew('Underworld')).resolves.toEqual({
      operation: 'new',
      status: 'success',
      message: 'Created a new plan.',
    });
    expect(presentProject(application).projectId).toBe('minted-1');
    await application.projectOperations.createNew('Surface');
    expect(presentProject(application).projectId).toBe('minted-2');
    expect(presentHistory(application)).toMatchObject({ past: [], future: [] });
    const stored = await library.plans(catalog);
    expect(stored.map((plan) => plan.projectId)).toEqual(['minted-1', 'minted-2']);
    expect(Object.keys(JSON.parse(encodeProjectDocument(stored[0]!)))).toEqual([
      'schemaVersion',
      ...(PROJECT_DOCUMENT_SCHEMA_REVISION === 0 ? [] : ['schemaRevision']),
      'projectId',
      'name',
      'catalogVersion',
      'route',
    ]);
  });

  it('writes edits debounced and coalesced, in order, so the last edit wins', async () => {
    const { application, library, saves } = createLibraryApplication();
    await application.projectOperations.createNew('Underworld');
    expect(saves.hasPending()).toBe(false);

    application.store.dispatch(configure(2));
    application.store.dispatch(configure(3));
    expect(saves.hasPending()).toBe(true);
    await application.projectOperations.flush();
    expect(library.writes).toHaveLength(1);
    expect(saves.hasPending()).toBe(false);

    // An edit made while a write runs is written after it, never before.
    application.store.dispatch(configure(2));
    saves.run();
    application.store.dispatch(configure(1));
    await application.projectOperations.flush();
    expect(library.writes.map((write) => JSON.parse(write.json).route.biomes.length)).toEqual([
      3, 2, 1,
    ]);
    expect(await library.plans(catalog)).toEqual([presentProject(application)]);

    // Undo is an edit like any other.
    application.store.dispatch(authoredProjectUndoRequested());
    await application.projectOperations.flush();
    expect((await library.plans(catalog))[0]?.route.biomes).toHaveLength(2);
  });

  it('follows the plan to its new key when a rename refiles it', async () => {
    const { application, library } = createLibraryApplication();
    await application.projectOperations.createNew('Underworld');
    const original = library.writes.length;
    // The browser library keeps its key; a desktop rename moves the file.
    const write = library.adapter.write;
    let moved = false;
    library.adapter.write = async (key, json) => {
      const entry = await write(key, json);
      if (moved) return entry;
      moved = true;
      return { ...entry, key: `${key}-renamed` };
    };
    application.store.dispatch(rename('Renamed plan'));
    await application.projectOperations.flush();
    application.store.dispatch(rename('Renamed again'));
    await application.projectOperations.flush();
    expect(library.writes.slice(original).map((entry) => entry.key)).toEqual([
      'plan-1',
      'plan-1-renamed',
    ]);
    expect((await library.adapter.readSession()).lastOpened).toEqual({
      key: 'plan-1-renamed',
      projectId: 'minted-1',
    });
  });

  it('reports a failed write and retries it with the next edit or flush', async () => {
    const { application, library } = createLibraryApplication();
    await application.projectOperations.createNew('Underworld');
    library.failWrites(new Error('disk full'));
    application.store.dispatch(configure(2));
    await expect(application.projectOperations.flush()).resolves.toEqual({
      status: 'failure',
      message: 'Could not save the plan: disk full',
    });
    expect(application.store.getState().librarySession.writeError).toBe(
      'Could not save the plan: disk full',
    );

    // Opening another plan would lose the unsaved edit, so it is refused.
    const before = application.store.getState().projectWorkspace;
    await expect(application.projectOperations.createNew('Surface')).resolves.toMatchObject({
      status: 'failure',
    });
    expect(application.store.getState().projectWorkspace).toBe(before);

    library.failWrites(null);
    await expect(application.projectOperations.flush()).resolves.toMatchObject({
      status: 'success',
    });
    expect(application.store.getState().librarySession.writeError).toBeNull();
    expect(
      (await library.plans(catalog)).find((plan) => plan.projectId === 'minted-1')?.route.biomes,
    ).toHaveLength(2);
  });

  it('writes the open plan before opening another, then opens it clean', async () => {
    const { application, library, saves } = createLibraryApplication();
    await application.projectOperations.createNew('Underworld');
    application.store.dispatch(configure(2));
    const key = await library.file(loadSurfaceNProject());
    await expect(application.projectOperations.openPlan(key)).resolves.toEqual({
      operation: 'openPlan',
      status: 'success',
      message: 'Opened the plan.',
    });
    expect(saves.hasPending()).toBe(false);
    expect(presentProject(application)).toEqual(loadSurfaceNProject());
    expect(presentHistory(application)).toMatchObject({ past: [], future: [] });
    expect(
      (await library.plans(catalog)).find((plan) => plan.projectId === 'minted-1')?.route.biomes,
    ).toHaveLength(2);
    expect((await library.adapter.readSession()).lastOpened).toEqual({
      key,
      projectId: loadSurfaceNProject().projectId,
    });
  });

  it('reverts to the plan as opened as one undoable step', async () => {
    const { application } = createLibraryApplication();
    await application.projectOperations.createNew('Underworld');
    const opened = presentProject(application);
    expect(selectRevertAvailable(application.store.getState())).toBe(false);
    application.store.dispatch(configure(2));
    application.store.dispatch(configure(3));
    const edited = presentProject(application);
    expect(selectRevertAvailable(application.store.getState())).toBe(true);

    expect(application.projectOperations.revertToOpened()).toMatchObject({ status: 'success' });
    expect(presentProject(application)).toBe(opened);
    expect(selectRevertAvailable(application.store.getState())).toBe(false);
    expect(presentHistory(application).past).toHaveLength(3);
    application.store.dispatch(authoredProjectUndoRequested());
    expect(presentProject(application)).toBe(edited);
  });

  it('duplicates the open plan as a new library plan named as its copy', async () => {
    const { application, library } = createLibraryApplication();
    await application.projectOperations.createNew('Underworld');
    application.store.dispatch(rename('Erebus opener'));
    application.store.dispatch(configure(2));
    const original = presentProject(application);
    await expect(application.projectOperations.duplicate()).resolves.toEqual({
      operation: 'duplicate',
      status: 'success',
      message: 'Opened Erebus opener (copy).',
    });
    expect(presentProject(application)).toEqual({
      ...original,
      projectId: 'minted-2',
      name: 'Erebus opener (copy)',
    });
    expect(presentHistory(application)).toMatchObject({ past: [], future: [] });
    expect((await library.plans(catalog)).map((plan) => [plan.projectId, plan.name])).toEqual([
      ['minted-1', 'Erebus opener'],
      ['minted-2', 'Erebus opener (copy)'],
    ]);

    application.store.dispatch(rename('é'.repeat(200)));
    await application.projectOperations.duplicate();
    expect(Array.from(presentProject(application).name)).toHaveLength(200);
    expect(presentProject(application).name.endsWith(' (copy)')).toBe(true);
  });

  it('opens an outside file as a library copy, re-identified when the library holds it', async () => {
    const { application, library } = createLibraryApplication();
    const project = createProjectDocument(catalog, {
      projectId: 'outside',
      routeKey: 'Underworld',
      configuredBiomeCount: 2,
    });
    const file = { fileName: 'erebus.runplanner.json', json: encodeProjectDocument(project) };
    library.choose(file);
    await expect(application.projectOperations.importPlan()).resolves.toEqual({
      operation: 'importPlan',
      status: 'success',
      message: 'Added the file to the library and opened it.',
    });
    expect(presentProject(application)).toEqual(project);
    library.choose(file);
    await application.projectOperations.importPlan();
    expect(presentProject(application)).toEqual({ ...project, projectId: 'minted-1' });
    expect((await library.plans(catalog)).map((plan) => plan.projectId)).toEqual([
      'outside',
      'minted-1',
    ]);
    await expect(application.projectOperations.importPlan()).resolves.toEqual({
      operation: 'importPlan',
      status: 'cancelled',
      message: 'Open file cancelled.',
    });
  });

  it('rejects malformed, unsupported and stale-catalog files without filing or replacing anything', async () => {
    const { application, library } = createLibraryApplication();
    await application.projectOperations.createNew('Underworld');
    const state = application.store.getState();
    const current = JSON.parse(encodeProjectDocument(presentProject(application))) as Record<
      string,
      unknown
    >;
    library.choose({ fileName: 'broken.runplanner.json', json: '{not json' });
    await expect(application.projectOperations.importPlan()).resolves.toEqual({
      operation: 'importPlan',
      status: 'failure',
      message: 'Open file failed: $: must be valid JSON',
    });
    expect(application.store.getState()).toBe(state);
    for (const json of [
      JSON.stringify({ ...current, schemaVersion: 8 }),
      JSON.stringify({ ...current, schemaVersion: 99 }),
      JSON.stringify({ ...current, catalogVersion: 'stale-catalog-version' }),
    ]) {
      library.choose({ fileName: 'bad.runplanner.json', json });
      await expect(application.projectOperations.importPlan()).resolves.toMatchObject({
        operation: 'importPlan',
        status: 'failure',
      });
      expect(application.store.getState()).toBe(state);
    }
    expect(await library.plans(catalog)).toHaveLength(1);
  });

  it('names an opened schema-97 file after its file', async () => {
    const { application, library } = createLibraryApplication();
    const { name: _name, ...rest } = JSON.parse(
      encodeProjectDocument(
        createProjectDocument(catalog, {
          configuredBiomeCount: 1,
          projectId: 'legacy-unnamed',
          routeKey: 'Underworld',
        }),
      ),
    ) as Record<string, unknown>;
    void _name;
    library.choose({
      fileName: 'Staff run.runplanner.json',
      json: JSON.stringify({ ...rest, schemaVersion: 97 }),
    });
    await expect(application.projectOperations.importPlan()).resolves.toMatchObject({
      status: 'success',
    });
    expect(presentProject(application).name).toBe('Staff run');
    expect((await library.plans(catalog))[0]?.name).toBe('Staff run');
  });

  it('opens a reached Steady Growth outcome at a blocked Shrine frontier', async () => {
    const library = createMemoryProjectLibrary();
    const checkpoint = surfaceCheckpointArtifacts['surface-p-steady-growth-shrine-frontier']
      .raw as {
      readonly route: Record<string, unknown>;
    };
    library.choose({
      fileName: 'surface-p-steady-growth-shrine-frontier.runplanner.json',
      json: JSON.stringify({
        ...checkpoint,
        route: {
          ...checkpoint.route,
          itineraryBiomeKeys: catalog.routes.byKey.Surface!.biomeKeys,
        },
      }),
    });
    const application = createApplication({ projectLibrary: library.adapter });

    await expect(application.projectOperations.importPlan()).resolves.toMatchObject({
      operation: 'importPlan',
      status: 'success',
    });
    const evaluation = selectProjectEvaluation(application.store.getState());
    const finding = evaluation?.findings.find(
      (candidate) =>
        candidate.code === 'steadyGrowthOutcomeMissing' &&
        candidate.origin.kind === 'steadyGrowthOutcome' &&
        candidate.origin.biomeKey === 'P',
    );
    if (finding?.origin.kind !== 'steadyGrowthOutcome') {
      throw new Error('opened plan lost its reached P Steady Growth outcome');
    }
    const steadyGrowthOutcome = finding.origin;
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const interaction = workspace?.interactions.steadyGrowth.get(
      semanticAddressKey(steadyGrowthOutcome),
    );
    const candidates = interaction
      ?.forTarget()
      .load()
      ?.picker.sections.flatMap((section) => section.items.map((item) => item.value));
    expect(candidates).toEqual([
      'ZeusWeaponBoon',
      'HeraCastBoon',
      'AphroditeSpecialBoon',
      'CastNovaBoon',
      'FocusCritBoon',
      'DoubleBoltBoon',
      'DamageSharePotencyBoon',
      'DamageShareRetaliateBoon',
      'FocusLightningBoon',
      'SprintShieldBoon',
    ]);

    if (interaction === undefined) throw new Error('Steady Growth interaction is unavailable');
    application.store.dispatch(
      authoredProjectCommandDispatched(interaction.intentFor('HeraCastBoon').command),
    );
    expect(
      selectProjectEvaluation(application.store.getState())?.findings.some(
        (candidate) =>
          semanticAddressKey(candidate.origin) === semanticAddressKey(steadyGrowthOutcome),
      ),
    ).toBe(false);

    const deliveryFinding = selectProjectEvaluation(application.store.getState())?.findings.find(
      (candidate) =>
        candidate.code === 'hermesShrineDeliveryPlacementRequired' &&
        candidate.origin.kind === 'acquisitionEntry' &&
        candidate.origin.site.owner.kind === 'occurrence' &&
        candidate.origin.site.owner.occurrenceId === 'c34604d0-c4e3-4c26-8539-54a82158716f',
    );
    expect(deliveryFinding).toBeUndefined();
    const host = application.store
      .getState()
      .projectWorkspace.history!.present.route.biomes.flatMap(
        (biome) => biome.topology?.occurrences ?? [],
      )
      .find((occurrence) => occurrence.occurrenceId === 'c34604d0-c4e3-4c26-8539-54a82158716f');
    expect(
      host?.roomActions.order.some(
        (reference) =>
          reference.kind === 'interactAcquisitionEntry' &&
          reference.siteKey === 'hermesShrineDelivery',
      ),
    ).toBe(true);
  });

  it('reconciles a pre-fix Ixion purchase into its forced gate while opening', async () => {
    const library = createMemoryProjectLibrary();
    let source = createGoldenFGHProject();
    const gPostboss = source.route.biomes
      .find((biome) => biome.biomeKey === 'G')
      ?.topology?.occurrences.find((occurrence) => occurrence.gameName === 'G_PostBoss01');
    if (gPostboss === undefined) throw new Error('expected fixed G Postboss');
    const well = createOccurrenceAddress(goldenGBiome, gPostboss.occurrenceId);
    for (const command of [
      { kind: 'SetStygianWellInteraction' as const, occurrence: well, interacted: true },
      {
        kind: 'ReplaceStygianWellOffer' as const,
        occurrence: well,
        slotKey: 'secondLeft' as const,
        itemKey: 'TemporaryForcedSecretDoorTrait',
      },
      {
        kind: 'SetStygianWellPurchase' as const,
        occurrence: well,
        generationKey: 'initial:secondLeft' as const,
        purchased: true,
      },
    ])
      source = applyProjectCommand(source, catalog, command);
    const raw = JSON.parse(encodeProjectDocument(source)) as {
      route: {
        routeKey: string;
        biomes: Array<{
          biomeKey: string;
          topology: {
            occurrences: Array<{
              occurrenceId: string;
              additionalExits: Array<{ kind: string; occurrenceId: string }>;
            }>;
            decisions: Array<{
              kind: string;
              source?: { kind: string; occurrenceId?: string };
              selection?: unknown;
            }>;
          } | null;
        }>;
      };
    };
    const h = raw.route.biomes.find((biome) => biome.biomeKey === 'H')?.topology;
    const intro = h?.occurrences.find((occurrence) => occurrence.occurrenceId === goldenHStartId);
    const chaos = intro?.additionalExits.find((exit) => exit.kind === 'chaos');
    if (h == null || intro === undefined || chaos === undefined)
      throw new Error('expected generated H Intro Spark');
    intro.additionalExits = [];
    h.occurrences = h.occurrences.filter(
      (occurrence) => occurrence.occurrenceId !== chaos.occurrenceId,
    );
    const introDecision = h.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.source?.kind === 'occurrence' &&
        decision.source.occurrenceId === goldenHStartId,
    );
    if (introDecision === undefined) throw new Error('expected H Intro decision');
    introDecision.selection = { kind: 'derived' };
    library.choose({ fileName: 'ixion.runplanner.json', json: JSON.stringify(raw) });
    const application = createApplication({ projectLibrary: library.adapter });

    await expect(application.projectOperations.importPlan()).resolves.toMatchObject({
      status: 'success',
    });
    expect(
      presentProject(application)
        .route.biomes.find((biome) => biome.biomeKey === 'H')
        ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === goldenHStartId)
        ?.additionalExits,
    ).toEqual([expect.objectContaining({ kind: 'chaos', key: 'chaos' })]);
  });

  it('reports retained generated choices needing repair when opening a schema-86 plan', async () => {
    const library = createMemoryProjectLibrary();
    const legacy = JSON.parse(
      encodeProjectDocument(
        createProjectDocument(catalog, {
          configuredBiomeCount: 1,
          projectId: 'legacy-generated-allocations',
          routeKey: 'Underworld',
        }),
      ),
    ) as Record<string, unknown>;
    legacy.schemaVersion = 86;
    library.choose({ fileName: 'legacy.runplanner.json', json: JSON.stringify(legacy) });
    const application = createApplication({ projectLibrary: library.adapter });

    await expect(application.projectOperations.importPlan()).resolves.toEqual({
      operation: 'importPlan',
      status: 'success',
      message:
        'Migrated the plan to schema 98; retained encounter choices may need missing fields repaired.',
    });
    legacy.schemaVersion = 87;
    library.choose({ fileName: 'legacy.runplanner.json', json: JSON.stringify(legacy) });
    await expect(application.projectOperations.importPlan()).resolves.toEqual({
      operation: 'importPlan',
      status: 'success',
      message: 'Migrated the plan to schema 98.',
    });
    const hubLegacy = legacyRareEpicHexTrees(
      JSON.parse(encodeProjectDocument(loadSurfaceNProject())),
    ) as {
      schemaVersion: number;
      route: { biomes: { topology: { decisions: Record<string, unknown>[] } | null }[] };
    };
    hubLegacy.schemaVersion = 87;
    for (const biome of hubLegacy.route.biomes)
      for (const decision of biome.topology?.decisions ?? []) {
        if (decision.kind !== 'hub') continue;
        decision.visitOrder = (decision.actions as { hubSlotKey?: string }[]).flatMap((action) =>
          action.hubSlotKey === undefined ? [] : [action.hubSlotKey],
        );
        delete decision.actions;
      }
    library.choose({ fileName: 'legacy.runplanner.json', json: JSON.stringify(hubLegacy) });
    await expect(application.projectOperations.importPlan()).resolves.toEqual({
      operation: 'importPlan',
      status: 'success',
      message:
        'Migrated the plan to schema 98; the Hub fountain use is placed before the first visit, so an Aromatic Phial target may need repair.',
    });

    // A schema-88 Hub already has its authored fountain placement, so no repair is named.
    const hub88 = legacyRareEpicHexTrees(
      JSON.parse(encodeProjectDocument(loadSurfaceNProject())),
    ) as Record<string, unknown>;
    hub88.schemaVersion = 88;
    library.choose({ fileName: 'legacy.runplanner.json', json: JSON.stringify(hub88) });
    await expect(application.projectOperations.importPlan()).resolves.toEqual({
      operation: 'importPlan',
      status: 'success',
      message: 'Migrated the plan to schema 98.',
    });
  });

  it('reopens the last plan at startup, and reports one it cannot read', async () => {
    const { application, library } = createLibraryApplication();
    await application.projectOperations.createNew('Surface');
    const opened = presentProject(application);
    application.dispose();

    const reopened = createApplication({ projectLibrary: library.adapter });
    await reopened.startupReady;
    expect(presentProject(reopened)).toEqual(opened);
    reopened.dispose();

    const plans = await library.adapter.list();
    await library.adapter.write(plans[0]!.key, '{"schemaVersion":98,"projectId":"x","name":"x"}');
    const broken = createApplication({ projectLibrary: library.adapter });
    await broken.startupReady;
    expect(broken.store.getState().projectWorkspace.kind).toBe('noProject');
    expect(broken.store.getState().librarySession.openError).toMatch(
      /^Could not reopen the last plan: /,
    );

    // A plan the library no longer holds is no plan.
    await broken.projectOperations.forgetLastOpened();
    const fresh = createApplication({ projectLibrary: library.adapter });
    await fresh.startupReady;
    expect(fresh.store.getState().projectWorkspace.kind).toBe('noProject');
    expect(fresh.store.getState().librarySession.openError).toBeNull();
  });

  it('offers the file open before the library once, importing or declining it', async () => {
    const previous = {
      fileName: 'Earlier.runplanner.json',
      json: encodeProjectDocument({ ...loadSurfaceNProject(), projectId: 'earlier' }),
    };
    const library = createMemoryProjectLibrary({ previousFile: previous });
    const declining = createApplication({ projectLibrary: library.adapter });
    await declining.startupReady;
    expect(declining.store.getState().librarySession.previousFileOffer).toEqual({
      fileName: 'Earlier.runplanner.json',
    });
    await declining.projectOperations.declinePreviousFile();
    expect(declining.store.getState().librarySession.previousFileOffer).toBeNull();
    const later = createApplication({ projectLibrary: library.adapter });
    await later.startupReady;
    expect(later.store.getState().librarySession.previousFileOffer).toBeNull();
    await expect(later.projectOperations.acceptPreviousFile()).resolves.toMatchObject({
      status: 'failure',
    });

    const accepting = createMemoryProjectLibrary({ previousFile: previous });
    const application = createApplication({ projectLibrary: accepting.adapter });
    await application.startupReady;
    await expect(application.projectOperations.acceptPreviousFile()).resolves.toMatchObject({
      operation: 'importPrevious',
      status: 'success',
    });
    expect(presentProject(application).projectId).toBe('earlier');
    expect(application.store.getState().librarySession.previousFileOffer).toBeNull();
    expect((await accepting.adapter.readSession()).previousFileOffered).toBe(true);
  });
});

describe('sending to the game', () => {
  it('publishes an explicit Aetos biome target', async () => {
    const game = createFakeGameModuleHost();
    const application = createApplication({ gameModuleHost: game.host });
    application.store.dispatch(
      authoredProjectReplaced(
        applyProjectCommand(loadSurfaceNOPProject(), catalog, {
          kind: 'ReplaceAetosWave',
          phase: createEncounterPhaseAddress(
            pBiome,
            { kind: 'occurrence', occurrenceId: pOccurrenceId('P_Combat03', 1, 1) },
            'Combat',
          ),
          value: 2,
        }),
      ),
    );
    expect(application.projectOperations.inspectCurrentGamePlan().kind).toBe('publishable');
    await expect(application.projectOperations.publishGame(1)).resolves.toMatchObject({
      status: 'success',
    });
    expect(game.published).toHaveLength(1);
  });

  it('publishes while retaining an unpicked Aetos choice outside the execution surface', async () => {
    const game = createFakeGameModuleHost();
    const application = createApplication({ gameModuleHost: game.host });
    const phase = createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pOccurrenceId('P_Combat06', 2, 2) },
      'Combat',
    );
    const project = applyProjectCommand(loadSurfaceNOPProject(), catalog, {
      kind: 'ReplaceAetosWave',
      phase,
      value: 2,
    });
    application.store.dispatch(authoredProjectReplaced(project));
    expect(application.projectOperations.inspectCurrentGamePlan().kind).toBe('publishable');
    await expect(application.projectOperations.publishGame(1)).resolves.toMatchObject({
      status: 'success',
    });
    expect(game.published).toHaveLength(1);
    expect(
      selectPresentProject(application.store.getState())
        ?.route.biomes.find((biome) => biome.biomeKey === 'P')
        ?.topology?.occurrences.find((room) => room.occurrenceId === phase.owner.occurrenceId)
        ?.encounters.aetosWaveByPhase,
    ).toEqual({ Combat: 2 });
  });

  it('publishes a complete F prefix as it stands, writing nothing and recording only the send', async () => {
    const game = createFakeGameModuleHost();
    const { application, library, saves } = createLibraryApplication({ gameModuleHost: game.host });
    const complete = createCompleteFGProject();
    const key = await library.file({
      ...complete,
      route: { ...complete.route, biomes: complete.route.biomes.slice(0, 1) },
    });
    await application.projectOperations.openPlan(key);
    application.store.dispatch(rename('Erebus opener'));
    await application.projectOperations.flush();
    application.store.dispatch(rename('Erebus opener, edited'));
    const beforePublication = application.store.getState();
    const writes = library.writes.length;

    const current = application.projectOperations.inspectCurrentGamePlan();
    expect(current.kind).toBe('publishable');
    expect(application.projectOperations.inspectCurrentGamePlan()).toBe(current);
    await expect(application.projectOperations.publishGame(3)).resolves.toEqual({
      operation: 'publishGame',
      status: 'success',
      message: 'Published to game, Slot 3.',
    });
    expect(game.published).toHaveLength(1);
    const publication = game.published[0];
    if (publication === undefined) throw new Error('publication was not recorded');
    expect(publication.slotNumber).toBe(3);
    expect(JSON.parse(publication.json)).toMatchObject({
      planFingerprint: current.kind === 'publishable' ? current.planFingerprint : null,
      format: EXECUTION_PLAN_FORMAT,
      catalogVersion: application.catalog.version,
      routeKey: 'Underworld',
      extent: { biomeKeys: ['F'] },
      displayName: 'Erebus opener, edited',
    });
    // The summary names the plan as sent, for the slot overview.
    expect(publication.summary).toMatchObject({
      route: application.catalog.routes.byKey.Underworld!.label,
      endBiome: application.catalog.biomes.byKey.F!.label,
      sentAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
    });
    expect(publication.summary.label).toMatch(/ - Underworld$/);
    // The source beside the slot is the document as sent and the options it compiled with.
    const source = decodeSlotSource(publication.sourceJson);
    expect(typeof source.internalRunModifiers).toBe('boolean');
    expect(JSON.parse(source.projectJson)).toEqual(
      JSON.parse(encodeProjectDocument(presentProject(application))),
    );
    expect(source.displayName).toBeUndefined();
    // Sending records only UI-session state and writes nothing itself.
    expect(application.store.getState().gameSendSession.lastSentSlot).toBe(3);
    expect(application.store.getState().editorSession).toBe(beforePublication.editorSession);
    expect(application.store.getState().projectWorkspace).toBe(beforePublication.projectWorkspace);
    expect(library.writes).toHaveLength(writes);
    expect(saves.hasPending()).toBe(true);
  });

  it('publishes a valid Dream prefix through the game capability', async () => {
    const game = createFakeGameModuleHost();
    const application = createApplication({ gameModuleHost: game.host });
    application.store.dispatch(authoredProjectReplaced(dreamMixedPrefixProject()));

    await expect(application.projectOperations.publishGame(3)).resolves.toEqual({
      operation: 'publishGame',
      status: 'success',
      message: 'Published to game, Slot 3.',
    });
    expect(game.published).toHaveLength(1);
    expect(JSON.parse(game.published[0]!.json)).toMatchObject({
      routeKey: 'Dream',
      extent: { biomeKeys: ['Q'] },
      selectedOccurrenceIds: expect.arrayContaining(['dream-q-preboss:postboss']),
    });
  });

  it('sends a Fresh File plan only once it compiles', async () => {
    const game = createFakeGameModuleHost();
    const { application } = createLibraryApplication({ gameModuleHost: game.host });
    await expect(application.projectOperations.createNew('FreshFile')).resolves.toMatchObject({
      status: 'success',
    });
    const created = selectPresentProject(application.store.getState());
    expect(created?.route).toMatchObject({
      routeKey: 'FreshFile',
      itineraryBiomeKeys: ['F', 'G', 'H', 'I'],
      loadout: { weaponKey: null, aspectKey: null, startingKeepsakeKey: null },
    });
    expect(created?.route.biomes[0]?.topology?.occurrences[0]?.gameName).toBe('F_Opening01');
    expect(application.projectOperations.inspectCurrentGamePlan()).toMatchObject({
      kind: 'notPublishable',
    });
    await expect(application.projectOperations.publishGame(1)).resolves.toMatchObject({
      operation: 'publishGame',
      status: 'failure',
    });
    expect(game.published).toHaveLength(0);

    application.store.dispatch(authoredProjectReplaced(createFreshFileRouteProject()));
    await expect(application.projectOperations.publishGame(2)).resolves.toMatchObject({
      status: 'success',
    });
    const published = JSON.parse(game.published.at(-1)!.json);
    expect(published).toMatchObject({ routeKey: 'FreshFile', startingKeepsake: {} });
    expect(published.startingLoadout).not.toHaveProperty('aspectKey');
  });

  it('reports the host blockers when the established target is not ready', async () => {
    const blocked = gameModuleStatus({
      publicationBlockers: [
        { code: 'moduleMismatch', found: '0.10.0', required: '0.1.0' },
        { code: 'modpackLibOlder', found: '4.0.1', required: '4.1.0' },
      ],
    });
    const game = createFakeGameModuleHost(blocked, {
      status: 'blocked',
      message: 'The game target is not ready for publication.',
      blockers: blocked.publicationBlockers,
      activationProblem: null,
    });
    const application = createApplication({ gameModuleHost: game.host });
    const complete = createCompleteFGProject();
    application.store.dispatch(
      authoredProjectReplaced({
        ...complete,
        route: { ...complete.route, biomes: complete.route.biomes.slice(0, 1) },
      }),
    );

    await expect(application.projectOperations.publishGame(2)).resolves.toEqual({
      operation: 'publishGame',
      status: 'failure',
      message:
        'Update the game module in the Game panel (found 0.10.0). ' +
        'Update ModpackLib to 4.1.0+ in r2modman (found 4.0.1).',
    });
  });

  it('rejects an invalid publication before invoking the game writer', async () => {
    const game = createFakeGameModuleHost();
    const { application } = createLibraryApplication({ gameModuleHost: game.host });
    expect(application.projectOperations.inspectCurrentGamePlan()).toEqual({ kind: 'noProject' });
    await application.projectOperations.createNew('Underworld');
    expect(application.projectOperations.inspectCurrentGamePlan()).toEqual({
      kind: 'notPublishable',
      code: 'notEligible',
    });
    const failure = await application.projectOperations.publishGame(1);
    expect(failure.message).toMatch(/^Send to game failed: /);
    expect(game.published).toHaveLength(0);
  });
});

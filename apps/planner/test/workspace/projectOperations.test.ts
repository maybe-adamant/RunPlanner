import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createOccurrenceAddress,
  createEncounterPhaseAddress,
  createRouteAddress,
  createProjectDocument,
  encodeProjectDocument,
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
import { createInitialProject } from '@planner/composition/projectBootstrap';
import { decodeExecutionPlan, EXECUTION_PLAN_FORMAT } from '@run-planner/engine/execution-plan';
import { createFakeGameModuleHost, gameModuleStatus } from '@planner-test/fixtures/gameModuleHost';
import { createFakeProfileFiles } from '@planner-test/fixtures/profileFiles';
import type {
  AutosaveRecoveryAdapter,
  AutosaveScheduler,
} from '@planner/persistence/autosaveRecovery';
import {
  createProjectOperations,
  DEFAULT_AUTOSAVE_EXPORT_FILE_NAME,
  DEFAULT_PROFILE_FILE_NAME,
} from '@planner/workspace/projectOperations';
import type { ProfileFileAdapter, ProfileFileReference } from '@planner/persistence/profileFile';
import {
  authoredProjectCommandDispatched,
  authoredProjectRedoRequested,
  authoredProjectReplaced,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import { newProjectCreated, profileSaveSucceeded } from '@planner/state/profileSessionSlice';
import {
  selectExplicitProfileBaselineJson,
  selectPresentProject,
  selectProjectEvaluation,
  selectProjectHistory,
  selectProfileSession,
  selectProfileStatus,
} from '@planner/state/store';
import {
  loadSurfaceNProject,
  loadSurfaceNOPProject,
  pBiome,
  pOccurrenceId,
} from '@run-planner/test-fixtures/surface';

it('publishes an explicit Aetos biome target', async () => {
  const profile = createProfileFixture();
  const game = createFakeGameModuleHost();
  const application = createApplication({
    gameModuleHost: game.host,
    profileFile: profile.adapter,
  });
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
  expect(profile.saves).toHaveLength(1);
});

it('publishes while retaining an unpicked Aetos choice outside the execution surface', async () => {
  const profile = createProfileFixture();
  const game = createFakeGameModuleHost();
  const application = createApplication({
    gameModuleHost: game.host,
    profileFile: profile.adapter,
  });
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

interface ProfileFixture {
  readonly adapter: ProfileFileAdapter;
  readonly saves: { fileName: string; json: string }[];
  saveAsCount(): number;
  setLoadJson(json: string | null, fileName?: string): void;
  setSaveCancelled(cancelled: boolean): void;
}

function profileAdapter(
  overrides: Pick<ProfileFileAdapter, 'load' | 'saveAs'>,
): ProfileFileAdapter {
  return {
    clearActive: () => Promise.resolve(),
    restoreActive: () => Promise.resolve({ status: 'none' }),
    supportsSaveAs: true,
    ...overrides,
  };
}

function createProfileFixture(): ProfileFixture {
  let loadJson: string | null = null;
  let loadFileName = 'loaded-route.runplanner.json';
  let saveCancelled = false;
  let saveAsCount = 0;
  const saves: { fileName: string; json: string }[] = [];
  const referenceFor = (fileName: string): ProfileFileReference => ({
    activate: () => Promise.resolve(),
    fileName,
    write: (json) => {
      saves.push({ fileName, json });
      return Promise.resolve();
    },
  });
  return {
    adapter: {
      clearActive: () => Promise.resolve(),
      saveAs: (fileName, json) => {
        saveAsCount += 1;
        if (saveCancelled) return Promise.resolve(null);
        saves.push({ fileName, json });
        return Promise.resolve(referenceFor(fileName));
      },
      load: () =>
        Promise.resolve(
          loadJson === null ? null : { file: referenceFor(loadFileName), json: loadJson },
        ),
      restoreActive: () => Promise.resolve({ status: 'none' }),
      supportsSaveAs: true,
    },
    saves,
    saveAsCount: () => saveAsCount,
    setLoadJson: (json, fileName = 'loaded-route.runplanner.json') => {
      loadJson = json;
      loadFileName = fileName;
    },
    setSaveCancelled: (cancelled) => {
      saveCancelled = cancelled;
    },
  };
}

function configureF(application: ReturnType<typeof createApplication>): void {
  application.store.dispatch(
    newProjectCreated(
      createInitialProject(catalog, {
        projectId: 'configured-f',
        routeKey: 'Underworld',
      }),
    ),
  );
  application.store.dispatch(
    authoredProjectCommandDispatched({
      kind: 'ConfigureRoutePrefix',
      route: createRouteAddress('Underworld'),
      configuredBiomeCount: 1,
    }),
  );
}

function presentProject(application: ReturnType<typeof createApplication>) {
  const project = selectPresentProject(application.store.getState());
  if (project === undefined) throw new Error('expected an open project');
  return project;
}

function presentEvaluation(application: ReturnType<typeof createApplication>) {
  const evaluation = selectProjectEvaluation(application.store.getState());
  if (evaluation === undefined) throw new Error('expected a project evaluation');
  return evaluation;
}

function presentHistory(application: ReturnType<typeof createApplication>) {
  const history = selectProjectHistory(application.store.getState());
  if (history === undefined) throw new Error('expected project history');
  return history;
}

function createPublicationAutosaveFixture(): {
  readonly recovery: AutosaveRecoveryAdapter;
  readonly scheduler: AutosaveScheduler & { readonly pendingCount: number };
} {
  const tasks: { cancelled: boolean; task: () => void }[] = [];
  const recovery: AutosaveRecoveryAdapter = {
    read: () => null,
    write: () => undefined,
    clear: () => undefined,
  };
  const scheduler = {
    get pendingCount() {
      return tasks.filter((entry) => !entry.cancelled).length;
    },
    schedule: (_delayMs: number, task: () => void) => {
      const entry = { cancelled: false, task };
      tasks.push(entry);
      return () => {
        entry.cancelled = true;
      };
    },
  } satisfies AutosaveScheduler & { readonly pendingCount: number };
  return { recovery, scheduler };
}

describe('project profile operations', () => {
  it('creates and loads a legal Dream Dive while rejecting a non-public itinerary atomically', async () => {
    const profile = createProfileFixture();
    const application = createApplication({ profileFile: profile.adapter });
    await application.projectOperations.createNew('Underworld');
    const beforeInvalidDream = selectPresentProject(application.store.getState());
    await expect(
      application.projectOperations.createNew('Dream', ['F', 'G', 'N', 'P']),
    ).resolves.toMatchObject({
      status: 'failure',
    });
    expect(selectPresentProject(application.store.getState())).toBe(beforeInvalidDream);
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
    expect(selectPresentProject(application.store.getState())?.route.biomes).toHaveLength(2);
    application.store.dispatch(authoredProjectUndoRequested());
    expect(selectPresentProject(application.store.getState())?.route).toMatchObject({
      itineraryBiomeKeys: ['Q', 'F', 'N', 'H'],
      biomes: [{ biomeKey: 'Q' }],
    });
    const loadedDream = createProjectDocument(catalog, {
      projectId: 'loaded-dream',
      routeKey: 'Dream',
      itineraryBiomeKeys: ['Q', 'F', 'N', 'H'],
      configuredBiomeCount: 2,
    });
    profile.setLoadJson(encodeProjectDocument(loadedDream));
    await expect(application.projectOperations.loadProfile()).resolves.toMatchObject({
      status: 'success',
    });
    expect(selectPresentProject(application.store.getState())?.route).toMatchObject({
      itineraryBiomeKeys: ['Q', 'F', 'N', 'H'],
    });
  });

  it('publishes a complete F prefix through the separate game capability', async () => {
    const profile = createProfileFixture();
    const autosave = createPublicationAutosaveFixture();
    const game = createFakeGameModuleHost();
    const application = createApplication({
      gameModuleHost: game.host,
      profileFile: profile.adapter,
      autosaveRecovery: autosave.recovery,
      autosaveScheduler: autosave.scheduler,
    });
    const complete = createCompleteFGProject();
    application.store.dispatch(
      authoredProjectReplaced({
        ...complete,
        route: { ...complete.route, biomes: complete.route.biomes.slice(0, 1) },
      }),
    );
    await expect(application.projectOperations.saveProfile()).resolves.toMatchObject({
      status: 'success',
    });
    const beforePublication = application.store.getState();
    const beforeWorkspace = beforePublication.projectWorkspace;
    const beforeHistory = presentHistory(application);
    const beforeBaseline = selectExplicitProfileBaselineJson(beforePublication);
    const beforeProfileSession = selectProfileSession(beforePublication);
    const beforePendingAutosaves = autosave.scheduler.pendingCount;
    const beforeAutosaveWrites = profile.saves.length;

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
    });
    // Sending records only UI-session state; authored state and history are untouched.
    expect(application.store.getState().gameSendSession.lastSentSlot).toBe(3);
    expect(application.store.getState().editorSession).toBe(beforePublication.editorSession);
    expect(application.store.getState().projectWorkspace).toBe(beforeWorkspace);
    expect(presentHistory(application)).toBe(beforeHistory);
    expect(selectExplicitProfileBaselineJson(application.store.getState())).toBe(beforeBaseline);
    expect(selectProfileSession(application.store.getState())).toBe(beforeProfileSession);
    expect(autosave.scheduler.pendingCount).toBe(beforePendingAutosaves);
    expect(profile.saves).toHaveLength(beforeAutosaveWrites);

    // Publication does not replace the active host-file reference: the next
    // explicit save still writes in place rather than opening a new file.
    await expect(application.projectOperations.saveProfile()).resolves.toMatchObject({
      status: 'success',
    });
    expect(profile.saveAsCount()).toBe(1);
    expect(profile.saves.at(-1)?.fileName).toBe(DEFAULT_PROFILE_FILE_NAME);
  });

  it('publishes a valid Dream prefix through the game capability', async () => {
    const profile = createProfileFixture();
    const game = createFakeGameModuleHost();
    const application = createApplication({
      gameModuleHost: game.host,
      profileFile: profile.adapter,
    });
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

  it('creates, saves and loads a Fresh File project and sends it only once it compiles', async () => {
    const profile = createProfileFixture();
    const game = createFakeGameModuleHost();
    const application = createApplication({
      gameModuleHost: game.host,
      profileFile: profile.adapter,
    });
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

    // A new Fresh File project is incomplete, so it does not compile yet.
    expect(application.projectOperations.inspectCurrentGamePlan()).toMatchObject({
      kind: 'notPublishable',
    });
    await expect(application.projectOperations.publishGame(1)).resolves.toMatchObject({
      operation: 'publishGame',
      status: 'failure',
    });
    expect(game.published).toHaveLength(0);
    // Refusing to send saves nothing on the way.
    expect(profile.saves).toHaveLength(0);

    await expect(application.projectOperations.saveProfile()).resolves.toMatchObject({
      status: 'success',
    });
    const savedJson = profile.saves.at(-1)?.json;
    expect(savedJson).toBe(encodeProjectDocument(created!));
    profile.setLoadJson(savedJson!);
    await expect(application.projectOperations.loadProfile()).resolves.toMatchObject({
      status: 'success',
    });
    expect(selectPresentProject(application.store.getState())).toEqual(created);

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
    const profile = createProfileFixture();
    const application = createApplication({
      gameModuleHost: game.host,
      profileFile: profile.adapter,
    });
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
        'Saved, but not sent: ' +
        'Update the game module in the Game panel (found 0.10.0). ' +
        'Update ModpackLib to 4.1.0+ in r2modman (found 4.0.1).',
    });
  });

  it('rejects an invalid publication before invoking the game writer', async () => {
    const game = createFakeGameModuleHost();
    const application = createApplication({ gameModuleHost: game.host });
    expect(application.projectOperations.inspectCurrentGamePlan()).toEqual({ kind: 'noProject' });
    await application.projectOperations.createNew('Underworld');
    expect(application.projectOperations.inspectCurrentGamePlan()).toEqual({
      kind: 'notPublishable',
      code: 'notEligible',
    });
    const failure = await application.projectOperations.publishGame(1);
    expect(failure.message).toMatch(/^Send to game failed: /);

    await expect(application.projectOperations.publishGame(1)).resolves.toMatchObject({
      operation: 'publishGame',
      status: 'failure',
    });
    expect(game.published).toHaveLength(0);
  });

  it('reuses one host file reference until New clears it', async () => {
    let activationCount = 0;
    let clearCount = 0;
    let saveAsCount = 0;
    let writeCount = 0;
    const profileFile: ProfileFileAdapter = {
      clearActive: () => {
        clearCount += 1;
        return Promise.resolve();
      },
      saveAs: (fileName) => {
        saveAsCount += 1;
        return Promise.resolve({
          activate: () => {
            activationCount += 1;
            return Promise.resolve();
          },
          fileName,
          write: () => {
            writeCount += 1;
            return Promise.resolve();
          },
        });
      },
      load: () => Promise.resolve(null),
      restoreActive: () => Promise.resolve({ status: 'none' }),
      supportsSaveAs: true,
    };
    const application = createApplication({ profileFile });

    configureF(application);
    await application.projectOperations.saveProfile();
    await application.projectOperations.saveProfile();
    expect({ activationCount, clearCount, saveAsCount, writeCount }).toEqual({
      activationCount: 1,
      clearCount: 0,
      saveAsCount: 1,
      writeCount: 1,
    });

    await application.projectOperations.createNew('Surface');
    await application.projectOperations.saveProfile();
    expect({ activationCount, clearCount, saveAsCount, writeCount }).toEqual({
      activationCount: 2,
      clearCount: 1,
      saveAsCount: 2,
      writeCount: 1,
    });
  });

  it('mints a unique identity for each new project, which saving keeps', async () => {
    let minted = 0;
    const profile = createProfileFixture();
    const application = createApplication({
      profileFile: profile.adapter,
      mintProjectId: () => `minted-${++minted}`,
    });
    await application.projectOperations.createNew('Underworld');
    expect(presentProject(application).projectId).toBe('minted-1');
    await application.projectOperations.createNew('Surface');
    expect(presentProject(application).projectId).toBe('minted-2');
    await application.projectOperations.saveProfile();
    await application.projectOperations.saveProfile();
    expect(presentProject(application).projectId).toBe('minted-2');
    expect(
      profile.saves.map((save) => (JSON.parse(save.json) as { projectId: string }).projectId),
    ).toEqual(['minted-2', 'minted-2']);
  });

  it('sends a Save As copy under the identity its save wrote', async () => {
    const game = createFakeGameModuleHost();
    const files = createFakeProfileFiles();
    const application = createApplication({
      gameModuleHost: game.host,
      profileFile: files.adapter,
      mintProjectId: () => 'minted-copy',
    });
    const complete = createCompleteFGProject();
    await files.openSaved(
      application,
      {
        ...complete,
        projectId: 'original-run',
        route: { ...complete.route, biomes: complete.route.biomes.slice(0, 1) },
      },
      'Original.runplanner.json',
    );
    files.chooseSaveAs('Copy run.runplanner.json');
    await expect(application.projectOperations.saveProfileAs()).resolves.toMatchObject({
      status: 'success',
    });
    application.store.dispatch(
      profileSaveSucceeded({ baselineJson: '{}', fileName: 'Copy run.runplanner.json' }),
    );
    await expect(application.projectOperations.publishGame(2)).resolves.toMatchObject({
      status: 'success',
    });
    const written = JSON.parse(files.writes.at(-1)!.json) as { projectId: string };
    const sent = decodeExecutionPlan(JSON.parse(game.published[0]!.json));
    expect(files.writes.at(-1)?.fileName).toBe('Copy run.runplanner.json');
    expect(written.projectId).toBe('minted-copy');
    expect(presentProject(application).projectId).toBe('minted-copy');
    expect(sent.projectId).toBe('minted-copy');
    expect(sent.displayName).toBe('Copy run');
    expect(application.projectOperations.inspectCurrentGamePlan()).toMatchObject({
      projectId: 'minted-copy',
      planFingerprint: sent.planFingerprint,
    });
  });

  it('runs one explicit save at a time, so a later Save writes the file a pending Save As chose', async () => {
    let resolveSaveAs: ((file: ProfileFileReference) => void) | undefined;
    const writes: { fileName: string; json: string }[] = [];
    const reference = (fileName: string): ProfileFileReference => ({
      activate: () => Promise.resolve(),
      fileName,
      write: (json) => {
        writes.push({ fileName, json });
        return Promise.resolve();
      },
    });
    const application = createApplication({
      mintProjectId: () => 'minted-copy',
      profileFile: {
        clearActive: () => Promise.resolve(),
        load: () => Promise.resolve(null),
        restoreActive: () => Promise.resolve({ status: 'none' }),
        saveAs: (fileName, json) => {
          writes.push({ fileName, json });
          return new Promise((resolve) => {
            resolveSaveAs = resolve;
          });
        },
        supportsSaveAs: true,
      },
    });
    configureF(application);
    const firstSave = application.projectOperations.saveProfile();
    const secondSave = application.projectOperations.saveProfile();
    await Promise.resolve();
    expect(writes).toHaveLength(1);
    resolveSaveAs?.(reference('Chosen.runplanner.json'));
    await expect(firstSave).resolves.toMatchObject({ status: 'success' });
    await expect(secondSave).resolves.toMatchObject({ status: 'success' });
    expect(writes.map((write) => write.fileName)).toEqual([
      DEFAULT_PROFILE_FILE_NAME,
      'Chosen.runplanner.json',
    ]);
  });

  it('reports a save failure and a publish failure after saving distinctly', async () => {
    const game = createFakeGameModuleHost();
    let failWrite = true;
    const application = createApplication({
      gameModuleHost: game.host,
      mintProjectId: () => 'minted-x',
      profileFile: {
        clearActive: () => Promise.resolve(),
        load: () =>
          Promise.resolve({
            file: {
              activate: () => Promise.resolve(),
              fileName: 'Run.runplanner.json',
              write: () => (failWrite ? Promise.reject(new Error('disk full')) : Promise.resolve()),
            },
            json: encodeProjectDocument({
              ...createCompleteFGProject(),
              projectId: 'unique-run',
              route: {
                ...createCompleteFGProject().route,
                biomes: createCompleteFGProject().route.biomes.slice(0, 1),
              },
            }),
          }),
        restoreActive: () => Promise.resolve({ status: 'none' }),
        saveAs: () => Promise.resolve(null),
        supportsSaveAs: true,
      },
    });
    await application.projectOperations.loadProfile();
    application.store.dispatch(
      profileSaveSucceeded({ baselineJson: '{}', fileName: 'Run.runplanner.json' }),
    );
    const notSaved = await application.projectOperations.publishGame(1);
    expect(notSaved.status).toBe('failure');
    expect(notSaved.message).toMatch(/^Not saved, so not sent: Save Profile failed: disk full/);
    expect(game.published).toHaveLength(0);

    failWrite = false;
    game.host.publish.mockResolvedValueOnce({
      status: 'nativeWrite',
      message: 'could not write plan slot.',
      blockers: [],
      activationProblem: null,
    });
    await expect(application.projectOperations.publishGame(1)).resolves.toEqual({
      operation: 'publishGame',
      status: 'failure',
      message: 'Saved, but not sent: could not write plan slot.',
    });
    expect(application.store.getState().gameSendSession.lastFailure).toMatchObject({
      message: 'Saved, but not sent: could not write plan slot.',
    });
    await application.projectOperations.publishGame(1);
    expect(application.store.getState().gameSendSession.lastFailure).toBeNull();
  });

  it('reports a Save As that wrote the file but could not activate it', async () => {
    const application = createApplication({
      profileFile: {
        clearActive: () => Promise.resolve(),
        load: () => Promise.resolve(null),
        restoreActive: () => Promise.resolve({ status: 'none' }),
        saveAs: () =>
          Promise.resolve({
            activate: () => Promise.reject(new Error('scope denied')),
            fileName: 'Copy.runplanner.json',
            write: () => Promise.resolve(),
          }),
        supportsSaveAs: true,
      },
    });
    configureF(application);
    await expect(application.projectOperations.saveProfileAs()).resolves.toEqual({
      operation: 'saveProfileAs',
      status: 'failure',
      message:
        'Save As wrote Copy.runplanner.json but could not make it the active file: scope denied',
    });
    expect(selectProfileStatus(application.store.getState())).toBe('Unsaved');
  });

  it('Save As always chooses a new target and makes later Save write that target', async () => {
    const saveAsCalls: { fileName: string; json: string }[] = [];
    const writes: { fileName: string; json: string }[] = [];
    const activations: string[] = [];
    let saveAsCount = 0;
    const referenceFor = (fileName: string): ProfileFileReference => ({
      activate: () => {
        activations.push(fileName);
        return Promise.resolve();
      },
      fileName,
      write: (json) => {
        writes.push({ fileName, json });
        return Promise.resolve();
      },
    });
    const profileFile: ProfileFileAdapter = {
      clearActive: () => Promise.resolve(),
      load: () => Promise.resolve(null),
      restoreActive: () => Promise.resolve({ status: 'none' }),
      saveAs: (suggestedFileName, json) => {
        const saveAsIndex = saveAsCount++;
        const fileName =
          saveAsIndex === 0
            ? 'route-a.runplanner.json'
            : saveAsIndex === 1
              ? 'route-b.runplanner.json'
              : 'route-c.runplanner.json';
        saveAsCalls.push({ fileName: suggestedFileName, json });
        return Promise.resolve(referenceFor(fileName));
      },
      supportsSaveAs: true,
    };
    const application = createApplication({ profileFile, mintProjectId: () => 'copy-b' });
    configureF(application);
    expect(application.projectOperations.saveAsAvailable).toBe(true);
    const originalId = presentProject(application).projectId;

    await expect(application.projectOperations.saveProfile()).resolves.toMatchObject({
      status: 'success',
    });
    // The first save of a never-saved project keeps its identity.
    expect(presentProject(application).projectId).toBe(originalId);
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceFearVowRank',
        route: createRouteAddress('Underworld'),
        vowKey: 'EnemyDamageShrineUpgrade',
        rank: 1,
      }),
    );
    const saveAsSnapshot = presentProject(application);
    // Save As from a saved file mints a new identity for the copy.
    const saveAsJson = encodeProjectDocument({ ...saveAsSnapshot, projectId: 'copy-b' });

    await expect(application.projectOperations.saveProfileAs()).resolves.toEqual({
      operation: 'saveProfileAs',
      status: 'success',
      message: 'Saved as a new file.',
    });
    expect(saveAsCalls).toHaveLength(2);
    expect(saveAsCalls[1]?.fileName).toBe('route-a.runplanner.json');
    expect(saveAsCalls[1]?.json).toBe(saveAsJson);
    expect(activations).toEqual(['route-a.runplanner.json', 'route-b.runplanner.json']);
    expect(selectProfileSession(application.store.getState()).fileName).toBe(
      'route-b.runplanner.json',
    );
    expect(selectExplicitProfileBaselineJson(application.store.getState())).toBe(saveAsJson);
    expect(presentProject(application).projectId).toBe('copy-b');
    expect(selectProfileStatus(application.store.getState())).toBe('Clean');
    application.store.dispatch(authoredProjectUndoRequested());
    expect(presentProject(application).projectId).toBe('copy-b');
    application.store.dispatch(authoredProjectRedoRequested());

    await application.projectOperations.saveProfile();
    expect(writes).toEqual([{ fileName: 'route-b.runplanner.json', json: saveAsJson }]);

    await application.projectOperations.createNew('Surface');
    await application.projectOperations.saveProfile();
    expect(saveAsCalls[2]?.fileName).toBe(DEFAULT_PROFILE_FILE_NAME);
    // New projects mint their identity at creation, and their first save keeps it.
    expect(presentProject(application).projectId).toBe('copy-b');
    expect(activations).toEqual([
      'route-a.runplanner.json',
      'route-b.runplanner.json',
      'route-c.runplanner.json',
    ]);
  });

  it('preserves the active target and baseline when Save As is cancelled or fails', async () => {
    let mode: 'success' | 'cancel' | 'writeFailure' | 'activationFailure' = 'success';
    const writes: { fileName: string; json: string }[] = [];
    const referenceFor = (fileName: string): ProfileFileReference => ({
      activate: () =>
        mode === 'activationFailure'
          ? Promise.reject(new Error('activation denied'))
          : Promise.resolve(),
      fileName,
      write: (json) => {
        writes.push({ fileName, json });
        return Promise.resolve();
      },
    });
    const profileFile: ProfileFileAdapter = {
      clearActive: () => Promise.resolve(),
      load: () => Promise.resolve(null),
      restoreActive: () => Promise.resolve({ status: 'none' }),
      saveAs: (_suggestedFileName, json) => {
        if (mode === 'cancel') return Promise.resolve(null);
        if (mode === 'writeFailure') return Promise.reject(new Error('save denied'));
        return Promise.resolve(referenceFor(`route-${json.length}.runplanner.json`));
      },
      supportsSaveAs: true,
    };
    const application = createApplication({ profileFile });
    configureF(application);
    await application.projectOperations.saveProfile();
    const baseline = selectExplicitProfileBaselineJson(application.store.getState());
    const stateAfterInitialSave = application.store.getState();

    mode = 'cancel';
    await expect(application.projectOperations.saveProfileAs()).resolves.toEqual({
      operation: 'saveProfileAs',
      status: 'cancelled',
      message: 'Save As cancelled.',
    });
    expect(application.store.getState()).toBe(stateAfterInitialSave);
    expect(selectExplicitProfileBaselineJson(application.store.getState())).toBe(baseline);

    mode = 'writeFailure';
    await expect(application.projectOperations.saveProfileAs()).resolves.toEqual({
      operation: 'saveProfileAs',
      status: 'failure',
      message: 'Save As failed: save denied',
    });
    expect(application.store.getState()).toBe(stateAfterInitialSave);
    expect(selectExplicitProfileBaselineJson(application.store.getState())).toBe(baseline);

    mode = 'activationFailure';
    await expect(application.projectOperations.saveProfileAs()).resolves.toEqual({
      operation: 'saveProfileAs',
      status: 'failure',
      message: expect.stringMatching(
        /^Save As wrote .+ but could not make it the active file: activation denied$/,
      ),
    });
    expect(application.store.getState()).toBe(stateAfterInitialSave);
    expect(selectExplicitProfileBaselineJson(application.store.getState())).toBe(baseline);

    mode = 'success';
    await application.projectOperations.saveProfile();
    expect(writes).toHaveLength(1);
    expect(writes[0]?.json).toBe(baseline);
  });

  it('binds Save As to its invocation snapshot without marking concurrent edits clean', async () => {
    let saveAsCount = 0;
    let resolvePendingSaveAs: ((file: ProfileFileReference) => void) | undefined;
    const writes: { fileName: string; json: string }[] = [];
    const referenceFor = (fileName: string): ProfileFileReference => ({
      activate: () => Promise.resolve(),
      fileName,
      write: (json) => {
        writes.push({ fileName, json });
        return Promise.resolve();
      },
    });
    const application = createApplication({
      mintProjectId: () => 'copy-b',
      profileFile: {
        clearActive: () => Promise.resolve(),
        load: () => Promise.resolve(null),
        restoreActive: () => Promise.resolve({ status: 'none' }),
        saveAs: () => {
          saveAsCount += 1;
          if (saveAsCount === 1) return Promise.resolve(referenceFor('route-a.runplanner.json'));
          return new Promise((resolve) => {
            resolvePendingSaveAs = resolve;
          });
        },
        supportsSaveAs: true,
      },
    });
    configureF(application);
    await application.projectOperations.saveProfile();
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceFearVowRank',
        route: createRouteAddress('Underworld'),
        vowKey: 'EnemyDamageShrineUpgrade',
        rank: 1,
      }),
    );
    const invocationJson = encodeProjectDocument({
      ...presentProject(application),
      projectId: 'copy-b',
    });

    const savingAs = application.projectOperations.saveProfileAs();
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceFearVowRank',
        route: createRouteAddress('Underworld'),
        vowKey: 'EnemyDamageShrineUpgrade',
        rank: 2,
      }),
    );
    const laterJson = encodeProjectDocument({
      ...presentProject(application),
      projectId: 'copy-b',
    });
    resolvePendingSaveAs?.(referenceFor('route-b.runplanner.json'));
    await expect(savingAs).resolves.toMatchObject({ status: 'success' });

    expect(selectExplicitProfileBaselineJson(application.store.getState())).toBe(invocationJson);
    expect(selectProfileSession(application.store.getState()).fileName).toBe(
      'route-b.runplanner.json',
    );
    expect(laterJson).not.toBe(invocationJson);
    expect(encodeProjectDocument(presentProject(application))).toBe(laterJson);

    await application.projectOperations.saveProfile();
    expect(writes).toEqual([{ fileName: 'route-b.runplanner.json', json: laterJson }]);
  });

  it('saves and loads only the normalized project with a fresh evaluation, history, and baseline', async () => {
    const profile = createProfileFixture();
    const application = createApplication({ profileFile: profile.adapter });
    configureF(application);
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ConfigureRoutePrefix',
        route: createRouteAddress('Underworld'),
        configuredBiomeCount: 2,
      }),
    );
    const savedProject = presentProject(application);
    const savedEvaluation = presentEvaluation(application);
    const savedJson = encodeProjectDocument(savedProject);

    await expect(application.projectOperations.saveProfile()).resolves.toEqual({
      operation: 'saveProfile',
      status: 'success',
      message: 'Saved the profile.',
    });
    expect(profile.saves).toEqual([{ fileName: DEFAULT_PROFILE_FILE_NAME, json: savedJson }]);
    expect(profile.saveAsCount()).toBe(1);
    expect(selectExplicitProfileBaselineJson(application.store.getState())).toBe(savedJson);
    expect(Object.keys(JSON.parse(savedJson))).toEqual([
      'schemaVersion',
      'projectId',
      'catalogVersion',
      'route',
    ]);

    await expect(application.projectOperations.createNew('Underworld')).resolves.toMatchObject({
      status: 'success',
    });
    expect(presentProject(application)).not.toEqual(savedProject);
    expect(selectExplicitProfileBaselineJson(application.store.getState())).toBeNull();
    expect(selectProfileSession(application.store.getState()).fileName).toBeNull();
    expect(presentHistory(application).past).toEqual([]);
    expect(presentHistory(application).future).toEqual([]);
    expect(presentProject(application).route.biomes.map((biome) => biome.biomeKey)).toEqual(['F']);
    expect(presentEvaluation(application).status).toBe('incomplete');
    profile.setLoadJson(savedJson, 'erebus-route.runplanner.json');

    await expect(application.projectOperations.loadProfile()).resolves.toEqual({
      operation: 'loadProfile',
      status: 'success',
      message: 'Loaded the profile.',
    });

    const state = application.store.getState();
    expect(selectPresentProject(state)).toEqual(savedProject);
    expect(selectProjectHistory(state)).toEqual({ past: [], present: savedProject, future: [] });
    expect(selectProjectEvaluation(state)).toEqual(savedEvaluation);
    expect(selectExplicitProfileBaselineJson(state)).toBe(savedJson);
    expect(selectProfileSession(state).fileName).toBe('erebus-route.runplanner.json');

    await application.projectOperations.saveProfile();
    expect(profile.saves.at(-1)).toEqual({
      fileName: 'erebus-route.runplanner.json',
      json: savedJson,
    });
    expect(profile.saveAsCount()).toBe(1);
  });

  it('loads a reached Steady Growth outcome at a blocked Shrine frontier', async () => {
    const profile = createProfileFixture();
    const checkpoint = surfaceCheckpointArtifacts['surface-p-steady-growth-shrine-frontier']
      .raw as {
      readonly route: Record<string, unknown>;
    };
    profile.setLoadJson(
      JSON.stringify({
        ...checkpoint,
        route: {
          ...checkpoint.route,
          itineraryBiomeKeys: catalog.routes.byKey.Surface!.biomeKeys,
        },
      }),
      'surface-p-steady-growth-shrine-frontier.runplanner.json',
    );
    const application = createApplication({ profileFile: profile.adapter });

    await expect(application.projectOperations.loadProfile()).resolves.toEqual({
      operation: 'loadProfile',
      status: 'success',
      message: 'Loaded the profile.',
    });
    const evaluation = selectProjectEvaluation(application.store.getState());
    const finding = evaluation?.findings.find(
      (candidate) =>
        candidate.code === 'steadyGrowthOutcomeMissing' &&
        candidate.origin.kind === 'steadyGrowthOutcome' &&
        candidate.origin.biomeKey === 'P',
    );
    if (finding?.origin.kind !== 'steadyGrowthOutcome') {
      throw new Error('loaded profile lost its reached P Steady Growth outcome');
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

  it('reconciles a pre-fix Ixion purchase into its forced gate while loading', async () => {
    const profile = createProfileFixture();
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
    profile.setLoadJson(JSON.stringify(raw));
    const application = createApplication({ profileFile: profile.adapter });

    await expect(application.projectOperations.loadProfile()).resolves.toMatchObject({
      status: 'success',
    });
    expect(
      presentProject(application)
        .route.biomes.find((biome) => biome.biomeKey === 'H')
        ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === goldenHStartId)
        ?.additionalExits,
    ).toEqual([expect.objectContaining({ kind: 'chaos', key: 'chaos' })]);
  });

  it('establishes the exact pending-save snapshot as baseline after a later edit', async () => {
    let resolveSave: ((file: ProfileFileReference) => void) | undefined;
    const saves: { fileName: string; json: string }[] = [];
    const profileFile = profileAdapter({
      saveAs: (fileName, json) => {
        saves.push({ fileName, json });
        return new Promise((resolve) => {
          resolveSave = resolve;
        });
      },
      load: () => Promise.resolve(null),
    });
    const application = createApplication({ profileFile });
    configureF(application);
    const pendingSnapshot = presentProject(application);
    const pendingJson = encodeProjectDocument(pendingSnapshot);

    const saving = application.projectOperations.saveProfile();
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceFearVowRank',
        route: createRouteAddress('Underworld'),
        vowKey: 'EnemyDamageShrineUpgrade',
        rank: 1,
      }),
    );
    resolveSave?.({
      activate: () => Promise.resolve(),
      fileName: DEFAULT_PROFILE_FILE_NAME,
      write: () => Promise.resolve(),
    });
    await expect(saving).resolves.toMatchObject({ status: 'success' });

    expect(saves).toEqual([{ fileName: 'run-plan.runplanner.json', json: pendingJson }]);
    expect(selectExplicitProfileBaselineJson(application.store.getState())).toBe(pendingJson);
    expect(presentProject(application)).not.toBe(pendingSnapshot);
  });

  it('preserves the current workspace and baseline across cancellation and adapter failure', async () => {
    const profile = createProfileFixture();
    const application = createApplication({ profileFile: profile.adapter });
    configureF(application);
    await application.projectOperations.saveProfile();
    const workspace = application.store.getState().projectWorkspace;
    const baseline = selectExplicitProfileBaselineJson(application.store.getState());

    profile.setLoadJson(null);
    await expect(application.projectOperations.loadProfile()).resolves.toMatchObject({
      operation: 'loadProfile',
      status: 'cancelled',
    });
    expect(application.store.getState().projectWorkspace).toBe(workspace);
    expect(selectExplicitProfileBaselineJson(application.store.getState())).toBe(baseline);

    const cancelledProfile = createProfileFixture();
    cancelledProfile.setSaveCancelled(true);
    const cancelled = createApplication({ profileFile: cancelledProfile.adapter });
    configureF(cancelled);
    const cancelledState = cancelled.store.getState();
    await expect(cancelled.projectOperations.saveProfile()).resolves.toMatchObject({
      operation: 'saveProfile',
      status: 'cancelled',
    });
    expect(cancelled.store.getState()).toBe(cancelledState);

    const failing = createApplication({
      profileFile: profileAdapter({
        saveAs: () => Promise.reject(new Error('save denied')),
        load: () => Promise.reject(new Error('load denied')),
      }),
    });
    await failing.projectOperations.createNew('Underworld');
    const failingState = failing.store.getState();
    await expect(failing.projectOperations.saveProfile()).resolves.toEqual({
      operation: 'saveProfile',
      status: 'failure',
      message: 'Save Profile failed: save denied',
    });
    await expect(failing.projectOperations.loadProfile()).resolves.toEqual({
      operation: 'loadProfile',
      status: 'failure',
      message: 'Load Profile failed: load denied',
    });
    expect(failing.store.getState()).toBe(failingState);
  });

  it('exports the untouched autosave without clearing recovery or changing project state', async () => {
    const rawAutosave = '{not json';
    let recoveryRaw: string | null = rawAutosave;
    let clearCount = 0;
    const profile = createProfileFixture();
    const application = createApplication({
      autosaveRecovery: {
        read: () => recoveryRaw,
        write: (json) => {
          recoveryRaw = json;
        },
        clear: () => {
          clearCount += 1;
          recoveryRaw = null;
        },
      },
      autosaveScheduler: { schedule: () => () => undefined },
      profileFile: profile.adapter,
    });
    const state = application.store.getState();

    await expect(application.projectOperations.exportAutosaveRecovery()).resolves.toEqual({
      operation: 'exportRecovery',
      status: 'success',
      message: 'Exported the autosave copy.',
    });

    expect(profile.saves).toEqual([
      { fileName: DEFAULT_AUTOSAVE_EXPORT_FILE_NAME, json: rawAutosave },
    ]);
    expect(application.store.getState()).toBe(state);
    expect(recoveryRaw).toBe(rawAutosave);
    expect(clearCount).toBe(0);

    profile.setSaveCancelled(true);
    await expect(application.projectOperations.exportAutosaveRecovery()).resolves.toEqual({
      operation: 'exportRecovery',
      status: 'cancelled',
      message: 'Export Autosave cancelled.',
    });
    expect(application.store.getState()).toBe(state);
    expect(recoveryRaw).toBe(rawAutosave);
    expect(clearCount).toBe(0);
  });

  it('rejects malformed profiles atomically', async () => {
    const profile = createProfileFixture();
    const application = createApplication({ profileFile: profile.adapter });
    configureF(application);
    await application.projectOperations.saveProfile();
    const state = application.store.getState();

    profile.setLoadJson('{not json');
    await expect(application.projectOperations.loadProfile()).resolves.toEqual({
      operation: 'loadProfile',
      status: 'failure',
      message: 'Load Profile failed: $: must be valid JSON',
    });
    expect(application.store.getState()).toBe(state);

    const stateProject = selectPresentProject(state);
    if (stateProject === undefined) throw new Error('expected an open project');
    profile.setLoadJson(encodeProjectDocument(stateProject), '  ');
    await expect(application.projectOperations.loadProfile()).resolves.toEqual({
      operation: 'loadProfile',
      status: 'failure',
      message: 'Load Profile failed: Loaded profile filename must be non-blank',
    });
    expect(application.store.getState()).toBe(state);
  });

  it('does not clear recovery or replace the native Save target when preparation fails', async () => {
    let recoveryRaw: string | null = '{bad recovery';
    let clearCount = 0;
    let establishedTargetWrites = 0;
    let rejectedTargetActivations = 0;
    let rejectedTargetWrites = 0;
    const recovery: AutosaveRecoveryAdapter = {
      read: () => recoveryRaw,
      write: (json) => {
        recoveryRaw = json;
      },
      clear: () => {
        clearCount += 1;
        recoveryRaw = null;
      },
    };
    const application = createApplication({
      autosaveRecovery: recovery,
      autosaveScheduler: { schedule: () => () => undefined },
    });
    await application.projectOperations.createNew('Underworld');
    const project = presentProject(application);
    const establishedFile: ProfileFileReference = {
      activate: () => Promise.resolve(),
      fileName: 'current.runplanner.json',
      write: () => {
        establishedTargetWrites += 1;
        return Promise.resolve();
      },
    };
    const rejectedFile: ProfileFileReference = {
      activate: () => {
        rejectedTargetActivations += 1;
        return Promise.resolve();
      },
      fileName: 'rejected.runplanner.json',
      write: () => {
        rejectedTargetWrites += 1;
        return Promise.resolve();
      },
    };
    const operations = createProjectOperations({
      autosaveRecovery: recovery,
      catalog,
      prepareProjectWorkspace: () => {
        throw new Error('workspace projection failed');
      },
      profileFile: profileAdapter({
        saveAs: () => Promise.resolve(establishedFile),
        load: () => Promise.resolve({ file: rejectedFile, json: encodeProjectDocument(project) }),
      }),
      store: application.store,
    });

    await expect(operations.saveProfile()).resolves.toMatchObject({ status: 'success' });
    const state = application.store.getState();
    await expect(operations.loadProfile()).resolves.toEqual({
      operation: 'loadProfile',
      status: 'failure',
      message: 'Load Profile failed: workspace projection failed',
    });

    expect(application.store.getState()).toBe(state);
    expect(recoveryRaw).toBe('{bad recovery');
    expect(clearCount).toBe(0);
    await expect(operations.saveProfile()).resolves.toMatchObject({ status: 'success' });
    expect(establishedTargetWrites).toBe(1);
    expect(rejectedTargetActivations).toBe(0);
    expect(rejectedTargetWrites).toBe(0);
  });

  it('restores blocked autosave and retains the prior target when native Load activation fails', async () => {
    let recoveryRaw: string | null = '{bad recovery';
    let priorTargetWrites = 0;
    const recovery: AutosaveRecoveryAdapter = {
      clear: () => {
        recoveryRaw = null;
      },
      read: () => recoveryRaw,
      write: (json) => {
        recoveryRaw = json;
      },
    };
    const application = createApplication({
      autosaveRecovery: recovery,
      autosaveScheduler: { schedule: () => () => undefined },
    });
    application.store.dispatch(
      newProjectCreated(
        createInitialProject(application.catalog, {
          projectId: 'history-project',
          routeKey: 'Underworld',
        }),
      ),
    );
    const project = presentProject(application);
    const workspace = application.store.getState().projectWorkspace;
    if (workspace.kind !== 'openProject') throw new Error('expected open workspace');
    const priorFile: ProfileFileReference = {
      activate: () => Promise.resolve(),
      fileName: 'prior.runplanner.json',
      write: () => {
        priorTargetWrites += 1;
        return Promise.resolve();
      },
    };
    const rejectedFile: ProfileFileReference = {
      activate: () => Promise.reject(new Error('activation denied')),
      fileName: 'rejected.runplanner.json',
      write: () => Promise.resolve(),
    };
    const operations = createProjectOperations({
      activeProfileFile: priorFile,
      autosaveRecovery: recovery,
      catalog,
      prepareProjectWorkspace: (loadedProject) => ({
        assembly: workspace.assembly,
        project: loadedProject,
      }),
      profileFile: profileAdapter({
        saveAs: () => Promise.resolve(null),
        load: () => Promise.resolve({ file: rejectedFile, json: encodeProjectDocument(project) }),
      }),
      store: application.store,
    });
    const state = application.store.getState();

    await expect(operations.loadProfile()).resolves.toEqual({
      operation: 'loadProfile',
      status: 'failure',
      message: 'Load Profile failed: activation denied',
    });
    expect(application.store.getState()).toBe(state);
    expect(recoveryRaw).toBe('{bad recovery');

    await expect(operations.saveProfile()).resolves.toMatchObject({ status: 'success' });
    expect(priorTargetWrites).toBe(1);
  });

  it('rejects unsupported old/future schemas and stale-catalog profiles without replacing the current workspace', async () => {
    const profile = createProfileFixture();
    const application = createApplication({ profileFile: profile.adapter });
    configureF(application);
    const state = application.store.getState();
    const currentProject = selectPresentProject(state);
    if (currentProject === undefined) throw new Error('expected an open project');
    const current = JSON.parse(encodeProjectDocument(currentProject)) as Record<string, unknown>;

    for (const json of [
      JSON.stringify({ ...current, schemaVersion: 8 }),
      JSON.stringify({ ...current, schemaVersion: 96 }),
      JSON.stringify({ ...current, catalogVersion: 'stale-catalog-version' }),
    ]) {
      profile.setLoadJson(json);
      await expect(application.projectOperations.loadProfile()).resolves.toMatchObject({
        operation: 'loadProfile',
        status: 'failure',
      });
      expect(application.store.getState()).toBe(state);
    }
  });

  it('reports retained generated choices needing repair when loading a schema-86 profile', async () => {
    const profile = createProfileFixture();
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
    profile.setLoadJson(JSON.stringify(legacy));
    const application = createApplication({ profileFile: profile.adapter });

    await expect(application.projectOperations.loadProfile()).resolves.toEqual({
      operation: 'loadProfile',
      status: 'success',
      message:
        'Migrated the profile to schema 95; retained encounter choices may need missing fields repaired.',
    });
    legacy.schemaVersion = 87;
    profile.setLoadJson(JSON.stringify(legacy));
    await expect(application.projectOperations.loadProfile()).resolves.toEqual({
      operation: 'loadProfile',
      status: 'success',
      message: 'Migrated the profile to schema 95.',
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
    profile.setLoadJson(JSON.stringify(hubLegacy));
    await expect(application.projectOperations.loadProfile()).resolves.toEqual({
      operation: 'loadProfile',
      status: 'success',
      message:
        'Migrated the profile to schema 95; the Hub fountain use is placed before the first visit, so an Aromatic Phial target may need repair.',
    });

    // A schema-88 Hub already has its authored fountain placement, so no repair is named.
    const hub88 = legacyRareEpicHexTrees(
      JSON.parse(encodeProjectDocument(loadSurfaceNProject())),
    ) as Record<string, unknown>;
    hub88.schemaVersion = 88;
    profile.setLoadJson(JSON.stringify(hub88));
    await expect(application.projectOperations.loadProfile()).resolves.toEqual({
      operation: 'loadProfile',
      status: 'success',
      message: 'Migrated the profile to schema 95.',
    });
  });

  it('saves before an update only when the project is unsaved, through the same save path', async () => {
    const profile = createProfileFixture();
    const application = createApplication({ profileFile: profile.adapter });
    expect(application.store.getState().projectWorkspace.kind).not.toBe('openProject');
    await expect(application.projectOperations.saveBeforeUpdate()).resolves.toEqual({
      operation: 'saveBeforeUpdate',
      status: 'success',
      message: 'No project is open.',
    });
    expect(profile.saveAsCount()).toBe(0);

    configureF(application);
    profile.setSaveCancelled(true);
    await expect(application.projectOperations.saveBeforeUpdate()).resolves.toEqual({
      operation: 'saveBeforeUpdate',
      status: 'cancelled',
      message: 'Update cancelled; the project was not saved.',
    });
    expect(selectProfileStatus(application.store.getState())).toBe('Unsaved');

    profile.setSaveCancelled(false);
    await expect(application.projectOperations.saveBeforeUpdate()).resolves.toMatchObject({
      status: 'success',
      message: 'Saved the profile.',
    });
    expect(profile.saveAsCount()).toBe(2);
    expect(selectProfileStatus(application.store.getState())).toBe('Clean');

    await expect(application.projectOperations.saveBeforeUpdate()).resolves.toMatchObject({
      status: 'success',
      message: 'The project is already saved.',
    });
    expect(profile.saves).toHaveLength(1);

    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ConfigureRoutePrefix',
        route: createRouteAddress('Underworld'),
        configuredBiomeCount: 2,
      }),
    );
    expect(selectProfileStatus(application.store.getState())).toBe('Dirty');
    await expect(application.projectOperations.saveBeforeUpdate()).resolves.toMatchObject({
      status: 'success',
    });
    expect(profile.saveAsCount()).toBe(2);
    expect(profile.saves).toHaveLength(2);
    expect(selectProfileStatus(application.store.getState())).toBe('Clean');
  });

  it('reports a failed save before an update', async () => {
    const application = createApplication({
      profileFile: profileAdapter({
        load: () => Promise.resolve(null),
        saveAs: () => Promise.reject(new Error('disk full')),
      }),
    });
    configureF(application);
    const saving = await application.projectOperations.saveBeforeUpdate();
    expect(saving.status).toBe('failure');
    expect(saving.message).toMatch(/^Not saved, so not updated: Save Profile failed: disk full/);
  });
});

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createOccurrenceAddress,
  createRouteAddress,
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

import { createApplication } from '../composition/createApplication';
import { createInitialProject } from '../composition/projectBootstrap';
import type { GamePlanPublisher } from '../persistence/gamePlanPublisher';
import type { AutosaveRecoveryAdapter, AutosaveScheduler } from '../persistence/autosaveRecovery';
import {
  createProjectOperations,
  DEFAULT_AUTOSAVE_EXPORT_FILE_NAME,
  DEFAULT_PROFILE_FILE_NAME,
} from './projectOperations';
import type { ProfileFileAdapter, ProfileFileReference } from '../persistence/profileFile';
import {
  authoredProjectCommandDispatched,
  authoredProjectReplaced,
} from '../state/projectWorkspaceSlice';
import { newProjectCreated } from '../state/profileSessionSlice';
import {
  selectExplicitProfileBaselineJson,
  selectPresentProject,
  selectProjectEvaluation,
  selectProjectHistory,
  selectProfileSession,
} from '../state/store';

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
  application.store.dispatch(newProjectCreated(createInitialProject(catalog, 'Underworld')));
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
  it('publishes a complete F prefix through the separate game capability', async () => {
    const published: { targetId: string; slotNumber: number; json: string }[] = [];
    const profile = createProfileFixture();
    const autosave = createPublicationAutosaveFixture();
    const gamePlanPublisher: GamePlanPublisher = {
      discoverProfiles: () =>
        Promise.resolve({ status: 'available', targets: [], message: 'Choose a profile.' }),
      publish: (targetId, slotNumber, json) => {
        published.push({ targetId, slotNumber, json });
        return Promise.resolve({
          status: 'published',
          message: `Published profile ${targetId} Slot ${slotNumber}.`,
        });
      },
    };
    const application = createApplication({
      gamePlanPublisher,
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

    await expect(application.projectOperations.publishGame('profile-a', 3)).resolves.toEqual({
      operation: 'publishGame',
      status: 'success',
      message: 'Published to game profile profile-a, Slot 3.',
    });
    expect(published).toHaveLength(1);
    const publication = published[0];
    if (publication === undefined) throw new Error('publication was not recorded');
    expect(JSON.parse(publication.json)).toMatchObject({
      routeKey: 'Underworld',
      extent: { biomeKeys: ['F'] },
    });
    expect(application.store.getState()).toBe(beforePublication);
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

  it('rejects an invalid publication before invoking the game writer', async () => {
    const published: { targetId: string; slotNumber: number; json: string }[] = [];
    const application = createApplication({
      gamePlanPublisher: {
        discoverProfiles: () =>
          Promise.resolve({ status: 'available', targets: [], message: 'Choose a profile.' }),
        publish: (targetId, slotNumber, json) => {
          published.push({ targetId, slotNumber, json });
          return Promise.resolve({ status: 'published', message: 'Published.' });
        },
      },
    });
    await application.projectOperations.createNew('Underworld');

    await expect(application.projectOperations.publishGame('profile-a', 1)).resolves.toMatchObject({
      operation: 'publishGame',
      status: 'failure',
    });
    expect(published).toHaveLength(0);
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

  it('saves and loads only the normalized project with a fresh evaluation, history, and baseline', async () => {
    const profile = createProfileFixture();
    const application = createApplication({ profileFile: profile.adapter });
    configureF(application);
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
    expect(presentEvaluation(application).status).toBe('empty');
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
    profile.setLoadJson(
      JSON.stringify(surfaceCheckpointArtifacts['surface-p-steady-growth-shrine-frontier'].raw),
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
    expect(candidates).toHaveLength(9);
    expect(candidates).toEqual(
      expect.arrayContaining([
        'AphroditeSpecialBoon',
        'BoonDecayBoon',
        'CastNovaBoon',
        'DamageSharePotencyBoon',
        'DoubleBoltBoon',
        'FocusCritBoon',
        'FocusLightningBoon',
        'HeraCastBoon',
        'SprintShieldBoon',
      ]),
    );

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
        candidate.origin.site.owner.occurrenceId === steadyGrowthOutcome.owner.occurrenceId,
    );
    if (deliveryFinding?.origin.kind !== 'acquisitionEntry') {
      throw new Error('loaded profile lost its due Shrine delivery placement');
    }
    const deliveryEntry = deliveryFinding.origin;
    expect(() =>
      application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'PlaceHermesShrineDelivery',
          entry: deliveryEntry,
          encounterPhaseKey: 'Combat',
        }),
      ),
    ).not.toThrow();
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
      newProjectCreated(createInitialProject(application.catalog, 'Underworld')),
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

  it('rejects schema-8 and stale-catalog profiles without replacing the current workspace', async () => {
    const profile = createProfileFixture();
    const application = createApplication({ profileFile: profile.adapter });
    configureF(application);
    const state = application.store.getState();
    const currentProject = selectPresentProject(state);
    if (currentProject === undefined) throw new Error('expected an open project');
    const current = JSON.parse(encodeProjectDocument(currentProject)) as Record<string, unknown>;

    for (const json of [
      JSON.stringify({ ...current, schemaVersion: 8 }),
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
});

import {
  createProjectDocument,
  createRouteAddress,
  encodeProjectDocument,
} from '@run-planner/engine/authored-project';
import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';

import {
  restoreStartupProject,
  type AutosaveRecoveryAdapter,
  type AutosaveScheduler,
} from './autosaveRecovery';
import { createApplication } from '../composition/createApplication';
import { settingsSelected } from '../state/editorSessionSlice';
import type { ProfileFileAdapter } from './profileFile';
import { profileSaveSucceeded } from '../state/profileSessionSlice';
import {
  authoredProjectCommandDispatched,
  authoredProjectUndoRequested,
} from '../state/projectWorkspaceSlice';
import {
  selectExplicitProfileBaselineJson,
  selectPresentProject,
  selectProfileSession,
  selectProfileStatus,
  selectProjectEvaluation,
  selectProjectHistory,
} from '../state/store';

interface RecoveryFixture extends AutosaveRecoveryAdapter {
  readonly writes: string[];
  readonly clearCount: number;
  raw: string | null;
  readError: Error | null;
  writeError: Error | null;
  clearError: Error | null;
}

function createRecoveryFixture(raw: string | null = null): RecoveryFixture {
  const writes: string[] = [];
  let clearCount = 0;
  return {
    raw,
    readError: null,
    writeError: null,
    clearError: null,
    writes,
    get clearCount() {
      return clearCount;
    },
    read() {
      if (this.readError !== null) {
        throw this.readError;
      }
      return this.raw;
    },
    write(json) {
      if (this.writeError !== null) {
        throw this.writeError;
      }
      writes.push(json);
      this.raw = json;
    },
    clear() {
      if (this.clearError !== null) {
        throw this.clearError;
      }
      clearCount += 1;
      this.raw = null;
    },
  };
}

interface SchedulerFixture extends AutosaveScheduler {
  readonly delays: number[];
  readonly cancellationCount: number;
  readonly pendingCount: number;
  flush(): void;
}

function createSchedulerFixture(): SchedulerFixture {
  const tasks: { cancelled: boolean; task: () => void }[] = [];
  const delays: number[] = [];
  let cancellationCount = 0;
  return {
    delays,
    get cancellationCount() {
      return cancellationCount;
    },
    get pendingCount() {
      return tasks.filter((entry) => !entry.cancelled).length;
    },
    schedule(delayMs, task) {
      delays.push(delayMs);
      const entry = { cancelled: false, task };
      tasks.push(entry);
      return () => {
        if (!entry.cancelled) {
          entry.cancelled = true;
          cancellationCount += 1;
        }
      };
    },
    flush() {
      const entry = tasks.findLast((candidate) => !candidate.cancelled);
      if (entry === undefined) {
        throw new Error('No autosave task is pending');
      }
      entry.cancelled = true;
      entry.task();
    },
  };
}

function configureF(application: ReturnType<typeof createApplication>): void {
  application.store.dispatch(
    authoredProjectCommandDispatched({
      kind: 'ConfigureRoutePrefix',
      route: createRouteAddress('Underworld'),
      configuredBiomeCount: 1,
    }),
  );
}

function setFearRank(application: ReturnType<typeof createApplication>, rank: number): void {
  application.store.dispatch(
    authoredProjectCommandDispatched({
      kind: 'ReplaceFearVowRank',
      route: createRouteAddress('Underworld'),
      vowKey: 'EnemyDamageShrineUpgrade',
      rank,
    }),
  );
}

describe('profile status', () => {
  it('derives clean and dirty from the normalized explicit baseline, including undo-to-clean', async () => {
    const profileFile: ProfileFileAdapter = {
      save: () => Promise.resolve('saved'),
      load: () => Promise.resolve(null),
    };
    const application = createApplication({ profileFile });

    expect(selectProfileStatus(application.store.getState())).toBe('Unsaved');
    configureF(application);
    await application.projectOperations.saveProfile();
    expect(selectProfileStatus(application.store.getState())).toBe('Clean');

    setFearRank(application, 1);
    expect(selectProfileStatus(application.store.getState())).toBe('Dirty');
    application.store.dispatch(authoredProjectUndoRequested());
    expect(selectProfileStatus(application.store.getState())).toBe('Clean');

    application.projectOperations.createNew();
    expect(selectProfileStatus(application.store.getState())).toBe('Unsaved');
  });
});

describe('autosave recovery lifecycle', () => {
  it('blocks and preserves schema-21 and stale-catalog autosaves without migrating either payload', () => {
    const fallback = createProjectDocument(catalog, {
      projectId: 'fallback',
      configuredBiomeCounts: { Underworld: 1 },
    });
    const current = JSON.parse(encodeProjectDocument(fallback)) as Record<string, unknown>;
    const legacy = createRecoveryFixture(
      JSON.stringify({ ...current, schemaVersion: 21, catalogVersion: catalog.version }),
    );
    const stale = createRecoveryFixture(
      JSON.stringify({ ...current, catalogVersion: 'stale-catalog-version' }),
    );

    for (const recovery of [legacy, stale]) {
      const startup = restoreStartupProject(fallback, catalog, recovery);
      expect(startup.project).toBe(fallback);
      expect(startup.profileSession.recoveryStatus).toBe('blocked');
      expect(recovery.raw).not.toBeNull();
      expect(recovery.clearCount).toBe(0);
    }
  });

  it('debounces only effective authored replacements and never changes the explicit baseline', () => {
    const recovery = createRecoveryFixture();
    const scheduler = createSchedulerFixture();
    const application = createApplication({
      autosaveDelayMs: 25,
      autosaveRecovery: recovery,
      autosaveScheduler: scheduler,
    });
    const baselineJson = encodeProjectDocument(selectPresentProject(application.store.getState()));

    application.store.dispatch(settingsSelected());
    application.store.dispatch(
      profileSaveSucceeded({ baselineJson, fileName: 'run-plan.runplanner.json' }),
    );
    expect(scheduler.delays).toEqual([]);

    configureF(application);
    expect(scheduler.delays).toEqual([25]);
    setFearRank(application, 1);
    expect(scheduler.delays).toEqual([25, 25]);
    expect(scheduler.cancellationCount).toBe(1);
    expect(scheduler.pendingCount).toBe(1);

    setFearRank(application, 1);
    expect(scheduler.delays).toEqual([25, 25]);
    scheduler.flush();
    expect(recovery.writes).toEqual([
      encodeProjectDocument(selectPresentProject(application.store.getState())),
    ]);
    expect(selectExplicitProfileBaselineJson(application.store.getState())).toBe(baselineJson);

    application.store.dispatch(authoredProjectUndoRequested());
    expect(scheduler.delays).toEqual([25, 25, 25]);
    application.dispose();
  });

  it('restores a valid project with fresh history and evaluation without writing on boot', () => {
    const source = createApplication();
    configureF(source);
    const recoveredProject = selectPresentProject(source.store.getState());
    const recovery = createRecoveryFixture(encodeProjectDocument(recoveredProject));
    const scheduler = createSchedulerFixture();

    const application = createApplication({
      autosaveRecovery: recovery,
      autosaveScheduler: scheduler,
    });
    const state = application.store.getState();

    expect(selectPresentProject(state)).toEqual(recoveredProject);
    expect(selectProjectHistory(state)).toEqual({
      past: [],
      present: recoveredProject,
      future: [],
    });
    expect(selectProjectEvaluation(state)).toEqual(
      source.store.getState().projectWorkspace.assembly.evaluation,
    );
    expect(selectProfileStatus(state)).toBe('Recovered');
    expect(selectExplicitProfileBaselineJson(state)).toBeNull();
    expect(scheduler.delays).toEqual([]);
    expect(recovery.writes).toEqual([]);

    setFearRank(application, 1);
    scheduler.flush();
    expect(selectProfileStatus(application.store.getState())).toBe('Recovered');
    expect(selectExplicitProfileBaselineJson(application.store.getState())).toBeNull();
  });

  it('preserves corrupt recovery and suspends writes until explicit discard', () => {
    const recovery = createRecoveryFixture('{not json');
    const scheduler = createSchedulerFixture();
    const application = createApplication({
      autosaveRecovery: recovery,
      autosaveScheduler: scheduler,
    });

    expect(selectProfileSession(application.store.getState())).toMatchObject({
      recoveryStatus: 'blocked',
      recoveryError: 'Autosave recovery failed: $: must be valid JSON',
    });
    expect(selectProjectEvaluation(application.store.getState()).status).toBe('empty');
    configureF(application);
    application.projectOperations.createNew();
    expect(recovery.raw).toBe('{not json');
    expect(recovery.writes).toEqual([]);
    expect(scheduler.delays).toEqual([]);

    expect(application.projectOperations.discardAutosaveRecovery()).toEqual({
      operation: 'discardRecovery',
      status: 'success',
      message: 'Discarded the unreadable autosave.',
    });
    expect(recovery.clearCount).toBe(1);
    expect(selectProfileSession(application.store.getState()).recoveryStatus).toBe('none');
    expect(selectProfileStatus(application.store.getState())).toBe('Unsaved');
    expect(scheduler.delays).toEqual([500]);
    scheduler.flush();
    expect(recovery.raw).toBe(
      encodeProjectDocument(selectPresentProject(application.store.getState())),
    );
  });

  it('blocks on recovery read failure and keeps the fallback editor available', () => {
    const recovery = createRecoveryFixture();
    recovery.readError = new Error('storage denied');
    const application = createApplication({
      autosaveRecovery: recovery,
      autosaveScheduler: createSchedulerFixture(),
    });

    expect(selectProfileSession(application.store.getState())).toMatchObject({
      recoveryStatus: 'blocked',
      recoveryError: 'Autosave recovery failed: storage denied',
    });
    expect(selectProjectEvaluation(application.store.getState()).status).toBe('empty');
    configureF(application);
    expect(selectPresentProject(application.store.getState()).routes[0]?.biomes).toHaveLength(1);
  });

  it('restores a structurally valid activated I recovery', () => {
    const iProject = createProjectDocument(catalog, {
      projectId: 'i-recovery',
      configuredBiomeCounts: { Underworld: 4 },
    });
    const recovery = createRecoveryFixture(encodeProjectDocument(iProject));
    const application = createApplication({
      autosaveRecovery: recovery,
      autosaveScheduler: createSchedulerFixture(),
    });

    expect(selectProfileSession(application.store.getState()).recoveryStatus).toBe('recovered');
    expect(selectPresentProject(application.store.getState())).toEqual(iProject);
    expect(selectProjectEvaluation(application.store.getState()).status).toBe('incomplete');
    expect(recovery.raw).toBe(encodeProjectDocument(iProject));
  });

  it('reports autosave write failure without losing edits and clears it after a later success', () => {
    const recovery = createRecoveryFixture();
    recovery.writeError = new Error('quota exceeded');
    const scheduler = createSchedulerFixture();
    const application = createApplication({
      autosaveRecovery: recovery,
      autosaveScheduler: scheduler,
    });

    configureF(application);
    const editedProject = selectPresentProject(application.store.getState());
    scheduler.flush();
    expect(selectPresentProject(application.store.getState())).toBe(editedProject);
    expect(selectProfileSession(application.store.getState()).autosaveError).toBe(
      'Autosave failed: quota exceeded',
    );

    recovery.writeError = null;
    setFearRank(application, 1);
    scheduler.flush();
    expect(selectProfileSession(application.store.getState()).autosaveError).toBeNull();
    expect(recovery.writes).toHaveLength(1);
  });

  it('clears a corrupt recovery only after a valid profile has decoded', async () => {
    const validSource = createApplication();
    configureF(validSource);
    const validJson = encodeProjectDocument(selectPresentProject(validSource.store.getState()));
    const recovery = createRecoveryFixture('{bad recovery');
    const scheduler = createSchedulerFixture();
    const application = createApplication({
      autosaveRecovery: recovery,
      autosaveScheduler: scheduler,
      profileFile: {
        save: () => Promise.resolve('saved'),
        load: () => Promise.resolve({ fileName: 'valid-profile.runplanner.json', json: validJson }),
      },
    });

    await expect(application.projectOperations.loadProfile()).resolves.toMatchObject({
      status: 'success',
    });
    expect(recovery.clearCount).toBe(1);
    expect(selectProfileSession(application.store.getState()).recoveryStatus).toBe('none');
    expect(selectProfileStatus(application.store.getState())).toBe('Clean');
    expect(scheduler.delays).toEqual([500]);
  });

  it('preserves the current workspace and corrupt value when clearing recovery fails', async () => {
    const source = createApplication();
    configureF(source);
    const validJson = encodeProjectDocument(selectPresentProject(source.store.getState()));
    const recovery = createRecoveryFixture('{bad recovery');
    recovery.clearError = new Error('clear denied');
    const application = createApplication({
      autosaveRecovery: recovery,
      autosaveScheduler: createSchedulerFixture(),
      profileFile: {
        save: () => Promise.resolve('saved'),
        load: () => Promise.resolve({ fileName: 'valid-profile.runplanner.json', json: validJson }),
      },
    });
    const state = application.store.getState();

    await expect(application.projectOperations.loadProfile()).resolves.toEqual({
      operation: 'loadProfile',
      status: 'failure',
      message: 'Load Profile failed: clear denied',
    });
    expect(application.store.getState()).toBe(state);
    expect(recovery.raw).toBe('{bad recovery');
  });
});

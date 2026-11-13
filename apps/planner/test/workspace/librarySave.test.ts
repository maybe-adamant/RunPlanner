import {
  createProjectAddress,
  createProjectDocument,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it, vi } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import {
  summarizeProjectJson,
  type ProjectLibraryAdapter,
} from '@planner/persistence/projectLibrary';
import {
  authoredProjectCommandDispatched,
  authoredProjectReplaced,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import { createLibrarySaver } from '@planner/workspace/librarySave';
import {
  createManualSaveScheduler,
  createMemoryProjectLibrary,
} from '@planner-test/support/memoryProjectLibrary';

/** A plan named this one cannot be shown: its workspace projection throws, as a defect's would. */
const UNSHOWABLE = 'Unshowable';

vi.mock(
  '@planner/projections/structured-workspace',
  async (
    importOriginal: () => Promise<typeof import('@planner/projections/structured-workspace')>,
  ) => {
    const original = await importOriginal();
    return {
      ...original,
      createStructuredWorkspaceProjection: (
        ...args: Parameters<typeof original.createStructuredWorkspaceProjection>
      ) => {
        const service = original.createStructuredWorkspaceProjection(...args);
        return Object.freeze({
          ...service,
          project: (assembly: Parameters<typeof service.project>[0]) => {
            if (assembly.project.name === UNSHOWABLE) throw new Error('projection defect');
            return service.project(assembly);
          },
        });
      },
    };
  },
);

/** Records the saver's library calls in order; each call fails while `failing` is set. */
function recordingAdapter() {
  const calls: string[] = [];
  let failing: Error | null = null;
  const adapter = {
    write(key: string, json: string) {
      if (failing !== null) return Promise.reject(failing);
      calls.push(`write ${key}`);
      return Promise.resolve({ key, modifiedMs: 1, content: summarizeProjectJson(json) });
    },
    preserveOriginal(key: string) {
      if (failing !== null) return Promise.reject(failing);
      calls.push(`preserve ${key}`);
      return Promise.resolve();
    },
  } as unknown as ProjectLibraryAdapter;
  return {
    adapter,
    calls,
    fail: (error: Error | null) => {
      failing = error;
    },
  };
}

function setup(admit: (project: ProjectDocument) => void = () => undefined) {
  const application = createApplication();
  const recording = recordingAdapter();
  const saver = createLibrarySaver({
    adapter: recording.adapter,
    delayMs: 0,
    scheduler: createManualSaveScheduler().scheduler,
    store: application.store,
    admit,
  });
  const open = (key: string, project: ProjectDocument, preserveOriginal: boolean) =>
    saver.open(key, () => application.store.dispatch(authoredProjectReplaced(project)), {
      preserveOriginal,
    });
  const rename = (name: string) =>
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'RenameProject',
        project: createProjectAddress(),
        name,
      }),
    );
  return { application, open, recording, rename, saver };
}

const plan = (projectId: string) =>
  createProjectDocument(catalog, { projectId, routeKey: 'Underworld', configuredBiomeCount: 1 });

describe('library saver', () => {
  it('keeps an older-schema original once, before its first write', async () => {
    const { open, recording, rename, saver } = setup();
    await open('old', plan('old'), true);
    expect(recording.calls).toEqual([]);
    rename('First');
    await saver.flush();
    rename('Second');
    await saver.flush();
    expect(recording.calls).toEqual(['preserve old', 'write old', 'write old']);

    await open('current', plan('current'), false);
    rename('Third');
    await saver.flush();
    expect(recording.calls.slice(3)).toEqual(['write current']);
  });

  it('writes nothing over the original until it is kept, retrying both', async () => {
    const { application, open, recording, rename, saver } = setup();
    await open('old', plan('old'), true);
    recording.fail(new Error('trash unavailable'));
    rename('First');
    await expect(saver.flush()).rejects.toThrow('trash unavailable');
    expect(recording.calls).toEqual([]);
    expect(application.store.getState().librarySession.writeError).toBe(
      'Could not save the plan: trash unavailable',
    );

    recording.fail(null);
    await saver.flush();
    expect(recording.calls).toEqual(['preserve old', 'write old']);
    expect(application.store.getState().librarySession.writeError).toBeNull();
  });

  it('follows a move of the open plan and stops writing once it is closed', async () => {
    const { open, recording, rename, saver } = setup();
    await open('Practice/plan', plan('moved'), false);
    saver.moved('Practice/plan', 'Speedrun/plan');
    rename('Moved');
    await saver.flush();
    expect(recording.calls).toEqual(['write Speedrun/plan']);

    saver.close();
    rename('Closed');
    await saver.flush();
    expect(recording.calls).toEqual(['write Speedrun/plan']);
    expect(saver.openKey()).toBeNull();
  });

  it('never writes a plan its admission refuses, keeping the last written one', async () => {
    const { application, open, recording, rename, saver } = setup((project) => {
      if (project.name === UNSHOWABLE) throw new Error('projection defect');
    });
    await open('plan', plan('plan'), false);
    rename('Shown');
    await saver.flush();
    expect(recording.calls).toEqual(['write plan']);

    rename(UNSHOWABLE);
    // A refusal does not reject, so it never holds the library or the window.
    await saver.flush();
    expect(recording.calls).toEqual(['write plan']);
    expect(application.store.getState().librarySession.writeError).not.toBeNull();
    expect(saver.refusedPresent()).toBe(true);
    expect(saver.hasUnwrittenEdits()).toBe(true);

    // Undoing back to the written plan leaves nothing unsaved.
    application.store.dispatch(authoredProjectUndoRequested());
    await saver.flush();
    expect(recording.calls).toEqual(['write plan']);
    expect(application.store.getState().librarySession.writeError).toBeNull();
    expect(saver.hasUnwrittenEdits()).toBe(false);

    rename(UNSHOWABLE);
    await saver.flush();
    rename('Shown again');
    await saver.flush();
    expect(recording.calls).toEqual(['write plan', 'write plan']);
    expect(application.store.getState().librarySession.writeError).toBeNull();

    // Opening another plan drops a refused edit instead of failing on it.
    rename(UNSHOWABLE);
    await saver.flush();
    await open('other', plan('other'), false);
    expect(saver.openKey()).toBe('other');
    expect(recording.calls).toEqual(['write plan', 'write plan']);
  });
});

describe('library saving with the application admission', () => {
  it('keeps the stored plan openable when an edit cannot be shown', async () => {
    const library = createMemoryProjectLibrary();
    const saves = createManualSaveScheduler();
    const application = createApplication({
      projectLibrary: library.adapter,
      saveScheduler: saves.scheduler,
    });
    const operations = application.projectOperations;
    await operations.createNew('Underworld');
    const key = operations.openKey()!;
    const stored = await library.plan(catalog, key);
    const writes = library.writes.length;

    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'RenameProject',
        project: createProjectAddress(),
        name: UNSHOWABLE,
      }),
    );
    saves.run();
    // Closing the window, leaving for the Library or reloading all flush the same way.
    const flushed = await operations.flush();
    expect(flushed.status).toBe('failure');
    expect(library.writes).toHaveLength(writes);
    expect(await library.plan(catalog, key)).toEqual(stored);
    expect(application.store.getState().librarySession.writeError).not.toBeNull();

    // Opening the plan again shows it as stored.
    await expect(operations.openPlan(key)).resolves.toMatchObject({ status: 'success' });
    expect(application.store.getState().projectWorkspace).toMatchObject({
      kind: 'openProject',
      history: { present: stored },
    });
    expect(application.store.getState().librarySession.writeError).toBeNull();
    expect((await operations.flush()).status).toBe('success');
  });
});

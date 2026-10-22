import {
  createProjectAddress,
  createProjectDocument,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import {
  summarizeProjectJson,
  type ProjectLibraryAdapter,
} from '@planner/persistence/projectLibrary';
import {
  authoredProjectCommandDispatched,
  authoredProjectReplaced,
} from '@planner/state/projectWorkspaceSlice';
import { createLibrarySaver } from '@planner/workspace/librarySave';
import { createManualSaveScheduler } from '@planner-test/support/memoryProjectLibrary';

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

function setup() {
  const application = createApplication();
  const recording = recordingAdapter();
  const saver = createLibrarySaver({
    adapter: recording.adapter,
    delayMs: 0,
    onRefiled: () => undefined,
    scheduler: createManualSaveScheduler().scheduler,
    store: application.store,
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
});

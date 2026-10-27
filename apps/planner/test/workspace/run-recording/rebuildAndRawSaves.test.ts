import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { createMemoryRecordHost } from '@planner-test/support/memoryRecordHost';
import { sampleSaveBytes } from '@planner-test/support/syntheticSave';
import {
  createRecordingSessionReducer,
  type RecordingSessionState,
} from '@planner/state/recordingSessionSlice';
import type { PlannerStore } from '@planner/state/store';
import { createRecordingController } from '@planner/workspace/run-recording/recordingController';
import { decodeRecentRunEntry } from '@planner/workspace/run-recording/recentRuns';
import {
  createInProcessRunImporter,
  type RunImporter,
} from '@planner/workspace/run-recording/runImport';

const RUN_ID = 'p1-1793057328-1002';
const OPENING = ['002', '004', '006', '009', '011'];
const SAVE = 'Profile1_Temp.sav';

/**
 * A recording controller over a memory host, keeping raw saves as a development composition
 * does when `rawSaves` is set. The trimmed captures end at N_Hub, so runs are kept there.
 */
function setup(options: {
  readonly rawSaves: boolean;
  readonly importer?: RunImporter;
  readonly host?: ReturnType<typeof createMemoryRecordHost>;
}) {
  const reducer = createRecordingSessionReducer();
  let state: RecordingSessionState = reducer(undefined, { type: 'init' });
  const dispatch = ((action: Parameters<typeof reducer>[1]) => {
    state = reducer(state, action);
    return action;
  }) as PlannerStore['dispatch'];
  const host = options.host ?? createMemoryRecordHost();
  const controller = createRecordingController({
    host,
    preference: { read: () => ({ enabled: true, folder: null }), write: () => undefined },
    store: { dispatch },
    importer: options.importer ?? createInProcessRunImporter(catalog),
    prebossRooms: new Map([['N', new Set(['N_Hub'])]]),
    savedValuePaths: new Map(),
    ...(options.rawSaves ? { rawSaves: host.rawSaves } : {}),
    delay: () => Promise.resolve(),
  });
  const deliver = async (bytes: Uint8Array) => {
    host.deliver({ fileName: SAVE, bytes });
    await controller.idle();
  };
  return {
    host,
    controller,
    state: () => state,
    deliver,
    stored: () => decodeRecentRunEntry(host.recentRuns.files.get(RUN_ID)!),
    rawFiles: (folder: string) => [...(host.rawSaves.folderFiles.get(folder)?.keys() ?? [])],
    /** Plays run 1002's opening, then starts run 1003, which closes it. */
    async playRun() {
      await controller.start();
      for (const id of OPENING) await deliver(sampleSaveBytes(`surface-${id}`));
      await deliver(sampleSaveBytes('surface-002', { runCount: 1003 }));
    },
  };
}

describe('rebuilding a stored run', () => {
  it('replaces the plan and report from the stored record and keeps the record', async () => {
    const context = setup({ rawSaves: false });
    await context.playRun();
    const recorded = context.stored();
    expect(recorded.project).toBeDefined();
    context.host.recentRuns.files.set(
      RUN_ID,
      JSON.stringify({ ...recorded, project: '{"stale":true}', report: { entries: [] } }),
    );

    await context.controller.rebuildRun(RUN_ID);

    const rebuilt = context.stored();
    expect(rebuilt.record).toEqual(recorded.record);
    expect(rebuilt.project).toBe(recorded.project);
    expect(rebuilt.report).toEqual(recorded.report);
    expect(rebuilt.importKind).toBe(recorded.importKind);
    expect(context.state().recentRuns).toMatchObject([
      { id: RUN_ID, reportCount: recorded.report!.entries.length },
    ]);
  });

  it('keeps the old plan and reports why when the import fails', async () => {
    const real = createInProcessRunImporter(catalog);
    const context = setup({
      rawSaves: false,
      importer: {
        importRun: (run) => real.importRun(run),
        importRecord: () => Promise.resolve({ kind: 'failed', message: 'the importer broke' }),
      },
    });
    await context.playRun();
    const before = context.host.recentRuns.files.get(RUN_ID);

    await expect(context.controller.rebuildRun(RUN_ID)).rejects.toThrow(
      'Run 1002 could not be rebuilt: the importer broke',
    );
    expect(context.host.recentRuns.files.get(RUN_ID)).toBe(before);
  });

  it('rebuilds from the raw saves when they were kept, without the stored record', async () => {
    const context = setup({ rawSaves: true });
    await context.playRun();
    const recorded = context.stored();
    const { record: _record, project: _project, ...bare } = recorded;
    void [_record, _project];
    context.host.recentRuns.files.set(
      RUN_ID,
      JSON.stringify({ ...bare, failure: 'an older importer failed' }),
    );

    await context.controller.rebuildRun(RUN_ID);

    expect(context.stored()).toEqual(recorded);
  });

  it('falls back to the stored record when the run has no raw saves', async () => {
    const context = setup({ rawSaves: true });
    await context.playRun();
    const recorded = context.stored();
    context.host.rawSaves.folderFiles.delete(RUN_ID);
    context.host.recentRuns.files.set(
      RUN_ID,
      JSON.stringify({ ...recorded, project: '{"stale":true}' }),
    );

    await context.controller.rebuildRun(RUN_ID);

    expect(context.stored().project).toBe(recorded.project);
  });
});

describe('raw save capture', () => {
  it('keeps an open run’s saves, moves them to the kept run and deletes them with it', async () => {
    const context = setup({ rawSaves: true });
    await context.controller.start();
    for (const id of OPENING) await context.deliver(sampleSaveBytes(`surface-${id}`));
    const opening = context.rawFiles('open-p1');
    expect(opening[0]).toBe(`000-${SAVE}`);
    expect(opening.length).toBeGreaterThan(1);
    expect(context.host.rawSaves.folderFiles.get('open-p1')!.get(`000-${SAVE}`)).toEqual(
      sampleSaveBytes('surface-002'),
    );

    await context.deliver(sampleSaveBytes('surface-002', { runCount: 1003 }));
    // Run 1002's saves went with it; run 1003's start begins a fresh folder.
    expect(context.rawFiles(RUN_ID)).toEqual(opening);
    expect(context.rawFiles('open-p1')).toEqual([`000-${SAVE}`]);

    await context.controller.deleteRun(RUN_ID);
    expect(context.host.rawSaves.folderFiles.has(RUN_ID)).toBe(false);
  });

  it('deletes the raw saves of a run rolling off the limit', async () => {
    const context = setup({ rawSaves: true });
    // Twenty older runs fill the store; the oldest has raw saves.
    for (let index = 0; index < 20; index += 1)
      context.host.recentRuns.files.set(`p1-${1_000 + index}-${index}`, '{}');
    await context.host.rawSaves.write('p1-1000-0', `000-${SAVE}`, Uint8Array.of(1));
    await context.playRun();
    expect(context.host.recentRuns.files.has('p1-1000-0')).toBe(false);
    expect(context.host.rawSaves.folderFiles.has('p1-1000-0')).toBe(false);
    expect(context.rawFiles(RUN_ID).length).toBeGreaterThan(0);
  });

  it('deletes the raw saves of a run below the threshold', async () => {
    const context = setup({ rawSaves: true });
    await context.controller.start();
    await context.deliver(sampleSaveBytes('surface-002'));
    await context.deliver(sampleSaveBytes('surface-002', { runCount: 1003 }));
    expect([...context.host.rawSaves.folderFiles.keys()]).toEqual(['open-p1']);
    expect(context.host.recentRuns.files.has(RUN_ID)).toBe(false);
  });

  it('removes raw saves of runs neither stored nor open when recording starts', async () => {
    const host = createMemoryRecordHost();
    await host.rawSaves.write('open-p4', `000-${SAVE}`, Uint8Array.of(1));
    await host.rawSaves.write('p9-1-1', `000-${SAVE}`, Uint8Array.of(1));
    const context = setup({ rawSaves: true, host });
    await context.playRun();
    expect([...host.rawSaves.folderFiles.keys()].sort()).toEqual(['open-p1', RUN_ID]);
  });

  it('is kept by a development composition only', async () => {
    for (const devBuild of [true, false]) {
      const host = createMemoryRecordHost();
      const application = createApplication({
        devBuild,
        recordHost: host,
        runImporter: createInProcessRunImporter(catalog),
      });
      await application.startupReady;
      await application.recording!.setEnabled(true);
      for (const id of OPENING) {
        host.deliver({ fileName: SAVE, bytes: sampleSaveBytes(`surface-${id}`) });
        await application.recording!.idle();
      }
      // Run 1002 is below the catalog's Preboss threshold, so it closes without being kept.
      host.deliver({ fileName: SAVE, bytes: sampleSaveBytes('surface-002', { runCount: 1003 }) });
      await application.recording!.idle();
      expect(application.store.getState().recordingSession.status).toMatchObject({
        kind: 'runOpen',
      });
      expect([...host.rawSaves.folderFiles.keys()]).toEqual(devBuild ? ['open-p1'] : []);
      application.dispose();
    }
  });
});

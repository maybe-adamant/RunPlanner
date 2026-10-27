import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';

import { createMemoryRecordHost } from '@planner-test/support/memoryRecordHost';
import { encodeSyntheticSave, sampleSaveBytes } from '@planner-test/support/syntheticSave';
import type { RecordingPreference } from '@planner/persistence/recordHost';
import {
  createRecordingSessionReducer,
  type RecordingSessionState,
} from '@planner/state/recordingSessionSlice';
import type { PlannerStore } from '@planner/state/store';
import { createRecordingController } from '@planner/workspace/run-recording/recordingController';
import {
  createInProcessRunImporter,
  type RunImporter,
} from '@planner/workspace/run-recording/runImport';
import type { RunImportResult } from '@planner/workspace/run-recording/runImportProtocol';
import { prebossRoomsByBiome } from '@planner/workspace/run-recording/runRecorder';

function setup(
  options: {
    readonly prebossRooms?: ReadonlyMap<string, ReadonlySet<string>>;
    readonly enabled?: boolean;
    readonly importer?: RunImporter;
  } = {},
) {
  const reducer = createRecordingSessionReducer();
  let state: RecordingSessionState = reducer(undefined, { type: 'init' });
  const dispatch = ((action: Parameters<typeof reducer>[1]) => {
    state = reducer(state, action);
    return action;
  }) as PlannerStore['dispatch'];
  let saved = { enabled: options.enabled ?? false, folder: null as string | null };
  const preference: RecordingPreference = {
    read: () => saved,
    write: (value) => void (saved = { ...value }),
  };
  const host = createMemoryRecordHost();
  const controller = createRecordingController({
    host,
    preference,
    store: { dispatch },
    importer: options.importer ?? createInProcessRunImporter(catalog),
    prebossRooms: options.prebossRooms ?? prebossRoomsByBiome(catalog),
    delay: () => Promise.resolve(),
  });
  return {
    host,
    controller,
    state: () => state,
    saved: () => saved,
    deliver: async (fileName: string, bytes: Uint8Array) => {
      host.deliver({ fileName, bytes });
      await controller.idle();
    },
  };
}

/** The first rooms of capture S's run 1002, then the start of run 1003. */
async function playSurfaceOpening(context: ReturnType<typeof setup>) {
  for (const id of ['002', '004', '006', '009', '011'])
    await context.deliver('Profile1_Temp.sav', sampleSaveBytes(`surface-${id}`));
}

describe('recording controller', () => {
  it('records a run from its saves and drops it below the Preboss threshold', async () => {
    const context = setup();
    await context.controller.start();
    expect(context.state()).toEqual({
      status: { kind: 'off' },
      recentRuns: [],
      unreadableRuns: [],
      problem: null,
    });
    await context.controller.setEnabled(true);
    expect(context.saved()).toEqual({ enabled: true, folder: null });
    expect(context.state().status).toEqual({ kind: 'watching', folder: '/saves/Hades II' });
    await playSurfaceOpening(context);
    expect(context.state().status).toEqual({
      kind: 'runOpen',
      folder: '/saves/Hades II',
      runs: [{ profile: 1, rooms: 3 }],
    });
    await context.deliver('Profile1_Temp.sav', sampleSaveBytes('surface-002', { runCount: 1003 }));
    expect(context.state().recentRuns).toEqual([]);
    expect(context.host.recentRuns.files.size).toBe(0);
  });

  it('imports and stores a kept run with its record, plan and report', async () => {
    // The trimmed captures end at N_Hub, so the test moves the threshold there.
    const context = setup({ prebossRooms: new Map([['N', new Set(['N_Hub'])]]) });
    await context.controller.setEnabled(true);
    await playSurfaceOpening(context);
    await context.deliver('Profile1_Temp.sav', sampleSaveBytes('surface-002', { runCount: 1003 }));
    const [summary] = context.state().recentRuns!;
    expect(summary).toMatchObject({
      id: 'p1-1793057328-1002',
      profile: 1,
      runCount: 1002,
      startedAt: 1_793_057_328,
      outcome: 'abandoned',
      route: { biomes: ['N'], dream: false, rooms: 3, endingRoom: 'N_Hub' },
      gap: false,
    });
    expect(summary).not.toHaveProperty('failure');
    const stored = await context.controller.readRun(summary!.id);
    expect(stored.record?.rooms.map((room) => room.name)).toEqual([
      'N_Opening01',
      'N_PreHub01',
      'N_Hub',
    ]);
    expect(typeof stored.project).toBe('string');
    expect(stored.report?.entries.length).toBe(summary!.reportCount);
    expect(context.state().status).toMatchObject({ kind: 'runOpen', runs: [{ profile: 1 }] });
    await context.controller.deleteRun(summary!.id);
    expect(context.state().recentRuns).toEqual([]);
  });

  it('reads a save again when the first read raced the write', async () => {
    const context = setup();
    await context.controller.setEnabled(true);
    const bytes = sampleSaveBytes('surface-002');
    context.host.folder.set('Profile1_Temp.sav', bytes);
    await context.deliver('Profile1_Temp.sav', bytes.subarray(0, 100));
    expect(context.state().status).toMatchObject({ kind: 'runOpen' });
    expect(context.state().problem).toBeNull();
  });

  it('reports a save that stays unreadable and keeps watching', async () => {
    const context = setup();
    await context.controller.setEnabled(true);
    const bytes = sampleSaveBytes('surface-002');
    context.host.folder.set('Profile1_Temp.sav', bytes.subarray(0, 100));
    await context.deliver('Profile1_Temp.sav', bytes.subarray(0, 100));
    expect(context.state().problem).toMatch(/^Profile1_Temp\.sav could not be read/);
    expect(context.state().status).toMatchObject({ kind: 'watching' });
  });

  it('stops with an error at an unknown save format', async () => {
    const context = setup();
    await context.controller.setEnabled(true);
    await context.deliver(
      'Profile1_Temp.sav',
      encodeSyntheticSave(
        {
          version: 0x00020000,
          timestamp: 1,
          location: 'Location_Home',
          runCount: 1,
          fear: 0,
          mapName: 'Hub_PreRun',
          nextMap: 'F_Opening01',
        },
        {},
      ),
    );
    expect(context.state().status).toEqual({
      kind: 'error',
      message: 'This save format (version 20000) is not supported yet.',
    });
    expect(context.host.watched()).toBeNull();
    // Turning recording on again starts over.
    await context.controller.setEnabled(true);
    expect(context.state().status).toMatchObject({ kind: 'watching' });
  });

  it('resumes watching at start-up, follows a chosen folder and turns off', async () => {
    const context = setup({ enabled: true });
    await context.controller.start();
    expect(context.host.watched()).toBe('/saves/Hades II');
    await context.controller.setFolder('/elsewhere/Hades II');
    expect(context.saved()).toEqual({ enabled: true, folder: '/elsewhere/Hades II' });
    expect(context.state().status).toEqual({ kind: 'watching', folder: '/elsewhere/Hades II' });
    await context.controller.setEnabled(false);
    expect(context.host.watched()).toBeNull();
    expect(context.state().status).toEqual({ kind: 'off' });
    expect(context.saved()).toEqual({ enabled: false, folder: '/elsewhere/Hades II' });
  });

  it('shows a folder that cannot be watched as an error', async () => {
    const context = setup();
    context.host.startFailure = 'No Hades II save folder was found. Choose it instead.';
    await context.controller.setEnabled(true);
    expect(context.state().status).toEqual({
      kind: 'error',
      message: 'No Hades II save folder was found. Choose it instead.',
    });
  });

  it('opens no run from the saves already in the folder at start-up', async () => {
    const context = setup({ enabled: true });
    await context.controller.start();
    // A run under way and the hub profile, delivered together by the first poll.
    await context.deliver('Profile1.sav', sampleSaveBytes('surface-004'));
    await context.deliver('Profile1_Temp.sav', sampleSaveBytes('surface-009'));
    expect(context.state().status).toEqual({ kind: 'watching', folder: '/saves/Hades II' });
  });

  it('keeps a run closed while recording stops and restarts during its import', async () => {
    const real = createInProcessRunImporter(catalog);
    const started: { readonly runCount: number; readonly finish: () => void }[] = [];
    const importer: RunImporter = {
      importRun: (run) =>
        new Promise<RunImportResult>((resolve) => {
          started.push({
            runCount: run.runCount,
            finish: () => void real.importRun(run).then(resolve),
          });
        }),
    };
    const context = setup({ prebossRooms: new Map([['N', new Set(['N_Hub'])]]), importer });
    await context.controller.setEnabled(true);
    await playSurfaceOpening(context);
    // Run 1003 starts, closing run 1002, whose import is still running when recording stops.
    context.host.deliver({
      fileName: 'Profile1_Temp.sav',
      bytes: sampleSaveBytes('surface-002', { runCount: 1003 }),
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(started.map((entry) => entry.runCount)).toEqual([1002]);
    const restarted = context.controller
      .setEnabled(false)
      .then(() => context.controller.setEnabled(true));
    started[0]!.finish();
    await restarted;
    await context.controller.idle();
    // Run 1003, open when recording stopped, is abandoned below the threshold, not imported.
    expect(started.map((entry) => entry.runCount)).toEqual([1002]);
    expect(context.state().recentRuns!.map((run) => run.runCount)).toEqual([1002]);
    expect(context.state().status).toEqual({ kind: 'watching', folder: '/saves/Hades II' });
  });

  it('keeps every closed run through an import failure and a failed store write', async () => {
    let calls = 0;
    const real = createInProcessRunImporter(catalog);
    const importer: RunImporter = {
      importRun: (run) => {
        calls += 1;
        return calls === 1 ? Promise.reject(new Error('worker lost')) : real.importRun(run);
      },
    };
    const context = setup({ prebossRooms: new Map([['N', new Set(['N_Hub'])]]), importer });
    await context.controller.setEnabled(true);
    await playSurfaceOpening(context);
    const write = context.host.recentRuns.write;
    let failWrites = 1;
    context.host.recentRuns.write = (id, json) =>
      failWrites-- > 0 ? Promise.reject(new Error('disk full')) : write(id, json);
    // Run 1002 closes; its import fails and its first write fails too.
    await context.deliver('Profile1_Temp.sav', sampleSaveBytes('surface-002', { runCount: 1003 }));
    expect(context.state().problem).toBe('Run 1002 could not be saved yet: disk full');
    expect(context.state().recentRuns).toEqual([]);
    // The next save writes it again.
    await context.deliver('Profile1_Temp.sav', sampleSaveBytes('surface-004', { runCount: 1003 }));
    expect(context.state().recentRuns).toMatchObject([
      { runCount: 1002, failure: 'worker lost', reportCount: 0 },
    ]);
  });
});

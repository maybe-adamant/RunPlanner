import type {
  RecordHost,
  RecordingPreference,
  SaveFileDelivery,
} from '@planner/persistence/recordHost';
import {
  recentRunsLoaded,
  recordingProblemReported,
  recordingStatusChanged,
  type RecordingStatus,
} from '@planner/state/recordingSessionSlice';
import type { PlannerStore } from '@planner/state/store';
import {
  createRecentRunsStore,
  recentRunEntry,
  summarizeRecentRun,
  type RecentRunEntry,
} from './recentRuns';
import { createOpenRunStore } from './openRuns';
import type { RunImporter } from './runImport';
import {
  abandonOpenRuns,
  advanceRecorder,
  EMPTY_RECORDER,
  observeSave,
  reachesFirstPreboss,
  restoreOpenRuns,
  type OpenRun,
  type ClosedRun,
  type RecorderState,
  type RunAttempt,
  type RecorderStep,
  type SaveObservation,
} from './runRecorder';
import { SaveFileError } from './saveFile';

/** Re-reads of a save whose read raced the game's write. */
const SAVE_READ_ATTEMPTS = 4;
const SAVE_REREAD_DELAY_MS = 100;

export interface RecordingController {
  /** Reads the stored runs and resumes watching when recording was left on. */
  start(): Promise<void>;
  setEnabled(enabled: boolean): Promise<void>;
  /** Watches `folder` instead of the discovered save folder; null returns to discovery. */
  setFolder(folder: string | null): Promise<void>;
  /** The folder recording watches: the chosen one, else the one found on this computer. */
  saveFolder(): Promise<{ readonly folder: string | null; readonly chosen: boolean }>;
  /** Asks for a save folder and watches it; nothing changes when the user cancels. */
  chooseFolder(): Promise<void>;
  readRun(id: string): Promise<RecentRunEntry>;
  /** Deletes a stored run; resolves with it for Undo, or null when it could not be read. */
  deleteRun(id: string): Promise<RecentRunEntry | null>;
  /** Writes a deleted run back. */
  restoreRun(entry: RecentRunEntry): Promise<void>;
  /** Settles once every delivered save has been handled. */
  idle(): Promise<void>;
  dispose(): void;
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Feeds delivered saves, in arrival order, through the run recorder; a closed
 * run that reached its first biome's Preboss is imported and stored.
 */
export function createRecordingController(options: {
  readonly host: RecordHost;
  readonly preference: RecordingPreference;
  readonly store: Pick<PlannerStore, 'dispatch'>;
  readonly importer: RunImporter;
  readonly prebossRooms: ReadonlyMap<string, ReadonlySet<string>>;
  readonly delay?: (ms: number) => Promise<void>;
}): RecordingController {
  const { host, preference, store, importer, prebossRooms } = options;
  const delay =
    options.delay ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const recentRuns = createRecentRunsStore(host.recentRuns);
  const openRuns = createOpenRunStore(host.recentRuns);
  let recorder: RecorderState = EMPTY_RECORDER;
  /** Each profile's attempt memory as last written to the store. */
  const savedAttempts = new Map<number, RunAttempt>();
  let folder: string | null = null;
  /** Bumped whenever the watch starts or stops, so deliveries of an earlier watch are dropped. */
  let generation = 0;
  let queue: Promise<void> = Promise.resolve();
  let disposed = false;

  const enqueue = (task: () => Promise<void>) => {
    queue = queue.then(task).catch((error: unknown) => {
      store.dispatch(recordingProblemReported(message(error)));
    });
    return queue;
  };
  const publish = (status: RecordingStatus) => store.dispatch(recordingStatusChanged(status));
  const publishWatching = () => {
    if (folder === null) return;
    const runs = [...recorder.runs.values()].map((run) => ({
      profile: run.profile,
      rooms: run.checkpoints.filter((save) => save.kind === 'entry').length,
    }));
    publish(runs.length === 0 ? { kind: 'watching', folder } : { kind: 'runOpen', folder, runs });
  };
  const report = (problem: string) => store.dispatch(recordingProblemReported(problem));
  const reloadRuns = async () => {
    const listing = await recentRuns.list();
    store.dispatch(
      recentRunsLoaded({
        runs: listing.entries.map(summarizeRecentRun),
        unreadable: listing.unreadable,
      }),
    );
  };

  /** Runs whose store write failed; each later step writes them again. */
  let unsaved: RecentRunEntry[] = [];
  const write = async (entry: RecentRunEntry) => {
    try {
      if ((await recentRuns.add(entry)) === 'olderThanKept')
        report(`Run ${entry.runCount} started before every kept run, so it was not kept.`);
    } catch (error) {
      unsaved.push(entry);
      report(`Run ${entry.runCount} could not be saved yet: ${message(error)}`);
    }
  };
  const writeUnsaved = async () => {
    const waiting = unsaved;
    unsaved = [];
    for (const entry of waiting) await write(entry);
  };

  /** Imports and stores each closed run that reached its first Preboss, one failure at a time. */
  const keep = async (runs: readonly ClosedRun[]) => {
    const retried = unsaved.length > 0;
    await writeUnsaved();
    let stored = retried;
    for (const run of runs) {
      if (!reachesFirstPreboss(prebossRooms, run)) continue;
      stored = true;
      try {
        if (folder !== null) publish({ kind: 'importing', folder });
        const result = await importer
          .importRun(run)
          .catch((error: unknown) => ({ kind: 'failed' as const, message: message(error) }));
        await write(recentRunEntry(run, result));
      } catch (error) {
        report(`Run ${run.runCount} could not be kept: ${message(error)}`);
      }
    }
    if (stored) await reloadRuns().catch((error: unknown) => report(message(error)));
  };

  const observe = async (delivery: SaveFileDelivery): Promise<SaveObservation | undefined> => {
    let bytes = delivery.bytes;
    for (let attempt = 1; ; attempt += 1) {
      try {
        return observeSave(delivery.fileName, bytes);
      } catch (error) {
        if (!(error instanceof SaveFileError) || attempt >= SAVE_READ_ATTEMPTS) throw error;
      }
      await delay(SAVE_REREAD_DELAY_MS);
      bytes = await host.readSave(delivery.fileName);
    }
  };

  /**
   * Keeps each profile's open run on disk for a restart; a closed run's
   * document goes only once the run has been kept, so a crash mid-import
   * restores it.
   */
  const persist = async (
    before: ReadonlyMap<number, OpenRun>,
    after: ReadonlyMap<number, OpenRun>,
  ) => {
    for (const profile of new Set([...before.keys(), ...after.keys()])) {
      const run = after.get(profile);
      if (run === before.get(profile)) continue;
      try {
        if (run === undefined) await openRuns.remove(profile);
        else await openRuns.save(run);
      } catch (error) {
        report(
          `The run being recorded on profile ${profile} could not be kept for a restart: ${message(error)}`,
        );
      }
    }
    // A memory whose write failed is written again at the next save.
    for (const [profile, attempt] of recorder.attempts) {
      if (savedAttempts.get(profile) === attempt) continue;
      try {
        await openRuns.saveAttempt(profile, attempt);
        savedAttempts.set(profile, attempt);
      } catch (error) {
        report(`The attempt count on profile ${profile} could not be kept: ${message(error)}`);
      }
    }
  };

  const advance = async (step: RecorderStep) => {
    const before = recorder.runs;
    const unsupportedBefore = recorder.unsupported;
    recorder = step.state;
    for (const [profile, version] of recorder.unsupported)
      if (unsupportedBefore.get(profile) !== version)
        report(
          `Profile ${profile} uses a save format (version ${version.toString(16)}) that is not supported yet, so its run is not recorded.`,
        );
    await keep(step.closed);
    await persist(before, recorder.runs);
  };

  const stopHost = () => host.stop().catch((error: unknown) => report(message(error)));

  const deliver = (watch: number) => (delivery: SaveFileDelivery) => {
    void enqueue(async () => {
      if (watch !== generation) return;
      let observation: SaveObservation | undefined;
      try {
        observation = await observe(delivery);
      } catch (error) {
        report(`${delivery.fileName} could not be read: ${message(error)}`);
        return;
      }
      if (observation === undefined || watch !== generation) return;
      await advance(advanceRecorder(recorder, observation));
      // A stop or restart while this save was imported owns the status and the watch.
      if (watch !== generation) return;
      publishWatching();
    });
  };

  const stopWatching = async () => {
    generation += 1;
    folder = null;
    await stopHost();
    // Stopping ends the runs being recorded where their saves stop, as they stand once
    // every earlier save has been handled.
    await enqueue(async () => {
      await advance(abandonOpenRuns(recorder));
      recorder = { ...EMPTY_RECORDER, attempts: recorder.attempts };
    });
  };

  const startWatching = async (chosen: string | null) => {
    await stopWatching();
    const watch = generation;
    store.dispatch(recordingProblemReported(null));
    // Runs being recorded when the planner last closed continue before the first poll.
    await enqueue(async () => {
      if (watch !== generation) return;
      const restored = await openRuns.restore();
      for (const problem of restored.problems) report(problem);
      recorder = restoreOpenRuns(recorder, restored.runs, restored.attempts);
      // A memory raised from an open run is written at the next save.
      for (const [profile, attempt] of restored.attempts) savedAttempts.set(profile, attempt);
    });
    if (watch !== generation) return;
    try {
      const watched = await host.start(chosen, deliver(watch), (problem) => {
        if (watch === generation) report(problem);
      });
      if (watch !== generation || disposed) return;
      folder = watched;
      publishWatching();
    } catch (error) {
      publish({ kind: 'error', message: message(error) });
    }
  };

  return Object.freeze({
    async start() {
      await reloadRuns().catch((error: unknown) => {
        store.dispatch(recordingProblemReported(message(error)));
      });
      const saved = preference.read();
      if (saved.enabled) await startWatching(saved.folder);
    },
    async setEnabled(enabled: boolean) {
      const saved = preference.read();
      preference.write({ enabled, folder: saved.folder });
      if (enabled) await startWatching(saved.folder);
      else {
        await stopWatching();
        publish({ kind: 'off' });
      }
    },
    async setFolder(chosen: string | null) {
      const saved = preference.read();
      preference.write({ enabled: saved.enabled, folder: chosen });
      if (saved.enabled) await startWatching(chosen);
    },
    async saveFolder() {
      const chosen = preference.read().folder;
      return chosen === null
        ? { folder: await host.discoverFolder(), chosen: false }
        : { folder: chosen, chosen: true };
    },
    async chooseFolder() {
      const saved = preference.read();
      const picked = await host.chooseFolder(saved.folder ?? (await host.discoverFolder()));
      if (picked === null) return;
      preference.write({ enabled: saved.enabled, folder: picked });
      if (saved.enabled) await startWatching(picked);
    },
    readRun: (id: string) => recentRuns.read(id),
    async deleteRun(id: string) {
      const entry = await recentRuns.read(id).catch(() => null);
      await recentRuns.delete(id);
      await reloadRuns();
      return entry;
    },
    async restoreRun(entry: RecentRunEntry) {
      await write(entry);
      await reloadRuns();
    },
    idle: () => queue,
    dispose() {
      disposed = true;
      generation += 1;
      // The window is closing; the host drops its watch with it.
      void host.stop().catch(() => undefined);
    },
  });
}

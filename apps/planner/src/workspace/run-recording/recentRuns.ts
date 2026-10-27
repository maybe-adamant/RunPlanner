import { decodeRunRecord, type RunRecord } from '@run-planner/engine/run-record';
import type { RunImportReport } from '@run-planner/engine/simulation';

import type { RecentRunsHost } from '@planner/persistence/recordHost';
import type { RunImportResult } from './runImportProtocol';
import type { ClosedRun } from './runRecorder';

/** How many recorded runs are kept; the oldest start is dropped first. */
export const RECENT_RUNS_LIMIT = 20;

const ENTRY_VERSION = 1;

export interface RecentRunRoute {
  /** Biome game names in visit order. */
  readonly biomes: readonly string[];
  readonly dream: boolean;
  /** Rooms entered in the stored record. */
  readonly rooms: number;
  readonly endingRoom: string;
}

/** One recorded run as stored: its record beside the imported plan and report. */
export interface RecentRunEntry {
  readonly entryVersion: typeof ENTRY_VERSION;
  readonly id: string;
  /** The save profile number the run was played on. */
  readonly profile: number;
  readonly runCount: number;
  /** Unix seconds of the run-start save. */
  readonly startedAt: number;
  readonly outcome: ClosedRun['outcome'];
  readonly route: RecentRunRoute;
  /** Absent when the record could not be built. */
  readonly record?: RunRecord;
  /** The imported plan's canonical JSON; absent when the import failed. */
  readonly project?: string;
  readonly report?: RunImportReport;
  readonly importKind?: 'complete' | 'stopped';
  /** A room's entry save was missed, so the run was cut before it. */
  readonly gap?: true;
  /** Why the record or plan could not be built. */
  readonly failure?: string;
}

/** A stored run without its record, plan and report. */
export interface RecentRunSummary {
  readonly id: string;
  readonly profile: number;
  readonly runCount: number;
  readonly startedAt: number;
  readonly outcome: ClosedRun['outcome'];
  readonly route: RecentRunRoute;
  readonly importKind?: 'complete' | 'stopped';
  readonly reportCount: number;
  readonly gap: boolean;
  readonly failure?: string;
}

export function recentRunId(run: Pick<ClosedRun, 'profile' | 'startedAt' | 'runCount'>): string {
  return `p${run.profile}-${run.startedAt}-${run.runCount}`;
}

const idStart = (id: string): number | undefined => {
  const match = /^p\d+-(\d+)-\d+$/.exec(id);
  return match === null ? undefined : Number(match[1]);
};

/** The stored entry for a closed run and its import. */
export function recentRunEntry(run: ClosedRun, result: RunImportResult): RecentRunEntry {
  const entries = run.checkpoints.filter((save) => save.kind === 'entry');
  const last = run.end ?? run.checkpoints[run.checkpoints.length - 1]!;
  const recordJson = result.recordJson;
  return {
    entryVersion: ENTRY_VERSION,
    id: recentRunId(run),
    profile: run.profile,
    runCount: run.runCount,
    startedAt: run.startedAt,
    outcome: run.outcome,
    route: {
      biomes: last.run.biomeVisitOrder,
      dream: last.run.dream,
      rooms: entries.length,
      endingRoom: entries[entries.length - 1]!.currentRoom.name,
    },
    ...(recordJson === undefined ? {} : { record: decodeRunRecord(JSON.parse(recordJson)) }),
    ...(result.kind === 'imported'
      ? { project: result.projectJson, report: result.report, importKind: result.importKind }
      : { failure: result.message }),
    ...(run.gap ? { gap: true as const } : {}),
  };
}

export function summarizeRecentRun(entry: RecentRunEntry): RecentRunSummary {
  return {
    id: entry.id,
    profile: entry.profile,
    runCount: entry.runCount,
    startedAt: entry.startedAt,
    outcome: entry.outcome,
    route: entry.route,
    ...(entry.importKind === undefined ? {} : { importKind: entry.importKind }),
    reportCount: entry.report?.entries.length ?? 0,
    gap: entry.gap === true,
    ...(entry.failure === undefined ? {} : { failure: entry.failure }),
  };
}

export class RecentRunEntryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecentRunEntryError';
  }
}

type Fields = Record<string, unknown>;

const isObject = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isWhole = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0;

/** Reads a stored entry; the record goes through the engine's strict codec. */
export function decodeRecentRunEntry(json: string): RecentRunEntry {
  const value: unknown = JSON.parse(json);
  const fail = (field: string): never => {
    throw new RecentRunEntryError(`recent run ${field} is malformed`);
  };
  if (!isObject(value) || value.entryVersion !== ENTRY_VERSION) return fail('entryVersion');
  const { id, profile, runCount, startedAt, outcome, route } = value;
  if (typeof id !== 'string' || idStart(id) === undefined) return fail('id');
  if (!isWhole(profile)) return fail('profile');
  if (!isWhole(runCount)) return fail('runCount');
  if (!isWhole(startedAt)) return fail('startedAt');
  if (outcome !== 'victory' && outcome !== 'death' && outcome !== 'abandoned')
    return fail('outcome');
  if (
    !isObject(route) ||
    !Array.isArray(route.biomes) ||
    !route.biomes.every((biome) => typeof biome === 'string') ||
    typeof route.dream !== 'boolean' ||
    !isWhole(route.rooms) ||
    typeof route.endingRoom !== 'string'
  )
    return fail('route');
  if (value.project !== undefined && typeof value.project !== 'string') return fail('project');
  if (
    value.report !== undefined &&
    (!isObject(value.report) || !Array.isArray(value.report.entries))
  )
    return fail('report');
  if (
    value.importKind !== undefined &&
    value.importKind !== 'complete' &&
    value.importKind !== 'stopped'
  )
    return fail('importKind');
  if (value.gap !== undefined && value.gap !== true) return fail('gap');
  if (value.failure !== undefined && typeof value.failure !== 'string') return fail('failure');
  return {
    entryVersion: ENTRY_VERSION,
    id,
    profile,
    runCount,
    startedAt,
    outcome,
    route: {
      biomes: route.biomes as string[],
      dream: route.dream,
      rooms: route.rooms,
      endingRoom: route.endingRoom,
    },
    ...(value.record === undefined ? {} : { record: decodeRunRecord(value.record) }),
    ...(value.project === undefined ? {} : { project: value.project }),
    ...(value.report === undefined ? {} : { report: value.report as unknown as RunImportReport }),
    ...(value.importKind === undefined ? {} : { importKind: value.importKind }),
    ...(value.gap === undefined ? {} : { gap: true as const }),
    ...(value.failure === undefined ? {} : { failure: value.failure }),
  };
}

/** A stored document this planner cannot read, kept on disk and listed as such. */
export interface UnreadableRecentRun {
  readonly id: string;
  readonly reason: string;
}

export interface RecentRunsListing {
  /** Newest start first. */
  readonly entries: readonly RecentRunEntry[];
  readonly unreadable: readonly UnreadableRecentRun[];
}

export interface RecentRunsStore {
  list(): Promise<RecentRunsListing>;
  read(id: string): Promise<RecentRunEntry>;
  /**
   * Stores a run, then drops the oldest starts beyond the limit. A run that
   * started before every kept run of a full store is not written.
   */
  add(entry: RecentRunEntry): Promise<'stored' | 'olderThanKept'>;
  delete(id: string): Promise<void>;
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function createRecentRunsStore(
  host: RecentRunsHost,
  limit: number = RECENT_RUNS_LIMIT,
): RecentRunsStore {
  const read = async (id: string) => decodeRecentRunEntry(await host.read(id));
  /** Stored ids with a run identity, newest start first; other files never count. */
  const kept = async () =>
    (await host.list())
      .flatMap((id) => {
        const start = idStart(id);
        return start === undefined ? [] : [{ id, start }];
      })
      .sort((left, right) => right.start - left.start || (left.id < right.id ? 1 : -1));
  return Object.freeze({
    async list() {
      const entries: RecentRunEntry[] = [];
      const unreadable: UnreadableRecentRun[] = [];
      for (const { id } of await kept()) {
        try {
          entries.push(await read(id));
        } catch (error) {
          unreadable.push({ id, reason: message(error) });
        }
      }
      return {
        entries: entries.sort((left, right) => right.startedAt - left.startedAt),
        unreadable,
      };
    },
    read,
    async add(entry: RecentRunEntry) {
      const before = (await kept()).filter(({ id }) => id !== entry.id);
      if (before.length >= limit && entry.startedAt < before[limit - 1]!.start)
        return 'olderThanKept';
      await host.write(entry.id, JSON.stringify(entry));
      for (const { id } of (await kept()).slice(limit)) await host.delete(id);
      return 'stored';
    },
    delete: (id: string) => host.delete(id),
  });
}

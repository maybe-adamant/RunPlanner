import type { Catalog } from '@run-planner/engine/catalog-schema';

import { extractSaveCheckpoint, type SaveCheckpoint } from './saveCheckpoint';
import { decodeSaveFile, readSaveContainer } from './saveFile';

/** The `SGB1` header version every save of the audited game build carries. */
export const SUPPORTED_SAVE_VERSION = 0x00010012;

/** `Profile<N>.sav` is the hub profile; `Profile<N>_Temp.sav` its run checkpoint. */
export function parseSaveFileName(
  fileName: string,
): { readonly profile: number; readonly temp: boolean } | undefined {
  const match = /^Profile(\d{1,4})(_Temp)?\.sav$/.exec(fileName);
  return match === null ? undefined : { profile: Number(match[1]), temp: match[2] !== undefined };
}

/** What one delivered save tells the recorder. */
export type SaveObservation =
  | { readonly kind: 'checkpoint'; readonly profile: number; readonly checkpoint: SaveCheckpoint }
  | { readonly kind: 'unsupportedVersion'; readonly profile: number; readonly version: number };

/**
 * Reduces one delivered save to its observation; the raw bytes are dropped here.
 * Throws `SaveFileError` for an unreadable file (a read that raced the write),
 * which the caller may read again.
 */
export function observeSave(fileName: string, bytes: Uint8Array): SaveObservation | undefined {
  const name = parseSaveFileName(fileName);
  if (name === undefined) return undefined;
  const { header } = readSaveContainer(bytes);
  if (header.version !== SUPPORTED_SAVE_VERSION)
    return { kind: 'unsupportedVersion', profile: name.profile, version: header.version };
  return {
    kind: 'checkpoint',
    profile: name.profile,
    checkpoint: extractSaveCheckpoint(decodeSaveFile(bytes), name.temp),
  };
}

/** A run being recorded: its room saves in arrival order, rewrites applied. */
export interface OpenRun {
  readonly profile: number;
  readonly runCount: number;
  readonly checkpoints: readonly SaveCheckpoint[];
}

export interface RecorderState {
  /** At most one open run per save profile. */
  readonly runs: ReadonlyMap<number, OpenRun>;
  /** Set by a save format the recorder does not know; recording stops until it is restarted. */
  readonly error: string | null;
}

export const EMPTY_RECORDER: RecorderState = Object.freeze({ runs: new Map(), error: null });

/** A finished run's saves, ready to build its record. */
export interface ClosedRun {
  readonly profile: number;
  readonly runCount: number;
  /** Unix seconds of the run-start save. */
  readonly startedAt: number;
  readonly checkpoints: readonly SaveCheckpoint[];
  /** The hub save of the dead hero; absent when the run was abandoned or cut. */
  readonly end?: SaveCheckpoint;
  readonly outcome: 'victory' | 'death' | 'abandoned';
  /** A room's entry save was missed, so the run is cut before that room. */
  readonly gap: boolean;
}

export interface RecorderStep {
  readonly state: RecorderState;
  readonly closed: readonly ClosedRun[];
}

const depth = (checkpoint: SaveCheckpoint) => checkpoint.history.length;

const sameSave = (left: SaveCheckpoint, right: SaveCheckpoint) =>
  left.kind === right.kind &&
  depth(left) === depth(right) &&
  left.timestamp === right.timestamp &&
  left.worldTime === right.worldTime;

const isRunStart = (checkpoint: SaveCheckpoint) =>
  checkpoint.kind === 'entry' && checkpoint.mapName === 'Hub_PreRun' && depth(checkpoint) === 0;

/** Cuts the run before the first room whose entry save is missing. */
function close(run: OpenRun, end: SaveCheckpoint | undefined): ClosedRun {
  const entered = new Set(
    run.checkpoints.filter((save) => save.kind === 'entry').map((save) => depth(save)),
  );
  const deepest = Math.max(
    end === undefined ? -1 : depth(end) - 1,
    ...run.checkpoints.map((save) => depth(save)),
  );
  let gapAt: number | undefined;
  for (let index = 0; index <= deepest && gapAt === undefined; index += 1)
    if (!entered.has(index)) gapAt = index;
  const checkpoints =
    gapAt === undefined ? run.checkpoints : run.checkpoints.filter((save) => depth(save) < gapAt!);
  const kept = gapAt === undefined ? end : undefined;
  return Object.freeze({
    profile: run.profile,
    runCount: run.runCount,
    startedAt: run.checkpoints[0]!.timestamp,
    checkpoints: Object.freeze(checkpoints),
    ...(kept === undefined ? {} : { end: kept }),
    outcome: kept === undefined ? 'abandoned' : kept.run.cleared ? 'victory' : 'death',
    gap: gapAt !== undefined,
  });
}

/**
 * Adds one room save to its open run. A rewritten entry (a reload from an
 * earlier checkpoint) supersedes that room and everything after it.
 */
function extend(run: OpenRun, checkpoint: SaveCheckpoint): OpenRun | undefined {
  if (run.checkpoints.some((save) => sameSave(save, checkpoint))) return undefined;
  const at = depth(checkpoint);
  const checkpoints = run.checkpoints.filter((save) =>
    checkpoint.kind === 'entry'
      ? depth(save) < at
      : !(save.kind === 'postReward' && depth(save) === at),
  );
  return { ...run, checkpoints: Object.freeze([...checkpoints, checkpoint]) };
}

/** Folds one observation into the recorder, in arrival order. */
export function advanceRecorder(state: RecorderState, observation: SaveObservation): RecorderStep {
  if (state.error !== null) return { state, closed: [] };
  // The open runs end where their readable saves stop.
  if (observation.kind === 'unsupportedVersion')
    return {
      state: {
        runs: new Map(),
        error: `This save format (version ${observation.version.toString(16)}) is not supported yet.`,
      },
      closed: [...state.runs.values()].map((run) => close(run, undefined)),
    };
  const { profile, checkpoint } = observation;
  const open = state.runs.get(profile);
  const runs = new Map(state.runs);
  const closed: ClosedRun[] = [];
  const settle = () => ({ state: { runs, error: null }, closed });

  if (checkpoint.kind === 'hub') {
    if (open === undefined || checkpoint.runCount < open.runCount) return { state, closed: [] };
    // The hub save of a later run means the open run ended unseen.
    if (checkpoint.runCount > open.runCount) closed.push(close(open, undefined));
    else if (checkpoint.run.heroDead) closed.push(close(open, checkpoint));
    else return { state, closed: [] };
    runs.delete(profile);
    return settle();
  }

  if (open !== undefined && checkpoint.runCount === open.runCount) {
    const next = extend(open, checkpoint);
    if (next === undefined) return { state, closed: [] };
    runs.set(profile, next);
    return settle();
  }
  if (open !== undefined && checkpoint.runCount < open.runCount) return { state, closed: [] };
  // A later run without the open run's end save: the open run was abandoned.
  if (open !== undefined) {
    closed.push(close(open, undefined));
    runs.delete(profile);
  }
  // A run is recorded only from its start save.
  if (isRunStart(checkpoint))
    runs.set(profile, {
      profile,
      runCount: checkpoint.runCount,
      checkpoints: Object.freeze([checkpoint]),
    });
  return closed.length === 0 && !runs.has(profile) ? { state, closed } : settle();
}

/** Adds open runs kept across a restart; a profile already recording keeps its run. */
export function restoreOpenRuns(state: RecorderState, runs: readonly OpenRun[]): RecorderState {
  if (runs.length === 0) return state;
  const restored = new Map(state.runs);
  for (const run of runs) if (!restored.has(run.profile)) restored.set(run.profile, run);
  return { runs: restored, error: state.error };
}

/** Ends every open run as abandoned, as recording stops. */
export function abandonOpenRuns(state: RecorderState): RecorderStep {
  return {
    state: { runs: new Map(), error: state.error },
    closed: [...state.runs.values()].map((run) => close(run, undefined)),
  };
}

/** Preboss room game names by biome, from every route's completion declarations. */
export function prebossRoomsByBiome(catalog: Catalog): ReadonlyMap<string, ReadonlySet<string>> {
  const rooms = new Map<string, Set<string>>();
  for (const route of catalog.routes.values)
    for (const [biome, room] of Object.entries(route.completion.prebossRoomGameNameByBiomeKey)) {
      const names = rooms.get(biome) ?? new Set<string>();
      names.add(room);
      rooms.set(biome, names);
    }
  return rooms;
}

/** Whether the run's recorded rooms reach its first biome's Preboss: the keep threshold. */
export function reachesFirstPreboss(
  prebossRooms: ReadonlyMap<string, ReadonlySet<string>>,
  run: ClosedRun,
): boolean {
  const last = run.end ?? run.checkpoints[run.checkpoints.length - 1];
  const firstBiome = last?.run.biomeVisitOrder[0];
  const names = firstBiome === undefined ? undefined : prebossRooms.get(firstBiome);
  return (
    names !== undefined &&
    run.checkpoints.some((save) => save.kind === 'entry' && names.has(save.currentRoom.name))
  );
}

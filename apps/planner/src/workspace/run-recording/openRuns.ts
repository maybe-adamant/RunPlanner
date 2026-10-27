import type { RecentRunsHost } from '@planner/persistence/recordHost';
import type { OpenRun } from './runRecorder';
import type { SaveCheckpoint } from './saveCheckpoint';

const DOCUMENT_VERSION = 1;
/** Open-run documents share the recent-runs folder; this prefix keeps them out of its list. */
const PREFIX = 'open-p';

export class OpenRunDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenRunDocumentError';
  }
}

export const openRunId = (profile: number) => `${PREFIX}${profile}`;

const openRunProfile = (id: string): number | undefined => {
  const match = /^open-p(\d{1,4})$/.exec(id);
  return match === null ? undefined : Number(match[1]);
};

type Fields = Record<string, unknown>;
const isObject = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isWhole = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0;

/** The shape the recorder and the record builder rely on; the builder checks the rest. */
function isCheckpoint(value: unknown, runCount: number): value is SaveCheckpoint {
  return (
    isObject(value) &&
    (value.kind === 'entry' || value.kind === 'postReward') &&
    value.runCount === runCount &&
    typeof value.timestamp === 'number' &&
    typeof value.worldTime === 'number' &&
    typeof value.mapName === 'string' &&
    typeof value.nextMap === 'string' &&
    Array.isArray(value.history) &&
    value.history.every((name) => typeof name === 'string') &&
    isObject(value.currentRoom) &&
    typeof value.currentRoom.name === 'string' &&
    isObject(value.run) &&
    Array.isArray(value.run.biomeVisitOrder) &&
    isObject(value.profile)
  );
}

export function encodeOpenRun(run: OpenRun): string {
  return JSON.stringify({
    openRunVersion: DOCUMENT_VERSION,
    profile: run.profile,
    runCount: run.runCount,
    checkpoints: run.checkpoints,
  });
}

export function decodeOpenRun(json: string, profile: number): OpenRun {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new OpenRunDocumentError('the open run is not JSON');
  }
  if (!isObject(value) || value.openRunVersion !== DOCUMENT_VERSION)
    throw new OpenRunDocumentError('the open run has an unknown version');
  const { runCount, checkpoints } = value;
  if (value.profile !== profile || !isWhole(runCount))
    throw new OpenRunDocumentError('the open run identity is malformed');
  if (
    !Array.isArray(checkpoints) ||
    checkpoints.length === 0 ||
    !checkpoints.every((checkpoint) => isCheckpoint(checkpoint, runCount))
  )
    throw new OpenRunDocumentError('the open run checkpoints are malformed');
  const start = checkpoints[0] as SaveCheckpoint;
  if (start.kind !== 'entry' || start.history.length !== 0)
    throw new OpenRunDocumentError('the open run does not begin with its start save');
  return {
    profile,
    runCount,
    checkpoints: Object.freeze(checkpoints as SaveCheckpoint[]),
  };
}

/** Open runs kept across planner restarts, one document per save profile. */
export interface OpenRunStore {
  /** Readable open runs, with a problem per document that could not be read and was removed. */
  restore(): Promise<{ readonly runs: readonly OpenRun[]; readonly problems: readonly string[] }>;
  save(run: OpenRun): Promise<void>;
  remove(profile: number): Promise<void>;
}

export function createOpenRunStore(host: RecentRunsHost): OpenRunStore {
  return Object.freeze({
    async restore() {
      const runs: OpenRun[] = [];
      const problems: string[] = [];
      for (const id of await host.list()) {
        const profile = openRunProfile(id);
        if (profile === undefined) continue;
        try {
          runs.push(decodeOpenRun(await host.read(id), profile));
        } catch (error) {
          problems.push(
            `The run being recorded on profile ${profile} could not be restored: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          await host.delete(id).catch(() => undefined);
        }
      }
      return { runs, problems };
    },
    save: (run: OpenRun) => host.write(openRunId(run.profile), encodeOpenRun(run)),
    remove: (profile: number) => host.delete(openRunId(profile)),
  });
}

import type { Catalog } from '@run-planner/engine/catalog-schema';

import {
  answerRunImportRequest,
  type RunImportRequest,
  type RunImportResponse,
  type RunImportResult,
} from './runImportProtocol';
import type { ClosedRun } from './runRecorder';

/** Builds a closed run's record and imports it as a plan, away from the caller; never rejects. */
export interface RunImporter {
  importRun(run: ClosedRun): Promise<RunImportResult>;
  /** Imports a stored run's record, as canonical JSON, again. */
  importRecord(recordJson: string): Promise<RunImportResult>;
}

type RunImportSource =
  | { readonly source: 'saves'; readonly run: ClosedRun }
  | { readonly source: 'record'; readonly recordJson: string };

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

const request = (id: number, from: RunImportSource): RunImportRequest =>
  from.source === 'record'
    ? { id, source: 'record', recordJson: from.recordJson }
    : {
        id,
        source: 'saves',
        checkpoints: from.run.checkpoints,
        ...(from.run.end === undefined ? {} : { end: from.run.end }),
      };

/** Imports on the calling thread after the current task; for tests and hosts without workers. */
export function createInProcessRunImporter(catalog: Catalog): RunImporter {
  const answer = (from: RunImportSource) =>
    new Promise<RunImportResult>((resolve) => {
      setTimeout(() => resolve(answerRunImportRequest(catalog, request(0, from)).result), 0);
    });
  return {
    importRun: (run) => answer({ source: 'saves', run }),
    importRecord: (recordJson) => answer({ source: 'record', recordJson }),
  };
}

/** How long one import may take before its worker is replaced. */
export const RUN_IMPORT_TIMEOUT_MS = 120_000;

/** Imports in one dedicated worker, started on first use and replaced after a crash or timeout. */
export function createWorkerRunImporter(
  createWorker: () => Worker,
  timeoutMs: number = RUN_IMPORT_TIMEOUT_MS,
): RunImporter {
  let worker: Worker | undefined;
  let nextId = 1;
  const pending = new Map<
    number,
    { readonly resolve: (result: RunImportResult) => void; readonly timer: unknown }
  >();
  const settle = (id: number, result: RunImportResult) => {
    const entry = pending.get(id);
    if (entry === undefined) return;
    clearTimeout(entry.timer as ReturnType<typeof setTimeout>);
    pending.delete(id);
    entry.resolve(result);
  };
  /** Fails every pending import and drops the worker; the next import starts a new one. */
  const discard = (failure: string) => {
    for (const id of [...pending.keys()]) settle(id, { kind: 'failed', message: failure });
    worker?.terminate();
    worker = undefined;
  };
  const ensureWorker = (): Worker => {
    if (worker !== undefined) return worker;
    const created = createWorker();
    created.onmessage = (event: MessageEvent<RunImportResponse>) =>
      settle(event.data.id, event.data.result);
    created.onmessageerror = () => {
      if (worker === created) discard('The run import answer could not be read.');
    };
    created.onerror = (error) => {
      error.preventDefault();
      if (worker === created) discard(error.message);
    };
    worker = created;
    return created;
  };
  const post = (from: RunImportSource) => {
    const id = nextId++;
    return new Promise<RunImportResult>((resolve) => {
      const timer = setTimeout(() => discard('The run import took too long.'), timeoutMs);
      pending.set(id, { resolve, timer });
      try {
        ensureWorker().postMessage(request(id, from));
      } catch (error) {
        settle(id, { kind: 'failed', message: message(error) });
      }
    });
  };
  return {
    importRun: (run) => post({ source: 'saves', run }),
    importRecord: (recordJson) => post({ source: 'record', recordJson }),
  };
}

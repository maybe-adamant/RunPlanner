import { parseProjectDocument } from '@run-planner/engine/authored-project';
import { decodeRunRecord } from '@run-planner/engine/run-record';
import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it, vi } from 'vitest';

import { sampleSaveBytes } from '@planner-test/support/syntheticSave';
import { createWorkerRunImporter } from '@planner/workspace/run-recording/runImport';
import {
  answerRunImportRequest,
  type RunImportRequest,
  type RunImportResponse,
} from '@planner/workspace/run-recording/runImportProtocol';
import { observeSave, type ClosedRun } from '@planner/workspace/run-recording/runRecorder';
import type { SaveCheckpoint } from '@planner/workspace/run-recording/saveCheckpoint';

function sampleCheckpoints(): readonly SaveCheckpoint[] {
  return ['002', '004', '006', '009', '011'].map((id) => {
    const observation = observeSave('Profile1_Temp.sav', sampleSaveBytes(`surface-${id}`));
    if (observation?.kind !== 'checkpoint') throw new Error('sample is not a checkpoint');
    return observation.checkpoint;
  });
}

describe('run import protocol', () => {
  it('builds the record and imports it as a plan with its report', () => {
    const { id, result } = answerRunImportRequest(catalog, {
      id: 4,
      source: 'saves',
      checkpoints: sampleCheckpoints(),
    });
    expect(id).toBe(4);
    if (result.kind !== 'imported') throw new Error(result.message);
    const record = decodeRunRecord(JSON.parse(result.recordJson));
    expect(record.run).toEqual({ runCount: 1002, startedAt: 1_793_057_328 });
    expect(record.outcome).toEqual({ kind: 'abandoned', endingRoom: 'N_Hub' });
    expect(parseProjectDocument(result.projectJson, catalog).route.routeKey).toBe('Surface');
    expect(['complete', 'stopped']).toContain(result.importKind);
    expect(Array.isArray(result.report.entries)).toBe(true);
  });

  it('reports a record that cannot be built, without a plan', () => {
    const checkpoints = sampleCheckpoints();
    expect(
      answerRunImportRequest(catalog, {
        id: 1,
        source: 'saves',
        checkpoints: checkpoints.slice(1),
      }),
    ).toEqual({
      id: 1,
      result: {
        kind: 'failed',
        message: 'a run starts with an entry save and an empty room history',
      },
    });
  });

  it('imports a stored record again, and reports one the codec refuses', () => {
    const built = answerRunImportRequest(catalog, {
      id: 1,
      source: 'saves',
      checkpoints: sampleCheckpoints(),
    }).result;
    if (built.kind !== 'imported') throw new Error(built.message);
    const { result } = answerRunImportRequest(catalog, {
      id: 2,
      source: 'record',
      recordJson: built.recordJson,
    });
    expect(result).toEqual(built);
    expect(
      answerRunImportRequest(catalog, { id: 3, source: 'record', recordJson: '{}' }).result,
    ).toMatchObject({ kind: 'failed' });
  });
});

class FakeWorker {
  readonly posted: RunImportRequest[] = [];
  terminated = false;
  onmessage: ((message: MessageEvent<RunImportResponse>) => void) | null = null;
  onerror: ((error: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  refuse = false;

  postMessage(message: RunImportRequest): void {
    if (this.refuse) throw new Error('could not clone');
    this.posted.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  answer(response: RunImportResponse): void {
    this.onmessage?.({ data: response } as MessageEvent<RunImportResponse>);
  }

  crash(message: string): void {
    this.onerror?.({ message, preventDefault() {} } as ErrorEvent);
  }
}

describe('worker run importer', () => {
  const run = (end?: SaveCheckpoint): ClosedRun => ({
    profile: 1,
    runCount: 1002,
    attempt: 1,
    startedAt: 1,
    checkpoints: sampleCheckpoints().slice(0, 1),
    ...(end === undefined ? {} : { end }),
    outcome: 'unfinished',
    gap: false,
  });

  it('posts each run to one worker and settles it with the matching answer', async () => {
    const workers: FakeWorker[] = [];
    const importer = createWorkerRunImporter(() => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker as unknown as Worker;
    });
    const first = importer.importRun(run());
    const second = importer.importRun(run());
    expect(workers).toHaveLength(1);
    expect(workers[0]!.posted.map((request) => request.id)).toEqual([1, 2]);
    expect(workers[0]!.posted[0]).not.toHaveProperty('end');
    workers[0]!.answer({ id: 2, result: { kind: 'failed', message: 'second' } });
    workers[0]!.answer({ id: 1, result: { kind: 'failed', message: 'first' } });
    expect(await first).toEqual({ kind: 'failed', message: 'first' });
    expect(await second).toEqual({ kind: 'failed', message: 'second' });
  });

  it('fails pending runs when the worker crashes and starts a new worker after', async () => {
    const workers: FakeWorker[] = [];
    const importer = createWorkerRunImporter(() => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker as unknown as Worker;
    });
    const pending = importer.importRun(run());
    workers[0]!.crash('out of memory');
    expect(await pending).toEqual({ kind: 'failed', message: 'out of memory' });
    expect(workers[0]!.terminated).toBe(true);
    void importer.importRun(run());
    expect(workers).toHaveLength(2);
  });

  it('fails runs whose answer cannot be read, that time out, or that cannot be posted', async () => {
    vi.useFakeTimers();
    try {
      const workers: FakeWorker[] = [];
      const importer = createWorkerRunImporter(() => {
        const worker = new FakeWorker();
        workers.push(worker);
        return worker as unknown as Worker;
      }, 1_000);
      const unreadable = importer.importRun(run());
      workers[0]!.onmessageerror?.();
      expect(await unreadable).toEqual({
        kind: 'failed',
        message: 'The run import answer could not be read.',
      });
      const slow = importer.importRun(run());
      expect(workers).toHaveLength(2);
      vi.advanceTimersByTime(1_000);
      expect(await slow).toEqual({ kind: 'failed', message: 'The run import took too long.' });
      expect(workers[1]!.terminated).toBe(true);
      const refused = importer.importRun(run());
      workers[2]!.refuse = true;
      const unposted = importer.importRun(run());
      expect(await unposted).toEqual({ kind: 'failed', message: 'could not clone' });
      workers[2]!.answer({ id: 3, result: { kind: 'failed', message: 'answered' } });
      expect(await refused).toEqual({ kind: 'failed', message: 'answered' });
    } finally {
      vi.useRealTimers();
    }
  });
});

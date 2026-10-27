import { describe, expect, it } from 'vitest';

import { sampleSaveBytes } from '@planner-test/support/syntheticSave';
import { createMemoryRecordHost } from '@planner-test/support/memoryRecordHost';
import {
  createOpenRunStore,
  decodeOpenRun,
  encodeOpenRun,
  OpenRunDocumentError,
} from '@planner/workspace/run-recording/openRuns';
import { observeSave, type OpenRun } from '@planner/workspace/run-recording/runRecorder';
import type { SaveCheckpoint } from '@planner/workspace/run-recording/saveCheckpoint';

function checkpoint(id: string): SaveCheckpoint {
  const observation = observeSave('Profile1_Temp.sav', sampleSaveBytes(`surface-${id}`));
  if (observation?.kind !== 'checkpoint') throw new Error('sample is not a checkpoint');
  return observation.checkpoint;
}

describe('open run documents', () => {
  const run: OpenRun = {
    profile: 1,
    runCount: 1002,
    attempt: 2,
    checkpoints: [checkpoint('002'), checkpoint('004')],
  };

  it('round-trip the decoded checkpoint views of a run', () => {
    expect(decodeOpenRun(encodeOpenRun(run), 1)).toEqual(run);
  });

  it('reject a document of another profile, run or shape', () => {
    const value = JSON.parse(encodeOpenRun(run)) as Record<string, unknown>;
    const bad = (change: Record<string, unknown>, profile = 1) =>
      expect(() => decodeOpenRun(JSON.stringify({ ...value, ...change }), profile)).toThrow(
        OpenRunDocumentError,
      );
    bad({}, 2);
    bad({ openRunVersion: 2 });
    bad({ runCount: 1003 });
    bad({ attempt: 0 });
    bad({ attempt: undefined });
    bad({ checkpoints: [] });
    bad({ checkpoints: [run.checkpoints[1]] });
    bad({ checkpoints: [{ ...run.checkpoints[0], currentRoom: {} }] });
  });

  it('restore each profile attempt memory beside the open runs', async () => {
    const host = createMemoryRecordHost().recentRuns;
    const store = createOpenRunStore(host);
    await store.save(run);
    await store.saveAttempt(1, { runCount: 1002, attempt: 2 });
    await store.saveAttempt(3, { runCount: 40, attempt: 1 });
    // An unreadable memory only restarts that profile's numbering.
    host.files.set('attempts-p4', '{');
    const restored = await store.restore();
    expect(restored.runs).toEqual([run]);
    expect([...restored.attempts].sort()).toEqual([
      [1, { runCount: 1002, attempt: 2 }],
      [3, { runCount: 40, attempt: 1 }],
    ]);
    expect(restored.problems).toEqual([]);
  });
});

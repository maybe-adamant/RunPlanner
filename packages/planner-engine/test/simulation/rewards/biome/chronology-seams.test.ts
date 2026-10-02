import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createBiomeAddress,
  createExitDecisionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createTargetAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';

import { createChronologyAccumulator } from '../../../../src/simulation/rewards/biome/chronology-accumulator';
import { applySeamStep } from '../../../../src/simulation/rewards/biome/chronology-seams';
import {
  createChronologyWalkState,
  type ChronologyWalkContext,
  type ChronologyWalkState,
} from '../../../../src/simulation/rewards/biome/chronology-walk';
import type { RewardBranchState } from '../../../../src/simulation/rewards/branch-primitives';
import type { RunStateSnapshot } from '../../../../src/simulation/rewards/run-state';

/** Records each capture and target-history call in order, observing the accumulator then. */
const calls: { kind: string; state?: ChronologyWalkState; awaiting?: readonly string[] }[] = [];

vi.mock('../../../../src/simulation/rewards/biome/chronology-run-state', () => ({
  captureRunState: (
    _context: unknown,
    state: ChronologyWalkState,
    accumulator: ReturnType<typeof createChronologyAccumulator>,
    checkpoint: { owner: { kind: string }; room: { origin: never } },
  ) => {
    const ownerKey = 'checkpoint';
    const awaiting = accumulator.traitChildCheckpointsAwaiting(checkpoint.room.origin, ownerKey);
    calls.push({ kind: 'capture', state, awaiting: awaiting.map((child) => child.key) });
    accumulator.mergeEmissions(
      awaiting.map((child) => ({
        kind: 'traitChildRunStateSnapshot' as const,
        childKey: child.key,
        ownerKey,
        snapshot: { owner: checkpoint.owner } as unknown as RunStateSnapshot,
      })),
    );
  },
  targetSlotHistory: () => {
    calls.push({ kind: 'targetHistory' });
    return [];
  },
}));

const biome = createBiomeAddress('Underworld', 'F');
const occurrence = createOccurrenceAddress(biome, createOccurrenceId('shop'));
const owner = createExitDecisionAddress(biome, occurrence);
const child = createTargetAddress(biome, occurrence, 'exit1');
const context = {} as ChronologyWalkContext;
const branch = {} as RewardBranchState;
const received = createChronologyWalkState([branch]);
const next = createChronologyWalkState([branch, branch]);
const checkpoint = {
  owner,
  room: { origin: occurrence } as never,
  view: {} as never,
};

describe('seam step ordering', () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it('merges leading emissions before a capture against the received state', () => {
    const accumulator = createChronologyAccumulator(new Map());
    applySeamStep(context, accumulator, received, {
      leadingEmissions: [
        {
          kind: 'traitChildSettlements',
          checkpoints: [{ address: child, branch }],
          occurrenceOwner: occurrence,
        },
      ],
      runStateCheckpoint: { ...checkpoint, against: 'received' },
      state: next,
      emissions: [],
    });
    expect(calls).toEqual([
      { kind: 'capture', state: received, awaiting: [semanticAddressKey(child)] },
    ]);
    expect([
      ...accumulator
        .finish()
        .traitChildSettlements.get(semanticAddressKey(child))!
        .runStateSnapshots.values(),
    ]).toEqual([{ owner }]);
  });

  it('captures against the next state when the seam asks for it', () => {
    const accumulator = createChronologyAccumulator(new Map());
    const result = applySeamStep(context, accumulator, received, {
      runStateCheckpoint: { ...checkpoint, against: 'next' },
      state: next,
      emissions: [],
    });
    expect(result).toBe(next);
    expect(calls).toEqual([{ kind: 'capture', state: next, awaiting: [] }]);
  });

  it('records target-slot history after the received capture', () => {
    const accumulator = createChronologyAccumulator(new Map());
    applySeamStep(context, accumulator, received, {
      runStateCheckpoint: { ...checkpoint, against: 'received' },
      targetHistoryCheckpoint: { origin: child, historySequence: 1, branches: [branch] },
      state: next,
      emissions: [],
    });
    expect(calls.map((call) => call.kind)).toEqual(['capture', 'targetHistory']);
  });
});

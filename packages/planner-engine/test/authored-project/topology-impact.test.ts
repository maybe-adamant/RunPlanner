import {
  createOccurrenceId,
  describeTopologyRemovalImpact,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

const root = createOccurrenceId('impact-root');
const retained = createOccurrenceId('impact-retained');
const child = createOccurrenceId('impact-child');
const grandchild = createOccurrenceId('impact-grandchild');

describe('topology removal impact', () => {
  it('owns the complete removed occurrence subtree and its exit-decision sources', () => {
    const topology = {
      startOccurrenceId: root,
      occurrences: [root, retained, child, grandchild].map((occurrenceId) => ({
        occurrenceId,
        gameName: 'TestRoom',
        state: { kind: 'none' as const },
      })),
      decisions: [
        {
          kind: 'exit' as const,
          source: { kind: 'occurrence' as const, occurrenceId: root },
          normal: {
            kind: 'batch' as const,
            rewardStore: { kind: 'none' as const },
            batchState: null,
            targets: [
              { exitKey: 'exit1', occurrenceId: retained },
              { exitKey: 'exit2', occurrenceId: child },
            ],
          },
          selection: { kind: 'normal' as const, exitKey: 'exit1' },
        },
        {
          kind: 'exit' as const,
          source: { kind: 'occurrence' as const, occurrenceId: child },
          normal: {
            kind: 'linked' as const,
            exitKey: 'exit1',
            occurrenceId: grandchild,
          },
          selection: { kind: 'derived' as const },
        },
      ],
    };

    expect(describeTopologyRemovalImpact(topology, new Set([child]))).toEqual({
      removedExitDecisionSources: [{ kind: 'occurrence', occurrenceId: child }],
      removedOccurrenceIds: [child, grandchild],
    });
  });
});

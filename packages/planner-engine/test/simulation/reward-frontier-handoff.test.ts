import { catalog } from '@run-planner/hades2-catalog';
import { createBiomeAddress } from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import { createArcanaFearState } from '../../src/simulation/arcana-fear';
import { publicRewardBranch } from '../../src/simulation/rewards/branch-lifecycle';
import { initializeTestRewardBranchesForRoute as initializeRewardBranches } from '../support/arcana-fear';

function predecessorBranch() {
  const loadout = createDefaultRouteLoadout(catalog);
  return publicRewardBranch(
    initializeRewardBranches(
      undefined,
      createArcanaFearState(catalog, loadout),
      catalog,
      loadout.startingKeepsakeKey,
      undefined,
      'Underworld',
      loadout,
    )[0]!,
  );
}

describe('reward frontier biome handoff', () => {
  it('starts the successor from the predecessor state without its biome-local events', () => {
    const base = predecessorBranch();
    const next = initializeRewardBranches([
      Object.freeze({
        ...base,
        events: Object.freeze([
          Object.freeze({
            kind: 'rewardOffered' as const,
            rewardSequence: 1,
            historySequence: 12,
            origin: createBiomeAddress('Underworld', 'F'),
            offer: Object.freeze({ rewardType: 'MaxHealthDrop' }),
            storeKey: 'RunProgress',
          }),
        ]),
        processedThroughHistorySequence: 12,
      }),
    ]);

    expect(next).toHaveLength(1);
    expect(next[0]?.events).toEqual([]);
    expect(next[0]?.processedThroughHistorySequence).toBe(0);
  });

  it('rejects a predecessor that publishes more than one frontier state', () => {
    const base = predecessorBranch();
    expect(() => initializeRewardBranches([base, base])).toThrow(
      'a completed predecessor publishes one frontier state',
    );
  });
});

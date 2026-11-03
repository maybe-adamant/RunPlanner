import { catalog } from '@run-planner/hades2-catalog';
import { createBiomeAddress } from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import { createArcanaFearState } from '../../src/simulation/arcana-fear';
import { publicRewardBranch } from '../../src/simulation/rewards/branch-lifecycle';
import { initializeTestRewardBranchForRoute } from '../support/arcana-fear';

function predecessorBranch() {
  const loadout = createDefaultRouteLoadout(catalog);
  return publicRewardBranch(
    initializeTestRewardBranchForRoute(
      undefined,
      createArcanaFearState(catalog, loadout),
      catalog,
      loadout.startingKeepsakeKey,
      undefined,
      'Underworld',
      loadout,
    ),
  );
}

describe('reward frontier biome handoff', () => {
  it('starts the successor from the predecessor state without its biome-local events', () => {
    const base = predecessorBranch();
    const next = initializeTestRewardBranchForRoute(
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
    );

    expect(next.events).toEqual([]);
    expect(next.processedThroughHistorySequence).toBe(0);
  });
});

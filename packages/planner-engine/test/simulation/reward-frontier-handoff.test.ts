import { catalog } from '@run-planner/hades2-catalog';
import { createBiomeAddress } from '@run-planner/engine/authored-project';
import { createRewardBagState } from '@run-planner/engine/reward-kernel';
import { describe, expect, it } from 'vitest';

import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import { createArcanaFearState } from '../../src/simulation/arcana-fear';
import {
  initializeRewardBranches,
  publicRewardBranch,
} from '../../src/simulation/rewards/processing';

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
  it('coalesces predecessor paths after discarding their biome-local event evidence', () => {
    const base = predecessorBranch();
    const duplicatePath = Object.freeze({
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
    });

    const next = initializeRewardBranches([base, duplicatePath]);

    expect(next).toHaveLength(1);
    expect(next[0]?.events).toEqual([]);
    expect(next[0]?.processedThroughHistorySequence).toBe(0);
  });

  it('retains distinct counted-bag states across the biome handoff', () => {
    const base = predecessorBranch();
    const store = catalog.rewards.stores.byKey.RunProgress;
    if (store === undefined) throw new Error('RunProgress store is missing');
    const full = createRewardBagState(store);
    const remainingEntryCounts = [...full.remainingEntryCounts];
    remainingEntryCounts[0] = (remainingEntryCounts[0] ?? 0) - 1;
    const depleted = Object.freeze({ remainingEntryCounts: Object.freeze(remainingEntryCounts) });

    const next = initializeRewardBranches([
      Object.freeze({ ...base, bags: Object.freeze({ RunProgress: full }) }),
      Object.freeze({ ...base, bags: Object.freeze({ RunProgress: depleted }) }),
    ]);

    expect(next).toHaveLength(2);
    expect(next.map((branch) => branch.bags.RunProgress)).toEqual([full, depleted]);
  });
});

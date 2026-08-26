import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createBatchRewardStoreAddress,
  createTargetAddress,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';

import {
  createFStart,
  createUnresolvedFOpeningBatch,
  fBiome,
  fDecision,
} from './support/f-takeover-project';

describe('reward store support', () => {
  it('evaluates an unresolved F base store from its source prefix and blocks its dependent target', () => {
    const project = createUnresolvedFOpeningBatch(createFStart());
    const rewardStore = createBatchRewardStoreAddress(fBiome, fDecision().source);
    const target = createTargetAddress(fBiome, fDecision().source, 'exit1');
    const session = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );

    expect(
      session.evaluate([
        { kind: 'batchRewardStore', rewardStore, storeKey: 'MetaProgress' },
        { kind: 'batchRewardStore', rewardStore, storeKey: 'RunProgress' },
        { kind: 'roomTarget', target, gameName: 'F_Combat02' },
      ]),
    ).toMatchObject([
      {
        kind: 'batchRewardStore',
        result: { selectedStoreKey: 'MetaProgress', selectedPossible: true },
      },
      {
        kind: 'batchRewardStore',
        result: { selectedStoreKey: 'RunProgress', selectedPossible: false },
      },
      {
        kind: 'unavailable',
        reason: 'authoredPrerequisiteMissing',
        evidence: {
          kind: 'authoredPrerequisiteMissing',
          prerequisite: { kind: 'batchRewardStore', owner: rewardStore },
        },
      },
    ]);
  });
});

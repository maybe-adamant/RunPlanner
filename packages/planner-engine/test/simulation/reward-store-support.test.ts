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
import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNOPQProject } from '@run-planner/test-fixtures/surface';

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

describe('entered-store ownership at route and biome starts', () => {
  const ledgerFor = (project: Parameters<typeof simulateProjectAssembly>[1], biomeKey: string) => {
    const biome = simulateProjectAssembly(catalog, project).evaluation.route.biomes.find(
      (candidate) => candidate.biomeKey === biomeKey,
    );
    if (biome === undefined || !('history' in biome))
      throw new Error(`${biomeKey} lost its composed history`);
    return biome.history.ledgers.enteredRewardStores.map(
      (entry) => `${entry.gameName}=${entry.storeKey}`,
    );
  };

  it('records the route start through its loadout-owned starting reward', () => {
    // The F opening declares `resolvedOffer` but has no room offer; its entered
    // store is the route-start resolution (entry-resolution.ts), so the very
    // first ledger entry is the opening with the starting reward's store.
    const entries = ledgerFor(createGoldenFGHIProject(), 'F');
    expect(entries[0]).toBe('F_Opening01=RunProgress');
  });

  it('records no entered store for a mid-route biome start', () => {
    // A later biome's start room is created with the reward skipped natively
    // (DreamRunLogic.lua), so no biome start after the first contributes.
    const entries = ledgerFor(createGoldenFGHIProject(), 'G');
    expect(entries.filter((entry) => entry.startsWith('G_Intro'))).toEqual([]);
  });

  it('counts a mid-route Hub biome not at all', () => {
    // Every N room carries the native IgnoreForRewardStoreCount exclusion.
    expect(ledgerFor(loadSurfaceNOPQProject(), 'N')).toEqual([]);
  });
});

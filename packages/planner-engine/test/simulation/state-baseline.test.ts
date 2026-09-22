import { expect, it, vi } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNOPQProject } from '@run-planner/test-fixtures/surface';
import { dreamMixedHandoffProject } from '@run-planner/test-fixtures/dream';
import { simulateProjectAssembly } from '../../src/simulation';
import * as traitCapabilities from '../../src/simulation/candidates/trait-offer/capability';
import { createTraitHistoryState } from '../../src/simulation/traits';
import { replaceSimulationTraitHistory } from '../../src/simulation/state/transitions';
import {
  addHubBoardRewardLookup,
  sharedRewardLookups,
} from '../../src/simulation/state/reward-lookups';
import { mergeEquivalentRewardBranches } from '../../src/simulation/rewards/branch-primitives';
import { initializeTestRewardBranches } from '../support/arcana-fear';

const baseline = {
  Underworld: {
    branches: [1, 1, 1, 1],
    snapshots: [39, 30, 21, 22],
    // G's opening batch is saturated to MetaProgress under the run-wide ledger,
    // so its first reward is a Meta-bag drop and the route carries one trait
    // offer — and one candidate owner and context — fewer than a per-biome
    // window would allow.
    offers: [4, 3, 5, 0],
    owners: 12,
    contexts: 12,
  },
  Surface: {
    branches: [1, 1, 1, 1],
    snapshots: [33, 31, 33, 25],
    offers: [7, 3, 3, 2],
    owners: 15,
    contexts: 15,
  },
  Dream: {
    branches: [1, 1, 1],
    // F carries nine batches: a tenth would be saturated to RunProgress and its
    // draws would empty the Run bag F_PreBoss01's forced reward needs, so the
    // prefix stops one room — and its three run-state snapshots — short.
    snapshots: [27, 36, 25],
    // The Dream F prefix carries a Boon batch in the Meta bag and the N prehub
    // holds a Hammer rather than a Pom, so one trait offer sits in N, not F.
    offers: [3, 2, 5],
    owners: 10,
    contexts: 10,
  },
};

it('retains old lookup snapshots and does not merge divergent reservation states', () => {
  const base = initializeTestRewardBranches()[0]!;
  const added = addHubBoardRewardLookup(base.state, 'hubRewardLookup', ['SpellDrop']);
  expect(base.state.rewardLookups.hubRewardLookup).toEqual([]);
  expect(added.rewardLookups.hubRewardLookup).toEqual(['SpellDrop']);
  expect(addHubBoardRewardLookup(added, 'hubRewardLookup', ['SpellDrop']).rewardLookups).toEqual(
    added.rewardLookups,
  );
  expect(mergeEquivalentRewardBranches([base, { ...base, state: added }])).toHaveLength(2);
  expect(() => sharedRewardLookups([base.state, added])).toThrow();
  expect(sharedRewardLookups([added, added])).toBe(added.rewardLookups);
});

it('preserves route branch and candidate-context counts through state consolidation', () => {
  for (const build of [createGoldenFGHIProject, loadSurfaceNOPQProject, dreamMixedHandoffProject]) {
    const project = build();
    const observer = vi.spyOn(traitCapabilities, 'createTraitOfferCandidateArtifacts');
    try {
      const { evaluation } = simulateProjectAssembly(catalog, project);
      expect(evaluation.findings).toEqual([]);
      const contexts = new Map<string, number>();
      for (const [, captured] of observer.mock.calls)
        for (const [owner, branches] of captured) contexts.set(owner, branches.length);
      const biomes = evaluation.route.biomes.map((biome) => {
        if (!('rewards' in biome)) throw new Error('fixture did not reach rewards');
        for (const branch of biome.rewards.branches) {
          const state = branch.state;
          expect(Object.isFrozen(state)).toBe(true);
          expect(state.equipment).toEqual({
            weaponKey: project.route.loadout.weaponKey,
            aspectKey: project.route.loadout.aspectKey,
          });
          expect(state.reached.routePosition.biomeKey).toBe(biome.biomeKey);
          expect(state.reached.historyView).toBe(
            biome.history.viewsBySequence[state.reached.historyView.sequence],
          );
          expect(state.rewardHistory.traitFacts.elementCounts).toEqual(
            state.traitHistory.elementCounts,
          );
          expect(state.rewardHistory.traitFacts.godBoonRarityCounts).toEqual(
            state.traitHistory.godBoonRarityCounts,
          );
          const emptyHistory = createTraitHistoryState();
          const cleared = replaceSimulationTraitHistory(state, emptyHistory);
          expect(cleared.traitHistory).toBe(emptyHistory);
          expect(cleared.rewardHistory.traitFacts.upgradableTraitCount).toBe(0);
          expect(state.traitHistory).not.toBe(emptyHistory);
          expect(cleared.rewardLookups).toBe(state.rewardLookups);
          expect(replaceSimulationTraitHistory(state, state.traitHistory)).toBe(state);
        }
        for (const checkpoint of biome.rewards.targetHistory)
          for (const state of checkpoint.states)
            expect(state.reached.historyView).toBe(
              biome.history.viewsBySequence[checkpoint.historySequence],
            );
        return {
          biome: biome.biomeKey,
          branches: biome.rewards.branches.length,
          snapshots: biome.rewards.runStateSnapshots.length,
          offers: biome.rewards.selectedTraitOffers.length,
        };
      });
      expect(
        {
          branches: biomes.map((biome) => biome.branches),
          snapshots: biomes.map((biome) => biome.snapshots),
          offers: biomes.map((biome) => biome.offers),
          owners: contexts.size,
          contexts: [...contexts.values()].reduce((sum, count) => sum + count, 0),
        },
        project.route.routeKey,
      ).toEqual(baseline[project.route.routeKey as keyof typeof baseline]);
    } finally {
      observer.mockRestore();
    }
  }
});

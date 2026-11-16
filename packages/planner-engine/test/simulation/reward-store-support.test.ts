import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createTargetAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';

import type { HistoryStateView } from '../../src/simulation/history';
import type { CanonicalAuthoredRoom } from '../../src/simulation/materialization';
import { rewardStoreCandidateSupport } from '../../src/simulation/rewards';
import {
  createFStart,
  createUnresolvedFOpeningBatch,
  fBiome,
  fDecision,
} from './support/f-takeover-project';
import { createGoldenFGHIProject, goldenGBiome } from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNOPQProject, oBiome, pBiome, qBiome } from '@run-planner/test-fixtures/surface';
import { dreamMixedHandoffProject } from '@run-planner/test-fixtures/dream';
import { loadDreamMixedHandoffCheckpoint } from '@run-planner/test-fixtures/checkpoints/dream';

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

describe("the source room's store target", () => {
  const surfaceLedgers = (biomeKey: string): HistoryStateView['ledgers'] => {
    const biome = simulateProjectAssembly(
      catalog,
      loadSurfaceNOPQProject(),
    ).evaluation.route.biomes.find((candidate) => candidate.biomeKey === biomeKey);
    if (biome === undefined || !('history' in biome))
      throw new Error(`${biomeKey} lost its composed history`);
    return biome.history.ledgers;
  };
  // Ten entered stores, three of them MetaProgress; the source's own entered store
  // makes eleven, so the counted ratio is 3/11.
  const priorStores = [...Array(7).fill('RunProgress'), ...Array(3).fill('MetaProgress')];
  const view: HistoryStateView = Object.freeze({
    sequence: priorStores.length,
    ledgers: Object.freeze({
      ...surfaceLedgers('P'),
      enteredRewardStores: Object.freeze(
        priorStores.map((storeKey, sequence) =>
          Object.freeze({
            sequence,
            origin: createOccurrenceAddress(pBiome, createOccurrenceId(`prior-${sequence}`)),
            gameName: 'P_Combat01',
            storeKey,
          }),
        ),
      ),
    }),
  });
  const pLayout = catalog.biomeLayouts.byKey['P']!;
  const support = (gameName: string, source: object) =>
    rewardStoreCandidateSupport(
      catalog,
      pLayout,
      createBatchRewardStoreAddress(pBiome, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId(gameName),
      }),
      source as CanonicalAuthoredRoom,
      catalog.rooms.byKey[gameName]!,
      view,
      view.sequence + 1,
    );

  it("rolls a Chaos room's exits with the Hero target, where the tally makes Meta certain", () => {
    // 0.45 + 10 * (0.45 - 3/11) > 1: both of Chaos_04's doors are MetaProgress.
    expect(support('Chaos_04', {})).toMatchObject({
      enteredStoreCount: 11,
      enteredMetaStoreCount: 3,
      supportStoreKeys: ['MetaProgress'],
    });
  });

  it("rolls a biome room's exits with the biome target, where the same tally rules Meta out", () => {
    // 0.20 + 10 * (0.20 - 3/11) < 0.
    expect(
      support('P_Combat01', { incomingReward: { resolvedStoreKey: 'RunProgress' } }),
    ).toMatchObject({
      enteredStoreCount: 11,
      enteredMetaStoreCount: 3,
      supportStoreKeys: ['RunProgress'],
    });
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

describe('run-wide entered-store ledger', () => {
  /** The whole run's entered-store ledger: every biome carries the run so far. */
  const routeLedger = (project: ProjectDocument): readonly string[] => {
    const evaluated = simulateProjectAssembly(catalog, project).evaluation.route.biomes.filter(
      (biome) => 'history' in biome,
    );
    const last = evaluated.at(-1);
    if (last === undefined || !('history' in last)) throw new Error('route composed no history');
    return last.history.ledgers.enteredRewardStores.map(
      (entry) => `${entry.gameName}=${entry.storeKey}`,
    );
  };

  it('follows the authored boss-door store for each of G, O, P and Q', () => {
    // P's door is the saturated case: at the Preboss's exit the run-wide ledger
    // stands at 17 entered / 2 meta, so the selection value is
    // 0.20 + 10 * (0.20 - 2/17) = 1.0235 and MetaProgress is the only supported
    // key. G (20/6), O (7/2) and Q (21/3) support both keys and stand on Run.
    // Flipping P's door to RunProgress therefore leaves the controller forbidding
    // it, and an unsupported door is not entered: the boss falls out of the
    // assessed prefix and contributes no ledger entry until the store is repaired.
    for (const [project, biome, preboss, bossGameName, authoredKey, otherKey, otherSupported] of [
      [
        createGoldenFGHIProject(),
        goldenGBiome,
        createOccurrenceId('golden-g-preboss-shop'),
        'G_Boss01',
        'RunProgress',
        'MetaProgress',
        true,
      ],
      [
        loadSurfaceNOPQProject(),
        oBiome,
        createOccurrenceId('surface-o-preboss'),
        'O_Boss01',
        'RunProgress',
        'MetaProgress',
        true,
      ],
      [
        loadSurfaceNOPQProject(),
        pBiome,
        createOccurrenceId('surface-p-preboss-shop'),
        'P_Boss01',
        'MetaProgress',
        'RunProgress',
        false,
      ],
      [
        loadSurfaceNOPQProject(),
        qBiome,
        createOccurrenceId('surface-q-preboss'),
        'Q_Boss01',
        'RunProgress',
        'MetaProgress',
        true,
      ],
    ] as const) {
      const authored = routeLedger(project).filter((entry) => entry.startsWith(bossGameName));
      expect(authored).toEqual([`${bossGameName}=${authoredKey}`]);
      const reauthored = applyProjectCommand(project, catalog, {
        kind: 'ReplaceBossDoorRewardStore',
        rewardStore: createBatchRewardStoreAddress(biome, {
          kind: 'occurrence',
          occurrenceId: preboss,
        }),
        storeKey: otherKey,
      });
      expect(routeLedger(reauthored).filter((entry) => entry.startsWith(bossGameName))).toEqual(
        otherSupported ? [`${bossGameName}=${otherKey}`] : [],
      );
    }
  });

  it('keeps the run-wide count order-independent across a reordered Dream itinerary', () => {
    // A Dream Dive runs the controller unmodified over a reordered itinerary,
    // so the same rooms in a different order carry the same count.
    //
    // The reorder has to move store-carrying rooms to witness anything: the N
    // hub rooms all declare IgnoreForRewardStoreCount, so reordering those
    // leaves the ledger empty of them and asserts nothing. This swaps two of the
    // Dream F prefix's RunProgress combat batches, whose four rooms do count.
    //
    // The ledger is compared as a multiset, not a sequence: entry order moves
    // with the itinerary, while the counts — total, MetaProgress, and each
    // room's own store — do not. The swap keeps the store at each chain position
    // unchanged because it must: the controller saturates at every F boundary,
    // so the store sequence is forced and only a same-store permutation is a
    // legal itinerary.
    const base = loadDreamMixedHandoffCheckpoint();
    const reordered = dreamMixedHandoffProject([0, 1, 3, 2, 4, 5, 6, 7, 8, 9]);
    const sorted = (entries: readonly string[]): readonly string[] => [...entries].sort();

    // Both itineraries are legal routes, so the comparison is between two runs
    // the controller accepts rather than between a run and a repair.
    expect(simulateProjectAssembly(catalog, base).evaluation.findings).toEqual([]);
    expect(simulateProjectAssembly(catalog, reordered).evaluation.findings).toEqual([]);
    // The itinerary genuinely moves, and it moves counted rooms: the ledger's
    // own order is the order those rooms were entered in.
    expect(routeLedger(reordered)).not.toEqual(routeLedger(base));
    expect(routeLedger(reordered).filter((entry) => entry.startsWith('F_Combat07='))).toEqual([
      'F_Combat07=RunProgress',
    ]);
    // ...and the run-wide count does not.
    expect(sorted(routeLedger(reordered))).toEqual(sorted(routeLedger(base)));
  });
});

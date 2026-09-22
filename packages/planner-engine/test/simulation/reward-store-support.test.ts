import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createOccurrenceId,
  createTargetAddress,
  type ProjectDocument,
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
import { createGoldenFGHIProject, goldenGBiome } from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNOPQProject, oBiome, pBiome, qBiome } from '@run-planner/test-fixtures/surface';
import { dreamMixedHandoffProject } from '@run-planner/test-fixtures/dream';

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
    // key. G (20/6), O (7/2) and Q (21/2) support both keys and stand on Run.
    for (const [project, biome, preboss, bossGameName, authoredKey, otherKey] of [
      [
        createGoldenFGHIProject(),
        goldenGBiome,
        createOccurrenceId('golden-g-preboss-shop'),
        'G_Boss01',
        'RunProgress',
        'MetaProgress',
      ],
      [
        loadSurfaceNOPQProject(),
        oBiome,
        createOccurrenceId('surface-o-preboss'),
        'O_Boss01',
        'RunProgress',
        'MetaProgress',
      ],
      [
        loadSurfaceNOPQProject(),
        pBiome,
        createOccurrenceId('surface-p-preboss-shop'),
        'P_Boss01',
        'MetaProgress',
        'RunProgress',
      ],
      [
        loadSurfaceNOPQProject(),
        qBiome,
        createOccurrenceId('surface-q-preboss'),
        'Q_Boss01',
        'RunProgress',
        'MetaProgress',
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
      expect(routeLedger(reauthored).filter((entry) => entry.startsWith(bossGameName))).toEqual([
        `${bossGameName}=${otherKey}`,
      ]);
    }
  });

  it('assesses an authored boss-door store against support like an ordinary batch', () => {
    // The authored key is bounded by the policy alone at the write, so an
    // unsupported store is reachable and must surface the ordinary finding
    // rather than passing silently: P's door supports MetaProgress only.
    const project = loadSurfaceNOPQProject();
    expect(simulateProjectAssembly(catalog, project).evaluation.findings).toEqual([]);
    const unsupported = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBossDoorRewardStore',
      rewardStore: createBatchRewardStoreAddress(pBiome, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('surface-p-preboss-shop'),
      }),
      storeKey: 'RunProgress',
    });
    expect(
      simulateProjectAssembly(catalog, unsupported).evaluation.findings.map((finding) => [
        finding.code,
        finding.origin,
      ]),
    ).toEqual([
      [
        'baseRewardStoreUnavailable',
        {
          kind: 'batchRewardStore',
          routeKey: 'Surface',
          biomeKey: 'P',
          source: {
            kind: 'occurrence',
            occurrenceId: createOccurrenceId('surface-p-preboss-shop'),
          },
        },
      ],
    ]);
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
    const base = dreamMixedHandoffProject();
    const reordered = dreamMixedHandoffProject([0, 1, 3, 2, 4, 5, 6, 7, 8]);
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

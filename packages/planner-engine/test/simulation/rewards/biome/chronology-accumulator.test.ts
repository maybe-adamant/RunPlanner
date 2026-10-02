import { describe, expect, it } from 'vitest';

import {
  createBiomeAddress,
  createEchoKeepsakeReplayAddress,
  createHubDecisionAddress,
  createKeepsakeEquipResultAddress,
  createOccurrenceAddress,
  createOccurrenceId,
} from '@run-planner/engine/authored-project';

import { ownerRegion } from '../../../../src/simulation/finding-regions';
import {
  createChronologyAccumulator,
  mergedFindings,
  settledFindings,
  siteSettlementEmissions,
  type ChronologyEmission,
} from '../../../../src/simulation/rewards/biome/chronology-accumulator';
import type { AuthoredSiteSettlementResult } from '../../../../src/simulation/rewards/biome/generation/authored-site-settlement';
import type { RewardBranchState } from '../../../../src/simulation/rewards/branch-primitives';
import type { ReachedLevelResolutionEvaluation } from '../../../../src/simulation/traits';
import { rewardFinding } from '../../../../src/simulation/rewards/findings';
import type { RewardProducerFrontier } from '../../../../src/simulation/rewards/producer-frontiers';
import type { RunStateSnapshot } from '../../../../src/simulation/rewards/run-state';
import type { SemanticFinding } from '../../../../src/simulation/model';

type SemanticFindingOrigin = SemanticFinding['origin'];

const replay = createEchoKeepsakeReplayAddress(createBiomeAddress('Underworld', 'F'));
const hammer = createKeepsakeEquipResultAddress(replay, 'experimentalHammer');
const embryo = createKeepsakeEquipResultAddress(replay, 'transcendentEmbryo');
const at = (sequence: number) => ({ kind: 'history' as const, sequence, boundary: 'at' as const });

function missing(owner: SemanticFindingOrigin) {
  return rewardFinding('keepsakeEquipResultMissing', owner, { keepsakeKey: 'TempHammerKeepsake' });
}

function added(owner: SemanticFindingOrigin, sequence: number): ChronologyEmission {
  return {
    kind: 'findings',
    rule: 'add',
    entries: [
      { finding: missing(owner), atomicRegion: ownerRegion(replay), chronology: at(sequence) },
    ],
  };
}

function evaluation(levelCount: number): ReachedLevelResolutionEvaluation {
  return {
    address: hammer,
    before: {},
    value: {},
    effectKind: 'choice',
    levelCount,
  } as unknown as ReachedLevelResolutionEvaluation;
}

const snapshot = (label: string) => ({ owner: hammer, label }) as unknown as RunStateSnapshot;

describe('chronology accumulator', () => {
  it('keeps each finding write rule distinct and the first insertion position', () => {
    const accumulator = createChronologyAccumulator(new Map());
    accumulator.mergeEmissions([added(hammer, 1), added(embryo, 2)]);
    const replacement = Object.freeze({
      finding: missing(hammer),
      atomicRegion: ownerRegion(hammer),
      chronology: at(9),
    });
    accumulator.mergeEmissions([settledFindings([replacement])]);
    expect(accumulator.findingEntries().map((entry) => entry.finding.origin)).toEqual([
      hammer,
      embryo,
    ]);
    expect(accumulator.findingEntries()[0]).toBe(replacement);

    accumulator.mergeEmissions([added(hammer, 3)]);
    expect(accumulator.findingEntries()[0]).not.toBe(replacement);
    expect(accumulator.findingEntries()[0]?.chronology).toEqual(at(3));

    // A merged entry writes once per retained evaluation, so an empty list writes nothing.
    const other = createKeepsakeEquipResultAddress(
      createEchoKeepsakeReplayAddress(createBiomeAddress('Underworld', 'G')),
      'experimentalHammer',
    );
    accumulator.mergeEmissions([
      mergedFindings([
        {
          finding: missing(other),
          atomicRegion: ownerRegion(other),
          levelResolutionEvaluations: [],
        },
      ]),
    ]);
    expect(accumulator.findingEntries()).toHaveLength(2);
    accumulator.mergeEmissions([
      mergedFindings([{ finding: missing(other), atomicRegion: ownerRegion(other) }]),
    ]);
    expect(accumulator.findingEntries()).toHaveLength(3);
  });

  it('publishes timeline nodes in first-insertion order and upgrades inclusion in place', () => {
    const accumulator = createChronologyAccumulator(new Map());
    accumulator.mergeEmissions([
      {
        kind: 'timelineFacts',
        facts: {
          nodes: [
            { owner: hammer, included: false },
            { owner: embryo, included: true },
          ],
          dependencies: [
            { owner: hammer, afterOwner: hammer },
            { owner: embryo, afterOwner: hammer },
          ],
        },
      },
      { kind: 'timelineFacts', facts: { nodes: [{ owner: hammer, included: true }] } },
      { kind: 'timelineFacts', facts: { nodes: [{ owner: embryo, included: false }] } },
    ]);
    expect(accumulator.finish().timelineFacts).toEqual({
      nodes: [
        { owner: hammer, included: true },
        { owner: embryo, included: true },
      ],
      dependencies: [{ owner: embryo, afterOwner: hammer }],
    });
  });

  it('rejects a second producer frontier for one owner', () => {
    const accumulator = createChronologyAccumulator(new Map());
    const frontier = { owners: [hammer] } as unknown as RewardProducerFrontier;
    accumulator.mergeEmissions([{ kind: 'producerFrontiers', frontiers: [frontier] }]);
    expect(() =>
      accumulator.mergeEmissions([{ kind: 'producerFrontiers', frontiers: [frontier] }]),
    ).toThrow(/already owns/);
  });

  it('keeps the first run-state snapshot per owner and stops writing once finished', () => {
    const accumulator = createChronologyAccumulator(new Map());
    const first = { owner: hammer, label: 'first' } as unknown as RunStateSnapshot;
    const second = { owner: hammer, label: 'second' } as unknown as RunStateSnapshot;
    accumulator.mergeEmissions([
      { kind: 'runStateSnapshot', ownerKey: 'owner', snapshot: first },
      { kind: 'runStateSnapshot', ownerKey: 'owner', snapshot: second },
    ]);
    expect(accumulator.hasRunStateSnapshot('owner')).toBe(true);
    expect(accumulator.finish().runStateSnapshots).toEqual([first]);
    expect(() => accumulator.mergeEmissions([added(hammer, 1)])).toThrow(/already finished/);
  });

  it('joins only distinct level-resolution evaluations to one added finding', () => {
    const accumulator = createChronologyAccumulator(new Map());
    const add = (levelCount: number): ChronologyEmission => ({
      kind: 'findings',
      rule: 'add',
      entries: [
        {
          finding: missing(hammer),
          atomicRegion: ownerRegion(hammer),
          levelResolutionEvaluation: evaluation(levelCount),
        },
      ],
    });
    accumulator.mergeEmissions([add(1), add(1), add(2)]);
    expect(
      accumulator.findingEntries()[0]?.levelResolutionEvaluations?.map((entry) => entry.levelCount),
    ).toEqual([1, 2]);
  });

  it('adds a site-settlement finding once without evaluations and once per evaluation', () => {
    const plain = { finding: missing(hammer), atomicRegion: ownerRegion(hammer) };
    const evaluated = {
      finding: missing(embryo),
      atomicRegion: ownerRegion(embryo),
      levelResolutionEvaluations: [evaluation(1), evaluation(2)],
    };
    const result = {
      branches: [],
      producerFrontiers: [],
      emissions: { findings: [{ ...plain, levelResolutionEvaluations: [] }, evaluated] },
    } as unknown as AuthoredSiteSettlementResult;
    const emissions = siteSettlementEmissions(result, replay);
    expect(emissions[0]).toMatchObject({ kind: 'findings', rule: 'add' });
    expect((emissions[0] as { readonly entries: readonly unknown[] }).entries).toHaveLength(3);
    const accumulator = createChronologyAccumulator(new Map());
    accumulator.mergeEmissions(emissions);
    expect(accumulator.findingEntries().map((entry) => entry.finding.origin)).toEqual([
      hammer,
      embryo,
    ]);
    expect(accumulator.findingEntries()[1]?.levelResolutionEvaluations).toHaveLength(2);
  });

  it('attaches a run-state snapshot once to each awaiting trait child of the occurrence', () => {
    const biome = createBiomeAddress('Underworld', 'F');
    const occurrence = createOccurrenceAddress(biome, createOccurrenceId('shop'));
    const other = createOccurrenceAddress(biome, createOccurrenceId('other'));
    const [first, second, third] = [{}, {}, {}] as unknown as RewardBranchState[];
    const accumulator = createChronologyAccumulator(new Map());
    accumulator.mergeEmissions([
      {
        kind: 'traitChildSettlements',
        checkpoints: [
          { address: hammer, branch: first! },
          { address: hammer, branch: second! },
        ],
        occurrenceOwner: occurrence,
      },
      {
        kind: 'traitChildSettlements',
        checkpoints: [{ address: embryo, branch: third! }],
        occurrenceOwner: other,
      },
    ]);
    const awaiting = accumulator.traitChildCheckpointsAwaiting(occurrence, 'owner');
    expect(awaiting.map((entry) => entry.branches)).toEqual([[first, second]]);
    const childKey = awaiting[0]!.key;
    accumulator.mergeEmissions([
      { kind: 'traitChildRunStateSnapshot', childKey, ownerKey: 'owner', snapshot: snapshot('a') },
      { kind: 'traitChildRunStateSnapshot', childKey, ownerKey: 'owner', snapshot: snapshot('b') },
    ]);
    expect(accumulator.traitChildCheckpointsAwaiting(occurrence, 'owner')).toEqual([]);
    expect(accumulator.traitChildCheckpointsAwaiting(occurrence, 'later')).toHaveLength(1);
    expect([
      ...accumulator.finish().traitChildSettlements.get(childKey)!.runStateSnapshots.values(),
    ]).toEqual([snapshot('a')]);
  });

  it('counts Hub departures and lets a fountain use replace only an open interval', () => {
    const hub = createHubDecisionAddress(createBiomeAddress('Surface', 'N'), 'hub');
    const departure = (label: string, replace: boolean): ChronologyEmission => ({
      kind: 'hubDeparture',
      hub,
      hubGameName: 'N_Hub',
      departure: snapshot(label),
      replace,
    });
    const empty = createChronologyAccumulator(new Map());
    expect(() => empty.mergeEmissions([departure('fountain', true)])).toThrow(
      'N_Hub fountain use has no Hub interval',
    );
    const accumulator = createChronologyAccumulator(new Map());
    accumulator.mergeEmissions([
      departure('entry', false),
      departure('visit', false),
      departure('fountain', true),
    ]);
    expect(accumulator.finish().hubDepartures).toEqual([
      { hub, precedingVisitCount: 0, departure: snapshot('entry') },
      { hub, precedingVisitCount: 1, departure: snapshot('fountain') },
    ]);
  });
});

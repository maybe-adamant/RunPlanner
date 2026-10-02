import { describe, expect, it } from 'vitest';

import {
  createBiomeAddress,
  createEchoKeepsakeReplayAddress,
  createKeepsakeEquipResultAddress,
} from '@run-planner/engine/authored-project';

import { ownerRegion } from '../../../../src/simulation/finding-regions';
import {
  createChronologyAccumulator,
  mergedFindings,
  settledFindings,
  type ChronologyEmission,
} from '../../../../src/simulation/rewards/biome/chronology-accumulator';
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
});

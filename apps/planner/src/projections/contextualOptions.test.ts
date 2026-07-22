import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createOccurrenceId,
  createTargetAddress,
} from '@run-planner/engine/authored-project';
import type { ProjectCandidateEvaluation } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import type { CandidateOptionProjection } from './candidateProjection';
import { createContextualOptionResolver } from './contextualOptions';

const biome = createBiomeAddress('Underworld', 'F');
const parent = createOccurrenceId('contextual-parent');
const target = createTargetAddress(biome, parent, 1);

function evaluated(support: 'forced' | 'possible', gameName: string): ProjectCandidateEvaluation {
  return {
    context: 'evaluated',
    query: { kind: 'startRoom', owner: biome, gameName },
    support,
    findings: [],
    evidence: { candidateGameName: gameName, supportedGameNames: [gameName] },
  };
}

const impossible: ProjectCandidateEvaluation = {
  context: 'evaluated',
  query: { kind: 'roomTarget', target, gameName: 'F_Combat20' },
  support: 'impossible',
  findings: [],
  evidence: {
    beforeSequence: 12,
    sourceGameName: 'F_Combat01',
    candidateGameName: 'F_Combat20',
    exitIndex: 1,
    biomeDepthCache: 4,
    biomeEncounterDepth: 5,
    candidateCreationCount: 0,
    candidateAppearanceCount: 0,
    candidateParentCreationCount: 0,
    eligibleRoomGameNames: [],
    optionalForcedRoomGameNames: [],
    requiredForcedRoomGameNames: ['F_MiniBoss01'],
    supportRoomGameNames: ['F_MiniBoss01'],
    exclusionReasons: ['forcedPool'],
    exclusions: [{ kind: 'forcedPool', requiredRoomGameNames: ['F_MiniBoss01'] }],
  },
};

const forcedPool: ProjectCandidateEvaluation = {
  ...impossible,
  query: { kind: 'roomTarget', target, gameName: 'F_MiniBoss01' },
  support: 'forced',
  evidence: {
    ...impossible.evidence,
    candidateGameName: 'F_MiniBoss01',
    requiredForcedRoomGameNames: ['F_MiniBoss01', 'F_MiniBoss02', 'F_MiniBoss03'],
    supportRoomGameNames: ['F_MiniBoss01', 'F_MiniBoss02', 'F_MiniBoss03'],
    exclusionReasons: [],
    exclusions: [],
  },
};

const unassessed: ProjectCandidateEvaluation = {
  context: 'unavailable',
  query: {
    kind: 'incomingReward',
    reward: createIncomingRewardAddress(biome, createOccurrenceId('future-room')),
    value: { rewardType: 'Boon' },
  },
  reason: 'coverageNotReached',
  evidence: {
    kind: 'coverageNotReached',
    requiredOwner: createIncomingRewardAddress(biome, createOccurrenceId('future-room')),
    requiredCheckpoint: 'afterTargetGeneration',
    coverage: { kind: 'prefix', through: { owner: target, checkpoint: 'afterTargetGeneration' } },
  },
};

describe('contextual option projection', () => {
  it('maps forced, possible, impossible, and unassessed evidence through one vocabulary', () => {
    const options: readonly CandidateOptionProjection<string>[] = Object.freeze([
      { value: 'forced', evaluation: forcedPool },
      { value: 'possible', evaluation: evaluated('possible', 'F_Opening02') },
      { value: 'impossible', evaluation: impossible },
      { value: 'unassessed', evaluation: unassessed },
    ]);
    const presentation = [
      { label: 'Opening 01', selected: false },
      { label: 'Opening 02', category: 'Opening', selected: true },
      { label: 'Combat 20', category: 'Combat', selected: false },
      { label: 'Future reward', category: 'Reward', selected: false },
    ] as const;
    const resolver = createContextualOptionResolver(catalog);
    const presentationByValue = new Map(
      options.map((option, index) => [option.value, presentation[index]!] as const),
    );
    const projected = resolver.resolve(options, (option) => presentationByValue.get(option.value)!);

    expect(projected.map((option) => option.state)).toEqual([
      'forced',
      'possible',
      'impossible',
      'unassessed',
    ]);
    expect(projected[0]?.explanation).toEqual({
      kind: 'forced',
      message: 'This option is part of the required choice set at this decision.',
    });
    expect(projected[1]).toMatchObject({ category: 'Opening', selected: true });
    expect(projected[2]?.explanation).toMatchObject({
      kind: 'force',
      message: expect.stringContaining('Root-Stalker'),
    });
    expect(projected[3]?.explanation).toMatchObject({ kind: 'coverage' });
  });

  it('caches the projection by stable candidate domain and presentation semantics', () => {
    const options: readonly CandidateOptionProjection<string>[] = Object.freeze([
      { value: 'possible', evaluation: evaluated('possible', 'F_Opening01') },
    ]);
    const resolver = createContextualOptionResolver(catalog);
    const first = resolver.resolve(options, () => ({ label: 'Opening', selected: true }));
    const second = resolver.resolve(options, () => ({ label: 'Opening', selected: true }));
    const changed = resolver.resolve(options, () => ({ label: 'Opening', selected: false }));

    expect(second).toBe(first);
    expect(changed).not.toBe(first);
  });

  it('keeps internal biome, history, profile, and store identifiers out of player copy', () => {
    const recordRequirement: ProjectCandidateEvaluation = {
      ...impossible,
      evidence: {
        ...impossible.evidence,
        exclusionReasons: ['eligibilityRequirement'],
        exclusions: [
          {
            kind: 'eligibilityRequirement',
            evaluation: {
              kind: 'recordCount',
              satisfied: false,
              record: 'roomsEntered',
              keys: ['F_MiniBoss01'],
              actual: 1,
              expected: { max: 0 },
            },
          },
        ],
      },
    };
    const recentEncounterRequirement: ProjectCandidateEvaluation = {
      ...impossible,
      evidence: {
        ...impossible.evidence,
        exclusionReasons: ['eligibilityRequirement'],
        exclusions: [
          {
            kind: 'eligibilityRequirement',
            evaluation: {
              kind: 'recentEncounterPhaseCount',
              satisfied: false,
              profileKey: 'SingleCountedCombat',
              phaseKey: 'combat',
              roomWindow: 2,
              actual: 0,
              expected: { min: 1 },
            },
          },
        ],
      },
    };
    const storeExcluded: ProjectCandidateEvaluation = {
      context: 'evaluated',
      query: {
        kind: 'incomingReward',
        reward: createIncomingRewardAddress(biome, parent),
        value: { rewardType: 'MetaCurrencyDrop' },
      },
      support: 'impossible',
      findings: [],
      evidence: {
        candidate: { rewardType: 'MetaCurrencyDrop' },
        relevantFindingCodes: ['baseRewardStoreUnavailable'],
        exclusions: [{ kind: 'store', storeKey: 'RunProgress' }],
      },
    };
    const upstreamIncomplete: ProjectCandidateEvaluation = {
      context: 'unavailable',
      query: unassessed.query,
      reason: 'upstreamIncomplete',
      evidence: { kind: 'upstreamIncomplete', upstreamBiomeKey: 'F' },
    };
    const options: readonly CandidateOptionProjection<string>[] = Object.freeze([
      { value: 'record', evaluation: recordRequirement },
      { value: 'profile', evaluation: recentEncounterRequirement },
      { value: 'store', evaluation: storeExcluded },
      { value: 'upstream', evaluation: upstreamIncomplete },
    ]);
    const projected = createContextualOptionResolver(catalog).resolve(options, (option) => ({
      label: option.value,
      selected: false,
    }));

    expect(projected.map((option) => option.explanation?.message)).toEqual([
      'The current matching history count is 1; this room requires a different count.',
      'Recent encounter history does not satisfy this room.',
      'This reward is outside the selected reward pool.',
      'Complete Erebus before editing this biome contextually.',
    ]);
    expect(JSON.stringify(projected.map((option) => option.explanation))).not.toMatch(
      /roomsEntered|SingleCountedCombat|RunProgress|Complete F /,
    );
  });

  it('names the semantic sibling location without exposing occurrence identifiers', () => {
    const reward = { rewardType: 'MaxHealthDrop' };
    const siblingExcluded: ProjectCandidateEvaluation = {
      context: 'evaluated',
      query: {
        kind: 'incomingReward',
        reward: createIncomingRewardAddress(biome, parent),
        value: reward,
      },
      support: 'impossible',
      findings: [],
      evidence: {
        candidate: reward,
        relevantFindingCodes: ['rewardBagEntryUnavailable'],
        exclusions: [
          {
            kind: 'sibling',
            priorOffers: [{ origin: target, offer: reward }],
          },
        ],
      },
    };
    const [projected] = createContextualOptionResolver(catalog).resolve(
      [{ value: reward, evaluation: siblingExcluded }],
      () => ({ label: 'Max Health', selected: false }),
    );

    expect(projected?.explanation).toEqual({
      kind: 'sibling',
      message: 'This reward conflicts with the offer on Exit 1.',
    });
    expect(projected?.explanation?.message).not.toContain(parent);

    const unorderedSibling: ProjectCandidateEvaluation = {
      ...siblingExcluded,
      evidence: {
        ...siblingExcluded.evidence,
        exclusions: [
          {
            kind: 'sibling',
            priorOffers: [
              {
                origin: createLocalRewardAddress(biome, parent, 'sideRooms', 'sideDoor1'),
                offer: reward,
              },
            ],
          },
        ],
      },
    };
    const [unordered] = createContextualOptionResolver(catalog).resolve(
      [{ value: reward, evaluation: unorderedSibling }],
      () => ({ label: 'Max Health', selected: false }),
    );
    expect(unordered?.explanation?.message).toBe(
      'This reward conflicts with the offer on Side room 1.',
    );
    expect(unordered?.explanation?.message).not.toContain('earlier');
  });

  it('derives each presentation from its candidate instead of a parallel array position', () => {
    const options: readonly CandidateOptionProjection<string>[] = Object.freeze([
      { value: 'first', evaluation: evaluated('possible', 'F_Opening01') },
      { value: 'second', evaluation: evaluated('possible', 'F_Opening02') },
    ]);
    const resolver = createContextualOptionResolver(catalog);
    const labels = new Map([
      ['second', 'Second option'],
      ['first', 'First option'],
    ]);

    expect(
      resolver
        .resolve(options, (option) => ({
          label: labels.get(option.value)!,
          selected: option.value === 'second',
        }))
        .map(({ value, label, selected }) => ({ value, label, selected })),
    ).toEqual([
      { value: 'first', label: 'First option', selected: false },
      { value: 'second', label: 'Second option', selected: true },
    ]);
  });
});

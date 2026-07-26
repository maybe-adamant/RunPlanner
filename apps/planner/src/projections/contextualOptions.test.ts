import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createExitDecisionAddress,
  createOccurrenceId,
  createTargetAddress,
} from '@run-planner/engine/authored-project';
import type {
  ProjectCandidateEvaluation,
  RoomGenerationExclusionEvidence,
  SemanticFinding,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import type { CandidateOptionProjection } from './candidateProjection';
import { createContextualOptionResolver } from './contextualOptions';

const biome = createBiomeAddress('Underworld', 'F');
const source = { kind: 'occurrence' as const, occurrenceId: createOccurrenceId('context-source') };
const target = createTargetAddress(biome, source, 'exit1');

function start(
  gameName: string,
  supportedGameNames: readonly string[],
): ProjectCandidateEvaluation {
  return {
    kind: 'startRoom',
    result: {
      gameName,
      supportedGameNames,
      selectedPossible: supportedGameNames.includes(gameName),
    },
  };
}

function roomTarget(
  exclusions: readonly RoomGenerationExclusionEvidence[],
): ProjectCandidateEvaluation {
  return {
    kind: 'roomTarget',
    result: {
      pressure: {
        targetOrigin: target,
        beforeSequence: 0,
        sourceGameName: 'F_Opening01',
        selectedGameName: 'F_Combat01',
        exitIndex: 1,
        biomeDepthCache: 0,
        biomeEncounterDepth: 0,
        selectedCreationCount: 0,
        selectedAppearanceCount: 0,
        selectedParentCreationCount: 0,
        eligibleRoomGameNames: [],
        optionalForcedRoomGameNames: [],
        requiredForcedRoomGameNames: [],
        supportRoomGameNames: [],
        selectedPossible: false,
        selectedExclusionReasons: exclusions.map((exclusion) => exclusion.kind),
        selectedExclusions: exclusions,
      },
      findings: [],
    },
  };
}

function invalidReward(finding: SemanticFinding): ProjectCandidateEvaluation {
  return {
    kind: 'incomingReward',
    result: { supported: false, findings: [finding] },
  };
}

describe('contextual option projection', () => {
  it('maps active engine results to forced, possible, and impossible without a wrapper contract', () => {
    const options: readonly CandidateOptionProjection<string>[] = Object.freeze([
      { value: 'forced', evaluation: start('F_Opening01', ['F_Opening01']) },
      { value: 'possible', evaluation: start('F_Opening02', ['F_Opening01', 'F_Opening02']) },
      { value: 'impossible', evaluation: start('F_Combat01', ['F_Opening01']) },
    ]);
    const resolved = createContextualOptionResolver(catalog).resolve(options, (option) => ({
      label: option.value,
      selected: option.value === 'impossible',
    }));

    expect(resolved.map((option) => option.state)).toEqual(['forced', 'possible', 'impossible']);
    expect(resolved[0]?.explanation).toMatchObject({ kind: 'forced' });
    expect(resolved[2]?.explanation).toMatchObject({ kind: 'unsupported' });
  });

  it('retains exact unavailable prerequisite, coverage, producer, target, and upstream evidence', () => {
    const evidence: readonly ProjectCandidateEvaluation[] = Object.freeze([
      {
        kind: 'unavailable',
        reason: 'authoredPrerequisiteMissing',
        evidence: {
          kind: 'authoredPrerequisiteMissing',
          prerequisite: {
            kind: 'batchRewardStore',
            owner: createExitDecisionAddress(biome, source),
          },
        },
      },
      {
        kind: 'unavailable',
        reason: 'coverageNotReached',
        evidence: {
          kind: 'coverageNotReached',
          requiredOwner: target,
          requiredCheckpoint: 'afterTargetGeneration',
          coverage: { kind: 'none', reason: 'notEvaluated' },
        },
      },
      {
        kind: 'unavailable',
        reason: 'upstreamInvalid',
        evidence: { kind: 'upstreamInvalid', upstreamBiomeKey: 'F' },
      },
    ]);
    const options = evidence.map((evaluation, index) => ({ value: String(index), evaluation }));
    const resolved = createContextualOptionResolver(catalog).resolve(options, (option) => ({
      label: option.value,
      selected: false,
    }));

    expect(resolved.map((option) => option.state)).toEqual([
      'unassessed',
      'unassessed',
      'unassessed',
    ]);
    expect(resolved.map((option) => option.explanation?.kind)).toEqual([
      'authoredPrerequisiteMissing',
      'coverageNotReached',
      'upstreamInvalid',
    ]);
  });

  it('presents typed room, requirement, sibling, bag, and store reasons without finding codes', () => {
    const requirement = roomTarget([
      {
        kind: 'eligibilityRequirement',
        evaluation: {
          kind: 'counterRange',
          satisfied: false,
          axis: 'biomeDepthCache',
          actual: 1,
          expected: { min: 2 },
        },
      },
    ]);
    const sibling = invalidReward({
      code: 'rewardBagEntryUnavailable',
      severity: 'error',
      phase: 'rewardGeneration',
      origin: target,
      evidence: {
        priorOffers: [
          {
            origin: {
              kind: 'target',
              routeKey: 'Underworld',
              biomeKey: 'F',
              source,
              exitKey: 'exit1',
            },
          },
        ],
      },
    });
    const bag = invalidReward({
      code: 'rewardBagEntryUnavailable',
      severity: 'error',
      phase: 'rewardGeneration',
      origin: target,
      evidence: {},
    });
    const store = invalidReward({
      code: 'baseRewardStoreUnavailable',
      severity: 'error',
      phase: 'rewardGeneration',
      origin: target,
      evidence: {},
    });
    const sourceSibling = invalidReward({
      code: 'rewardSourceUnavailable',
      severity: 'error',
      phase: 'rewardGeneration',
      origin: target,
      evidence: {
        source: 'ApolloUpgrade',
        priorOffers: [
          {
            origin: {
              kind: 'target',
              routeKey: 'Underworld',
              biomeKey: 'F',
              source,
              exitKey: 'exit2',
            },
          },
        ],
      },
    });
    const devotionPair = invalidReward({
      code: 'rewardSourceUnavailable',
      severity: 'error',
      phase: 'rewardGeneration',
      origin: target,
      evidence: { chosenSource: 'ApolloUpgrade', spurnedSource: 'AresUpgrade' },
    });
    const boonSource = invalidReward({
      code: 'rewardSourceUnavailable',
      severity: 'error',
      phase: 'rewardGeneration',
      origin: target,
      evidence: { source: 'ApolloUpgrade' },
    });
    const options = [
      { value: 'requirement', evaluation: requirement },
      { value: 'sibling', evaluation: sibling },
      { value: 'bag', evaluation: bag },
      { value: 'store', evaluation: store },
      { value: 'sourceSibling', evaluation: sourceSibling },
      { value: 'devotionPair', evaluation: devotionPair },
      { value: 'boonSource', evaluation: boonSource },
    ];
    const resolved = createContextualOptionResolver(catalog).resolve(options, (option) => ({
      label: option.value,
      selected: false,
    }));

    expect(resolved.map((option) => option.explanation?.kind)).toEqual([
      'requirement',
      'sibling',
      'bag',
      'store',
      'sibling',
      'devotionPair',
      'boonSource',
    ]);
    expect(resolved[0]?.explanation?.message).toContain('Biome depth is 1');
    expect(resolved[1]?.explanation?.message).toBe(
      'This reward conflicts with the offer on Exit 1.',
    );
    expect(resolved[2]?.explanation?.message).toBe(
      'This reward is unavailable from the selected reward pool.',
    );
    expect(resolved[3]?.explanation?.message).toBe(
      'This reward is outside the selected reward pool.',
    );
    expect(resolved[4]?.explanation?.message).toBe(
      'This reward conflicts with the offer on Exit 2.',
    );
    expect(resolved[5]?.explanation?.message).toBe('This Devotion pair is not supported here.');
    expect(resolved[6]?.explanation?.message).toBe('This God cannot be offered at this point.');
    expect(resolved.map((option) => option.explanation?.message).join(' ')).not.toContain(
      'rewardBagEntryUnavailable',
    );
    expect(resolved.map((option) => option.explanation?.message).join(' ')).not.toContain(
      'rewardSourceUnavailable',
    );
  });
});

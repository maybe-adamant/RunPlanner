import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeFieldAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createKeepsakeEquipResultAddress,
  createOccurrenceId,
  createRouteStartKeepsakeSelectionAddress,
  createTargetAddress,
} from '@run-planner/engine/authored-project';
import type {
  ProjectCandidateEvaluation,
  RoomGenerationExclusionEvidence,
  SemanticFinding,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import type { CandidateOptionProjection } from './candidateProjection';
import { createContextualOptionResolver, explainCandidateEvaluation } from './contextualOptions';

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
    expect(resolved[0]?.explanation).toEqual({
      kind: 'forced',
      message: 'This option must be included here.',
    });
    expect(resolved[2]?.explanation).toEqual({
      kind: 'unsupported',
      message: 'This option is not available with the current route.',
    });
  });

  it('uses door and room language for room-candidate evidence', () => {
    const evaluations = [
      roomTarget([{ kind: 'notCandidate' }]),
      roomTarget([{ kind: 'physicalExitUnavailable', exitIndex: 2 }]),
      roomTarget([
        {
          kind: 'exitIncompatible',
          compatibilityPolicyKey: 'test',
          sourceGameName: 'F_Opening01',
          candidateGameName: 'F_Combat01',
        },
      ]),
      roomTarget([{ kind: 'maxCreationsThisRun', actual: 3, maximum: 3 }]),
      roomTarget([{ kind: 'maxCreationsPerRoom', actual: 2, maximum: 2 }]),
      roomTarget([{ kind: 'maxAppearancesThisBiome', actual: 4, maximum: 4 }]),
      roomTarget([{ kind: 'forcedPool', requiredRoomGameNames: ['F_Opening01'] }]),
      roomTarget([
        {
          kind: 'eligibilityRequirement',
          evaluation: { kind: 'minExits', satisfied: false, actual: 2, minimum: 3 },
        },
      ]),
      roomTarget([
        {
          kind: 'eligibilityRequirement',
          evaluation: {
            kind: 'currentBatchTargetCount',
            satisfied: false,
            actual: 2,
            expected: { min: 3 },
          },
        },
      ]),
      roomTarget([
        {
          kind: 'eligibilityRequirement',
          evaluation: {
            kind: 'currentBatchRoomCount',
            satisfied: false,
            roomGameNames: ['F_Combat01'],
            actual: 2,
            expected: { max: 1 },
          },
        },
      ]),
    ];

    expect(
      evaluations.map((evaluation) => explainCandidateEvaluation(catalog, evaluation)?.message),
    ).toEqual([
      'This room is not available for this door.',
      'Door 2 is unavailable here.',
      'Combat 01 is incompatible with this door.',
      'This room can appear at most 3 times on this route.',
      'This room can appear at most 2 times among these doors.',
      'This room can appear at most 4 times in this biome.',
      'This room must be included here: Opening 01.',
      'This room has 2 doors; this room requires at least 3.',
      "These doors contain 2 rooms, outside the room's supported range.",
      "These doors contain 2 matching rooms, outside the room's supported range.",
    ]);
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
        reason: 'authoredPrerequisiteMissing',
        evidence: {
          kind: 'authoredPrerequisiteMissing',
          prerequisite: {
            kind: 'biomeField',
            owner: createBiomeFieldAddress(biome, 'field'),
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
        reason: 'producerFrontierUnavailable',
        evidence: { kind: 'producerFrontierUnavailable', producer: target },
      },
      {
        kind: 'unavailable',
        reason: 'targetNotReachable',
        evidence: { kind: 'targetNotReachable', target },
      },
      {
        kind: 'unavailable',
        reason: 'upstreamIncomplete',
        evidence: { kind: 'upstreamIncomplete', upstreamBiomeKey: 'F' },
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
      'unassessed',
      'unassessed',
      'unassessed',
      'unassessed',
    ]);
    expect(resolved.map((option) => option.explanation?.kind)).toEqual([
      'authoredPrerequisiteMissing',
      'authoredPrerequisiteMissing',
      'coverageNotReached',
      'producerFrontierUnavailable',
      'targetNotReachable',
      'upstreamIncomplete',
      'upstreamInvalid',
    ]);
    expect(resolved.map((option) => option.explanation?.message)).toEqual([
      'Choose the required reward pool before evaluating this option.',
      'Choose the required biome setting before evaluating this option.',
      'This part of the route has not been evaluated yet.',
      'The current route does not reach this reward yet.',
      'This door is not reachable in the current route.',
      'Finish Erebus before choices here can be evaluated.',
      'Fix Erebus before choices here can be evaluated.',
    ]);
  });

  it('uses player-facing copy for finding-backed candidate explanations', () => {
    const explanations = [
      invalidReward({
        code: 'targetRoomSupportEmpty',
        severity: 'error',
        phase: 'roomGeneration',
        origin: target,
        evidence: {},
      }),
      invalidReward({
        code: 'targetRoomUnavailable',
        severity: 'error',
        phase: 'roomGeneration',
        origin: target,
        evidence: {},
      }),
      invalidReward({
        code: 'sideRoomGenerationUnavailable',
        severity: 'error',
        phase: 'roomGeneration',
        origin: target,
        evidence: {},
      }),
      invalidReward({
        code: 'rewardAcquisitionUnavailable',
        severity: 'error',
        phase: 'rewardGeneration',
        origin: target,
        evidence: {},
      }),
      invalidReward({
        code: 'rewardBagSupportEmpty',
        severity: 'error',
        phase: 'rewardGeneration',
        origin: target,
        evidence: {},
      }),
      invalidReward({
        code: 'rewardPayloadInvalid',
        severity: 'error',
        phase: 'rewardGeneration',
        origin: target,
        evidence: {},
      }),
      invalidReward({
        code: 'shopOfferUnavailable',
        severity: 'error',
        phase: 'rewardGeneration',
        origin: target,
        evidence: {},
      }),
      invalidReward({
        code: 'targetMissing',
        severity: 'error',
        phase: 'completeness',
        origin: target,
        evidence: {},
      }),
      invalidReward({
        code: 'shopPurchaseUnavailable',
        severity: 'error',
        phase: 'rewardGeneration',
        origin: target,
        evidence: {},
      }),
    ];

    expect(
      explanations.map((evaluation) => explainCandidateEvaluation(catalog, evaluation)?.message),
    ).toEqual([
      'No room can be offered when this door appears.',
      'This room is not among the rooms that can be offered for this door.',
      'This side-room setup is not available with the selected Hub rooms.',
      'This reward cannot be acquired here.',
      'No available reward pool can offer this reward.',
      'These reward details are not valid.',
      'These Shop offers cannot appear together.',
      'Finish the required earlier route steps before this option can be evaluated.',
      'This purchase order cannot be completed with the current shop configuration.',
    ]);
  });

  it('explains each keepsake equip-result family without shared Jeweled Pom copy', () => {
    const selection = createRouteStartKeepsakeSelectionAddress('Underworld');
    const jeweledPom = createKeepsakeEquipResultAddress(selection, 'jeweledPom');
    const experimentalHammer = createKeepsakeEquipResultAddress(selection, 'experimentalHammer');
    const explanation = (
      code: 'keepsakeEquipResultMissing' | 'keepsakeEquipResultUnavailable',
      origin: typeof jeweledPom | typeof experimentalHammer,
    ) =>
      explainCandidateEvaluation(
        catalog,
        invalidReward({ code, evidence: {}, origin, phase: 'completeness', severity: 'error' }),
      )?.message;

    expect(explanation('keepsakeEquipResultMissing', jeweledPom)).toBe(
      'Choose the Hades trait granted by Jeweled Pom.',
    );
    expect(explanation('keepsakeEquipResultUnavailable', jeweledPom)).toBe(
      'Choose a Hades trait eligible when Jeweled Pom is equipped.',
    );
    expect(explanation('keepsakeEquipResultMissing', experimentalHammer)).toBe(
      'Choose the Hammer trait granted by Experimental Hammer.',
    );
    expect(explanation('keepsakeEquipResultUnavailable', experimentalHammer)).toBe(
      'Choose a Hammer trait compatible with the active weapon and aspect.',
    );
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
      'This reward conflicts with the offer on Door 1.',
    );
    expect(resolved[2]?.explanation?.message).toBe(
      'This reward is unavailable from the selected reward pool.',
    );
    expect(resolved[3]?.explanation?.message).toBe(
      'This reward is outside the selected reward pool.',
    );
    expect(resolved[4]?.explanation?.message).toBe(
      'This reward conflicts with the offer on Door 2.',
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

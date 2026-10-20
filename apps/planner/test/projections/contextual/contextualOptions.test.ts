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
  RequirementEvaluationEvidence,
  RoomGenerationExclusionEvidence,
  SemanticFinding,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import type { CandidateOptionProjection } from '@planner/projections/candidates/candidateProjection';
import {
  createContextualOptionResolver,
  explainCandidateEvaluation,
} from '@planner/projections/contextual/contextualOptions';

const biome = createBiomeAddress('Underworld', 'F');

/** The reason lines a candidate shows, joined so a two-line case reads as one value. */
function reasons(evaluation: ProjectCandidateEvaluation): string | undefined {
  const lines = explainCandidateEvaluation(catalog, evaluation).map((reason) => reason.message);
  return lines.length === 0 ? undefined : lines.join(' | ');
}
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
    expect(resolved[0]?.explanations?.[0]).toEqual({
      kind: 'forced',
      message: 'This option must be included here.',
    });
    expect(resolved[2]?.explanations).toEqual([
      { kind: 'startRoom', message: 'This biome starts in Opening 01.' },
    ]);
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

    expect(evaluations.map((evaluation) => reasons(evaluation))).toEqual([
      'Not one of the rooms this door can offer.',
      'Door 2 is unavailable here.',
      'Combat 01 is incompatible with this door.',
      'This room can appear at most 3 times on this route.',
      'This room can appear at most 2 times among these doors.',
      'This room can appear at most 4 times in this biome.',
      'This room must be included here: Opening 01.',
      'This room has 2 doors; this room requires at least 3.',
      'These doors lead to 2 rooms; this room requires at least 3.',
      '2 of these doors lead to Combat 01; this room requires at most 1.',
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
    expect(resolved.map((option) => option.explanations?.[0]?.kind)).toEqual([
      'authoredPrerequisiteMissing',
      'authoredPrerequisiteMissing',
      undefined,
      'producerFrontierUnavailable',
      'targetNotReachable',
      'upstreamIncomplete',
      'upstreamInvalid',
    ]);
    expect(resolved.map((option) => option.explanations?.[0]?.message)).toEqual([
      'Choose the required reward pool before evaluating this option.',
      'Choose the required biome setting before evaluating this option.',
      undefined,
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
        phase: 'roomGeneration',
        origin: target,
        evidence: {},
      }),
      invalidReward({
        code: 'targetRoomUnavailable',
        phase: 'roomGeneration',
        origin: target,
        evidence: {},
      }),
      invalidReward({
        code: 'sideRoomGenerationUnavailable',
        phase: 'roomGeneration',
        origin: target,
        evidence: {},
      }),
      invalidReward({
        code: 'rewardAcquisitionUnavailable',
        phase: 'rewardGeneration',
        origin: target,
        evidence: {},
      }),
      invalidReward({
        code: 'rewardBagSupportEmpty',
        phase: 'rewardGeneration',
        origin: target,
        evidence: {},
      }),
      invalidReward({
        code: 'rewardPayloadInvalid',
        phase: 'rewardGeneration',
        origin: target,
        evidence: {},
      }),
      invalidReward({
        code: 'shopOfferUnavailable',
        phase: 'rewardGeneration',
        origin: target,
        evidence: {},
      }),
      invalidReward({
        code: 'targetMissing',
        phase: 'completeness',
        origin: target,
        evidence: {},
      }),
      invalidReward({
        code: 'shopPurchaseUnavailable',
        phase: 'rewardGeneration',
        origin: target,
        evidence: {},
      }),
    ];

    expect(explanations.map((evaluation) => reasons(evaluation))).toEqual([
      'No room can be offered when this door appears.',
      'This room is not among the rooms that can be offered for this door.',
      'This side-room setup is not available with the selected Hub rooms.',
      'This reward cannot be acquired here.',
      'No available reward pool can offer this reward.',
      'These reward details are not valid.',
      'These Shop offers cannot appear together.',
      'Choose the next room in Erebus first.',
      'This purchase order cannot be completed with the current shop configuration.',
    ]);
  });

  it('explains each keepsake equip-result family without shared Jeweled Pom copy', () => {
    const selection = createRouteStartKeepsakeSelectionAddress('Underworld');
    const jeweledPom = createKeepsakeEquipResultAddress(selection, 'jeweledPom');
    const experimentalHammer = createKeepsakeEquipResultAddress(selection, 'experimentalHammer');
    const transcendentEmbryo = createKeepsakeEquipResultAddress(selection, 'transcendentEmbryo');
    const explanation = (
      code: 'keepsakeEquipResultMissing' | 'keepsakeEquipResultUnavailable',
      origin: typeof jeweledPom | typeof experimentalHammer | typeof transcendentEmbryo,
    ) => reasons(invalidReward({ code, evidence: {}, origin, phase: 'completeness' }));

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
    expect(explanation('keepsakeEquipResultMissing', transcendentEmbryo)).toBe(
      'Choose the Chaos blessing granted by Transcendent Embryo.',
    );
    expect(explanation('keepsakeEquipResultUnavailable', transcendentEmbryo)).toBe(
      'Choose a Chaos blessing eligible when Transcendent Embryo is equipped.',
    );
  });

  it('explains both legal repairs for a missing Echo Pom child', () => {
    expect(
      reasons(
        invalidReward({
          code: 'echoPomTargetMissing',
          phase: 'rewardGeneration',
          origin: target,
          evidence: {},
        }),
      ),
    ).toBe('Choose a greatest-level trait, or record that no eligible target exists.');
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
      phase: 'rewardGeneration',
      origin: target,
      evidence: {},
    });
    const store = invalidReward({
      code: 'baseRewardStoreUnavailable',
      phase: 'rewardGeneration',
      origin: target,
      evidence: {},
    });
    const sourceSibling = invalidReward({
      code: 'rewardSourceUnavailable',
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
      phase: 'rewardGeneration',
      origin: target,
      evidence: { chosenSource: 'ApolloUpgrade', spurnedSource: 'AresUpgrade' },
    });
    const boonSource = invalidReward({
      code: 'rewardSourceUnavailable',
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

    expect(resolved.map((option) => option.explanations?.[0]?.kind)).toEqual([
      'requirement',
      'sibling',
      'bag',
      'store',
      'sibling',
      'devotionPair',
      'boonSource',
    ]);
    expect(resolved[0]?.explanations?.[0]?.message).toContain('Biome depth is 1');
    expect(resolved[1]?.explanations?.[0]?.message).toBe(
      'This reward conflicts with the offer on Door 1.',
    );
    expect(resolved[2]?.explanations?.[0]?.message).toBe(
      'This reward is unavailable from the selected reward pool.',
    );
    expect(resolved[3]?.explanations?.[0]?.message).toBe(
      'This reward pool is unavailable at this point.',
    );
    expect(resolved[4]?.explanations?.[0]?.message).toBe(
      'This reward conflicts with the offer on Door 2.',
    );
    expect(resolved[5]?.explanations?.[0]?.message).toBe(
      'This Devotion pair is not supported here.',
    );
    expect(resolved[6]?.explanations?.[0]?.message).toBe(
      'This God cannot be offered at this point.',
    );
    expect(resolved.map((option) => option.explanations?.[0]?.message).join(' ')).not.toContain(
      'rewardBagEntryUnavailable',
    );
    expect(resolved.map((option) => option.explanations?.[0]?.message).join(' ')).not.toContain(
      'rewardSourceUnavailable',
    );
  });

  it('names the missing earlier step for each structural finding', () => {
    const structural = (code: SemanticFinding['code'], evidence: SemanticFinding['evidence']) =>
      reasons(invalidReward({ code, phase: 'completeness', origin: target, evidence }));

    expect([
      structural('batchRewardStoreMissing', { parentGameName: 'F_Opening01' }),
      structural('batchStateMissing', { batchPolicy: 'fields' }),
      structural('biomeFieldMissing', { fieldKey: 'maxNonGoalRewards' }),
      structural('biomeTopologyMissing', { biomeKey: 'F' }),
      structural('hubOpenSetIncomplete', { actualCount: 1, minimumCount: 2, maximumCount: 3 }),
      structural('hubVisitOrderIncomplete', {
        actualCount: 2,
        requiredCount: 6,
        fountainUsed: false,
      }),
      structural('hubVisitOrderIncomplete', {
        actualCount: 6,
        requiredCount: 6,
        fountainUsed: false,
      }),
      structural('pickedTargetMissing', { decisionKind: 'hubHandoff' }),
      structural('pickedTargetMissing', { continuationKind: 'batch' }),
      structural('targetMissing', { exitKey: 'exit2', parentGameName: 'F_Opening01' }),
    ]).toEqual([
      'Choose the reward pool for the doors from Opening 01 first.',
      'Choose the Fields door roll in Erebus first.',
      'Choose the rolled non-goal limit in Erebus first.',
      'Create the opening room in Erebus first.',
      'Open 2–3 Hub rooms in Erebus first; 1 open.',
      'Plan 6 Hub visits in Erebus first; 2 planned.',
      'Use the Hub fountain in Erebus first.',
      'Choose the door taken from the Hub in Erebus first.',
      'Choose the door taken in Erebus first.',
      'Choose the room behind Door 2 from Opening 01 first.',
    ]);
  });

  it('shows at most two distinct reasons, most direct first', () => {
    expect(
      reasons(
        roomTarget([
          { kind: 'currentRoomRepeat', sourceGameName: 'F_Combat01' },
          { kind: 'maxCreationsThisRun', actual: 3, maximum: 3 },
          { kind: 'currentRoomRepeat', sourceGameName: 'F_Combat01' },
          { kind: 'maxAppearancesThisBiome', actual: 4, maximum: 4 },
        ]),
      ),
    ).toBe(
      'The current room cannot immediately repeat. | This room can appear at most 3 times on this route.',
    );
    const rewardFinding = (code: SemanticFinding['code']): SemanticFinding => ({
      code,
      phase: 'rewardGeneration',
      origin: target,
      evidence: {},
    });
    expect(
      reasons({
        kind: 'incomingReward',
        result: {
          supported: false,
          findings: [
            rewardFinding('rewardBagEntryUnavailable'),
            rewardFinding('rewardBagEntryUnavailable'),
            rewardFinding('rewardPayloadInvalid'),
          ],
        },
      }),
    ).toBe(
      'This reward is unavailable from the selected reward pool. | These reward details are not valid.',
    );
  });

  it("drops a door's summary finding when its exclusions already explain the room", () => {
    const evaluation = roomTarget([{ kind: 'currentRoomRepeat', sourceGameName: 'F_Combat01' }]);
    if (evaluation.kind !== 'roomTarget') throw new Error('room target fixture');
    expect(
      reasons({
        ...evaluation,
        result: {
          ...evaluation.result,
          findings: [
            {
              code: 'targetRoomUnavailable',
              phase: 'roomGeneration',
              origin: target,
              evidence: {},
            },
          ],
        },
      }),
    ).toBe('The current room cannot immediately repeat.');
  });

  it('keeps one line when a force minimum repeats the same eligibility counter', () => {
    expect(
      reasons(
        roomTarget([
          { kind: 'forceMinimum', axis: 'biomeDepthCache', actual: 1, minimum: 4 },
          {
            kind: 'eligibilityRequirement',
            evaluation: {
              kind: 'counterRange',
              satisfied: false,
              axis: 'biomeDepthCache',
              actual: 1,
              expected: { min: 4, max: 6 },
            },
          },
        ]),
      ),
    ).toBe('Biome depth is 1; this room requires 4–6.');
  });

  it('names the failed room condition instead of a generic history sentence', () => {
    const requirement = (evaluation: RequirementEvaluationEvidence) =>
      reasons(roomTarget([{ kind: 'eligibilityRequirement', evaluation }]));
    const entered: RequirementEvaluationEvidence = {
      kind: 'recordCount',
      satisfied: false,
      record: 'roomsEntered',
      keys: ['F_Combat01'],
      actual: 1,
      expected: { max: 0 },
    };

    expect(requirement(entered)).toBe('Combat 01 was already entered this run.');
    expect(
      requirement({
        kind: 'distinctRecordKeyCount',
        satisfied: false,
        record: 'lootTypeHistory',
        keys: ['ApolloUpgrade', 'ZeusUpgrade'],
        actual: 1,
        expected: { min: 2 },
      }),
    ).toBe('Requires rewards from at least 2 different gods this run; currently 1.');
    expect(
      requirement({
        kind: 'not',
        satisfied: false,
        child: { kind: 'routeKeyEquals', satisfied: true, expected: 'Underworld' },
      }),
    ).toBe('Unavailable on the Underworld route.');
    expect(
      requirement({
        kind: 'any',
        satisfied: false,
        children: [
          {
            kind: 'counterRange',
            satisfied: false,
            axis: 'biomeDepthCache',
            actual: 1,
            expected: { min: 3 },
          },
          entered,
        ],
      }),
    ).toBe(
      'Requires one of: Biome depth is 1; this room requires at least 3; or Combat 01 was already entered this run.',
    );
  });

  it('names the room category a door offers when the selected room is outside it', () => {
    const evaluation = roomTarget([{ kind: 'notCandidate' }]);
    if (evaluation.kind !== 'roomTarget') throw new Error('room target fixture');
    const offered: ProjectCandidateEvaluation = {
      ...evaluation,
      result: {
        ...evaluation.result,
        pressure: {
          ...evaluation.result.pressure,
          selectedGameName: 'F_MiniBoss01',
          eligibleRoomGameNames: ['F_Combat01', 'F_Combat02'],
        },
      },
    };
    expect(reasons(offered)).toBe('This door does not lead to Miniboss rooms.');
  });
});

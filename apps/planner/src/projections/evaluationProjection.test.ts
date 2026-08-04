import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeFieldAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createHubDecisionAddress,
  createHubRoomAddress,
  createLocalChildAddress,
  createLocalChildGroupAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectAddress,
  createTargetAddress,
  semanticAddressKey,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import {
  type FindingCode,
  type ProjectBiomeEvaluation,
  type ProjectEvaluation,
  type ProjectRouteEvaluation,
  type SemanticFinding,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  type BiomeFeedbackPresentation,
  findingDestinationLabel,
  indexFindingsByOwner,
  presentBiomeFeedbackContext,
  presentBiomeStatus,
  presentFinding,
  presentProjectStatus,
  presentRouteStatus,
  projectFeedbackHierarchy,
} from './evaluationProjection';

const allFindingCodes = [
  'fieldsCageOutcomeUnavailable',
  'hubOpenSlotUnavailable',
  'biomeTopologyMissing',
  'continuationMissing',
  'pickedShopStateMissing',
  'pickedTargetMissing',
  'targetMissing',
  'targetRoomSupportEmpty',
  'targetRoomUnavailable',
  'encounterUnavailable',
  'encounterSlotActivationUnavailable',
  'sideRoomGenerationUnavailable',
  'baseRewardStoreUnavailable',
  'rewardAcquisitionUnavailable',
  'rewardBagSupportEmpty',
  'rewardBagEntryUnavailable',
  'rewardPayloadInvalid',
  'rewardSourceUnavailable',
  'shopOfferUnavailable',
  'shopPurchaseUnavailable',
] as const satisfies readonly FindingCode[];

const biome = createBiomeAddress('Underworld', 'F');

function finding(code: FindingCode, origin: SemanticAddress = biome): SemanticFinding {
  return {
    code,
    severity: 'error',
    phase: 'completeness',
    origin,
    evidence: { internalGameName: 'F_Combat01' },
  };
}

describe('evaluation presentation', () => {
  it('provides explicit player copy for every Phase 3 finding code', () => {
    expect(allFindingCodes).toHaveLength(20);
    for (const code of allFindingCodes) {
      const presentation = presentFinding(finding(code));
      expect(presentation.title).not.toBe(code);
      expect(presentation.description).not.toContain(code);
      expect(presentation.title).not.toContain('F_Combat01');
      expect(presentation.description).not.toContain('F_Combat01');
    }
  });

  it('translates finding copy without changing Shop purchase-order wording', () => {
    const expected = [
      [
        'batchRewardStoreMissing',
        'Choose a reward pool',
        'Choose the reward pool before choosing rooms for these doors.',
      ],
      [
        'batchStateMissing',
        'Finish setting up these doors',
        'Choose the door setup before choosing rooms for these doors.',
      ],
      [
        'biomeFieldMissing',
        'Choose the biome setting',
        'Choose the required biome setting before building its doors.',
      ],
      ['continuationMissing', 'Continue this route', 'Continue from here to complete this route.'],
      [
        'hubOpenSetIncomplete',
        'Choose open Hub rooms',
        'Choose nine or ten Ephyra rooms to keep open in the Hub.',
      ],
      [
        'hubVisitOrderIncomplete',
        'Choose all six Hub visits',
        'Choose six different open Hub rooms in the order you enter them.',
      ],
      [
        'hubOpenSlotUnavailable',
        'Hub room cannot be open together',
        'This Ephyra room cannot stay open with the selected Hub rooms.',
      ],
      [
        'pickedShopStateMissing',
        'Finish setting up this Shop',
        'Choose every Shop offer before continuing.',
      ],
      [
        'pickedTargetMissing',
        'Choose the door taken',
        'Choose the one door taken from these doors.',
      ],
      ['targetMissing', 'Choose a room for every door', 'Choose a room for this door.'],
      [
        'targetRoomSupportEmpty',
        'No room can appear here',
        'The game has no room to offer when this door appears.',
      ],
      [
        'targetRoomUnavailable',
        'Room cannot appear here',
        'The selected room is not among the rooms that can be offered for this door.',
      ],
      [
        'encounterUnavailable',
        'Encounter cannot occur here',
        'The selected encounter is unavailable when this room begins.',
      ],
      [
        'encounterSlotActivationUnavailable',
        'Encounter phase is not active',
        'The selected room setup does not activate this encounter phase.',
      ],
      [
        'sideRoomGenerationUnavailable',
        'Side room generation cannot occur here',
        'This side-room setup is not available with the selected Hub rooms.',
      ],
      [
        'baseRewardStoreUnavailable',
        'Reward pool cannot appear here',
        'The selected reward pool is not one of the available reward pools for these doors.',
      ],
      [
        'rewardAcquisitionUnavailable',
        'Reward cannot be acquired',
        'The selected reward cannot be acquired here.',
      ],
      [
        'rewardBagSupportEmpty',
        'Reward pool has no possible offer',
        'This reward pool cannot offer a reward here.',
      ],
      [
        'rewardBagEntryUnavailable',
        'Reward is unavailable from this pool',
        'The selected reward is not available from this reward pool.',
      ],
      [
        'rewardSourceUnavailable',
        'Reward source is unavailable',
        'The selected reward source cannot be offered at this point in the route.',
      ],
      [
        'shopOfferUnavailable',
        'Shop offer is unavailable',
        'These Shop offers cannot appear together.',
      ],
      [
        'shopPurchaseUnavailable',
        'Shop purchase is unavailable',
        'The selected purchase order cannot be completed.',
      ],
    ] as const satisfies readonly (readonly [FindingCode, string, string])[];

    for (const [code, title, description] of expected) {
      expect(presentFinding(finding(code))).toEqual({ title, description });
    }
  });

  it('indexes every finding directly under its semantic owner', () => {
    const target = createTargetAddress(
      biome,
      { kind: 'occurrence', occurrenceId: createOccurrenceId('parent') },
      'exit2',
    );
    const room = createOccurrenceAddress(biome, createOccurrenceId('room'));
    const targetFindings = [
      finding('targetRoomSupportEmpty', target),
      finding('targetRoomUnavailable', target),
    ];
    const roomFinding = finding('pickedShopStateMissing', room);

    const index = indexFindingsByOwner([...targetFindings, roomFinding]);

    expect(index.size).toBe(2);
    expect(index.get(semanticAddressKey(target))).toEqual(targetFindings);
    expect(index.get(semanticAddressKey(room))).toEqual([roomFinding]);
  });

  it('projects scope-specific status language without changing evaluation state', () => {
    expect(presentProjectStatus({ status: 'empty' } as ProjectEvaluation)).toEqual({
      label: 'Empty project',
      tone: 'empty',
    });
    expect(presentRouteStatus({ status: 'empty' } as ProjectRouteEvaluation)).toEqual({
      label: 'Not configured',
      tone: 'empty',
    });
    expect(presentBiomeStatus(undefined)).toEqual({
      label: 'Blocked',
      tone: 'blocked',
    });
    expect(presentBiomeStatus({ authoring: 'incomplete' })).toEqual({
      label: 'Incomplete',
      tone: 'incomplete',
    });
    expect(
      presentBiomeStatus({
        authoring: 'complete',
        validity: 'valid',
      }),
    ).toEqual({ label: 'Complete · Valid', tone: 'valid' });
    expect(
      presentBiomeStatus({
        authoring: 'complete',
        validity: 'invalid',
      }),
    ).toEqual({ label: 'Complete · Invalid', tone: 'invalid' });
  });

  it('projects aggregate feedback and coverage context through the route hierarchy', () => {
    const fFinding = finding('biomeTopologyMissing');
    const fEvaluation = {
      biomeKey: 'F',
      origin: biome,
      authoring: 'incomplete',
      frontier: biome,
      coverage: { kind: 'none', reason: 'notEvaluated' },
      findings: [fFinding],
    } as const satisfies ProjectBiomeEvaluation;
    const underworld = {
      routeKey: 'Underworld',
      status: 'incomplete',
      configuredBiomeKeys: ['F', 'G'],
      biomes: [fEvaluation],
      processing: {
        completeValidPrefix: [],
        active: { kind: 'incomplete', biomeKey: 'F' },
        blockedSuffix: ['G'],
      },
      findings: [fFinding],
      summary: {
        configuredBiomeCount: 2,
        evaluatedBiomeCount: 1,
        validatedBiomeCount: 0,
        incompleteBiomeCount: 1,
        invalidBiomeCount: 0,
        blockedBiomeCount: 1,
        eligibleForExecutionPlan: false,
      },
    } as const satisfies ProjectRouteEvaluation;
    const surface = {
      routeKey: 'Surface',
      status: 'empty',
      configuredBiomeKeys: [],
      biomes: [],
      processing: { completeValidPrefix: [], active: null, blockedSuffix: [] },
      findings: [],
      summary: {
        configuredBiomeCount: 0,
        evaluatedBiomeCount: 0,
        validatedBiomeCount: 0,
        incompleteBiomeCount: 0,
        invalidBiomeCount: 0,
        blockedBiomeCount: 0,
        eligibleForExecutionPlan: false,
      },
    } as const satisfies ProjectRouteEvaluation;
    const evaluation = {
      status: 'incomplete',
      projectId: 'feedback-project',
      catalogVersion: catalog.version,
      routes: [underworld, surface],
      findings: [fFinding],
      summary: underworld.summary,
    } as const satisfies ProjectEvaluation;

    const feedback = projectFeedbackHierarchy(evaluation);
    const fFeedback = feedback.routes.get('Underworld')?.biomes.get('F');
    const gFeedback = feedback.routes.get('Underworld')?.biomes.get('G');

    expect(projectFeedbackHierarchy(evaluation)).toBe(feedback);
    expect(feedback).toMatchObject({ findingCount: 1, status: { tone: 'incomplete' } });
    expect(feedback.routes.get('Underworld')).toMatchObject({
      findingCount: 1,
      status: { tone: 'incomplete' },
    });
    expect(fFeedback).toMatchObject({
      context: 'unassessed',
      findingCount: 1,
      status: { tone: 'incomplete' },
    });
    expect(gFeedback).toMatchObject({
      blockedByBiomeKey: 'F',
      context: 'blocked',
      findingCount: 0,
      status: { tone: 'blocked' },
    });
    if (fFeedback === undefined || gFeedback === undefined) {
      throw new Error('feedback hierarchy omitted a configured biome');
    }
    expect(presentBiomeFeedbackContext(catalog, fFeedback)).toBe(
      'Erebus is not evaluated yet. You can still edit it.',
    );
    expect(presentBiomeFeedbackContext(catalog, gFeedback)).toBe(
      'Finish and fix Erebus before Oceanus can be evaluated. You can still edit it.',
    );
  });

  it('explains a blocked biome without exposing evaluated-prefix internals', () => {
    const feedback = {
      biomeKey: 'F',
      context: 'blocked',
      findingCount: 0,
      status: { label: 'Blocked', tone: 'blocked' },
    } as const satisfies BiomeFeedbackPresentation;

    expect(presentBiomeFeedbackContext(catalog, feedback)).toBe(
      'Finish the earlier biomes before this biome can be evaluated. You can still edit it.',
    );
  });

  it('uses declaration labels and player-facing finding destinations', () => {
    const target = createTargetAddress(
      biome,
      { kind: 'occurrence', occurrenceId: createOccurrenceId('private-parent') },
      'exit2',
    );
    const room = createOccurrenceAddress(biome, createOccurrenceId('private-room'));
    const hBiome = createBiomeAddress('Underworld', 'H');
    const nBiome = createBiomeAddress('Surface', 'N');
    const hRoom = createOccurrenceId('fields-room');
    const nRoom = createOccurrenceId('ephyra-room');

    expect(findingDestinationLabel(catalog, createProjectAddress())).toBe('Project');
    expect(findingDestinationLabel(catalog, createBiomeFieldAddress(biome, 'field'))).toBe(
      'Erebus · Biome setting',
    );
    expect(
      findingDestinationLabel(
        catalog,
        createExitDecisionAddress(biome, {
          kind: 'occurrence',
          occurrenceId: createOccurrenceId('private-parent'),
        }),
      ),
    ).toBe('Erebus · Door choice');
    expect(
      findingDestinationLabel(
        catalog,
        createExitSelectionAddress(biome, {
          kind: 'occurrence',
          occurrenceId: createOccurrenceId('private-parent'),
        }),
      ),
    ).toBe('Erebus · Door selection');
    expect(findingDestinationLabel(catalog, target)).toBe('Erebus · Door 2');
    expect(findingDestinationLabel(catalog, room)).toBe('Erebus · Room');
    expect(
      findingDestinationLabel(catalog, createLocalRewardAddress(hBiome, hRoom, 'cages', 'cage2')),
    ).toBe('Fields · Cage 2 reward');
    expect(
      findingDestinationLabel(
        catalog,
        createLocalRewardAddress(nBiome, nRoom, 'sideRooms', 'sideDoor3'),
      ),
    ).toBe('Ephyra · Side room 3 reward');
    expect(
      findingDestinationLabel(
        catalog,
        createLocalRewardAddress(nBiome, nRoom, 'futureRewards', 'reward4'),
      ),
    ).toBe('Ephyra · Room reward 4');
    expect(
      findingDestinationLabel(
        catalog,
        createLocalChildAddress(nBiome, nRoom, 'sideRooms', 'sideDoor2'),
      ),
    ).toBe('Ephyra · Side room 2');
    expect(
      findingDestinationLabel(catalog, createLocalChildGroupAddress(nBiome, nRoom, 'sideRooms')),
    ).toBe('Ephyra · Side room order');
    expect(findingDestinationLabel(catalog, createHubDecisionAddress(nBiome, 'hub'))).toBe(
      'Ephyra · Hub',
    );
    expect(findingDestinationLabel(catalog, createHubRoomAddress(nBiome, 'hub'))).toBe(
      'Ephyra · Hub',
    );
  });
});

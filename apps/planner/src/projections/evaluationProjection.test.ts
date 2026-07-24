import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createHubRoomAddress,
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
    expect(allFindingCodes).toHaveLength(18);
    for (const code of allFindingCodes) {
      const presentation = presentFinding(finding(code));
      expect(presentation.title).not.toBe(code);
      expect(presentation.description).not.toContain(code);
      expect(presentation.title).not.toContain('F_Combat01');
      expect(presentation.description).not.toContain('F_Combat01');
    }
  });

  it('indexes every finding directly under its semantic owner', () => {
    const target = createTargetAddress(biome, createOccurrenceId('parent'), 2);
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
      kind: 'LinearBiome',
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
      'Erebus has no evaluated route prefix yet. Its choices remain editable and are marked Not evaluated.',
    );
    expect(presentBiomeFeedbackContext(catalog, gFeedback)).toContain(
      'blocked until Erebus is complete and valid',
    );
  });

  it('uses declaration labels and structural roles without exposing occurrence identity', () => {
    const target = createTargetAddress(biome, createOccurrenceId('private-parent'), 2);
    const room = createOccurrenceAddress(biome, createOccurrenceId('private-room'));

    expect(findingDestinationLabel(catalog, createProjectAddress())).toBe('Project');
    expect(findingDestinationLabel(catalog, target)).toBe('Erebus · Exit 2');
    expect(findingDestinationLabel(catalog, room)).toBe('Erebus · Room');
    expect(
      findingDestinationLabel(catalog, createHubRoomAddress(createBiomeAddress('Surface', 'N'))),
    ).toBe('Ephyra · Hub');
  });
});

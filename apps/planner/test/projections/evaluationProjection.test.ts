import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeFieldAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createHubDecisionAddress,
  createHubRoomAddress,
  createKeepsakeEquipResultAddress,
  createLocalVisitSlotAddress,
  createLocalVisitOrderAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectAddress,
  createRouteStartKeepsakeSelectionAddress,
  createTargetAddress,
  semanticAddressKey,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import {
  type FindingCode,
  type AssessmentIssue,
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
} from '@planner/projections/evaluationProjection';

const emptyResourceExecutionPolicy = {
  occurrences: [],
} as const;

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
  'freshRarityUnavailable',
  'rarityRollUnavailable',
  'traitOfferGenerationUnavailable',
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
  it('provides explicit player copy for semantic findings', () => {
    for (const code of allFindingCodes) {
      const presentation = presentFinding(finding(code));
      expect(presentation.title).not.toBe(code);
      expect(presentation.title).not.toContain('F_Combat01');
      if (presentation.description !== undefined) {
        expect(presentation.description).not.toContain(code);
        expect(presentation.description).not.toContain('F_Combat01');
      }
    }
  });

  it('keeps concise repair titles and only details that add constraints', () => {
    expect(presentFinding(finding('continuationMissing'))).toEqual({
      title: 'Continue route',
    });
    expect(presentFinding(finding('wrongHammerLoadout'))).toEqual({
      title: 'Hammer incompatible with loadout',
    });
    expect(presentFinding(finding('shopPurchaseUnavailable'))).toEqual({
      title: 'Purchase order unavailable',
    });
    expect(presentFinding(finding('hubVisitOrderIncomplete'))).toEqual({
      title: 'Choose six Hub visits',
      description: 'Visit six different open rooms.',
    });
  });

  it('presents each closed keepsake equip-result family truthfully', () => {
    const selection = createRouteStartKeepsakeSelectionAddress('Underworld');
    const jeweledPom = createKeepsakeEquipResultAddress(selection, 'jeweledPom');
    const experimentalHammer = createKeepsakeEquipResultAddress(selection, 'experimentalHammer');
    const transcendentEmbryo = createKeepsakeEquipResultAddress(selection, 'transcendentEmbryo');

    expect(presentFinding(finding('keepsakeEquipResultMissing', jeweledPom))).toEqual({
      title: 'Choose Jeweled Pom result',
      description: 'Choose the granted Hades trait.',
    });
    expect(presentFinding(finding('keepsakeEquipResultUnavailable', jeweledPom))).toEqual({
      title: 'Jeweled Pom result unavailable',
    });
    expect(presentFinding(finding('keepsakeEquipResultMissing', experimentalHammer))).toEqual({
      title: 'Choose Experimental Hammer result',
    });
    expect(presentFinding(finding('keepsakeEquipResultUnavailable', experimentalHammer))).toEqual({
      title: 'Experimental Hammer unavailable',
      description: 'Choose a Hammer compatible with the weapon and aspect.',
    });
    expect(presentFinding(finding('keepsakeEquipResultMissing', transcendentEmbryo))).toEqual({
      title: 'Choose Embryo blessing',
    });
    expect(presentFinding(finding('keepsakeEquipResultUnavailable', transcendentEmbryo))).toEqual({
      title: 'Embryo blessing unavailable',
    });
    expect(findingDestinationLabel(catalog, jeweledPom)).toBe('Loadout');
    expect(findingDestinationLabel(catalog, experimentalHammer)).toBe('Loadout');
    expect(findingDestinationLabel(catalog, transcendentEmbryo)).toBe('Loadout');
  });

  it('presents the missing Echo Pom child with both legal settlement shapes', () => {
    expect(presentFinding(finding('echoPomTargetMissing'))).toEqual({
      title: 'Choose Echo Pom target',
      description: 'Choose a highest-level Pom-eligible trait, or no target if none is eligible.',
    });
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
    expect(presentBiomeStatus({ authoring: 'incomplete', validity: 'invalid' })).toEqual({
      label: 'Invalid',
      tone: 'invalid',
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
    const fIssue = {
      kind: 'incomplete',
      owner: biome,
      regionKey: 'underworld-f-start',
      reasons: [fFinding, finding('continuationMissing')],
    } as const satisfies AssessmentIssue;
    const fEvaluation = {
      biomeKey: 'F',
      origin: biome,
      authoring: 'incomplete',
      frontier: biome,
      coverage: { kind: 'none', reason: 'notEvaluated' },
      issue: fIssue,
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
      issue: fIssue,
      findings: [fFinding],
      resources: emptyResourceExecutionPolicy,
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
    const evaluation = {
      status: 'incomplete',
      projectId: 'feedback-project',
      catalogVersion: catalog.version,
      authoringHorizon: { kind: 'open' },
      issue: fIssue,
      route: underworld,
      findings: [fFinding],
      summary: underworld.summary,
    } as const satisfies ProjectEvaluation;

    const feedback = projectFeedbackHierarchy(evaluation);
    const fFeedback = feedback.route.biomes.get('F');
    const gFeedback = feedback.route.biomes.get('G');

    expect(projectFeedbackHierarchy(evaluation)).toBe(feedback);
    expect(feedback).toMatchObject({ findingCount: 1, status: { tone: 'incomplete' } });
    expect(feedback.route).toMatchObject({
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
    expect(presentBiomeFeedbackContext(catalog, fFeedback)).toBe('Erebus is not evaluated yet.');
    expect(presentBiomeFeedbackContext(catalog, gFeedback)).toBe(
      'Finish and fix Erebus before Oceanus can be evaluated.',
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
      'Finish the earlier biomes before this biome can be evaluated.',
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
      'Erebus',
    );
    expect(
      findingDestinationLabel(
        catalog,
        createExitDecisionAddress(biome, {
          kind: 'occurrence',
          occurrenceId: createOccurrenceId('private-parent'),
        }),
      ),
    ).toBe('Erebus');
    expect(
      findingDestinationLabel(
        catalog,
        createExitSelectionAddress(biome, {
          kind: 'occurrence',
          occurrenceId: createOccurrenceId('private-parent'),
        }),
      ),
    ).toBe('Erebus');
    expect(findingDestinationLabel(catalog, target)).toBe('Erebus');
    expect(findingDestinationLabel(catalog, room)).toBe('Erebus');
    expect(
      findingDestinationLabel(catalog, createLocalRewardAddress(hBiome, hRoom, 'cages', 'cage2')),
    ).toBe('Fields');
    expect(
      findingDestinationLabel(
        catalog,
        createLocalRewardAddress(nBiome, nRoom, 'futureRewards', 'reward4'),
      ),
    ).toBe('Ephyra');
    expect(
      findingDestinationLabel(
        catalog,
        createLocalVisitSlotAddress(nBiome, nRoom, 'sideRooms', 'sideDoor2'),
      ),
    ).toBe('Ephyra');
    expect(
      findingDestinationLabel(catalog, createLocalVisitOrderAddress(nBiome, nRoom, 'sideRooms')),
    ).toBe('Ephyra');
    expect(findingDestinationLabel(catalog, createHubDecisionAddress(nBiome, 'hub'))).toBe(
      'Ephyra',
    );
    expect(findingDestinationLabel(catalog, createHubRoomAddress(nBiome, 'hub'))).toBe('Ephyra');
  });
});

import { catalog } from '@run-planner/hades2-catalog';
import {
  createAdditionalExitAddress,
  createBiomeFieldAddress,
  createBiomeAddress,
  createCirceResolutionAddress,
  createEchoPomTargetAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createHubDecisionAddress,
  createHubRoomAddress,
  createKeepsakeEquipResultAddress,
  createLocalVisitSlotAddress,
  createLocalVisitOrderAddress,
  createLevelResolutionAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectAddress,
  createRouteStartKeepsakeSelectionAddress,
  createTargetAddress,
  createTraitOfferAddress,
  semanticAddressKey,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import {
  type FindingCode,
  type FindingEvidenceValue,
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
  isChaosGatePositionFinding,
  presentBlockedView,
  presentBiomeStatus,
  presentFinding,
  presentAssessmentIssue,
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
  it('explains unavailable physical doors without changing other room findings', () => {
    expect(
      presentFinding({
        ...finding('targetRoomUnavailable'),
        evidence: { exclusionReasons: ['physicalExitUnavailable'] },
      }),
    ).toEqual({
      title: 'Saved door unavailable',
      description: 'Restore the source room’s doors or use Remove unavailable doors.',
    });
    expect(
      presentFinding({
        ...finding('targetRoomUnavailable'),
        evidence: { exclusionReasons: ['eligibilityRequirement'] },
      }),
    ).toEqual({ title: 'Room unavailable' });
  });

  it('gives Travel Deal repair guidance without assuming its triggering purchase is absent', () => {
    expect(
      presentFinding({
        ...finding('shopPurchaseUnavailable'),
        evidence: { kind: 'travelDealRefillUnavailable' },
      }),
    ).toEqual({
      title: 'Travel Deal refill unavailable',
      description: 'Check the triggering purchase and refill item, or remove this refill purchase.',
    });
    expect(presentFinding(finding('shopPurchaseUnavailable'))).toEqual({
      title: 'Purchase order unavailable',
    });
  });

  it('distinguishes Chaos position repair from other unavailable-room findings', () => {
    const gate = createAdditionalExitAddress(biome, createOccurrenceId('source'), 'chaos');
    const position: SemanticFinding = {
      ...finding('targetRoomUnavailable', gate),
      evidence: {
        failedConditions: ['spawnPointIndex'],
        spawnPointIndex: 4,
        secretPointAnchorCount: 1,
      },
    };
    expect(isChaosGatePositionFinding(position)).toBe(true);
    expect(presentFinding(position)).toEqual({
      title: 'Chaos gate position unavailable',
      description: 'Choose Any or a numbered position on the source room map.',
    });
    expect(isChaosGatePositionFinding(finding('targetRoomUnavailable', gate))).toBe(false);
    expect(presentFinding(finding('targetRoomUnavailable', gate))).toEqual({
      title: 'Room unavailable',
    });
  });
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
      title: 'Plan six room visits and use the fountain',
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
    const roomFinding = finding('purgingPoolUnavailable', room);

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
      npcShopping: { occurrences: [] },
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
    expect(presentBlockedView(catalog, fFeedback, 'Erebus')).toEqual({
      title: 'Erebus is not evaluated yet',
    });
    expect(presentBlockedView(catalog, gFeedback, 'Erebus · Opening')).toEqual({
      title: 'Oceanus is blocked at Erebus · Opening',
      description: 'Finish and fix Erebus before Oceanus can be evaluated.',
    });
    expect(
      presentBlockedView(catalog, { ...gFeedback, context: 'complete' }, 'Erebus'),
    ).toBeUndefined();
  });

  it('explains a blocked biome without exposing evaluated-prefix internals', () => {
    const feedback = {
      biomeKey: 'F',
      context: 'blocked',
      findingCount: 0,
      status: { label: 'Blocked', tone: 'blocked' },
    } as const satisfies BiomeFeedbackPresentation;

    expect(presentBlockedView(catalog, feedback, undefined)).toEqual({
      title: 'Erebus is blocked',
      description: 'Finish the earlier biomes before this biome can be evaluated.',
    });
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

describe('timeline finding guidance', () => {
  const origin = createProjectAddress();
  const finding = (reason: string, dependencyKind?: string): SemanticFinding => ({
    code: 'roomActionOrderUnavailable',
    severity: 'error',
    phase: 'encounterResolution',
    origin,
    evidence: { reason, ...(dependencyKind === undefined ? {} : { dependencyKind }) },
  });

  it('groups distinct order reasons without duplicate guidance or internal keys', () => {
    const dependency = finding('dependency', 'afterCheckpoint');
    const issue = {
      owner: origin,
      regionKey: 'test',
      kind: 'invalid',
      reasons: [dependency, dependency, finding('window')],
    } as const satisfies AssessmentIssue;
    expect(presentAssessmentIssue(issue)).toEqual({
      title: 'Action out of order',
      description:
        'Move this action after its prerequisite. Move this action into its allowed room phase.',
    });
    expect(presentFinding(finding('dependency', 'beforeCheckpoint')).description).toBe(
      'Move this action before its required checkpoint.',
    );
  });

  it.each([
    [
      'staleHermesShrineDelivery',
      'Shrine delivery unavailable',
      'Remove this delivery from the timeline.',
    ],
    [
      'staleClockedTraitPickup',
      'Pickup unavailable',
      'Check this pickup’s source and room placement.',
    ],
  ])('explains %s from its source evidence', (reason, title, description) => {
    expect(
      presentFinding({
        code: 'rewardSourceUnavailable',
        severity: 'error',
        phase: 'rewardGeneration',
        origin,
        evidence: { reason },
      }),
    ).toEqual({ title, description });
  });
});

describe('outer finding collapse', () => {
  const phase = createEncounterPhaseAddress(
    biome,
    { kind: 'occurrence', occurrenceId: createOccurrenceId('collapse-room') },
    'Encounter',
  );
  const offer = createTraitOfferAddress(phase, 'selection');
  const traitFinding = (
    code: FindingCode,
    origin: SemanticAddress,
    evidence: Readonly<Record<string, FindingEvidenceValue>> = {},
  ): SemanticFinding => ({ code, severity: 'error', phase: 'rewardGeneration', origin, evidence });
  const issueOf = (owner: SemanticAddress, reasons: readonly SemanticFinding[]) =>
    ({ kind: 'invalid', owner, regionKey: 'collapse', reasons }) as const satisfies AssessmentIssue;

  it('folds trait option and outcome owners into one trait offer entry with their count', () => {
    const entry = presentAssessmentIssue(
      issueOf(offer, [
        traitFinding('alreadyEquipped', offer, { traitKey: 'ZeusWeaponBoon' }),
        traitFinding('rarityRollUnavailable', offer, { optionKey: 'option2' }),
        traitFinding('echoPomTargetMissing', createEchoPomTargetAddress(offer, 'option1')),
        traitFinding('circeResolutionMissing', createCirceResolutionAddress(offer, 'option2')),
      ]),
    );
    expect(entry).toEqual({
      title: 'Trait offer needs attention',
      description: '4 issues to repair in its editor.',
      dialog: { kind: 'traitOffer', owner: offer },
      innerFindingCount: 4,
    });
  });

  it('keeps a missing or ungenerable offer as the launcher’s own finding', () => {
    const entry = presentAssessmentIssue(
      issueOf(offer, [
        traitFinding('traitOfferMissing', offer),
        traitFinding('traitOfferGenerationUnavailable', offer),
      ]),
    );
    expect(entry).toEqual({
      title: 'Choose a trait offer',
      description: 'Trait choices cannot appear together',
    });
    expect(entry.dialog).toBeUndefined();
  });

  it('folds customization decisions under their encounter phase but not the selector', () => {
    expect(
      presentAssessmentIssue(
        issueOf(phase, [
          traitFinding('encounterCustomizationUnavailable', phase, {
            decisionKey: 'generatedComposition',
          }),
          traitFinding('encounterIntroductionRequired', phase, { decisionKey: 'infiniteRoster' }),
        ]),
      ),
    ).toEqual({
      title: 'Encounter customization needs attention',
      description: '2 issues to repair in its editor.',
      dialog: { kind: 'encounterCustomization', owner: phase },
      innerFindingCount: 2,
    });
    expect(
      presentAssessmentIssue(issueOf(phase, [traitFinding('encounterUnavailable', phase)])),
    ).toEqual({ title: 'Encounter unavailable' });
  });

  it('folds Pom targets under their level resolution', () => {
    const resolution = createLevelResolutionAddress(phase, 'selection');
    expect(
      presentAssessmentIssue(issueOf(resolution, [traitFinding('missingPomTarget', resolution)])),
    ).toEqual({
      title: 'Pom resolution needs attention',
      description: '1 issue to repair in its editor.',
      dialog: { kind: 'levelResolution', owner: resolution },
      innerFindingCount: 1,
    });
  });
});

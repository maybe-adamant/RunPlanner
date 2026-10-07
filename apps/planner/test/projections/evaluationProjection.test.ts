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
  createRoomFeatureAddress,
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
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  type BiomeFeedbackPresentation,
  findingDestinationLabel,
  indexFindingsByOwner,
  isChaosGatePositionFinding,
  presentBlockedView,
  presentBiomeStatus,
  presentFinding,
  presentLevelResolutionCandidateFinding,
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
    ).toEqual({ title: 'Door cannot offer this room' });
    expect(
      presentFinding({
        ...finding('targetRoomUnavailable'),
        evidence: { anomalyReplacement: { kind: 'sourceUnavailable' } },
      }),
    ).toEqual({ title: 'Anomaly cannot occur here' });
  });

  it('gives Travel Deal repair guidance without assuming its triggering purchase is absent', () => {
    expect(
      presentFinding({
        ...finding('shopPurchaseUnavailable'),
        evidence: { kind: 'travelDealRefillUnavailable' },
      }),
    ).toEqual({
      title: 'Travel Deal refill unavailable',
      description: 'Check its triggering purchase, or remove this refill.',
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
      title: 'Door cannot offer this room',
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
      title: 'Open the next room from the Hub',
    });
    expect(presentFinding(finding('wrongHammerLoadout'))).toEqual({
      title: 'Hammer incompatible with loadout',
    });
    expect(presentFinding(finding('shopPurchaseUnavailable'))).toEqual({
      title: 'Purchase order unavailable',
    });
  });

  it('states Hub requirements from their evidence', () => {
    const visits = (actualCount: number, fountainUsed: boolean) =>
      presentFinding({
        ...finding('hubVisitOrderIncomplete'),
        evidence: { actualCount, requiredCount: 6, fountainUsed },
      }).title;
    expect(visits(3, false)).toBe('Plan 6 Hub visits and use the fountain');
    expect(visits(3, true)).toBe('Plan 6 Hub visits');
    expect(visits(6, false)).toBe('Use the Hub fountain');
    expect(
      presentFinding({
        ...finding('hubOpenSetIncomplete'),
        evidence: { actualCount: 4, minimumCount: 9, maximumCount: 10 },
      }),
    ).toEqual({ title: 'Open 9–10 Hub rooms' });
  });

  it('presents each closed keepsake equip-result family truthfully', () => {
    const selection = createRouteStartKeepsakeSelectionAddress('Underworld');
    const jeweledPom = createKeepsakeEquipResultAddress(selection, 'jeweledPom');
    const experimentalHammer = createKeepsakeEquipResultAddress(selection, 'experimentalHammer');
    const transcendentEmbryo = createKeepsakeEquipResultAddress(selection, 'transcendentEmbryo');

    expect(presentFinding(finding('keepsakeEquipResultMissing', jeweledPom))).toEqual({
      title: 'Choose the Hades trait from Jeweled Pom',
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

describe('Pom draft finding copy', () => {
  it('has shared copy for every Pom draft finding code the engine declares', () => {
    const source = readFileSync(
      fileURLToPath(
        new URL(
          '../../../../packages/planner-engine/src/simulation/traits/level-effects.ts',
          import.meta.url,
        ),
      ),
      'utf8',
    );
    const union = /export type LevelResolutionFindingCode =([^;]+);/.exec(source)?.[1];
    const codes = [...(union ?? '').matchAll(/'([A-Za-z]+)'/g)].map((match) => match[1]!);
    expect(codes.length).toBeGreaterThan(0);
    for (const code of codes)
      expect(presentLevelResolutionCandidateFinding(code).title, code).not.toBe(code);
  });
});

describe('timeline finding guidance', () => {
  const origin = createProjectAddress();
  const finding = (
    reason: string,
    dependencyKind?: string,
    checkpointUnavailable?: boolean,
  ): SemanticFinding => ({
    code: 'roomActionOrderUnavailable',
    severity: 'error',
    phase: 'encounterResolution',
    origin,
    evidence: {
      reason,
      ...(dependencyKind === undefined ? {} : { dependencyKind }),
      ...(checkpointUnavailable === undefined ? {} : { checkpointUnavailable }),
    },
  });

  it('names the order repair from its dependency evidence', () => {
    expect(presentFinding(finding('dependency', 'afterCheckpoint'))).toEqual({
      title: 'Action out of order',
      description: 'Move it after its prerequisite.',
    });
    expect(presentFinding(finding('dependency', 'beforeCheckpoint')).description).toBe(
      'Move it before its required checkpoint.',
    );
    expect(presentFinding(finding('window')).description).toBe(
      'Move it into its allowed room phase.',
    );
    expect(presentFinding(finding('dependency', 'afterCheckpoint', true))).toEqual({
      title: 'Room phase for this action is gone',
    });
  });

  it.each([
    ['staleHermesShrineDelivery', 'Shrine delivery is not due here'],
    ['staleClockedTraitPickup', 'Supply Chain pickup cannot occur here'],
  ])('titles %s from its source evidence', (reason, title) => {
    expect(
      presentFinding({
        code: 'rewardSourceUnavailable',
        severity: 'error',
        phase: 'rewardGeneration',
        origin,
        evidence: { reason },
      }),
    ).toEqual({ title });
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
  const byOrigin = (finding: SemanticFinding) => semanticAddressKey(finding.origin);

  it('folds trait option and outcome owners into one trait offer entry with their count', () => {
    const entry = presentAssessmentIssue(
      issueOf(offer, [
        traitFinding('alreadyEquipped', offer, { traitKey: 'ZeusWeaponBoon' }),
        traitFinding('rarityRollUnavailable', offer, { optionKey: 'option2' }),
        traitFinding('echoPomTargetMissing', createEchoPomTargetAddress(offer, 'option1')),
        traitFinding('circeResolutionMissing', createCirceResolutionAddress(offer, 'option2')),
      ]),
      byOrigin,
    );
    expect(entry).toEqual({
      title: 'Trait offer: trait already equipped',
      description: '+3 more in its editor',
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
      byOrigin,
    );
    expect(entry).toEqual({ title: 'Choose a trait offer' });
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
        byOrigin,
      ),
    ).toEqual({
      title: 'Encounter customization unavailable',
      description: '+1 more in its editor',
      dialog: { kind: 'encounterCustomization', owner: phase },
      innerFindingCount: 2,
    });
    expect(
      presentAssessmentIssue(
        issueOf(phase, [
          traitFinding('encounterCustomizationRequired', phase, { decisionKey: 'composition' }),
        ]),
        byOrigin,
      ),
    ).toEqual({
      title: 'Encounter customization required',
      description: 'Fresh File plans require customized encounters.',
      dialog: { kind: 'encounterCustomization', owner: phase },
      innerFindingCount: 1,
    });
    expect(
      presentAssessmentIssue(
        issueOf(phase, [traitFinding('encounterUnavailable', phase)]),
        byOrigin,
      ),
    ).toEqual({ title: 'Encounter unavailable' });
  });

  it('folds Pom targets under their level resolution', () => {
    const resolution = createLevelResolutionAddress(phase, 'selection');
    expect(
      presentAssessmentIssue(
        issueOf(resolution, [traitFinding('missingPomTarget', resolution)]),
        byOrigin,
      ),
    ).toEqual({
      title: 'Pom resolution: choose a Pom target',
      dialog: { kind: 'levelResolution', owner: resolution },
      innerFindingCount: 1,
    });
  });
});

describe('grouped repair cards', () => {
  const room = createOccurrenceAddress(biome, createOccurrenceId('grouped-room'));
  const well = createRoomFeatureAddress(room, { kind: 'stygianWellPresence' });
  const pool = createRoomFeatureAddress(room, { kind: 'purgingPoolInventory' });
  const reason = (code: FindingCode, origin: SemanticAddress): SemanticFinding => ({
    code,
    severity: 'error',
    phase: 'rewardGeneration',
    origin,
    evidence: {},
  });
  const issueOf = (reasons: readonly SemanticFinding[]) =>
    ({
      kind: 'invalid',
      owner: well,
      regionKey: 'grouped',
      reasons,
    }) as const satisfies AssessmentIssue;
  const byOrigin = (finding: SemanticFinding) => semanticAddressKey(finding.origin);

  it('keeps the first description when every reason shares its repair target', () => {
    expect(
      presentAssessmentIssue(
        issueOf([
          reason('stygianWellPlacementUnavailable', well),
          reason('stygianWellDuplicate', well),
        ]),
        () => 'one control',
      ),
    ).toEqual({
      title: 'Well placement unavailable',
      description: 'Check room eligibility and spacing between Wells.',
    });
  });

  it('counts other repair targets instead of appending their copy', () => {
    expect(
      presentAssessmentIssue(
        issueOf([
          reason('stygianWellPlacementUnavailable', well),
          reason('purgingPoolUnavailable', pool),
        ]),
        byOrigin,
      ),
    ).toEqual({ title: 'Well placement unavailable', description: '+1 more to repair here' });
  });

  it('counts one code repaired at several controls in its title', () => {
    expect(
      presentAssessmentIssue(
        issueOf(
          ['a', 'b', 'c'].map((key) => ({
            ...reason('fieldsSpatialPointMissing', well),
            evidence: { key },
          })),
        ),
        (finding) => String(finding.evidence.key),
      ),
    ).toEqual({ title: 'Choose 3 Fields positions' });
  });
});

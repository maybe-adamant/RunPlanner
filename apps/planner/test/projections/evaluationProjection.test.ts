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
  decodeProjectDocument,
  encodeProjectDocument,
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
  simulateProject,
} from '@run-planner/engine/simulation';
import { createFreshFileRouteProject } from '@run-planner/test-fixtures/fresh-file';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  catalogFindingLabels,
  findingDestinationLabel,
  indexFindingsByOwner,
  isChaosGatePositionFinding,
  presentBiomeStatus,
  presentFinding,
  presentAnvilDraftFinding,
  presentHexActivationDraftIssues,
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
const labels = catalogFindingLabels(catalog);
/** The catalog's finding labels with trait names replaced. */
const traitNames = (trait: (traitKey: string) => string) => ({ ...labels, trait });

function finding(code: FindingCode, origin: SemanticAddress = biome): SemanticFinding {
  return {
    code,
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

  it('says why the game cannot show a trait offer screen, naming its traits', () => {
    const title = (evidence: Record<string, FindingEvidenceValue>) =>
      presentFinding({ ...finding('traitOfferGenerationUnavailable'), evidence }, labels).title;
    const buried = { traitKey: 'RoomRewardBonusBoon', optionKey: 'option2' };
    const rarity = (rarityCause: string, extra: Record<string, FindingEvidenceValue> = {}) =>
      title({ reason: 'rarityUnavailable', ...buried, rarity: 'Common', rarityCause, ...extra });
    expect(rarity('guaranteed', { requiredRarity: 'Rare', requiredChance: 1.1 })).toBe(
      "Buried Treasure can't be Common: Rare guaranteed",
    );
    expect(
      title({
        reason: 'rarityUnavailable',
        traitKey: 'RendBloodDropBoon',
        rarity: 'Common',
        rarityCause: 'guaranteed',
        requiredRarity: 'Rare',
      }),
    ).toBe('Profuse Bleeding: Rare is guaranteed');
    expect(rarity('replacement', { requiredRarity: 'Epic' })).toBe(
      'Buried Treasure must be Epic here',
    );
    expect(rarity('notInTrait')).toBe('Buried Treasure is never offered Common');
    expect(rarity('forcedCommon')).toBe('This screen offers only Common');
    expect(
      title({ reason: 'rarityUnavailable', ...buried, rarity: 'Duo', rarityCause: 'devotion' }),
    ).toBe("Duo can't roll under Devotion");
    expect(
      title({ reason: 'rarityUnavailable', ...buried, rarity: 'Epic', rarityCause: 'noChance' }),
    ).toBe("Epic can't be offered here");
    expect(title({ reason: 'traitUnavailable', ...buried })).toBe(
      "Buried Treasure can't be offered here",
    );
    expect(title({ reason: 'duplicateTrait', ...buried })).toBe('Buried Treasure is offered twice');
    expect(title({ reason: 'coreTraitsFirst', traitKeys: ['PoseidonWeaponBoon'] })).toBe(
      'This screen needs Wave Strike',
    );
    expect(
      title({
        reason: 'coreTraitsFirst',
        traitKeys: ['PoseidonWeaponBoon', 'PoseidonSpecialBoon'],
      }),
    ).toBe('This screen needs a core boon');
    expect(
      title({ reason: 'pairConflict', traitKeys: ['PoseidonWeaponBoon', 'RoomRewardBonusBoon'] }),
    ).toBe('Wave Strike never appears with Buried Treasure');
    expect(
      presentFinding(
        {
          ...finding('traitOfferGenerationUnavailable'),
          evidence: { reason: 'pairConflict', traitKeys: ['A', 'B'] },
        },
        traitNames((traitKey) => `${traitKey} Boon`),
      ).title,
    ).toBe('A Boon and B Boon never appear together');
    expect(
      presentFinding(
        {
          ...finding('traitOfferGenerationUnavailable'),
          evidence: { reason: 'screenSize', traitKey: 'RoomRewardBonusBoon' },
        },
        labels,
      ),
    ).toEqual({
      title: 'This screen needs another choice',
      description: 'Buried Treasure can fill it.',
    });
    expect(title({ reason: 'generic' })).toBe("These choices can't be drawn together");
    expect(title({})).toBe("These choices can't be drawn together");
  });

  it('falls back to nameless trait offer titles without names or room for them', () => {
    expect(
      presentFinding({
        ...finding('traitOfferGenerationUnavailable'),
        evidence: { reason: 'traitUnavailable', traitKey: 'RoomRewardBonusBoon' },
      }).title,
    ).toBe("This choice can't be offered here");
    expect(
      presentFinding(
        {
          ...finding('traitOfferGenerationUnavailable'),
          evidence: {
            reason: 'pairConflict',
            traitKeys: ['RoomRewardBonusBoon', 'RoomRewardBonusBoon'],
          },
        },
        traitNames(() => 'Primal Psychic Connection'),
      ).title,
    ).toBe('These two choices never appear together');
  });

  it('names a screen reroll with nothing left to draw apart from a missing card', () => {
    expect(
      presentFinding({
        ...finding('screenRerollUnavailable'),
        evidence: { reason: 'nothingLeft' },
      }),
    ).toEqual({ title: 'Nothing left to reroll' });
    expect(
      presentFinding({ ...finding('screenRerollUnavailable'), evidence: { reason: 'disabled' } }),
    ).toEqual({ title: 'Screen rerolls are not available' });
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
    expect(presentFinding(finding('hubOpenSetIncomplete'))).toEqual({
      title: 'Choose open Hub rooms',
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
      reasons: [fFinding, finding('pickedTargetMissing')],
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

describe('Anvil draft finding copy', () => {
  it('has shared copy for every Anvil assessment code the engine emits', () => {
    const source = readFileSync(
      fileURLToPath(
        new URL(
          '../../../../packages/planner-engine/src/simulation/rewards/anvil-settlement.ts',
          import.meta.url,
        ),
      ),
      'utf8',
    );
    const issues = [
      ...source.matchAll(/issues\.push\((?:anvilIssue\('([A-Za-z]+)'\)|(additionUnavailable)\()/g),
    ].map((match) =>
      match[2] === undefined ? { kind: match[1]! } : { kind: match[2], traitKey: 'SomeHammer' },
    );
    expect(issues.length).toBeGreaterThan(0);
    for (const issue of issues) {
      const copy = presentAnvilDraftFinding(issue, (traitKey) => `label ${traitKey}`);
      expect(copy.title, issue.kind).not.toBe(issue.kind);
      if (issue.traitKey !== undefined)
        expect(copy.description, issue.kind).toBe('label SomeHammer');
    }
  });
});

describe('Path of Stars screen finding copy', () => {
  const origin = createProjectAddress();
  const unavailable = (violations: readonly Record<string, unknown>[]): SemanticFinding =>
    ({
      code: 'hexActivationUnavailable',
      origin,
      evidence: { count: 3, nodeKeys: [], violations },
      phase: 'rewardGeneration',
    }) as SemanticFinding;

  it('titles the most specific violation and adds a wrong count as its description', () => {
    expect(
      presentFinding(unavailable([{ kind: 'selectionCount', expected: 3, actual: 2 }])),
    ).toEqual({ title: 'Choose 3 Path of Stars nodes' });
    expect(
      presentFinding(
        unavailable([
          { kind: 'selectionCount', expected: 3, actual: 2 },
          { kind: 'unreachable', nodeKey: '4:1' },
        ]),
      ),
    ).toEqual({ title: 'Path of Stars node out of reach', description: '2 of 3 points chosen.' });
    expect(presentFinding(unavailable([{ kind: 'absentNode', nodeKey: '5:3' }])).title).toBe(
      'God Sent is not on the tree yet',
    );
  });

  it('lists a draft violation per kind, naming its talents', () => {
    expect(
      presentHexActivationDraftIssues(
        [
          { kind: 'unreachable', nodeKey: '4:1' },
          { kind: 'unreachable', nodeKey: '4:2' },
          { kind: 'selectionCount', expected: 3, actual: 4 },
        ],
        (nodeKey) => ({ '4:1': 'Omen', '4:2': 'Sting' })[nodeKey] ?? nodeKey,
      ),
    ).toEqual([
      ['unreachable', 'Path of Stars nodes out of reach: Omen, Sting'],
      ['selectionCount', 'Choose 3 Path of Stars nodes'],
    ]);
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
  ): SemanticFinding => ({ code, phase: 'rewardGeneration', origin, evidence });
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

  it('lets an unshowable screen’s row cause read without the dialog’s name', () => {
    const rowCause = traitFinding('traitOfferGenerationUnavailable', offer, {
      reason: 'rarityUnavailable',
      traitKey: 'RoomRewardBonusBoon',
      optionKey: 'option2',
      rarity: 'Common',
      rarityCause: 'guaranteed',
      requiredRarity: 'Rare',
    });
    expect(
      presentAssessmentIssue(
        issueOf(offer, [rowCause]),
        byOrigin,
        traitNames((traitKey) =>
          traitKey === 'RoomRewardBonusBoon' ? 'Buried Treasure' : traitKey,
        ),
      ).title,
    ).toBe("Buried Treasure can't be Common: Rare guaranteed");
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
        issueOf(phase, [traitFinding('encounterUnavailable', phase)]),
        byOrigin,
      ),
    ).toEqual({ title: 'Encounter unavailable' });
  });

  it('says why an encounter customization is unavailable, naming its choice or enemy', () => {
    const customization = (decisionKey: string, evidence: Record<string, FindingEvidenceValue>) =>
      presentFinding(
        traitFinding('encounterCustomizationUnavailable', phase, { decisionKey, ...evidence }),
        labels,
      );
    // Fresh F_Combat01 replaces GeneratedF with its intro.
    expect(customization('generatedComposition', { reason: 'contextuallyReplaced' })).toEqual({
      title: 'Saved customization no longer applies',
    });
    // Chronos's late summon names a choice I_Boss01 does not declare.
    expect(customization('lateSummon', { reason: 'valueNotDeclared' })).toEqual({
      title: "Late summon choice isn't available here",
    });
    expect(
      customization('cocoonCount', {
        reason: 'cocoonCountOutOfRange',
        count: 20,
        minimum: 8,
        maximum: 14,
      }),
    ).toEqual({ title: 'Cocoons must be 8–14' });
    expect(
      customization('cocoonRewardPoint', { reason: 'cocoonRewardPointAbsent', spawnPointId: 1 }),
    ).toEqual({ title: "Reward cocoon's spot isn't in this room" });
    const composition = (compositionIssue: FindingEvidenceValue) =>
      customization('generatedComposition', { reason: 'compositionInvalid', compositionIssue });
    expect(composition({ reason: 'required', field: 'allocations', waveIndex: 1 })).toEqual({
      title: 'Set each editable enemy budget',
    });
    expect(composition({ reason: 'allocationMembers', waveIndex: 1 })).toEqual({
      title: 'Wave 1: edit its enemy budgets',
    });
    expect(
      composition({ reason: 'typeCount', waveIndex: 2, actual: 4, allowed: { min: 1, max: 2 } }),
    ).toEqual({ title: 'Wave 2: allows 2 enemy types; remove 2' });
    expect(
      composition({
        reason: 'introductionRequired',
        key: 'Guard',
        introductionEncounterKey: 'FIntroFight',
        admitted: true,
        waveIndex: 1,
        position: 1,
      }),
    ).toEqual({
      title: `Wave 1: ${labels.enemy('Guard')} isn't introduced yet`,
      description: 'Select Intro combat for this encounter, or remove the enemy.',
    });
    expect(
      customization('infiniteRoster', {
        reason: 'infiniteRosterInvalid',
        rosterIssue: { reason: 'enemyUnavailable', position: 2, key: 'SpreadShotUnit_Elite' },
      }),
    ).toEqual({ title: `${labels.enemy('SpreadShotUnit_Elite')} can't be drawn here` });
    expect(
      presentFinding(
        traitFinding('encounterCustomizationUnavailable', phase, {
          decisionKey: 'infiniteRoster',
          reason: 'infiniteRosterInvalid',
          rosterIssue: { reason: 'enemyUnavailable', position: 2, key: 'SpreadShotUnit_Elite' },
        }),
      ),
    ).toEqual({ title: "Roster enemy 2 can't be drawn here" });
  });

  it('names the route-excluded choice of a retained boss customization', () => {
    const wire = JSON.parse(encodeProjectDocument(createFreshFileRouteProject()));
    const boss = wire.route.biomes
      .find((entry: { biomeKey: string }) => entry.biomeKey === 'F')
      .topology.occurrences.find(
        (occurrence: { gameName: string }) => occurrence.gameName === 'F_Boss01',
      );
    boss.encounters.customizationByPhase = {
      Encounter: { interlude: { kind: 'single', choiceKey: 'rings' } },
    };
    const unavailable = simulateProject(
      catalog,
      decodeProjectDocument(wire, catalog),
    ).findings.find((entry) => entry.code === 'encounterCustomizationUnavailable')!;
    expect(presentFinding(unavailable, labels)).toEqual({
      title: "Hecate's Expanding Ring can't occur here",
    });
    // A decision several encounters declare, or a long name, drops the owner.
    expect(
      presentFinding(unavailable, { ...labels, customizationOwner: () => undefined }).title,
    ).toBe("Expanding Ring can't occur on this route");
    expect(presentFinding(unavailable)).toEqual({ title: "This choice can't occur on this route" });
    // Its title reads alone in the findings panel, without the dialog's name.
    expect(
      presentAssessmentIssue(issueOf(unavailable.origin, [unavailable]), byOrigin, labels).title,
    ).toBe("Hecate's Expanding Ring can't occur here");
  });

  it('names an unavailable encounter from its evidence', () => {
    const unavailable = traitFinding('encounterUnavailable', phase, {
      selectedEncounterKey: 'GeneratedF',
      candidateEncounterKeys: ['FIntroFight'],
    });
    expect(presentFinding(unavailable, labels)).toEqual({ title: "Combat can't occur here" });
    expect(presentFinding(unavailable)).toEqual({ title: 'Encounter unavailable' });
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

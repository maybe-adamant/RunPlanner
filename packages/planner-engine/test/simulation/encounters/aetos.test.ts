import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createBatchRewardStoreAddress,
  createGorgonPhaseAddress,
  createTraitOfferAddress,
  createProjectDocument,
  createStartingRewardAddress,
  createIncomingRewardAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createTargetAddress,
  createOccurrenceId,
  createRouteStartKeepsakeSelectionAddress,
  createEncounterPhaseAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import {
  encounterPhaseSequenceStatusForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import {
  loadSurfaceNOPProject,
  reachedPOutdoorIcarusFixture,
  pBiome,
  pOccurrenceId,
} from '@run-planner/test-fixtures/surface';
import { assessAetosAppearance } from '../../../src/simulation/encounters/aetos';
import { resolvedEncounterPhaseForDefinition } from '../../../src/simulation/encounters/resolve';

const first = createEncounterPhaseAddress(
  pBiome,
  { kind: 'occurrence', occurrenceId: pOccurrenceId('P_Combat03', 1, 1) },
  'Combat',
);
const phase = (key: string, wave?: number, count?: number) =>
  resolvedEncounterPhaseForDefinition(
    catalog,
    {
      slotKey: 'Combat',
      envelopeKey: 'PEncounter',
      figLeafSkip: false,
      ...(wave === undefined ? {} : { aetosWave: wave }),
      ...(count === undefined
        ? {}
        : {
            customizationByDecision: {
              generatedComposition: { kind: 'generated' as const, waveCount: count },
            },
          }),
    },
    key,
  );

describe('Aetos appearance', () => {
  it('uses the same reached event product in a Dream Olympus prefix', () => {
    const biome = createBiomeAddress('Dream', 'P');
    let project = createProjectDocument(catalog, {
      projectId: 'dream-aetos',
      routeKey: 'Dream',
      itineraryBiomeKeys: ['P', 'Q'],
      configuredBiomeCount: 1,
    });
    const start = project.route.biomes[0]!.topology!.startOccurrenceId;
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingReward',
      reward: createStartingRewardAddress('Dream'),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    });
    const source = { kind: 'occurrence' as const, occurrenceId: start };
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: createExitDecisionAddress(biome, source),
    });
    const id = createOccurrenceId('dream-aetos-combat');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(biome, source),
      storeKey: 'MetaProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, source, 'exit1'),
      occurrenceId: id,
      gameName: 'P_Combat03',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(biome, id),
      value: { rewardType: 'GiftDrop' },
    });
    const peer = createOccurrenceId('dream-aetos-peer');
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, source, 'exit2'),
      occurrenceId: peer,
      gameName: 'P_Combat05',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(biome, peer),
      value: { rewardType: 'MetaCurrencyDrop' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(biome, source),
      value: { kind: 'normal', exitKey: 'exit1' },
    });
    project = authorLegalTraitOffers(project);
    const target = createEncounterPhaseAddress(
      biome,
      { kind: 'occurrence', occurrenceId: id },
      'Combat',
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAetosWave',
      phase: target,
      value: 2,
    });
    const assembly = simulateProjectAssembly(catalog, project);
    expect(
      encounterPhaseSequenceStatusForProjectEvaluationAssembly(assembly, target),
      JSON.stringify(assembly.evaluation.findings),
    ).toMatchObject({ aetos: { selectedWave: 2, waves: [2] } });
  });

  it('rejects the propagated Fig Leaf skip and permits Gorgon alongside Aetos', () => {
    let project = applyProjectCommand(loadSurfaceNOPProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'SkipEncounterKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFigLeafSkip',
      phase: { ...first, phaseKey: 'Intro' },
      value: true,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAetosWave',
      phase: first,
      value: 2,
    });
    expect(simulateProjectAssembly(catalog, project).evaluation.findings).toContainEqual(
      expect.objectContaining({
        code: 'aetosAppearanceUnavailable',
        origin: first,
        evidence: expect.objectContaining({ reason: 'skipped' }),
      }),
    );
    project = applyProjectCommand(loadSurfaceNOPProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'AthenaEncounterKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceGorgonDeathDefianceCondition',
      phase: first,
      value: true,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceGorgonAthenaOffer',
      trait: createTraitOfferAddress(createGorgonPhaseAddress(first), 'gorgonAthena'),
      value: {
        traitKeys: [
          'InvulnerabilityDashBoon',
          'RetaliateInvulnerabilityBoon',
          'FocusLastStandBoon',
        ],
        selectedOptionKey: 'option1',
      },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAetosWave',
      phase: first,
      value: 2,
    });
    const assembly = simulateProjectAssembly(catalog, project);
    expect(
      encounterPhaseSequenceStatusForProjectEvaluationAssembly(assembly, first),
      JSON.stringify(assembly.evaluation.findings),
    ).toMatchObject({ aetos: { selectedWave: 2, waves: [2] } });
    expect(
      assembly.evaluation.findings.some((finding) => finding.code === 'aetosAppearanceUnavailable'),
    ).toBe(false);
  });

  it('does not assess or reserve a dormant suffix', () => {
    const id = pOccurrenceId('P_Combat02', 2, 1);
    const combat = createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: id },
      'Combat',
    );
    let project = applyProjectCommand(loadSurfaceNOPProject(), catalog, {
      kind: 'ReplaceAetosWave',
      phase: combat,
      value: 2,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase: { ...combat, phaseKey: 'Intro' },
      encounterKey: 'HeraclesCombatP',
    });
    const assembly = simulateProjectAssembly(catalog, project);
    expect(encounterPhaseSequenceStatusForProjectEvaluationAssembly(assembly, combat)).toEqual({
      kind: 'dormantSuffix',
    });
    expect(
      assembly.evaluation.findings.some((finding) => finding.code === 'aetosAppearanceUnavailable'),
    ).toBe(false);
  });

  it('owns native best-effort waves separately from exact customized composition and other event choices', () => {
    expect(assessAetosAppearance(phase('GeneratedP', 2), true, false, false)).toEqual({
      selectedWave: 2,
      waves: [2],
    });
    expect(assessAetosAppearance(phase('GeneratedP_Large', 3), true, false, false)).toEqual({
      selectedWave: 3,
      waves: [2, 3],
    });
    expect(
      assessAetosAppearance(phase('GeneratedP_Large', 3, 2), true, false, false),
    ).toMatchObject({ reason: 'wave', waves: [2] });
    expect(assessAetosAppearance(phase('GeneratedP', 2, 1), true, false, false)).toMatchObject({
      reason: 'wave',
      waves: [],
    });
    expect(assessAetosAppearance(phase('GeneratedP', 3), true, false, false)).toMatchObject({
      reason: 'wave',
      waves: [2],
    });
    for (const key of [
      'GeneratedP_PreCombat',
      'AthenaCombatP',
      'IcarusCombatP',
      'HeraclesCombatP',
      'BossPrometheus01',
    ])
      expect(assessAetosAppearance(phase(key, 2), true, false, false).reason).toBe('encounter');
    expect(assessAetosAppearance(phase('GeneratedP', 2), false, false, false).reason).toBe(
      'indoor',
    );
    expect(assessAetosAppearance(phase('GeneratedP', 2), true, true, false).reason).toBe('skipped');
    expect(assessAetosAppearance(phase('GeneratedP', 2), true, false, true).reason).toBe(
      'alreadyPlaced',
    );
  });

  it('folds only a valid reached appearance and exposes the exact event repair', () => {
    const selected = applyProjectCommand(loadSurfaceNOPProject(), catalog, {
      kind: 'ReplaceAetosWave',
      phase: first,
      value: 2,
    });
    const assembly = simulateProjectAssembly(catalog, selected);
    expect(assembly.evaluation.status, JSON.stringify(assembly.evaluation.findings)).toBe('valid');
    expect(encounterPhaseSequenceStatusForProjectEvaluationAssembly(assembly, first)).toMatchObject(
      { aetos: { selectedWave: 2, waves: [2] } },
    );
    const p = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'P')!;
    if (p.authoring !== 'complete' || p.validity !== 'valid') throw new Error('P missing');
    expect(
      p.history.afterTransition.ledgers.encounterStarts.filter(
        (entry) => entry.aetosWave !== undefined,
      ),
    ).toHaveLength(1);
    const invalid = simulateProjectAssembly(
      catalog,
      applyProjectCommand(selected, catalog, { kind: 'ReplaceAetosWave', phase: first, value: 3 }),
    );
    expect(invalid.evaluation.findings).toContainEqual(
      expect.objectContaining({
        code: 'aetosAppearanceUnavailable',
        origin: first,
        evidence: expect.objectContaining({ reason: 'wave' }),
      }),
    );
    expect(encounterPhaseSequenceStatusForProjectEvaluationAssembly(invalid, first)).toMatchObject({
      aetos: { selectedWave: 3, waves: [2] },
    });
    expect(invalid.evaluation.issue).toMatchObject({ kind: 'invalid', owner: first });
    const invalidP = invalid.evaluation.route.biomes.find((biome) => biome.biomeKey === 'P')!;
    if (!('history' in invalidP)) throw new Error('missing retained history');
    expect(
      invalidP.history.events.filter(
        (event) => event.kind === 'encounterStarted' && event.aetos?.selectedWave !== undefined,
      ),
    ).toEqual([]);
  });

  it('keeps earlier candidates available and retains a later duplicate with no later support', () => {
    const fixture = reachedPOutdoorIcarusFixture();
    const later = fixture.encounter;
    let project: ProjectDocument = applyProjectCommand(fixture.project, catalog, {
      kind: 'ReplaceAetosWave',
      phase: later,
      value: 2,
    });
    expect(
      encounterPhaseSequenceStatusForProjectEvaluationAssembly(
        simulateProjectAssembly(catalog, project),
        first,
      ),
    ).toMatchObject({ aetos: { waves: [2] } });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAetosWave',
      phase: first,
      value: 2,
    });
    const duplicate = simulateProjectAssembly(catalog, project);
    expect(duplicate.evaluation.findings).toContainEqual(
      expect.objectContaining({
        code: 'aetosAppearanceUnavailable',
        origin: later,
        evidence: expect.objectContaining({ reason: 'alreadyPlaced' }),
      }),
    );
    expect(
      encounterPhaseSequenceStatusForProjectEvaluationAssembly(duplicate, later),
    ).toMatchObject({ aetos: { selectedWave: 2, waves: [] } });
    expect(duplicate.evaluation.issue).toMatchObject({ kind: 'invalid', owner: later });
    const duplicateP = duplicate.evaluation.route.biomes.find((biome) => biome.biomeKey === 'P')!;
    if (!('history' in duplicateP)) throw new Error('missing retained history');
    expect(
      duplicateP.history.events.filter(
        (event) => event.kind === 'encounterStarted' && event.aetos?.selectedWave !== undefined,
      ),
    ).toHaveLength(1);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAetosWave',
      phase: first,
      value: 3,
    });
    const earlierBlock = simulateProjectAssembly(catalog, project);
    expect(earlierBlock.evaluation.issue).toMatchObject({ kind: 'invalid', owner: first });
    expect(
      encounterPhaseSequenceStatusForProjectEvaluationAssembly(earlierBlock, later),
    ).toBeUndefined();
    const blockedP = earlierBlock.evaluation.route.biomes.find((biome) => biome.biomeKey === 'P')!;
    if (!('history' in blockedP)) throw new Error('missing retained history');
    expect(
      blockedP.history.events.filter(
        (event) => event.kind === 'encounterStarted' && event.aetos?.selectedWave !== undefined,
      ),
    ).toEqual([]);
    expect(
      project.route.biomes
        .find((biome) => biome.biomeKey === 'P')
        ?.topology?.occurrences.find((room) => room.occurrenceId === fixture.occurrenceId)
        ?.encounters.aetosWaveByPhase,
    ).toEqual({ Combat: 2 });
  });
});

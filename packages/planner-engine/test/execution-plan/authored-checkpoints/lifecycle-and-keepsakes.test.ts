import { expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectHistoryCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createFigLeafPhaseAddress,
  createFigurineArcanaAddress,
  createFountainRarityOutcomeAddress,
  createHubFountainAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectHistory,
  createSteadyGrowthOutcomeAddress,
  undoProjectHistory,
} from '../../../src/authored-project';
import { simulateProjectAssembly } from '../../../src/simulation';
import {
  loadUnderworldAutomaticBossCheckpoint,
  loadUnderworldFigLeafCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  loadSurfaceNPhialIntermediateFountainCheckpoint,
  loadSurfaceScheduledLifecycleCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/surface';
import { goldenFBiome } from '@run-planner/test-fixtures/underworld';
import { oBiome, oOccurrenceIds } from '@run-planner/test-fixtures/surface';
import { compileEligibleProject, reloadProject } from '../support/authored-checkpoints';

it('reloads the intermediate Phial reset to its addressed repair finding', () => {
  const saved = loadSurfaceNPhialIntermediateFountainCheckpoint();
  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceFountainRarityTarget',
    outcome: createFountainRarityOutcomeAddress(
      createHubFountainAddress(createBiomeAddress('Surface', 'N'), 'hub'),
    ),
    targetTraitKey: null,
  });
  const evaluation = simulateProjectAssembly(catalog, reloadProject(edited.present)).evaluation;
  expect(reloadProject(edited.present)).toEqual(edited.present);
  expect(evaluation.findings).toContainEqual(
    expect.objectContaining({
      code: 'fountainRarityResultMissing',
      origin: createFountainRarityOutcomeAddress(
        createHubFountainAddress(createBiomeAddress('Surface', 'N'), 'hub'),
      ),
    }),
  );
  expect(undoProjectHistory(edited).present).toBe(saved);
});

it('reloads a cleared reached Steady Growth target to its exact repair owner', () => {
  const saved = loadSurfaceScheduledLifecycleCheckpoint();
  const outcome = createSteadyGrowthOutcomeAddress(
    createOccurrenceAddress(oBiome, oOccurrenceIds.combat01),
    'Combat1',
  );
  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceSteadyGrowthTarget',
    outcome,
    targetTraitKey: null,
  });
  const reloaded = reloadProject(edited.present);
  expect(reloaded).toEqual(edited.present);
  expect(simulateProjectAssembly(catalog, reloaded).evaluation.findings).toContainEqual(
    expect.objectContaining({ code: 'steadyGrowthOutcomeMissing', origin: outcome }),
  );
  expect(undoProjectHistory(edited).present).toBe(saved);
});

it('exports reached Judgment and Crystal Figurine Boss outcomes, then retains the Figurine edit', () => {
  const saved = loadUnderworldAutomaticBossCheckpoint();
  const boss = createOccurrenceId('golden-f-preboss-shop:boss');
  const figurine = createFigurineArcanaAddress(
    createOccurrenceAddress(goldenFBiome, boss),
    'Encounter',
  );
  const transactions = compileEligibleProject(saved).occurrences.find((room) => room.id === boss)
    ?.timeline.transactions;
  expect(transactions).toContainEqual(
    expect.objectContaining({
      kind: 'automatic',
      effect: 'judgment',
      rarity: 'Epic',
      window: { kind: 'bossDefeated', phaseKey: 'Encounter' },
    }),
  );
  expect(transactions).toContainEqual(
    expect.objectContaining({
      kind: 'automatic',
      effect: 'crystalFigurine',
      rarity: 'Epic',
      window: { kind: 'bossDefeated', phaseKey: 'Encounter' },
    }),
  );
  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceFigurineArcana',
    figurine,
    arcanaKeys: [],
  });
  const reloaded = reloadProject(edited.present);
  expect(reloaded).toEqual(edited.present);
  expect(simulateProjectAssembly(catalog, reloaded).evaluation.findings).toContainEqual({
    code: 'figurineOutcomeMissing',
    evidence: { required: 2, selected: 0 },
    origin: figurine,
    phase: 'rewardGeneration',
    severity: 'error',
  });
  expect(undoProjectHistory(edited).present).toBe(saved);
});

it('exports the reached Fig Leaf skip and reloads its addressed second-skip repair', () => {
  const saved = loadUnderworldFigLeafCheckpoint();
  const skipped = createOccurrenceId('golden-f-b2-e1');
  const f = simulateProjectAssembly(catalog, saved).evaluation.route.biomes.find(
    (biome) => biome.biomeKey === 'F',
  );
  if (f === undefined || !('rewards' in f)) throw new Error('Fig Leaf F evaluation is missing');
  expect(f.rewards.branches[0]?.state.keepsakes.figLeaf).toEqual({
    remainingUses: 2,
    activatedThisBiome: true,
  });
  const later = createEncounterPhaseAddress(
    goldenFBiome,
    { kind: 'occurrence', occurrenceId: createOccurrenceId('golden-f-b3-e1') },
    'Encounter',
  );
  expect(
    compileEligibleProject(saved)
      .occurrences.find((room) => room.id === skipped)
      ?.overview.encounterPhases.find((phase) => phase.slotKey === 'Encounter'),
  ).toMatchObject({ figLeafSkip: true });
  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceFigLeafSkip',
    phase: later,
    value: true,
  });
  const reloaded = reloadProject(edited.present);
  expect(reloaded).toEqual(edited.present);
  expect(simulateProjectAssembly(catalog, reloaded).evaluation.findings).toContainEqual(
    expect.objectContaining({
      code: 'figLeafSkipUnavailable',
      origin: createFigLeafPhaseAddress(later),
      evidence: { reason: 'alreadyUsed' },
      phase: 'encounterResolution',
      severity: 'error',
    }),
  );
  expect(undoProjectHistory(edited).present).toBe(saved);
});

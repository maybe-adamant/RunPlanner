import { expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectHistoryCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createFountainRarityOutcomeAddress,
  createHubFountainAddress,
  createProjectHistory,
  createSteadyGrowthOutcomeAddress,
  createOccurrenceAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  undoProjectHistory,
  type ProjectDocument,
} from '../../src/authored-project';
import { assembleExecutionProduct, compileExecutionPlan } from '../../src/execution-plan';
import { simulateProjectAssembly } from '../../src/simulation';
import { loadUnderworldGeneratedCompositionCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  loadSurfaceEncounterShowcaseCheckpoint,
  loadSurfaceNPhialIntermediateFountainCheckpoint,
  loadSurfaceScheduledLifecycleCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/surface';
import { goldenFBiome, goldenFOccurrenceId } from '@run-planner/test-fixtures/underworld';
import { oBiome, oOccurrenceIds, pBiome, pOccurrenceId } from '@run-planner/test-fixtures/surface';

function plan(project: ProjectDocument) {
  const assembly = simulateProjectAssembly(catalog, project);
  expect(assembly.evaluation.route.summary.eligibleForExecutionPlan).toBe(true);
  return compileExecutionPlan({ product: assembleExecutionProduct({ assembly, catalog }) });
}

function reload(project: ProjectDocument): ProjectDocument {
  return decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog);
}

it('exports reached Fangs, Menace, and the selected H cage from the saved Underworld checkpoint', () => {
  const saved = loadUnderworldGeneratedCompositionCheckpoint();
  const published = plan(saved);
  expect(
    published.occurrences.find((room) => room.id === 'golden-h-combat05')?.overview.encounterPhases,
  ).toContainEqual(expect.objectContaining({ encounterKey: 'GeneratedH_Treant2' }));
  expect(
    published.occurrences.find((room) => room.id === goldenFOccurrenceId(3, 1))?.overview
      .encounterPhases[0]?.customization,
  ).toMatchObject([
    {
      menace: [{ conversions: [{ count: 2, source: { nativeId: 'Guard' } }] }],
    },
  ]);
  expect(
    published.occurrences
      .find((room) => room.id === 'golden-h-combat05')
      ?.overview.encounterPhases.find((phase) => phase.slotKey === 'Cage01')?.customization,
  ).toMatchObject([{ fangs: { type: { nativeId: 'Treant2' }, perks: ['Blink'] } }]);
  expect(
    published.occurrences.find((room) => room.id === goldenFOccurrenceId(7, 1))?.overview
      .encounterPhases[0]?.customization,
  ).toMatchObject([{ fangs: { type: { nativeId: 'Guard_Elite' }, perks: ['Blink'] } }]);

  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceEncounterCustomization',
    phase: createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(7, 1) },
      'Encounter',
    ),
    decisionKey: 'generatedComposition',
    value: null,
  });
  const reloaded = reload(edited.present);
  expect(reloaded).toEqual(edited.present);
  expect(
    plan(reloaded).occurrences.find((room) => room.id === goldenFOccurrenceId(7, 1))?.overview
      .encounterPhases[0]?.customization,
  ).toBeUndefined();
  expect(undoProjectHistory(edited).present).toBe(saved);
});

it('exports the saved P base roll and Q egg choices, then retains the P edit across reload', () => {
  const saved = loadSurfaceEncounterShowcaseCheckpoint();
  const published = plan(saved);
  expect(
    published.occurrences.find((room) => room.id === pOccurrenceId('P_Combat07', 4, 1))?.overview
      .encounterPhases[0]?.customization,
  ).toMatchObject([{ baseRoll: 412 }]);
  expect(
    published.occurrences.find((room) => room.gameName === 'Q_Boss01')?.overview.encounterPhases[0]
      ?.customization,
  ).toMatchObject([
    { decisionKey: 'firstEggWave', choiceKey: 'eidolons' },
    { decisionKey: 'secondEggWave', choiceKey: 'lurkers' },
  ]);
  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceEncounterCustomization',
    phase: createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pOccurrenceId('P_Combat07', 4, 1) },
      'Intro',
    ),
    decisionKey: 'generatedComposition',
    value: null,
  });
  expect(reload(edited.present)).toEqual(edited.present);
  expect(
    plan(reload(edited.present)).occurrences.find(
      (room) => room.id === pOccurrenceId('P_Combat07', 4, 1),
    )?.overview.encounterPhases[0]?.customization,
  ).toBeUndefined();
  expect(undoProjectHistory(edited).present).toBe(saved);
});

it('reloads the intermediate Phial reset to its addressed repair finding', () => {
  const saved = loadSurfaceNPhialIntermediateFountainCheckpoint();
  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceFountainRarityTarget',
    outcome: createFountainRarityOutcomeAddress(
      createHubFountainAddress(createBiomeAddress('Surface', 'N'), 'hub'),
    ),
    targetTraitKey: null,
  });
  const evaluation = simulateProjectAssembly(catalog, reload(edited.present)).evaluation;
  expect(reload(edited.present)).toEqual(edited.present);
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
  const reloaded = reload(edited.present);
  expect(reloaded).toEqual(edited.present);
  expect(simulateProjectAssembly(catalog, reloaded).evaluation.findings).toContainEqual(
    expect.objectContaining({ code: 'steadyGrowthOutcomeMissing', origin: outcome }),
  );
  expect(undoProjectHistory(edited).present).toBe(saved);
});

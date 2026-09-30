import { expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectHistoryCommand,
  createEncounterPhaseAddress,
  createProjectHistory,
  undoProjectHistory,
} from '../../../src/authored-project';
import {
  loadUnderworldArachneCocoonsCheckpoint,
  loadUnderworldGAnomalyRosterCheckpoint,
  loadUnderworldGeneratedCompositionCheckpoint,
  loadUnderworldTwistScyllaCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/underworld';
import { loadSurfaceEncounterShowcaseCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import {
  anomalyRosterPhase,
  arachneCocoonPhases,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenGBiome,
} from '@run-planner/test-fixtures/underworld';
import { pBiome, pOccurrenceId } from '@run-planner/test-fixtures/surface';
import { compileEligibleProject, reloadProject } from '../support/authored-checkpoints';

it('exports reached Fangs, Menace, and the selected H cage from the saved Underworld checkpoint', () => {
  const saved = loadUnderworldGeneratedCompositionCheckpoint();
  const published = compileEligibleProject(saved);
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
  const reloaded = reloadProject(edited.present);
  expect(reloaded).toEqual(edited.present);
  expect(
    compileEligibleProject(reloaded).occurrences.find(
      (room) => room.id === goldenFOccurrenceId(7, 1),
    )?.overview.encounterPhases[0]?.customization,
  ).toBeUndefined();
  expect(undoProjectHistory(edited).present).toBe(saved);
});

it('exports the saved P base roll and Q egg choices, then retains the P edit across reload', () => {
  const saved = loadSurfaceEncounterShowcaseCheckpoint();
  const published = compileEligibleProject(saved);
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
  expect(reloadProject(edited.present)).toEqual(edited.present);
  expect(
    compileEligibleProject(reloadProject(edited.present)).occurrences.find(
      (room) => room.id === pOccurrenceId('P_Combat07', 4, 1),
    )?.overview.encounterPhases[0]?.customization,
  ).toBeUndefined();
  expect(undoProjectHistory(edited).present).toBe(saved);
});

it('exports the reached G Anomaly roster and native return, then reloads its roster reset', () => {
  const saved = loadUnderworldGAnomalyRosterCheckpoint();
  expect(
    compileEligibleProject(saved).occurrences.find(
      (room) => room.id === anomalyRosterPhase.owner.occurrenceId,
    ),
  ).toMatchObject({
    gameName: 'B_Combat01',
    anomaly: { replacedRoomGameName: 'G_Combat03', success: true },
    overview: {
      encounterPhases: [
        {
          slotKey: 'Encounter',
          encounterKey: 'GeneratedAnomalyB',
          kind: 'combat',
          customization: [
            {
              decisionKey: 'infiniteRoster',
              kind: 'infiniteRoster',
              types: [
                { choiceKey: 'SpreadShotUnit_Elite', nativeId: 'SpreadShotUnit_Elite' },
                { choiceKey: 'SpreadShotUnit', nativeId: 'SpreadShotUnit' },
                { choiceKey: 'BloodlessPitcher', nativeId: 'BloodlessPitcher' },
              ],
            },
          ],
        },
      ],
    },
    doors: {
      kind: 'fixed',
      target: { id: 'golden-g-b4-e1', gameName: 'G_Combat10' },
    },
  });
  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceEncounterCustomization',
    phase: anomalyRosterPhase,
    decisionKey: 'infiniteRoster',
    value: null,
  });
  const reloaded = reloadProject(edited.present);
  expect(reloaded).toEqual(edited.present);
  expect(
    compileEligibleProject(reloaded).occurrences.find(
      (room) => room.id === anomalyRosterPhase.owner.occurrenceId,
    )?.overview.encounterPhases,
  ).toEqual([{ slotKey: 'Encounter', encounterKey: 'GeneratedAnomalyB', kind: 'combat' }]);
  expect(undoProjectHistory(edited).present).toBe(saved);
});

it('exports the selected F/G Arachne encounters and reloads the F cocoon reset', () => {
  const saved = loadUnderworldArachneCocoonsCheckpoint();
  const countOnly = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceEncounterCustomization',
    phase: arachneCocoonPhases.F,
    decisionKey: 'cocoonRewardPoint',
    value: null,
  });
  expect(
    compileEligibleProject(countOnly.present).occurrences.find(
      (room) => room.id === arachneCocoonPhases.F.owner.occurrenceId,
    )?.overview.encounterPhases[0]?.customization,
  ).toEqual([{ decisionKey: 'cocoonCount', kind: 'cocoonCount', count: 11 }]);
  const published = compileEligibleProject(saved);
  expect(
    published.occurrences.find((room) => room.id === arachneCocoonPhases.F.owner.occurrenceId)
      ?.overview.encounterPhases,
  ).toEqual([
    {
      slotKey: 'Encounter',
      encounterKey: 'ArachneCombatF',
      kind: 'combat',
      customization: [
        { decisionKey: 'cocoonCount', kind: 'cocoonCount', count: 11 },
        { decisionKey: 'cocoonRewardPoint', kind: 'cocoonRewardPoint', spawnPointId: 40191 },
      ],
    },
  ]);
  expect(
    published.occurrences.find((room) => room.id === arachneCocoonPhases.G.owner.occurrenceId)
      ?.overview.encounterPhases,
  ).toEqual([
    {
      slotKey: 'Encounter',
      encounterKey: 'ArachneCombatG',
      kind: 'combat',
      customization: [
        { decisionKey: 'cocoonRewardPoint', kind: 'cocoonRewardPoint', spawnPointId: 560737 },
      ],
    },
  ]);
  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceEncounterCustomization',
    phase: arachneCocoonPhases.F,
    decisionKey: 'cocoonCount',
    value: null,
  });
  const reloaded = reloadProject(edited.present);
  expect(reloaded).toEqual(edited.present);
  expect(
    compileEligibleProject(reloaded).occurrences.find(
      (room) => room.id === arachneCocoonPhases.F.owner.occurrenceId,
    )?.overview.encounterPhases,
  ).toEqual([
    {
      slotKey: 'Encounter',
      encounterKey: 'ArachneCombatF',
      kind: 'combat',
      customization: [
        { decisionKey: 'cocoonRewardPoint', kind: 'cocoonRewardPoint', spawnPointId: 40191 },
      ],
    },
  ]);
  const any = applyProjectHistoryCommand(edited, catalog, {
    kind: 'ReplaceEncounterCustomization',
    phase: arachneCocoonPhases.F,
    decisionKey: 'cocoonRewardPoint',
    value: null,
  });
  expect(
    compileEligibleProject(any.present).occurrences.find(
      (room) => room.id === arachneCocoonPhases.F.owner.occurrenceId,
    )?.overview.encounterPhases,
  ).toEqual([{ slotKey: 'Encounter', encounterKey: 'ArachneCombatF', kind: 'combat' }]);
  expect(undoProjectHistory(edited).present).toBe(saved);
});

it('exports the reached Twist and Scylla choice and retains its performer reset through reload and Undo', () => {
  const saved = loadUnderworldTwistScyllaCheckpoint();
  const scylla = saved.route.biomes
    .find((biome) => biome.biomeKey === 'G')
    ?.topology?.occurrences.find((room) => room.gameName === 'G_Boss02');
  if (scylla === undefined) throw new Error('saved Twist Scylla checkpoint lost G Boss02');
  const phase = createEncounterPhaseAddress(
    goldenGBiome,
    { kind: 'occurrence', occurrenceId: scylla.occurrenceId },
    'Encounter',
  );
  const published = compileEligibleProject(saved);
  expect(
    published.occurrences.find((room) => room.id === 'golden-f-preboss-shop:postboss')?.timeline
      .transactions,
  ).toContainEqual(
    expect.objectContaining({
      kind: 'transformation',
      transformation: {
        kind: 'stygianWellTwist',
        sourceItemKey: 'RandomStoreItem',
        resultItemKey: 'TemporaryBoonRarityTrait',
      },
    }),
  );
  expect(
    published.occurrences.find((room) => room.id === scylla.occurrenceId)?.overview.encounterPhases,
  ).toContainEqual(
    expect.objectContaining({
      encounterKey: 'BossScylla02',
      customization: [
        expect.objectContaining({ decisionKey: 'featuredPerformer', choiceKey: 'charybdis' }),
      ],
    }),
  );
  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceEncounterCustomization',
    phase,
    decisionKey: 'featuredPerformer',
    value: null,
  });
  const reloaded = reloadProject(edited.present);
  expect(reloaded).toEqual(edited.present);
  expect(
    compileEligibleProject(reloaded).occurrences.find((room) => room.id === scylla.occurrenceId)
      ?.overview.encounterPhases,
  ).toEqual([{ slotKey: 'Encounter', encounterKey: 'BossScylla02', kind: 'boss' }]);
  expect(undoProjectHistory(edited).present).toBe(saved);
});

import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createBiomeFieldAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createStartingRewardAddress,
  createTargetAddress,
} from '../../../src/authored-project';
import {
  encounterPhaseCandidateSupportForProjectEvaluationAssembly,
  encounterPhaseSequenceStatusForProjectEvaluationAssembly,
  generatedEncounterSupportForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '../../../src/simulation';
import { resolveEncounterAuthoringProfile } from '../../../src/simulation/encounters/resolve';
import { assembleExecutionProduct, compileExecutionPlan } from '../../../src/execution-plan';
import { createGoldenFGHIProject, goldenIBiome } from '@run-planner/test-fixtures/underworld';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import { dreamMixedHandoffProject } from '@run-planner/test-fixtures/dream';

describe('Tartarus reached first-combat identity', () => {
  it.each([
    ['I_Combat01', 'GeneratedIChronosIntro'],
    ['I_Combat04', 'GeneratedI_SmallChronosIntro'],
  ])(
    'retains prepared %s identity before an incomplete composition can execute',
    (gameName, definitionKey) => {
      const occurrence = createOccurrenceAddress(
        goldenIBiome,
        createOccurrenceId('golden-i-combat01'),
      );
      let project = createGoldenFGHIProject();
      if (gameName !== 'I_Combat01')
        project = applyProjectCommand(project, catalog, {
          kind: 'ReplaceOccurrenceRoom',
          occurrence,
          gameName,
        });
      const phase = createEncounterPhaseAddress(
        goldenIBiome,
        { kind: 'occurrence', occurrenceId: occurrence.occurrenceId },
        'Encounter',
      );
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceEncounterCustomization',
        phase,
        decisionKey: 'generatedComposition',
        value: { kind: 'generated', waveCount: 1 },
      });
      const assembly = simulateProjectAssembly(catalog, project);
      expect(encounterPhaseSequenceStatusForProjectEvaluationAssembly(assembly, phase)).toEqual({
        kind: 'active',
        encounterDefinitionKey: definitionKey,
      });
      expect(generatedEncounterSupportForProjectEvaluationAssembly(assembly, phase)).toBeDefined();
      const biome = assembly.evaluation.route.biomes.find((value) => value.biomeKey === 'I');
      expect(
        biome &&
          'history' in biome &&
          biome.history.events.some(
            (event) =>
              event.kind === 'encounterRecorded' &&
              event.origin.kind === 'occurrence' &&
              event.origin.occurrenceId === occurrence.occurrenceId,
          ),
      ).toBe(false);
    },
  );
  it.each([
    ['IEncountersDefault', 'GeneratedI', 'GeneratedIChronosIntro', 'GeneratedI_GoalReward'],
    [
      'IEncountersSmaller',
      'GeneratedI_Small',
      'GeneratedI_SmallChronosIntro',
      'GeneratedI_Small_GoalReward',
    ],
  ])(
    'resolves %s only from known depth, before reward mapping',
    (setKey, authored, intro, goal) => {
      const profile = catalog.encounterSets.byKey[setKey]!.authoringProfiles.find(
        (value) => value.key === authored,
      )!;
      expect(
        resolveEncounterAuthoringProfile(profile, {
          kind: 'knownReward',
          rewardType: 'ClockworkGoal',
        }),
      ).toBeUndefined();
      expect(
        resolveEncounterAuthoringProfile(profile, {
          kind: 'knownReward',
          rewardType: 'ClockworkGoal',
          biomeEncounterDepth: 1,
        }),
      ).toBe(intro);
      expect(
        resolveEncounterAuthoringProfile(profile, {
          kind: 'knownReward',
          rewardType: 'ClockworkGoal',
          biomeEncounterDepth: 2,
        }),
      ).toBe(goal);
      expect(
        resolveEncounterAuthoringProfile(profile, {
          kind: 'knownReward',
          rewardType: 'MaxHealthDrop',
          biomeEncounterDepth: 2,
        }),
      ).toBe(authored);
    },
  );

  it.each([
    ['I_Combat01', 'GeneratedI', 'GeneratedIChronosIntro'],
    ['I_Combat04', 'GeneratedI_Small', 'GeneratedI_SmallChronosIntro'],
  ])(
    'prepares and exports %s with its exact generation support and retained authorship',
    (gameName, authored, intro) => {
      let project = createGoldenFGHIProject();
      const occurrence = createOccurrenceAddress(
        goldenIBiome,
        createOccurrenceId('golden-i-combat01'),
      );
      if (gameName !== 'I_Combat01')
        project = applyProjectCommand(project, catalog, {
          kind: 'ReplaceOccurrenceRoom',
          occurrence,
          gameName,
        });
      const phase = createEncounterPhaseAddress(
        goldenIBiome,
        { kind: 'occurrence', occurrenceId: occurrence.occurrenceId },
        'Encounter',
      );
      const initial = simulateProjectAssembly(catalog, project);
      expect(
        encounterPhaseCandidateSupportForProjectEvaluationAssembly(initial, phase),
      ).toMatchObject({
        selectedEncounterKey: authored,
        selectedPossible: true,
        candidateEncounterKeys: [authored],
      });
      const capability = generatedEncounterSupportForProjectEvaluationAssembly(initial, phase)!;
      const value = capability.initialize()!;
      expect(value).toBeDefined();
      const assessment = capability.assess(value);
      expect(assessment.supported).toBe(true);
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceEncounterCustomization',
        phase,
        decisionKey: 'generatedComposition',
        value,
      });
      const assembly = simulateProjectAssembly(catalog, project);
      expect(assembly.evaluation.status, JSON.stringify(assembly.evaluation.findings)).toBe(
        'valid',
      );
      const plan = compileExecutionPlan({
        product: assembleExecutionProduct({ assembly, catalog }),
      });
      const published = plan.occurrences.find((room) => room.id === occurrence.occurrenceId)!;
      expect(published.overview.encounterPhases[0]).toMatchObject({
        encounterKey: intro,
        customization: [
          expect.objectContaining({
            kind: 'generated',
            expectedBudget: assessment.operands!.expectedBudget,
          }),
        ],
      });
      expect(
        plan.occurrences.find((room) => room.id === 'golden-i-combat02')!.overview.encounterPhases,
      ).toEqual([]);
      expect(
        project.route.biomes[3]!.topology!.occurrences.find(
          (room) => room.occurrenceId === occurrence.occurrenceId,
        )!.encounters.customizationByPhase?.Encounter?.generatedComposition,
      ).toEqual(value);
    },
  );

  it.each([
    ['I_Combat01', false],
    ['I_Combat02', false],
    ['I_Combat01', true],
  ] as const)(
    'uses first/later reached identities in Dream from %s (later biome: %s)',
    (gameName, laterBiome) => {
      const biome = createBiomeAddress('Dream', 'I');
      let project = laterBiome
        ? dreamMixedHandoffProject()
        : createProjectDocument(catalog, {
            projectId: 'dream-i-intro',
            routeKey: 'Dream',
            itineraryBiomeKeys: ['I', 'Q'],
            configuredBiomeCount: 1,
          });
      if (laterBiome) {
        project = {
          ...project,
          route: { ...project.route, itineraryBiomeKeys: ['Q', 'F', 'N', 'I'] },
        };
        project = applyProjectCommand(project, catalog, {
          kind: 'ConfigureRoutePrefix',
          route: { kind: 'route', routeKey: 'Dream' },
          configuredBiomeCount: 4,
        });
      } else {
        project = applyProjectCommand(project, catalog, {
          kind: 'ReplaceStartingReward',
          reward: createStartingRewardAddress('Dream'),
          value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
        });
      }
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceBiomeField',
        field: createBiomeFieldAddress(biome, 'maxNonGoalRewards'),
        value: 5,
      });
      const first = createOccurrenceId('dream-i-first');
      const later = createOccurrenceId('dream-i-later');
      for (const [sourceId, targetId, targetGame] of [
        [
          project.route.biomes.find((entry) => entry.biomeKey === 'I')!.topology!.startOccurrenceId,
          first,
          gameName,
        ],
        [first, later, 'I_Combat05'],
      ] as const) {
        const source = { kind: 'occurrence' as const, occurrenceId: sourceId };
        project = applyProjectCommand(project, catalog, {
          kind: 'CreateBatch',
          decision: createExitDecisionAddress(biome, source),
        });
        project = applyProjectCommand(project, catalog, {
          kind: 'CreateTarget',
          target: createTargetAddress(biome, source, 'exit1'),
          occurrenceId: targetId,
          gameName: targetGame,
        });
        if (sourceId === first && catalog.rooms.byKey[gameName]!.exits.length > 1) {
          const peer = createOccurrenceId('dream-i-peer');
          project = applyProjectCommand(project, catalog, {
            kind: 'CreateTarget',
            target: createTargetAddress(biome, source, 'exit2'),
            occurrenceId: peer,
            gameName: 'I_Combat03',
          });
          project = applyProjectCommand(project, catalog, {
            kind: 'ReplaceIncomingReward',
            reward: createIncomingRewardAddress(biome, peer),
            value: { rewardType: 'RoomMoneyTripleDrop' },
          });
          project = applyProjectCommand(project, catalog, {
            kind: 'SetExitSelection',
            selection: createExitSelectionAddress(biome, source),
            value: { kind: 'normal', exitKey: 'exit1' },
          });
        }
      }
      project = authorLegalTraitOffers(project);
      const evaluation = simulateProjectAssembly(catalog, project).evaluation.route.biomes.find(
        (entry) => entry.biomeKey === 'I',
      )!;
      if (!('history' in evaluation)) throw new Error('Missing reached Dream history');
      const identities = evaluation.history?.events
        .filter((event) => event.kind === 'encounterRecorded')
        .map((event) => event.encounterKey);
      expect(identities).toContain(
        gameName === 'I_Combat01' ? 'GeneratedIChronosIntro' : 'GeneratedI_SmallChronosIntro',
      );
      expect(identities).toContain('GeneratedI_Small_GoalReward');
    },
  );
});

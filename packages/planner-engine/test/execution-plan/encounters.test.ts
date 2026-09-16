import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
} from '../../src/authored-project';
import {
  encounterPhaseCandidateSupportForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '../../src/simulation';
import { assembleExecutionProduct, compileExecutionPlan } from '../../src/execution-plan';
import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';

describe('resolved execution encounters', () => {
  it.each([
    ['F', 'golden-f-b8-e1', 'F_Combat12', 'GeneratedF'],
    ['G', 'golden-g-b7-e1', 'G_Combat12', 'GeneratedG'],
  ] as const)(
    'resolves %s %s (%s) Trial combat without changing its authored profile',
    (biomeKey, id, _gameName, authoredKey) => {
      const biome = createBiomeAddress('Underworld', biomeKey);
      const occurrenceId = createOccurrenceId(id);
      let project = createGoldenFGHIProject();
      project = {
        ...project,
        route: {
          ...project.route,
          biomes: project.route.biomes.slice(0, biomeKey === 'F' ? 1 : 2),
        },
      };
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(biome, occurrenceId),
        value: {
          rewardType: 'Devotion',
          payload: {
            kind: 'DevotionPair',
            chosenSource: 'ApolloUpgrade',
            spurnedSource: 'ZeusUpgrade',
          },
        },
      });
      project = authorLegalTraitOffers(project);
      const assembly = simulateProjectAssembly(catalog, project);
      expect(assembly.evaluation.route.findings).toEqual([]);
      expect(assembly.evaluation.status).toBe('valid');
      const phase = createEncounterPhaseAddress(
        biome,
        { kind: 'occurrence', occurrenceId },
        'Encounter',
      );
      expect(
        encounterPhaseCandidateSupportForProjectEvaluationAssembly(assembly, phase),
      ).toMatchObject({
        selectedEncounterKey: authoredKey,
        selectedPossible: true,
        candidateEncounterKeys: [authoredKey],
      });
      const evaluated = assembly.evaluation.route.biomes.find(
        (value) => value.biomeKey === biomeKey,
      );
      if (evaluated?.authoring !== 'complete' || evaluated.validity !== 'valid')
        throw new Error('Trial fixture must be complete-valid');
      expect(
        evaluated.history.events.find(
          (event) =>
            event.kind === 'encounterRecorded' &&
            event.origin.kind === 'occurrence' &&
            event.origin.occurrenceId === occurrenceId,
        ),
      ).toMatchObject({
        encounterKey: `DevotionTest${biomeKey}`,
        phaseKind: 'combat',
        phaseKey: 'Encounter',
      });
      const plan = compileExecutionPlan({ product: assembleExecutionProduct({ assembly }) });
      const occurrence = plan.occurrences.find((value) => value.id === occurrenceId);
      expect(occurrence?.overview.encounterPhases).toEqual([
        { slotKey: 'Encounter', encounterKey: `DevotionTest${biomeKey}`, kind: 'combat' },
      ]);
      const acquisitions = occurrence?.timeline.transactions.filter(
        (transaction) => transaction.kind === 'acquisition',
      );
      expect(acquisitions?.map((transaction) => transaction.window)).toEqual([
        { kind: 'standard', phase: 'beforeCombat' },
        { kind: 'standard', phase: 'afterCombat' },
      ]);
    },
  );

  it('publishes the concrete I goal definition already recorded by simulation', () => {
    const assembly = simulateProjectAssembly(catalog, createGoldenFGHIProject());
    const plan = compileExecutionPlan({ product: assembleExecutionProduct({ assembly }) });
    expect(
      plan.occurrences.find((value) => value.id === 'golden-i-combat01')?.overview.encounterPhases,
    ).toEqual([{ slotKey: 'Encounter', encounterKey: 'GeneratedI_GoalReward', kind: 'combat' }]);
  });
});

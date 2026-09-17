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
import {
  assembleExecutionProduct,
  compileExecutionPlan,
  decodeExecutionPlan,
} from '../../src/execution-plan';
import { overview as decodeExecutionOverview } from '../../src/execution-plan/codec/overview';
import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNOPQProject } from '@run-planner/test-fixtures/surface';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';

describe('resolved execution encounters', () => {
  it.each([
    ['Underworld', 4, 'I_Boss01', 'BossChronos02', createGoldenFGHIProject],
    ['Surface', 3, 'P_Boss01', 'BossPrometheus02', loadSurfaceNOPQProject],
  ] as const)(
    'publishes %s same-map Rival Boss identity',
    (routeKey, rank, gameName, encounterKey, build) => {
      const project = applyProjectCommand(build(), catalog, {
        kind: 'ReplaceFearVowRank',
        route: { kind: 'route', routeKey },
        vowKey: 'BossDifficultyShrineUpgrade',
        rank,
      });
      const plan = compileExecutionPlan({
        product: assembleExecutionProduct({ assembly: simulateProjectAssembly(catalog, project) }),
      });
      expect(
        plan.occurrences.find((occurrence) => occurrence.gameName === gameName)?.overview
          .encounterPhases,
      ).toEqual([{ slotKey: 'Encounter', encounterKey, kind: 'boss' }]);
    },
  );

  it('strictly decodes closed bounded execution customization values', () => {
    expect(() =>
      decodeExecutionOverview(
        {
          encounterPhases: [
            {
              slotKey: 'Encounter',
              encounterKey: 'BossEris02',
              kind: 'boss',
              customization: [
                {
                  decisionKey: 'earlySummons',
                  kind: 'orderedPrefix',
                  choices: [
                    { choiceKey: 'harpy', nativeId: 'ErisEMSummonHarpy' },
                    { choiceKey: 'harpy', nativeId: 'ErisEMSummonHarpy' },
                  ],
                },
              ],
            },
          ],
          requiredObjects: [],
        },
        'overview',
      ),
    ).toThrow(/distinct/);
    expect(() =>
      decodeExecutionOverview(
        { encounterPhases: [], requiredObjects: [], customization: [] },
        'overview',
      ),
    ).toThrow(/unknown field customization/);
  });

  it('publishes Underworld Scylla native choice operands from the resolved fixed phase', () => {
    let project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceFearVowRank',
      route: { kind: 'route', routeKey: 'Underworld' },
      vowKey: 'BossDifficultyShrineUpgrade',
      rank: 2,
    });
    const boss = project.route.biomes
      .find((biome) => biome.biomeKey === 'G')
      ?.topology?.occurrences.find((occurrence) => occurrence.gameName === 'G_Boss02');
    if (boss === undefined) throw new Error('Rival Scylla is missing');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase: createEncounterPhaseAddress(
        createBiomeAddress('Underworld', 'G'),
        { kind: 'occurrence', occurrenceId: boss.occurrenceId },
        'Encounter',
      ),
      decisionKey: 'featuredPerformer',
      value: { kind: 'single', choiceKey: 'charybdis' },
    });
    const plan = compileExecutionPlan({
      product: assembleExecutionProduct({ assembly: simulateProjectAssembly(catalog, project) }),
    });
    const phase = plan.occurrences
      .find((occurrence) => occurrence.id === boss.occurrenceId)
      ?.overview.encounterPhases.find((candidate) => candidate.slotKey === 'Encounter');
    expect(phase).toMatchObject({
      encounterKey: 'BossScylla02',
      customization: [
        {
          decisionKey: 'featuredPerformer',
          kind: 'single',
          choiceKey: 'charybdis',
          nativeId: 'Charybdis',
        },
      ],
    });
    expect(decodeExecutionPlan(JSON.parse(JSON.stringify(plan)))).toEqual(plan);
  });

  it('publishes Surface Eris ordered prefixes with bounded native operands', () => {
    let project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceFearVowRank',
      route: { kind: 'route', routeKey: 'Surface' },
      vowKey: 'BossDifficultyShrineUpgrade',
      rank: 2,
    });
    const boss = project.route.biomes
      .find((biome) => biome.biomeKey === 'O')
      ?.topology?.occurrences.find((occurrence) => occurrence.gameName === 'O_Boss02');
    if (boss === undefined) throw new Error('Rival Eris is missing');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase: createEncounterPhaseAddress(
        createBiomeAddress('Surface', 'O'),
        { kind: 'occurrence', occurrenceId: boss.occurrenceId },
        'Encounter',
      ),
      decisionKey: 'earlySummons',
      value: { kind: 'orderedPrefix', choiceKeys: ['harpy', 'swab'] },
    });
    const plan = compileExecutionPlan({
      product: assembleExecutionProduct({ assembly: simulateProjectAssembly(catalog, project) }),
    });
    const phase = plan.occurrences
      .find((occurrence) => occurrence.id === boss.occurrenceId)
      ?.overview.encounterPhases.find((candidate) => candidate.slotKey === 'Encounter');
    expect(phase?.customization).toEqual([
      {
        decisionKey: 'earlySummons',
        kind: 'orderedPrefix',
        choices: [
          { choiceKey: 'harpy', nativeId: 'ErisEMSummonHarpy' },
          { choiceKey: 'swab', nativeId: 'ErisEMSummonSwab' },
        ],
      },
    ]);
    expect(decodeExecutionPlan(JSON.parse(JSON.stringify(plan)))).toEqual(plan);
  });

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

import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createOccurrenceAddress,
  createExitDecisionAddress,
  createRouteStartKeepsakeSelectionAddress,
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
import {
  loadSurfaceNOPQProject,
  pBiome,
  reachedPOutdoorIcarusFixture,
} from '@run-planner/test-fixtures/surface';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import { underworldArachneCocoonProject } from './support/arachne-cocoon-fixture';

describe('resolved execution encounters', () => {
  it.each([
    ['F_MiniBoss01', 'MiniBossTreant'],
    ['F_MiniBoss02', 'MiniBossFogEmitter'],
  ])(
    'derives fixed %s Shadow identity off/on/off without authored selection or occurrence changes',
    (gameName, key) => {
      let project = createGoldenFGHIProject();
      const picked = project.route.biomes
        .find((biome) => biome.biomeKey === 'F')!
        .topology!.occurrences.find((value) => value.gameName === 'F_MiniBoss01')!;
      if (gameName !== picked.gameName) {
        const alternate = project.route.biomes
          .find((biome) => biome.biomeKey === 'F')!
          .topology!.occurrences.find((value) => value.gameName === gameName)!;
        project = applyProjectCommand(project, catalog, {
          kind: 'ReplaceOccurrenceRoom',
          occurrence: createOccurrenceAddress(
            createBiomeAddress('Underworld', 'F'),
            alternate.occurrenceId,
          ),
          gameName: picked.gameName,
        });
        project = applyProjectCommand(project, catalog, {
          kind: 'ReplaceOccurrenceRoom',
          occurrence: createOccurrenceAddress(
            createBiomeAddress('Underworld', 'F'),
            picked.occurrenceId,
          ),
          gameName,
        });
      }
      const original = project.route.biomes.find((biome) => biome.biomeKey === 'F')!.topology!
        .occurrences;
      for (const rank of [0, 1, 0]) {
        project = applyProjectCommand(project, catalog, {
          kind: 'ReplaceFearVowRank',
          route: { kind: 'route', routeKey: 'Underworld' },
          vowKey: 'MinibossCountShrineUpgrade',
          rank,
        });
        const occurrences = project.route.biomes.find((biome) => biome.biomeKey === 'F')!.topology!
          .occurrences;
        const plan = compileExecutionPlan({
          product: assembleExecutionProduct({
            assembly: simulateProjectAssembly(catalog, project),
            catalog,
          }),
        });
        {
          const occurrence = occurrences.find(
            (value) => value.occurrenceId === picked.occurrenceId,
          )!;
          expect(occurrence.occurrenceId).toBe(
            original.find((value) => value.occurrenceId === picked.occurrenceId)!.occurrenceId,
          );
          expect(occurrence.encounters.encounterKeyByPhase).toEqual({});
          expect(
            plan.occurrences.find((value) => value.id === occurrence.occurrenceId)?.overview
              .encounterPhases,
          ).toEqual([
            {
              slotKey: 'Encounter',
              encounterKey: rank > 0 ? `${key}_Shrine` : key,
              kind: 'miniboss',
            },
          ]);
        }
        if (rank === 1) {
          const incomplete = applyProjectCommand(project, catalog, {
            kind: 'RemoveExitDecision',
            decision: createExitDecisionAddress(createBiomeAddress('Underworld', 'F'), {
              kind: 'occurrence',
              occurrenceId: picked.occurrenceId,
            }),
          });
          const prefix = simulateProjectAssembly(catalog, incomplete).evaluation.route.biomes[0];
          expect(prefix?.authoring).toBe('incomplete');
          if (prefix?.authoring !== 'incomplete' || !('history' in prefix))
            throw new Error('Missing progressive history');
          expect(prefix.history?.events).toContainEqual(
            expect.objectContaining({ kind: 'encounterRecorded', encounterKey: `${key}_Shrine` }),
          );
        }
      }
    },
  );
  it('publishes skipped P Icarus as an encounter without an NPC acquisition transaction', () => {
    const fixture = reachedPOutdoorIcarusFixture();
    let project = applyProjectCommand(fixture.project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'SkipEncounterKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase: fixture.encounter,
      encounterKey: 'IcarusCombatP',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFigLeafSkip',
      phase: createEncounterPhaseAddress(
        pBiome,
        { kind: 'occurrence', occurrenceId: fixture.occurrenceId },
        'Intro',
      ),
      value: true,
    });
    project = authorLegalTraitOffers(project);
    const assembly = simulateProjectAssembly(catalog, project);
    const plan = compileExecutionPlan({ product: assembleExecutionProduct({ assembly, catalog }) });
    const room = plan.occurrences.find((value) => value.id === fixture.occurrenceId);
    expect(room?.overview.encounterPhases).toEqual([
      expect.objectContaining({ slotKey: 'Intro', figLeafSkip: true }),
      expect.objectContaining({ slotKey: 'Combat', encounterKey: 'IcarusCombatP' }),
    ]);
    expect(room?.timeline.transactions.some((entry) => entry.kind === 'encounterInteraction')).toBe(
      false,
    );
    expect(room?.timeline.transactions.some((entry) => entry.kind === 'acquisition')).toBe(true);
  });
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
        product: assembleExecutionProduct({
          assembly: simulateProjectAssembly(catalog, project),
          catalog,
        }),
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

  it('publishes an exact Arachne combat cocoon count and omits the native Default', () => {
    const plan = compileExecutionPlan({
      product: assembleExecutionProduct({
        assembly: simulateProjectAssembly(catalog, underworldArachneCocoonProject()),
        catalog,
      }),
    });
    const phases = (occurrenceId: string) =>
      plan.occurrences.find((occurrence) => occurrence.id === occurrenceId)?.overview
        .encounterPhases;
    expect(phases('golden-f-b5-e1')).toEqual([
      {
        slotKey: 'Encounter',
        encounterKey: 'ArachneCombatF',
        kind: 'combat',
        customization: [{ decisionKey: 'cocoonCount', kind: 'cocoonCount', count: 11 }],
      },
    ]);
    expect(phases('golden-g-b4-e1')).toEqual([
      { slotKey: 'Encounter', encounterKey: 'ArachneCombatG', kind: 'combat' },
    ]);
  });

  it('strictly decodes the cocoon count wire shape', () => {
    const decode = (decision: Record<string, unknown>) =>
      decodeExecutionOverview(
        {
          encounterPhases: [
            {
              slotKey: 'Encounter',
              encounterKey: 'ArachneCombatF',
              kind: 'combat',
              customization: [{ decisionKey: 'cocoonCount', kind: 'cocoonCount', ...decision }],
            },
          ],
          requiredObjects: [],
        },
        'overview',
      );
    expect(decode({ count: 8 }).encounterPhases[0]?.customization).toEqual([
      { decisionKey: 'cocoonCount', kind: 'cocoonCount', count: 8 },
    ]);
    expect(() => decode({ count: 0 })).toThrow(/integer >= 1/);
    expect(() => decode({ count: 8.5 })).toThrow(/integer >= 1/);
    expect(() => decode({})).toThrow();
    expect(() => decode({ count: 8, minimum: 8 })).toThrow(/unknown field minimum/);
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
      product: assembleExecutionProduct({
        assembly: simulateProjectAssembly(catalog, project),
        catalog,
      }),
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

  it.each([
    {
      label: 'normal Chronos late summon',
      routeKey: 'Underworld',
      biomeKey: 'I',
      gameName: 'I_Boss01',
      encounterKey: 'BossChronos01',
      build: createGoldenFGHIProject,
      customization: [
        {
          decisionKey: 'lateSummon',
          choiceKey: 'goldwraiths',
          nativeId: 'ChronosEliteSpawn2',
        },
      ],
    },
    {
      label: 'Rival Chronos late summon',
      routeKey: 'Underworld',
      biomeKey: 'I',
      gameName: 'I_Boss01',
      encounterKey: 'BossChronos02',
      rivalsRank: 4,
      build: createGoldenFGHIProject,
      customization: [
        {
          decisionKey: 'lateSummon',
          choiceKey: 'dreadWailer',
          nativeId: 'Screamer2_SuperElite',
        },
      ],
    },
    {
      label: 'normal Typhon egg waves',
      routeKey: 'Surface',
      biomeKey: 'Q',
      gameName: 'Q_Boss01',
      encounterKey: 'BossTyphonHead01',
      build: loadSurfaceNOPQProject,
      customization: [
        {
          decisionKey: 'firstEggWave',
          choiceKey: 'eidolons',
          nativeId: 'TyphonHeadCastSummon03',
        },
        {
          decisionKey: 'secondEggWave',
          choiceKey: 'lurkers',
          nativeId: 'TyphonHeadCastSummon05',
        },
      ],
    },
    {
      label: 'Rival Typhon second egg wave',
      routeKey: 'Surface',
      biomeKey: 'Q',
      gameName: 'Q_Boss02',
      encounterKey: 'BossTyphonHead02',
      rivalsRank: 4,
      build: loadSurfaceNOPQProject,
      customization: [
        {
          decisionKey: 'secondEggWave',
          choiceKey: 'skyDracons',
          nativeId: 'TyphonHeadCastSummonDragon',
        },
      ],
    },
  ] as const)('publishes $label native operands from the resolved fixed phase', (fixture) => {
    let project = fixture.build();
    if (fixture.rivalsRank !== undefined) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceFearVowRank',
        route: { kind: 'route', routeKey: fixture.routeKey },
        vowKey: 'BossDifficultyShrineUpgrade',
        rank: fixture.rivalsRank,
      });
    }
    const boss = project.route.biomes
      .find((biome) => biome.biomeKey === fixture.biomeKey)
      ?.topology?.occurrences.find((occurrence) => occurrence.gameName === fixture.gameName);
    if (boss === undefined) throw new Error(`${fixture.label} Boss occurrence is missing`);
    const phase = createEncounterPhaseAddress(
      createBiomeAddress(fixture.routeKey, fixture.biomeKey),
      { kind: 'occurrence', occurrenceId: boss.occurrenceId },
      'Encounter',
    );
    for (const customization of fixture.customization) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceEncounterCustomization',
        phase,
        decisionKey: customization.decisionKey,
        value: { kind: 'single', choiceKey: customization.choiceKey },
      });
    }
    const plan = compileExecutionPlan({
      product: assembleExecutionProduct({
        assembly: simulateProjectAssembly(catalog, project),
        catalog,
      }),
    });
    expect(
      plan.occurrences
        .find((occurrence) => occurrence.id === boss.occurrenceId)
        ?.overview.encounterPhases.find((candidate) => candidate.slotKey === 'Encounter'),
    ).toEqual({
      slotKey: 'Encounter',
      encounterKey: fixture.encounterKey,
      kind: 'boss',
      customization: fixture.customization.map(({ decisionKey, choiceKey, nativeId }) => ({
        decisionKey,
        kind: 'single',
        choiceKey,
        nativeId,
      })),
    });
  });

  it('omits Default Chronos customization from execution publication', () => {
    const plan = compileExecutionPlan({
      product: assembleExecutionProduct({
        assembly: simulateProjectAssembly(catalog, createGoldenFGHIProject()),
        catalog,
      }),
    });
    expect(
      plan.occurrences.find((occurrence) => occurrence.gameName === 'I_Boss01')?.overview
        .encounterPhases,
    ).toEqual([{ slotKey: 'Encounter', encounterKey: 'BossChronos01', kind: 'boss' }]);
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
      product: assembleExecutionProduct({
        assembly: simulateProjectAssembly(catalog, project),
        catalog,
      }),
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
      const plan = compileExecutionPlan({
        product: assembleExecutionProduct({ assembly, catalog }),
      });
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
    const plan = compileExecutionPlan({ product: assembleExecutionProduct({ assembly, catalog }) });
    expect(
      plan.occurrences.find((value) => value.id === 'golden-i-combat01')?.overview.encounterPhases,
    ).toEqual([{ slotKey: 'Encounter', encounterKey: 'GeneratedI_GoalReward', kind: 'combat' }]);
  });
});

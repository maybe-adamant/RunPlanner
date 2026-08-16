import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyKeepsakeDisposition,
  consumeGorgonAppearance,
  createKeepsakeState,
  expirePendingGorgon,
} from '../../src/simulation/keepsakes';
import { createArcanaFearState } from '../../src/simulation/arcana-fear';
import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import {
  createGoldenFGHProject,
  createCompleteFGProject,
  goldenGBiome,
  goldenGOccurrenceId,
  createRepresentativeNOPProject,
  pBiome,
  pOccurrenceId,
} from '@run-planner/test-fixtures';
import {
  applyProjectHistoryCommand,
  applyProjectCommand,
  createProjectHistory,
  redoProjectHistory,
  undoProjectHistory,
} from '../../src/authored-project';
import {
  encounterPhaseCandidateSupportForProjectEvaluationAssembly,
  encounterPhaseGorgonSupportForProjectEvaluationAssembly,
  evaluateBiomeCompleteness,
  materializeBiome,
  simulateProject,
  simulateProjectAssembly,
} from '../../src/simulation';
import { evaluateProgressiveBiomeAssembly } from '../../src/simulation/progressive/biome';
import {
  createDefaultGorgonAthenaOffer,
  materializeGorgonAthenaOffer,
} from '../../src/authored-project/traits';
import {
  assessGorgonCandidate,
  assessGorgonChildSettlement,
  assessGorgonEligibility,
  attestGorgonBranchState,
} from '../../src/simulation/keepsakes';
import {
  initializeRewardBranches,
  processEncounterTraitOffer,
} from '../../src/simulation/rewards/processing';
import { evaluateBiomeRewardsAssemblyInternal } from '../../src/simulation/rewards/biome';
import { attachTraitHistory, foldTraitHistoryEvents } from '../../src/simulation/traits';
import { initializeTestRewardBranches } from '../support/arcana-fear';
import {
  createBiomeAddress,
  createEncounterPhaseAddress,
  createGorgonPhaseAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createTraitOfferAddress,
} from '../../src/authored-project';
import { createRouteStartKeepsakeSelectionAddress } from '../../src/authored-project';
import { createEnteredNLocalProject } from '../authored-project/support/complete-n-project';
import { nBiome } from '../authored-project/support/configured-projects';

describe('Gorgon Amulet lifecycle', () => {
  const fear = createArcanaFearState(catalog, createDefaultRouteLoadout(catalog));

  function cherishedPrerequisiteHistory() {
    return foldTraitHistoryEvents(catalog, [
      {
        kind: 'traitOffer' as const,
        owner: { kind: 'project' as const },
        acquisitionRole: 'demeterSeed',
        sequence: 1,
        giverKey: 'Demeter',
        options: [{ traitKey: 'DemeterWeaponBoon', rarity: 'Common' as const }],
        selectedOptionKey: 'option1' as const,
        acquisitionPoint: 'prerequisiteSeed',
      },
      {
        kind: 'traitOffer' as const,
        owner: { kind: 'project' as const },
        acquisitionRole: 'heraSeed',
        sequence: 2,
        giverKey: 'Hera',
        options: [{ traitKey: 'HeraCastBoon', rarity: 'Common' as const }],
        selectedOptionKey: 'option1' as const,
        acquisitionPoint: 'prerequisiteSeed',
      },
    ]);
  }

  function cherishedOffer() {
    return {
      kind: 'traits' as const,
      giverKey: 'Demeter',
      options: [
        { traitKey: 'KeepsakeLevelBoon', rarity: 'Duo' as const },
        { traitKey: 'DemeterSpecialBoon', rarity: 'Common' as const },
        { traitKey: 'DemeterSprintBoon', rarity: 'Common' as const },
      ] as const,
      selectedOptionKey: 'option1' as const,
      rarificationActions: [] as const,
    };
  }

  function evaluateGWithGorgonSeed(
    project: ReturnType<typeof createCompleteFGProject>,
    seed: ReturnType<typeof initializeRewardBranches>[number],
  ) {
    const baseline = simulateProject(catalog, createCompleteFGProject());
    const underworld = baseline.routes.find((route) => route.routeKey === 'Underworld');
    const previous = underworld?.biomes.find((biome) => biome.biomeKey === 'F');
    const gEvaluation = underworld?.biomes.find((biome) => biome.biomeKey === 'G');
    const route = project.routes.find((candidate) => candidate.routeKey === 'Underworld');
    const plan = route?.biomes.find((biome) => biome.biomeKey === 'G');
    if (
      previous?.authoring !== 'complete' ||
      previous.validity !== 'valid' ||
      gEvaluation?.authoring !== 'complete' ||
      gEvaluation.validity !== 'valid' ||
      route === undefined ||
      plan === undefined
    )
      throw new Error('missing valid F-to-G Gorgon fixture');
    const completeness = evaluateBiomeCompleteness(catalog, goldenGBiome, plan);
    if (completeness.completion !== 'complete') throw new Error('G fixture is incomplete');
    const snapshot = materializeBiome(
      catalog,
      goldenGBiome,
      completeness,
      route.loadout,
      plan.bossCompletionArcanaKeys,
      undefined,
      plan.keepsakeEquipResults,
    );
    const traitHistory = seed.traitHistory ?? cherishedPrerequisiteHistory();
    const initialBranches = previous.rewards.branches.map((branch) => ({
      ...branch,
      history: attachTraitHistory(branch.history, traitHistory),
      traitHistory,
      keepsakes: seed.keepsakes,
    }));
    return evaluateBiomeRewardsAssemblyInternal(
      catalog,
      snapshot,
      gEvaluation.history,
      2,
      route.loadout,
      initialBranches,
    ).simulation;
  }

  it('starts pending, consumes once, and never reactivates', () => {
    const pending = createKeepsakeState(catalog, 'AthenaEncounterKeepsake', fear);
    expect(pending.gorgon).toEqual({ status: 'pending', rarity: 'Epic' });
    expect(consumeGorgonAppearance(pending).gorgon).toEqual({ status: 'consumed' });
    expect(consumeGorgonAppearance(consumeGorgonAppearance(pending)).gorgon).toEqual({
      status: 'consumed',
    });
  });

  it.each([
    ['depth', { biomeDepthCache: 1 }],
    ['false DD', { deathDefianceConditionMet: false }],
    ['room blocker', { roomBlocked: true }],
    ['encounter blocker', { encounterBlocked: true }],
    ['Fig Leaf', { figLeafSkipped: true }],
  ])('defers for %s blockers', (_label, override) => {
    expect(
      assessGorgonEligibility({
        status: 'pending',
        biomeDepthCache: 2,
        minimumBiomeDepth: 2,
        roomBlocked: false,
        encounterBlocked: false,
        figLeafSkipped: false,
        deathDefianceConditionMet: true,
        ...override,
      }),
    ).toBe(false);
  });

  it('accepts H passive-style positive phase only with all facts satisfied', () => {
    expect(
      assessGorgonEligibility({
        status: 'pending',
        biomeDepthCache: 2,
        minimumBiomeDepth: 2,
        roomBlocked: false,
        encounterBlocked: false,
        figLeafSkipped: false,
        deathDefianceConditionMet: true,
      }),
    ).toBe(true);
  });

  it('shares the natural/Gorgon Athena route budget in both directions', () => {
    expect(
      assessGorgonCandidate({ status: 'pending', naturalAthena: true, gorgonEligible: true }),
    ).toEqual({ naturalPossible: true, gorgonPossible: true, nextStatus: 'expired' });
    expect(
      assessGorgonCandidate({ status: 'consumed', naturalAthena: true, gorgonEligible: true }),
    ).toEqual({ naturalPossible: false, gorgonPossible: false, nextStatus: 'consumed' });
    expect(
      assessGorgonCandidate({ status: 'expired', naturalAthena: true, gorgonEligible: true }),
    ).toEqual({ naturalPossible: true, gorgonPossible: false, nextStatus: 'expired' });
  });

  it('carries one lifecycle state across equivalent reward branches and rejects divergence', () => {
    const pending = createKeepsakeState(catalog, 'AthenaEncounterKeepsake', fear);
    expect(attestGorgonBranchState([{ keepsakes: pending }, { keepsakes: pending }])).toBe(
      'pending',
    );
    const consumed = consumeGorgonAppearance(pending);
    expect(() =>
      attestGorgonBranchState([{ keepsakes: pending }, { keepsakes: consumed }]),
    ).toThrow('Gorgon branch frontier is divergent');
  });

  it('expires on replacement before activation and keeps replacement state', () => {
    const pending = createKeepsakeState(catalog, 'AthenaEncounterKeepsake', fear);
    const expired = expirePendingGorgon(pending);
    expect(expired.gorgon).toEqual({ status: 'expired' });
    const replaced = applyKeepsakeDisposition(
      catalog,
      pending,
      { kind: 'replace', keepsakeKey: 'ManaOverTimeRefundKeepsake' },
      fear,
    );
    expect(replaced.currentKey).toBe('ManaOverTimeRefundKeepsake');
    expect(replaced.gorgon).toEqual({ status: 'expired' });
  });

  it('publishes a reached G biome branch with an explicit pending lifecycle', () => {
    const project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'AthenaEncounterKeepsake',
    });
    const evaluation = simulateProjectAssembly(catalog, project).evaluation;
    const g = evaluation.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'G');
    expect(g).toBeDefined();
    if (g === undefined || !('rewards' in g)) return;
    expect(g.rewards.branches[0]?.keepsakes.gorgon).toBeDefined();
  });

  it('exposes the fixed depth/provider contract and distinct blocker facts', () => {
    const effect = catalog.keepsakes.byKey.AthenaEncounterKeepsake?.effect;
    expect(effect).toEqual({
      kind: 'gorgonAmulet',
      uses: 1,
      minimumBiomeDepth: 2,
      naturalEncounterKey: 'AthenaCombatP',
      providerKey: 'Athena',
      rarityLevelByRank: { Common: 1, Rare: 2, Epic: 3, Heroic: 4 },
    });
    expect(catalog.encounterDefinitions.byKey.AthenaCombatP?.blocksGorgon).toBe(true);
    expect(catalog.encounterDefinitions.byKey.GeneratedH_Passive?.blocksGorgon).not.toBe(true);
    expect(catalog.encounterDefinitions.byKey.GeneratedH_Passive?.hostsGorgon).toBe(true);
    expect(catalog.encounterDefinitions.byKey.OpeningGeneratedN?.hostsGorgon).toBe(true);
    expect(catalog.encounterDefinitions.byKey.PreHubGeneratedN?.hostsGorgon).toBe(true);
    expect(catalog.rooms.byKey.N_Sub01?.blocksGorgon).toBe(true);
  });

  it('preserves O/P chronology: opening and intro blockers precede positive generated phases', () => {
    expect(catalog.encounterDefinitions.byKey.GeneratedO_Intro01?.blocksGorgon).toBe(true);
    expect(catalog.encounterDefinitions.byKey.PIntroCombat01?.blocksGorgon).toBe(true);
    expect(catalog.encounterDefinitions.byKey.GeneratedO?.blocksGorgon).not.toBe(true);
    expect(catalog.encounterDefinitions.byKey.GeneratedP?.blocksGorgon).not.toBe(true);
  });

  it('retains pending state until a valid additive child settles', () => {
    const project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'AthenaEncounterKeepsake',
    });
    const result = createKeepsakeState(catalog, 'AthenaEncounterKeepsake', fear);
    expect(result.gorgon?.status).toBe('pending');
    expect(project.routes[0]?.loadout.startingKeepsakeKey).toBe('AthenaEncounterKeepsake');
  });

  it.each(['Epic', 'Heroic'] as const)(
    'settles a chronology-resolved %s Athena child with parent DD context',
    (rarity) => {
      const child = createDefaultGorgonAthenaOffer(catalog);
      expect(child?.traitKeys).toHaveLength(3);
      if (child === undefined) return;
      const offer = materializeGorgonAthenaOffer(catalog, child, rarity);
      expect(offer).toBeDefined();
      if (offer === undefined) return;
      expect(offer.options).toHaveLength(3);
      expect(offer.options.every((option) => option.rarity === rarity)).toBe(true);
      expect(offer.deathDefianceConditionMet).toBeUndefined();
      const branch = initializeTestRewardBranches()[0]!;
      const phase = createEncounterPhaseAddress(
        createBiomeAddress('Underworld', 'G'),
        { kind: 'occurrence', occurrenceId: createOccurrenceId('gorgon-child') },
        'Combat',
      );
      const evaluated = processEncounterTraitOffer(
        catalog,
        branch,
        phase,
        offer,
        1,
        'encounterCompleted',
        undefined,
        undefined,
        true,
        'gorgonAthena',
        rarity,
      );
      expect(evaluated.traitEvaluations?.at(-1)?.context.deathDefianceConditionMet).toBe(true);
      expect(evaluated.traitHistory?.equippedTraits.InvulnerabilityDashBoon?.rarity).toBe(rarity);
    },
  );

  it.each([
    ['prior Cherished', true, 'Heroic'],
    ['same-encounter Cherished reward', false, 'Epic'],
  ] as const)('preserves the real Gorgon snapshot for %s', (_label, priorCherished, rarity) => {
    const phase = createEncounterPhaseAddress(
      goldenGBiome,
      { kind: 'occurrence', occurrenceId: goldenGOccurrenceId(1, 1) },
      'Encounter',
    );
    let project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceGorgonDeathDefianceCondition',
      phase,
      value: true,
    });
    if (!priorCherished) {
      const incoming = createIncomingRewardAddress(goldenGBiome, goldenGOccurrenceId(1, 1));
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceIncomingReward',
        reward: incoming,
        value: {
          rewardType: 'Boon',
          payload: { kind: 'BoonSource', source: 'DemeterUpgrade' },
        },
      });
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceTraitOffer',
        trait: createTraitOfferAddress(incoming, 'source'),
        value: cherishedOffer(),
      });
      for (const [occurrenceId, options] of [
        [goldenGOccurrenceId(6, 1), ['DemeterSpecialBoon', 'DemeterCastBoon', 'DemeterSprintBoon']],
        [goldenGOccurrenceId(7, 1), ['DemeterManaBoon', 'CastNovaBoon', 'PlantHealthBoon']],
      ] as const) {
        project = applyProjectCommand(project, catalog, {
          kind: 'ReplaceIncomingReward',
          reward: createIncomingRewardAddress(goldenGBiome, occurrenceId),
          value: {
            rewardType: 'Boon',
            payload: { kind: 'BoonSource', source: 'DemeterUpgrade' },
          },
        });
        project = applyProjectCommand(project, catalog, {
          kind: 'ReplaceTraitOffer',
          trait: createTraitOfferAddress(
            createIncomingRewardAddress(goldenGBiome, occurrenceId),
            'source',
          ),
          value: {
            kind: 'traits',
            giverKey: 'Demeter',
            options: [
              { traitKey: options[0], rarity: 'Common' },
              { traitKey: options[1], rarity: 'Common' },
              { traitKey: options[2], rarity: 'Common' },
            ],
            selectedOptionKey: 'option1',
          },
        });
      }
    }

    const route = project.routes.find((candidate) => candidate.routeKey === 'Underworld');
    if (route === undefined) throw new Error('missing Underworld route');
    const arcanaFear = createArcanaFearState(catalog, route.loadout);
    const initialized = initializeRewardBranches(
      undefined,
      arcanaFear,
      catalog,
      'AthenaEncounterKeepsake',
    )[0]!;
    const before = cherishedPrerequisiteHistory();
    const seeded = {
      ...initialized,
      history: attachTraitHistory(initialized.history, before),
      traitHistory: before,
    };
    const acquired = priorCherished
      ? processEncounterTraitOffer(
          catalog,
          seeded,
          createEncounterPhaseAddress(
            createBiomeAddress('Underworld', 'F'),
            { kind: 'occurrence', occurrenceId: createOccurrenceId('prior-cherished') },
            'Encounter',
          ),
          cherishedOffer(),
          3,
          'encounterCompleted',
        )
      : seeded;
    const result = evaluateGWithGorgonSeed(project, acquired);
    expect(result.branches, JSON.stringify(result.findings)).not.toHaveLength(0);
    expect(result.branches.every((branch) => branch.keepsakes.gorgon?.status === 'consumed')).toBe(
      true,
    );
    expect(
      result.branches.every(
        (branch) => branch.traitHistory?.equippedTraits.InvulnerabilityDashBoon?.rarity === rarity,
      ),
    ).toBe(true);
    expect(
      result.branches.every(
        (branch) => branch.traitHistory?.equippedTraits.KeepsakeLevelBoon !== undefined,
      ),
    ).toBe(true);
  });

  it('atomically creates the authored child and preserves it when the condition is cleared', () => {
    const phase = createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pOccurrenceId('P_Combat03', 1, 1) },
      'Combat',
    );
    const initial = createRepresentativeNOPProject();
    const enabled = applyProjectCommand(initial, catalog, {
      kind: 'ReplaceGorgonDeathDefianceCondition',
      phase,
      value: true,
    });
    const enabledOccurrence = enabled.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'P')
      ?.topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === pOccurrenceId('P_Combat03', 1, 1),
      );
    const enabledResult = enabledOccurrence?.encounters.gorgonResultByPhase?.Combat;
    expect(enabledResult?.deathDefianceConditionMet).toBe(true);
    const enabledOffer = enabledResult?.athenaOffer;
    expect(enabledOffer?.traitKeys).toHaveLength(3);
    expect(enabledOffer).toEqual({
      traitKeys: ['InvulnerabilityDashBoon', 'RetaliateInvulnerabilityBoon', 'FocusLastStandBoon'],
      selectedOptionKey: 'option1',
    });

    const disabled = applyProjectCommand(enabled, catalog, {
      kind: 'ReplaceGorgonDeathDefianceCondition',
      phase,
      value: false,
    });
    const disabledOccurrence = disabled.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'P')
      ?.topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === pOccurrenceId('P_Combat03', 1, 1),
      );
    const disabledResult = disabledOccurrence?.encounters.gorgonResultByPhase?.Combat;
    expect(disabledResult?.athenaOffer).toEqual(enabledResult?.athenaOffer);
    expect(disabledResult?.deathDefianceConditionMet).toBe(false);
  });

  it('undoes and redoes the Gorgon condition without losing the retained child', () => {
    const phase = createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pOccurrenceId('P_Combat03', 1, 1) },
      'Combat',
    );
    const initial = createRepresentativeNOPProject();
    const enabled = applyProjectCommand(initial, catalog, {
      kind: 'ReplaceGorgonDeathDefianceCondition',
      phase,
      value: true,
    });
    const changed = applyProjectHistoryCommand(createProjectHistory(initial), catalog, {
      kind: 'ReplaceGorgonDeathDefianceCondition',
      phase,
      value: true,
    });
    expect(changed.present).toEqual(enabled);
    const undone = undoProjectHistory(changed);
    expect(undone.present).toBe(initial);
    const redone = redoProjectHistory(undone);
    expect(redone.present).toEqual(enabled);
    const result = redone.present.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'P')
      ?.topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === pOccurrenceId('P_Combat03', 1, 1),
      )?.encounters.gorgonResultByPhase?.Combat;
    expect(result?.deathDefianceConditionMet).toBe(true);
    expect(result?.athenaOffer?.traitKeys).toHaveLength(3);
  });

  it('persists only Gorgon author decisions through its exact command and undo/redo', () => {
    const phase = createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pOccurrenceId('P_Combat03', 1, 1) },
      'Combat',
    );
    const initial = applyProjectCommand(createRepresentativeNOPProject(), catalog, {
      kind: 'ReplaceGorgonDeathDefianceCondition',
      phase,
      value: true,
    });
    const trait = createTraitOfferAddress(createGorgonPhaseAddress(phase), 'gorgonAthena');
    const value = {
      traitKeys: [
        'FocusLastStandBoon',
        'InvulnerabilityDashBoon',
        'RetaliateInvulnerabilityBoon',
      ] as const,
      selectedOptionKey: 'option2' as const,
    };
    const command = { kind: 'ReplaceGorgonAthenaOffer' as const, trait, value };
    const changed = applyProjectHistoryCommand(createProjectHistory(initial), catalog, command);
    const occurrence = changed.present.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'P')
      ?.topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === pOccurrenceId('P_Combat03', 1, 1),
      );
    expect(occurrence?.encounters.gorgonResultByPhase?.Combat?.athenaOffer).toEqual(value);
    expect(redoProjectHistory(undoProjectHistory(changed)).present).toEqual(changed.present);

    expect(() =>
      applyProjectCommand(initial, catalog, {
        kind: 'ReplaceTraitOffer',
        trait,
        value: materializeGorgonAthenaOffer(catalog, value, 'Epic')!,
      }),
    ).toThrow('persists only its bound author decisions');
  });

  it('blocks downstream activation when the required child is missing or malformed', () => {
    expect(assessGorgonChildSettlement(catalog, undefined)).toBe(false);
    const offer = createDefaultGorgonAthenaOffer(catalog);
    expect(assessGorgonChildSettlement(catalog, offer)).toBe(true);
    if (offer === undefined) return;
    expect(
      assessGorgonChildSettlement(catalog, {
        ...offer,
        traitKeys: Object.freeze([offer.traitKeys[0]!, offer.traitKeys[0]!, offer.traitKeys[2]!]),
      }),
    ).toBe(false);
  });

  it('keeps a structurally valid context-invalid child at its owner and blocks settlement', () => {
    const phase = createEncounterPhaseAddress(
      createBiomeAddress('Underworld', 'G'),
      { kind: 'occurrence', occurrenceId: goldenGOccurrenceId(1, 1) },
      'Encounter',
    );
    let project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'AthenaEncounterKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceGorgonDeathDefianceCondition',
      phase,
      value: true,
    });
    const contextInvalid = project.routes.map((route) =>
      route.routeKey !== 'Underworld'
        ? route
        : Object.freeze({
            ...route,
            biomes: Object.freeze(
              route.biomes.map((biome) =>
                biome.biomeKey !== 'G'
                  ? biome
                  : Object.freeze({
                      ...biome,
                      topology:
                        biome.topology === null
                          ? null
                          : Object.freeze({
                              ...biome.topology,
                              occurrences: Object.freeze(
                                biome.topology.occurrences.map((occurrence) =>
                                  occurrence.occurrenceId !== goldenGOccurrenceId(1, 1)
                                    ? occurrence
                                    : Object.freeze({
                                        ...occurrence,
                                        encounters: Object.freeze({
                                          ...occurrence.encounters,
                                          gorgonResultByPhase: Object.freeze({
                                            ...(occurrence.encounters.gorgonResultByPhase ?? {}),
                                            Encounter: Object.freeze({
                                              deathDefianceConditionMet: true,
                                              athenaOffer: Object.freeze({
                                                ...occurrence.encounters.gorgonResultByPhase
                                                  ?.Encounter?.athenaOffer,
                                                traitKeys: Object.freeze([
                                                  'OlympianSpellCountBoon',
                                                  'RetaliateInvulnerabilityBoon',
                                                  'FocusLastStandBoon',
                                                ]),
                                              }),
                                            }),
                                          }),
                                        }),
                                      }),
                                ),
                              ),
                            }),
                    }),
              ),
            ),
          }),
    );
    const evaluation = simulateProjectAssembly(catalog, {
      ...project,
      routes: Object.freeze(contextInvalid) as typeof project.routes,
    }).evaluation;
    const g = evaluation.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'G');
    expect(g).toBeDefined();
    if (g === undefined || !('rewards' in g)) return;
    expect(
      g.rewards.branches.every((branch) => branch.keepsakes.gorgon?.status === 'pending'),
    ).toBe(true);
    expect(g.findings).toContainEqual(
      expect.objectContaining({
        code: 'missingPrerequisite',
        origin: expect.objectContaining({ acquisitionRole: 'gorgonAthena' }),
      }),
    );

    const missing = project.routes.map((route) =>
      route.routeKey !== 'Underworld'
        ? route
        : Object.freeze({
            ...route,
            biomes: Object.freeze(
              route.biomes.map((biome) =>
                biome.biomeKey !== 'G'
                  ? biome
                  : Object.freeze({
                      ...biome,
                      topology:
                        biome.topology === null
                          ? null
                          : Object.freeze({
                              ...biome.topology,
                              occurrences: Object.freeze(
                                biome.topology.occurrences.map((occurrence) =>
                                  occurrence.occurrenceId !== goldenGOccurrenceId(1, 1)
                                    ? occurrence
                                    : Object.freeze({
                                        ...occurrence,
                                        encounters: Object.freeze({
                                          ...occurrence.encounters,
                                          gorgonResultByPhase: Object.freeze({
                                            ...(occurrence.encounters.gorgonResultByPhase ?? {}),
                                            Encounter: Object.freeze({
                                              deathDefianceConditionMet: true,
                                            }),
                                          }),
                                        }),
                                      }),
                                ),
                              ),
                            }),
                    }),
              ),
            ),
          }),
    );
    const missingEvaluation = simulateProjectAssembly(catalog, {
      ...project,
      routes: Object.freeze(missing) as typeof project.routes,
    }).evaluation;
    const missingG = missingEvaluation.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'G');
    expect(missingG).toBeDefined();
    if (missingG === undefined || !('rewards' in missingG)) return;
    expect(
      missingG.rewards.branches.every((branch) => branch.keepsakes.gorgon?.status === 'pending'),
    ).toBe(true);
    expect(
      missingG.findings.some((finding) => finding.code === 'rewardAcquisitionUnavailable'),
    ).toBe(true);
  });

  it('publishes the final candidate output without natural Athena after Gorgon consumes first', () => {
    const phase = createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pOccurrenceId('P_Combat12', 8, 1) },
      'Combat',
    );
    let project = applyProjectCommand(createRepresentativeNOPProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'AthenaEncounterKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceGorgonDeathDefianceCondition',
      phase,
      value: true,
    });
    const assembly = simulateProjectAssembly(catalog, project);
    const p = assembly.evaluation.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'P');
    expect(p).toBeDefined();
    if (p === undefined || !('rewards' in p)) return;
    expect(p.rewards.branches[0]?.keepsakes.gorgon?.status).toBe('consumed');
    expect(
      encounterPhaseCandidateSupportForProjectEvaluationAssembly(assembly, phase)
        ?.candidateEncounterKeys,
    ).not.toContain('AthenaCombatP');
  });

  it('publishes exact reached Gorgon support through final project assembly', () => {
    const phase = createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pOccurrenceId('P_Combat12', 8, 1) },
      'Combat',
    );
    const noGorgon = simulateProjectAssembly(catalog, createRepresentativeNOPProject());
    expect(
      encounterPhaseGorgonSupportForProjectEvaluationAssembly(noGorgon, phase)?.supported,
    ).toBe(false);

    let pendingProject = applyProjectCommand(createRepresentativeNOPProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'AthenaEncounterKeepsake',
    });
    const pending = simulateProjectAssembly(catalog, pendingProject);
    expect(encounterPhaseGorgonSupportForProjectEvaluationAssembly(pending, phase)).toMatchObject({
      supported: true,
      rarity: 'Epic',
    });

    pendingProject = applyProjectCommand(pendingProject, catalog, {
      kind: 'ReplaceGorgonDeathDefianceCondition',
      phase,
      value: true,
    });
    const consumed = simulateProjectAssembly(catalog, pendingProject);
    expect(encounterPhaseGorgonSupportForProjectEvaluationAssembly(consumed, phase)).toMatchObject({
      supported: false,
      rarity: 'Epic',
    });

    const naturalFirst = applyProjectCommand(pendingProject, catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'AthenaCombatP',
    });
    const expired = simulateProjectAssembly(catalog, naturalFirst);
    expect(encounterPhaseGorgonSupportForProjectEvaluationAssembly(expired, phase)?.supported).toBe(
      false,
    );

    const nProject = applyProjectCommand(createEnteredNLocalProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'AthenaEncounterKeepsake',
    });
    const nAssembly = simulateProjectAssembly(catalog, nProject);
    const nBiomeEvaluation = nAssembly.evaluation.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N');
    const nSubEvent =
      nBiomeEvaluation !== undefined && 'history' in nBiomeEvaluation
        ? nBiomeEvaluation.history.events.find(
            (event) => event.kind === 'roomCreated' && event.gameName === 'N_Sub01',
          )
        : undefined;
    expect(nSubEvent, JSON.stringify(nAssembly.evaluation.findings)).toBeDefined();
    if (
      nSubEvent === undefined ||
      nSubEvent.kind !== 'roomCreated' ||
      (nSubEvent.origin.kind !== 'occurrence' && nSubEvent.origin.kind !== 'localChild')
    )
      return;
    const nSideGorgonPhase = createEncounterPhaseAddress(
      nBiome,
      nSubEvent.origin.kind === 'occurrence'
        ? { kind: 'occurrence', occurrenceId: nSubEvent.origin.occurrenceId }
        : {
            kind: 'localChild',
            occurrenceId: nSubEvent.origin.occurrenceId,
            groupKey: nSubEvent.origin.groupKey,
            slotKey: nSubEvent.origin.slotKey,
          },
      'Encounter',
    );
    expect(
      encounterPhaseGorgonSupportForProjectEvaluationAssembly(nAssembly, nSideGorgonPhase)
        ?.supported,
    ).toBe(false);
  });

  it('retains the natural alternative while pending and expires Gorgon when selected first', () => {
    const phase = createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pOccurrenceId('P_Combat12', 8, 1) },
      'Combat',
    );
    let project = applyProjectCommand(createRepresentativeNOPProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'AthenaEncounterKeepsake',
    });
    const pendingAssembly = simulateProjectAssembly(catalog, project);
    expect(
      encounterPhaseCandidateSupportForProjectEvaluationAssembly(pendingAssembly, phase)
        ?.candidateEncounterKeys,
    ).toContain('AthenaCombatP');
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'AthenaCombatP',
    });
    const naturalFirstAssembly = simulateProjectAssembly(catalog, project);
    const p = naturalFirstAssembly.evaluation.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'P');
    expect(p).toBeDefined();
    if (p === undefined || !('rewards' in p)) return;
    expect(p.rewards.branches[0]?.keepsakes.gorgon?.status).toBe('expired');
    expect(
      encounterPhaseCandidateSupportForProjectEvaluationAssembly(naturalFirstAssembly, phase),
    ).toMatchObject({ selectedEncounterKey: 'AthenaCombatP', selectedPossible: true });
  });

  it('does not activate Gorgon on a later P phase whose Fig Leaf execution skipped it', () => {
    const phase = createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pOccurrenceId('P_Combat12', 8, 1) },
      'Combat',
    );
    let project = applyProjectCommand(createRepresentativeNOPProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'AthenaEncounterKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceGorgonDeathDefianceCondition',
      phase,
      value: true,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFigLeafSkip',
      phase,
      value: true,
    });
    const baseline = simulateProjectAssembly(catalog, createRepresentativeNOPProject()).evaluation;
    const previous = baseline.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'O');
    const plan = project.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'P');
    expect(previous).toBeDefined();
    expect(plan).toBeDefined();
    if (
      previous === undefined ||
      plan === undefined ||
      previous.authoring !== 'complete' ||
      previous.validity !== 'valid' ||
      !('rewards' in previous)
    )
      return;
    const rewardBranches = previous.rewards.branches.map((branch) =>
      Object.freeze({
        ...branch,
        keepsakes: Object.freeze({
          ...branch.keepsakes,
          gorgon: { status: 'pending' as const, rarity: 'Epic' as const },
          figLeaf: { remainingUses: 3, activatedThisBiome: false },
        }),
      }),
    );
    const progressive = evaluateProgressiveBiomeAssembly(catalog, pBiome, plan, {
      enteredBiomeCount: 3,
      loadout: createDefaultRouteLoadout(catalog),
      seed: { history: previous.history, rewardBranches },
    });
    expect(progressive).not.toBeNull();
    const rewards = progressive?.evaluation.rewards;
    expect(rewards?.branches[0]?.keepsakes.gorgon?.status).toBe('pending');
  });
});

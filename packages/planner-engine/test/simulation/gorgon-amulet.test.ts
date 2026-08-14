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
  simulateProjectAssembly,
} from '../../src/simulation';
import { evaluateProgressiveBiomeAssembly } from '../../src/simulation/progressive/biome';
import { createDefaultGorgonAthenaOffer } from '../../src/authored-project/traits';
import {
  assessGorgonCandidate,
  assessGorgonChildSettlement,
  assessGorgonEligibility,
  attestGorgonBranchState,
} from '../../src/simulation/keepsakes';
import { processEncounterTraitOffer } from '../../src/simulation/rewards/processing';
import { initializeTestRewardBranches } from '../support/arcana-fear';
import {
  createBiomeAddress,
  createEncounterPhaseAddress,
  createOccurrenceId,
} from '../../src/authored-project';
import { createRouteStartKeepsakeSelectionAddress } from '../../src/authored-project';
import { createEnteredNLocalProject } from '../authored-project/support/complete-n-project';
import { nBiome } from '../authored-project/support/configured-projects';

describe('Gorgon Amulet lifecycle', () => {
  const fear = createArcanaFearState(catalog, createDefaultRouteLoadout(catalog));

  it('starts pending, consumes once, and never reactivates', () => {
    const pending = createKeepsakeState(catalog, 'AthenaEncounterKeepsake', fear);
    expect(pending.gorgon).toEqual({ status: 'pending' });
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

  it('settles a fixed-Epic three-option Athena child with parent DD context', () => {
    const offer = createDefaultGorgonAthenaOffer(catalog);
    expect(offer?.kind).toBe('traits');
    if (offer?.kind !== 'traits') return;
    expect(offer.options).toHaveLength(3);
    expect(offer.options.every((option) => option.rarity === 'Epic')).toBe(true);
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
    );
    expect(evaluated.traitEvaluations?.at(-1)?.context.deathDefianceConditionMet).toBe(true);
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
    expect(enabledOffer?.kind).toBe('traits');
    if (enabledOffer?.kind !== 'traits') return;
    expect(enabledOffer.options).toHaveLength(3);
    expect(enabledOffer.options.every((option) => option.rarity === 'Epic')).toBe(true);

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
    expect(result?.athenaOffer?.kind).toBe('traits');
  });

  it('blocks downstream activation when the required child is missing or malformed', () => {
    expect(assessGorgonChildSettlement(catalog, undefined)).toBe(false);
    const offer = createDefaultGorgonAthenaOffer(catalog);
    expect(assessGorgonChildSettlement(catalog, offer)).toBe(true);
    if (offer?.kind !== 'traits') return;
    expect(
      assessGorgonChildSettlement(catalog, {
        ...offer,
        options: Object.freeze([offer.options[0]!]),
      }),
    ).toBe(false);
  });

  it('blocks the real reward fold when a retained required child is malformed', () => {
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
    const malformed = project.routes.map((route) =>
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
                                                options: Object.freeze(
                                                  occurrence.encounters.gorgonResultByPhase
                                                    ?.Encounter?.athenaOffer?.kind === 'traits'
                                                    ? occurrence.encounters.gorgonResultByPhase.Encounter.athenaOffer.options.slice(
                                                        0,
                                                        1,
                                                      )
                                                    : [],
                                                ),
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
      routes: Object.freeze(malformed) as typeof project.routes,
    }).evaluation;
    const g = evaluation.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'G');
    expect(g).toBeDefined();
    if (g === undefined || !('rewards' in g)) return;
    expect(
      g.rewards.branches.every((branch) => branch.keepsakes.gorgon?.status === 'pending'),
    ).toBe(true);
    expect(g.findings.some((finding) => finding.code === 'rewardAcquisitionUnavailable')).toBe(
      true,
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
    expect(encounterPhaseGorgonSupportForProjectEvaluationAssembly(pending, phase)?.supported).toBe(
      true,
    );

    pendingProject = applyProjectCommand(pendingProject, catalog, {
      kind: 'ReplaceGorgonDeathDefianceCondition',
      phase,
      value: true,
    });
    const consumed = simulateProjectAssembly(catalog, pendingProject);
    expect(
      encounterPhaseGorgonSupportForProjectEvaluationAssembly(consumed, phase)?.supported,
    ).toBe(false);

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
    expect(nSubEvent).toBeDefined();
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
          gorgon: { status: 'pending' as const },
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

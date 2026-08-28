import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createKeepsakeEquipResultAddress,
  createLocalVisitOrderAddress,
  createOccurrenceId,
  createOccurrenceAddress,
  createPostbossKeepsakeSelectionAddress,
  createRouteStartKeepsakeSelectionAddress,
} from '@run-planner/engine/authored-project';
import {
  assessTraitOption,
  keepsakeEquipResultCandidateForProjectEvaluationAssembly,
  simulateProject,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';

import { replaceTestRoomActionOrder } from '@run-planner/test-fixtures/shared';
import {
  createCompleteFGProject,
  createGoldenFGHProject,
} from '@run-planner/test-fixtures/underworld';
import {
  loadSurfaceNProject,
  loadSurfaceNOProject,
  loadSurfaceNOPProject,
  nBiome,
  nOccurrenceId,
  oBiome,
  oOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import { evaluateBiomeRewardsAssemblyInternal } from '../../src/simulation/rewards/biome';
import { evaluateKeepsakeEquipResultCandidate } from '../../src/simulation/candidates/keepsake-equip-result';
import {
  applyExperimentalHammerEquipResult,
  initializeRewardBranches,
  publicRewardBranch,
} from '../../src/simulation/rewards/processing';
import { createArcanaFearState } from '../../src/simulation/arcana-fear';
import { createKeepsakeState } from '../../src/simulation/keepsakes';

function route(project: ReturnType<typeof createCompleteFGProject>) {
  const value = project.routes.find((candidate) => candidate.routeKey === 'Underworld');
  if (value === undefined) throw new Error('missing Underworld route');
  return value;
}

function automaticOccurrence(
  biome: ReturnType<typeof createBiomeAddress>,
  role: 'boss' | 'postboss',
) {
  const prebossOccurrenceIds: Record<string, string> = {
    F: 'golden-f-preboss-shop',
    G: 'golden-g-preboss-shop',
    H: 'golden-h-preboss-shop',
    N: 'surface-n-preboss',
    O: 'surface-o-preboss',
    P: 'surface-p-preboss-shop',
    Q: 'surface-q-preboss',
  };
  const preboss = prebossOccurrenceIds[biome.biomeKey];
  if (preboss === undefined) throw new Error(`missing test Preboss for ${biome.biomeKey}`);
  return createOccurrenceAddress(biome, createOccurrenceId(`${preboss}:${role}`));
}

function evaluatedBiome(project: ReturnType<typeof createCompleteFGProject>, key: 'F' | 'G' | 'H') {
  const value = simulateProject(catalog, project)
    .routes.find((candidate) => candidate.routeKey === 'Underworld')
    ?.biomes.find((candidate) => candidate.biomeKey === key);
  if (value?.authoring !== 'complete' || value.validity !== 'valid')
    throw new Error(`expected valid ${key} lifecycle fixture`);
  return value;
}

function equippedBranch(
  project: ReturnType<typeof createCompleteFGProject>,
  remainingUses: number,
  traitKey = 'StaffLongAttackTrait',
) {
  const loadout = route(project).loadout;
  const arcanaFear = createArcanaFearState(catalog, loadout);
  const seed = initializeRewardBranches(undefined, arcanaFear, catalog, 'TempHammerKeepsake')[0]!;
  const result = applyExperimentalHammerEquipResult(
    catalog,
    { ...seed, keepsakes: createKeepsakeState(catalog, 'TempHammerKeepsake', arcanaFear) },
    'TempHammerKeepsake',
    { experimentalHammer: { kind: 'selected', traitKey } },
    createKeepsakeEquipResultAddress(
      createRouteStartKeepsakeSelectionAddress('Underworld'),
      'experimentalHammer',
    ),
    0,
    loadout,
  );
  return publicRewardBranch({
    ...result,
    keepsakes: {
      ...result.keepsakes,
      experimentalHammers: [{ ...result.keepsakes.experimentalHammers.at(-1)!, remainingUses }],
    },
  });
}

function replayThroughRealLifecycle(
  project: ReturnType<typeof createCompleteFGProject>,
  key: 'F' | 'G' | 'H',
  remainingUses: number,
) {
  const evaluated = evaluatedBiome(project, key);
  return evaluateBiomeRewardsAssemblyInternal(
    catalog,
    evaluated.snapshot,
    evaluated.history,
    1,
    route(project).loadout,
    [equippedBranch(project, remainingUses)],
  ).simulation;
}

function withPostbossHammer(project: ReturnType<typeof createGoldenFGHProject>) {
  const selection = createPostbossKeepsakeSelectionAddress(
    automaticOccurrence(createBiomeAddress('Underworld', 'F'), 'postboss'),
  );
  const selected = applyProjectCommand(project, catalog, {
    kind: 'ReplacePostbossKeepsake',
    selection,
    keepsakeKey: 'TempHammerKeepsake',
  });
  return applyProjectCommand(selected, catalog, {
    kind: 'ReplaceExperimentalHammerEquipResult',
    result: createKeepsakeEquipResultAddress(selection, 'experimentalHammer'),
    value: { kind: 'selected', traitKey: 'StaffJumpSpecialTrait' },
  });
}

function withPostbossNeutralReplacement(project: ReturnType<typeof createGoldenFGHProject>) {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplacePostbossKeepsake',
    selection: createPostbossKeepsakeSelectionAddress(
      automaticOccurrence(createBiomeAddress('Underworld', 'F'), 'postboss'),
    ),
    keepsakeKey: 'BossPreDamageKeepsake',
  });
}

function lifecycleEndEffects(
  project: ReturnType<typeof createCompleteFGProject>,
  key: 'F' | 'G' | 'H',
) {
  return evaluatedBiome(project, key).history.events.filter(
    (event) => event.kind === 'encounterEndEffectsApplied',
  );
}

describe('Experimental Hammer', () => {
  it('leaves its immediate result unresolved independent of catalog order', () => {
    const project = createCompleteFGProject();
    const reversedCatalog = Object.freeze({
      ...catalog,
      traits: Object.freeze({
        ...catalog.traits,
        values: Object.freeze([...catalog.traits.values].reverse()),
      }),
    });
    const selected = applyProjectCommand(project, reversedCatalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'TempHammerKeepsake',
    });
    expect(route(selected).loadout.keepsakeEquipResults?.experimentalHammer).toBeUndefined();
    const missingAssembly = simulateProjectAssembly(reversedCatalog, selected);
    expect(missingAssembly.evaluation).toMatchObject({
      status: 'incomplete',
      summary: {
        evaluatedBiomeCount: 0,
        validatedBiomeCount: 0,
        blockedBiomeCount: 2,
        eligibleForExecutionPlan: false,
      },
    });
    expect(missingAssembly.evaluation.findings).toContainEqual(
      expect.objectContaining({
        code: 'keepsakeEquipResultMissing',
        origin: createKeepsakeEquipResultAddress(
          createRouteStartKeepsakeSelectionAddress('Underworld'),
          'experimentalHammer',
        ),
      }),
    );
    const missingRoute = missingAssembly.evaluation.routes.find(
      (candidate) => candidate.routeKey === 'Underworld',
    );
    expect(missingRoute).toMatchObject({
      status: 'incomplete',
      biomes: [],
      processing: { completeValidPrefix: [], active: null, blockedSuffix: ['F', 'G'] },
      summary: {
        evaluatedBiomeCount: 0,
        validatedBiomeCount: 0,
        blockedBiomeCount: 2,
        eligibleForExecutionPlan: false,
      },
    });
    const result = createKeepsakeEquipResultAddress(
      createRouteStartKeepsakeSelectionAddress('Underworld'),
      'experimentalHammer',
    );
    expect(
      keepsakeEquipResultCandidateForProjectEvaluationAssembly(missingAssembly, result),
    ).toBeDefined();

    const retainedInvalid = applyProjectCommand(selected, catalog, {
      kind: 'ReplaceExperimentalHammerEquipResult',
      result,
      value: { kind: 'selected', traitKey: 'DaggerBlinkAoETrait' },
    });
    const invalidAssembly = simulateProjectAssembly(catalog, retainedInvalid);
    expect(invalidAssembly.evaluation.status).toBe('invalid');
    expect(route(retainedInvalid).loadout.keepsakeEquipResults?.experimentalHammer).toEqual({
      kind: 'selected',
      traitKey: 'DaggerBlinkAoETrait',
    });
    expect(invalidAssembly.evaluation.routes[0]).toMatchObject({
      status: 'invalid',
      biomes: [],
      processing: { completeValidPrefix: [], active: null, blockedSuffix: ['F', 'G'] },
      summary: { eligibleForExecutionPlan: false },
    });
    expect(invalidAssembly.evaluation.findings).toContainEqual(
      expect.objectContaining({ code: 'keepsakeEquipResultUnavailable', origin: result }),
    );

    const completed = applyProjectCommand(retainedInvalid, catalog, {
      kind: 'ReplaceExperimentalHammerEquipResult',
      result,
      value: { kind: 'selected', traitKey: 'StaffOneWayAttackTrait' },
    });
    const completedRoute = simulateProjectAssembly(catalog, completed).evaluation.routes[0];
    expect(completedRoute).toMatchObject({
      status: 'valid',
      processing: { completeValidPrefix: ['F', 'G'], active: null, blockedSuffix: [] },
      summary: { evaluatedBiomeCount: 2, validatedBiomeCount: 2, eligibleForExecutionPlan: true },
    });
    expect(completedRoute?.biomes).toHaveLength(2);
    const resumedF = completedRoute?.biomes[0];
    if (resumedF === undefined || !('rewards' in resumedF))
      throw new Error('completed route-start Hammer did not resume F');
    expect(resumedF.rewards.branches[0]?.traitHistory?.equippedTraits).toHaveProperty(
      'StaffOneWayAttackTrait',
    );
  });

  it('acquires one compatible Hammer directly without an invented rarity', () => {
    const project = createCompleteFGProject();
    const branch = equippedBranch(project, 20);
    expect(branch.traitHistory?.equippedTraits.StaffLongAttackTrait).toMatchObject({
      traitKey: 'StaffLongAttackTrait',
      hammerRank: 'RankI',
    });
    expect(branch.traitHistory?.equippedTraits.StaffLongAttackTrait?.rarity).toBeUndefined();
  });

  it('uses the production end-effects lifecycle hook to expire and remove the exact acquisition', () => {
    const project = createCompleteFGProject();
    const result = replayThroughRealLifecycle(project, 'F', 1);
    const branch = result.branches[0]!;
    expect(branch.keepsakes.experimentalHammers.at(-1)).toMatchObject({
      active: false,
      remainingUses: 0,
    });
    expect(branch.traitHistory?.equippedTraits.StaffLongAttackTrait).toBeUndefined();
    expect(branch.traitHistory?.events).toContainEqual(
      expect.objectContaining({
        acquisitionRole: 'experimentalHammerExpiry',
        acquisitionPoint: 'encounterEndEffectsApplied',
      }),
    );
  });

  it('consumes every qualifying end-effects checkpoint in the real room lifecycle, rather than a room counter', () => {
    const project = createCompleteFGProject();
    const result = replayThroughRealLifecycle(project, 'F', 2);
    const branch = result.branches[0]!;
    expect(branch.keepsakes.experimentalHammers.at(-1)).toMatchObject({
      active: false,
      remainingUses: 0,
    });
    expect(
      branch.traitHistory?.events.filter(
        (event) => event.acquisitionRole === 'experimentalHammerExpiry',
      ),
    ).toHaveLength(1);
  });

  it('uses every rigid H cage end-effects checkpoint without treating Passive setup as an encounter cycle', () => {
    const project = replaceTestRoomActionOrder(
      createGoldenFGHProject(),
      catalog,
      createBiomeAddress('Underworld', 'H'),
      createOccurrenceId('golden-h-combat02'),
      [
        { kind: 'completeFieldsCage', phaseKey: 'Cage02' },
        { kind: 'completeFieldsCage', phaseKey: 'Cage01' },
        { kind: 'interactLocalReward', groupKey: 'cages', slotKey: 'cage1' },
        { kind: 'interactLocalReward', groupKey: 'cages', slotKey: 'cage2' },
      ],
    );
    const endEffects = lifecycleEndEffects(project, 'H');
    const distinctOwners = new Set(endEffects.map((event) => JSON.stringify(event.origin)));
    expect(endEffects.length).toBeGreaterThan(distinctOwners.size);

    const g = evaluatedBiome(project, 'G');
    const branch = applyExperimentalHammerEquipResult(
      catalog,
      g.rewards.branches[0]! as Parameters<typeof applyExperimentalHammerEquipResult>[1],
      'TempHammerKeepsake',
      { experimentalHammer: { kind: 'selected', traitKey: 'StaffJumpSpecialTrait' } },
      createKeepsakeEquipResultAddress(
        createRouteStartKeepsakeSelectionAddress('Underworld'),
        'experimentalHammer',
      ),
      0,
      route(project).loadout,
    );
    const result = evaluateBiomeRewardsAssemblyInternal(
      catalog,
      evaluatedBiome(project, 'H').snapshot,
      evaluatedBiome(project, 'H').history,
      3,
      route(project).loadout,
      [branch],
    ).simulation;
    expect(
      result.branches.every(
        (branch) =>
          branch.keepsakes.experimentalHammers.at(-1)?.remainingUses === 20 - endEffects.length,
      ),
    ).toBe(true);
    const combat02Phases = endEffects
      .filter(
        (event) =>
          event.origin.kind === 'occurrence' && event.origin.occurrenceId === 'golden-h-combat02',
      )
      .map((event) => event.phaseKey);
    expect(combat02Phases).toEqual(['Cage02', 'Cage01']);
  });

  it('advances only for the resolved end-effects checkpoints across Story rooms', () => {
    const project = createCompleteFGProject();
    const evaluated = evaluatedBiome(project, 'G');
    const endEffects = lifecycleEndEffects(project, 'G');
    expect(
      endEffects.some(
        (event) =>
          event.origin.kind === 'occurrence' && event.origin.occurrenceId === 'golden-g-b3-e1',
      ),
    ).toBe(true);
    const result = evaluateBiomeRewardsAssemblyInternal(
      catalog,
      evaluated.snapshot,
      evaluated.history,
      2,
      route(project).loadout,
      [equippedBranch(project, 20)],
    ).simulation;
    expect(
      result.branches.every(
        (branch) =>
          branch.keepsakes.experimentalHammers.at(-1)?.remainingUses === 20 - endEffects.length,
      ),
    ).toBe(true);
  });

  it('expires at the Boss end-effects owner but not the noncombat Postboss completion', () => {
    const project = createCompleteFGProject();
    const endEffects = lifecycleEndEffects(project, 'F');
    const bossIndex = endEffects.findIndex(
      (event) =>
        event.origin.kind === 'occurrence' &&
        event.origin.occurrenceId === 'golden-f-preboss-shop:boss',
    );
    if (bossIndex < 0) throw new Error('missing Boss end-effects checkpoint');
    expect(
      endEffects.some(
        (event) =>
          event.origin.kind === 'occurrence' &&
          event.origin.occurrenceId === 'golden-f-preboss-shop:postboss',
      ),
    ).toBe(false);
    const branch = replayThroughRealLifecycle(project, 'F', bossIndex + 1).branches[0]!;
    expect(branch.keepsakes.experimentalHammers.at(-1)).toMatchObject({
      active: false,
      remainingUses: 0,
    });
    expect(branch.traitHistory?.events).toContainEqual(
      expect.objectContaining({
        kind: 'traitRemoval',
        acquisitionRole: 'experimentalHammerExpiry',
        owner: expect.objectContaining({
          kind: 'occurrence',
          occurrenceId: 'golden-f-preboss-shop:boss',
        }),
      }),
    );
  });

  it('grants 20 uses at the Postboss rack after automatic completion has entered', () => {
    const project = withPostbossHammer(createGoldenFGHProject());
    const evaluated = evaluatedBiome(project, 'F');
    const branch = evaluated.rewards.branches[0]!;
    expect(branch.keepsakes.experimentalHammers.at(-1)).toMatchObject({
      traitKey: 'StaffJumpSpecialTrait',
      active: true,
      remainingUses: 20,
    });
    const equip = branch.traitHistory?.events.find(
      (event) => event.acquisitionRole === 'experimentalHammerEquip',
    );
    const postbossCompletion = evaluated.history.events.find(
      (event) =>
        event.kind === 'encounterCompleted' &&
        event.origin.kind === 'occurrence' &&
        event.origin.occurrenceId === 'golden-f-preboss-shop:postboss',
    );
    expect(equip).toBeDefined();
    expect(postbossCompletion).toBeDefined();
    expect(equip!.sequence).toBeGreaterThan(postbossCompletion!.sequence);
  });

  it('advances once for every active O ordered phase', () => {
    const project = loadSurfaceNOProject();
    const routePlan = project.routes.find((candidate) => candidate.routeKey === 'Surface');
    const evaluated = simulateProject(catalog, project)
      .routes.find((candidate) => candidate.routeKey === 'Surface')
      ?.biomes.find((candidate) => candidate.biomeKey === 'O');
    if (
      routePlan === undefined ||
      evaluated?.authoring !== 'complete' ||
      evaluated.validity !== 'valid'
    ) {
      throw new Error('expected valid O lifecycle fixture');
    }
    const endEffects = evaluated.history.events.filter(
      (event) => event.kind === 'encounterEndEffectsApplied',
    );
    expect(
      endEffects
        .filter(
          (event) =>
            event.origin.kind === 'occurrence' &&
            event.origin.occurrenceId === oOccurrenceIds.combat04,
        )
        .map((event) => event.phaseKey),
    ).toEqual(['Intro', 'Combat1']);
    const result = evaluateBiomeRewardsAssemblyInternal(
      catalog,
      evaluated.snapshot,
      evaluated.history,
      2,
      routePlan.loadout,
      [equippedBranch(createCompleteFGProject(), 20)],
    ).simulation;
    expect(
      result.branches.every(
        (branch) =>
          branch.keepsakes.experimentalHammers.at(-1)?.remainingUses === 20 - endEffects.length,
      ),
    ).toBe(true);
  });

  it('advances for a Fig Leaf-preserved skipped end-effects checkpoint', () => {
    const start = createRouteStartKeepsakeSelectionAddress('Surface');
    const rack = createPostbossKeepsakeSelectionAddress(automaticOccurrence(nBiome, 'postboss'));
    const skippedPhase = createEncounterPhaseAddress(
      oBiome,
      { kind: 'occurrence', occurrenceId: oOccurrenceIds.combat04 },
      'Intro',
    );
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: start,
      keepsakeKey: 'SkipEncounterKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: rack,
      keepsakeKey: 'TempHammerKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceExperimentalHammerEquipResult',
      result: createKeepsakeEquipResultAddress(rack, 'experimentalHammer'),
      value: { kind: 'selected', traitKey: 'StaffJumpSpecialTrait' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFigLeafSkip',
      phase: skippedPhase,
      value: true,
    });
    const evaluation = simulateProject(catalog, project);
    const n = evaluation.routes
      .find((candidate) => candidate.routeKey === 'Surface')
      ?.biomes.find((candidate) => candidate.biomeKey === 'N');
    const o = evaluation.routes
      .find((candidate) => candidate.routeKey === 'Surface')
      ?.biomes.find((candidate) => candidate.biomeKey === 'O');
    if (n === undefined || !('rewards' in n) || o === undefined || !('rewards' in o)) {
      throw new Error('expected valid N/O reward lifecycle');
    }
    expect(n.rewards.branches[0]?.keepsakes.experimentalHammers.at(-1)?.remainingUses).toBe(20);
    const oEndEffects = o.history.events.filter(
      (event) => event.kind === 'encounterEndEffectsApplied',
    );
    expect(
      oEndEffects.some(
        (event) =>
          event.origin.kind === 'occurrence' &&
          event.origin.occurrenceId === oOccurrenceIds.combat04 &&
          event.phaseKey === 'Intro' &&
          event.execution === 'skippedByFigLeaf',
      ),
    ).toBe(true);
    expect(o.rewards.branches[0]?.keepsakes.experimentalHammers.at(-1)?.remainingUses).toBe(
      20 - oEndEffects.length,
    );
  });

  it('advances once at the terminal P end-effects checkpoint in normal and Fig Leaf sequences', () => {
    const start = createRouteStartKeepsakeSelectionAddress('Surface');
    const rack = createPostbossKeepsakeSelectionAddress(automaticOccurrence(oBiome, 'postboss'));
    const pIntro = createEncounterPhaseAddress(
      createBiomeAddress('Surface', 'P'),
      { kind: 'occurrence', occurrenceId: createOccurrenceId('surface-p-1-1-p_combat03') },
      'Intro',
    );
    const withHammer = (project: ReturnType<typeof loadSurfaceNOPProject>) => {
      const equipped = applyProjectCommand(project, catalog, {
        kind: 'ReplacePostbossKeepsake',
        selection: rack,
        keepsakeKey: 'TempHammerKeepsake',
      });
      return applyProjectCommand(equipped, catalog, {
        kind: 'ReplaceExperimentalHammerEquipResult',
        result: createKeepsakeEquipResultAddress(rack, 'experimentalHammer'),
        value: { kind: 'selected', traitKey: 'StaffJumpSpecialTrait' },
      });
    };
    const normal = simulateProject(catalog, withHammer(loadSurfaceNOPProject()));
    let skipped = applyProjectCommand(loadSurfaceNOPProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: start,
      keepsakeKey: 'SkipEncounterKeepsake',
    });
    skipped = withHammer(skipped);
    skipped = applyProjectCommand(skipped, catalog, {
      kind: 'ReplaceFigLeafSkip',
      phase: pIntro,
      value: true,
    });

    for (const [label, evaluation] of [
      ['normal', normal],
      ['figLeaf', simulateProject(catalog, skipped)],
    ] as const) {
      const p = evaluation.routes
        .find((candidate) => candidate.routeKey === 'Surface')
        ?.biomes.find((candidate) => candidate.biomeKey === 'P');
      if (p === undefined || !('rewards' in p)) throw new Error(`${label} P evaluation missing`);
      const endEffects = p.history.events.filter(
        (event) => event.kind === 'encounterEndEffectsApplied',
      );
      const selected = endEffects.filter(
        (event) =>
          event.origin.kind === 'occurrence' &&
          event.origin.occurrenceId === 'surface-p-1-1-p_combat03',
      );
      expect(selected.map((event) => event.phaseKey)).toEqual(['Combat']);
      expect(p.rewards.branches[0]?.keepsakes.experimentalHammers.at(-1)?.remainingUses).toBe(
        20 - endEffects.length,
      );
      if (label === 'figLeaf') expect(selected[0]).toMatchObject({ execution: 'skippedByFigLeaf' });
    }
  });

  it('keeps an unavailable Postboss Hammer replacement at its parent and does not reach its child', () => {
    const project = withPostbossHammer(createGoldenFGHProject());
    const evaluated = evaluatedBiome(project, 'F');
    const plan = route(project).biomes.find((biome) => biome.biomeKey === 'F');
    const rack = plan?.topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === 'golden-f-preboss-shop:postboss',
    )?.keepsakeRack;
    if (rack === undefined || rack.equipResults === undefined)
      throw new Error('expected authored F Hammer result');
    const seed = initializeRewardBranches(
      undefined,
      createArcanaFearState(catalog, route(project).loadout),
      catalog,
      'ManaOverTimeRefundKeepsake',
    )[0]!;
    const carried = {
      ...seed,
      keepsakes: {
        ...seed.keepsakes,
        removedKeys: ['TempHammerKeepsake'],
      },
    };
    const assembly = evaluateBiomeRewardsAssemblyInternal(
      catalog,
      {
        ...evaluated.snapshot,
      },
      evaluated.history,
      1,
      route(project).loadout,
      [carried],
    );
    const selection = createPostbossKeepsakeSelectionAddress(
      automaticOccurrence(createBiomeAddress('Underworld', 'F'), 'postboss'),
    );
    const branch = assembly.simulation.branches[0]!;
    expect(assembly.simulation.findings).toContainEqual(
      expect.objectContaining({ code: 'keepsakeUnavailable', origin: selection }),
    );
    expect(branch.keepsakes).toMatchObject({ currentKey: 'ManaOverTimeRefundKeepsake' });
    expect(branch.keepsakes.experimentalHammers.at(-1)).toBeUndefined();
    expect(
      branch.traitHistory?.events.some((event) => event.acquisitionRole === 'keepsakeEquip'),
    ).toBe(false);
  });

  it('preserves a context-invalid authored Hammer child and exposes another compatible result', () => {
    const selection = createPostbossKeepsakeSelectionAddress(
      automaticOccurrence(createBiomeAddress('Underworld', 'F'), 'postboss'),
    );
    let project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection,
      keepsakeKey: 'TempHammerKeepsake',
    });
    const authoredResult = { kind: 'selected' as const, traitKey: 'StaffLongAttackTrait' };
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceExperimentalHammerEquipResult',
      result: createKeepsakeEquipResultAddress(selection, 'experimentalHammer'),
      value: authoredResult,
    });

    const arcanaFear = createArcanaFearState(catalog, route(project).loadout);
    const alreadyEquipped = equippedBranch(project, 20, authoredResult.traitKey);
    const carried = {
      ...alreadyEquipped,
      keepsakes: createKeepsakeState(catalog, 'ManaOverTimeRefundKeepsake', arcanaFear),
    };
    const evaluated = evaluatedBiome(project, 'F');
    const plan = route(project).biomes.find((biome) => biome.biomeKey === 'F');
    const rack = plan?.topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === 'golden-f-preboss-shop:postboss',
    )?.keepsakeRack;
    if (rack === undefined || rack.equipResults === undefined)
      throw new Error('expected authored F Hammer result');
    const rewards = evaluateBiomeRewardsAssemblyInternal(
      catalog,
      {
        ...evaluated.snapshot,
      },
      evaluated.history,
      1,
      route(project).loadout,
      [carried],
    );
    const result = createKeepsakeEquipResultAddress(selection, 'experimentalHammer');
    expect(
      route(project)
        .biomes.find((biome) => biome.biomeKey === 'F')
        ?.topology?.occurrences.find(
          (occurrence) => occurrence.occurrenceId === 'golden-f-preboss-shop:postboss',
        )?.keepsakeRack?.equipResults?.experimentalHammer,
    ).toEqual(authoredResult);
    expect(rewards.simulation.findings).toContainEqual(
      expect.objectContaining({ code: 'keepsakeEquipResultUnavailable', origin: result }),
    );

    const candidates = evaluateKeepsakeEquipResultCandidate(
      catalog,
      project,
      simulateProjectAssembly(catalog, project).evaluation,
      rewards.keepsakeEquipResultArtifacts,
      { kind: 'keepsakeEquipResult', result, value: authoredResult },
    );
    expect(candidates).toMatchObject({
      kind: 'keepsakeEquipResult',
      result: { selectedPossible: false },
    });
    if (candidates.kind !== 'keepsakeEquipResult')
      throw new Error('expected reached Hammer child candidates');
    expect(
      candidates.result.options.some(
        (option) =>
          'kind' in option.value &&
          option.value.kind === 'selected' &&
          option.value.traitKey !== authoredResult.traitKey &&
          option.selectedPossible,
      ),
    ).toBe(true);
  });

  it('does not spend an Experimental Hammer use for an entered N side room', () => {
    const base = loadSurfaceNProject();
    const withoutSide = applyProjectCommand(base, catalog, {
      kind: 'ReplaceLocalVisitOrder',
      order: createLocalVisitOrderAddress(nBiome, nOccurrenceId('combat05'), 'sideRooms'),
      occurrenceIds: [],
    });
    const evaluateN = (project: typeof base) => {
      const biome = simulateProject(catalog, project)
        .routes.find((candidate) => candidate.routeKey === 'Surface')
        ?.biomes.find((candidate) => candidate.biomeKey === 'N');
      if (biome?.authoring !== 'complete' || biome.validity !== 'valid')
        throw new Error('expected valid N side-room fixture');
      return biome;
    };
    const seedProject = createCompleteFGProject();
    const seed = equippedBranch(seedProject, 20);
    const replay = (project: typeof base) => {
      const biome = evaluateN(project);
      return evaluateBiomeRewardsAssemblyInternal(
        catalog,
        biome.snapshot,
        biome.history,
        1,
        project.routes.find((candidate) => candidate.routeKey === 'Surface')!.loadout,
        [seed],
      ).simulation.branches[0]!.keepsakes.experimentalHammers.at(-1)?.remainingUses;
    };
    expect(replay(base)).toBe(replay(withoutSide));
  });

  it('carries its exact temporary Hammer state through an absent and neutral replacement rack', () => {
    const unchangedProject = createGoldenFGHProject();
    const unchanged = evaluateBiomeRewardsAssemblyInternal(
      catalog,
      evaluatedBiome(unchangedProject, 'F').snapshot,
      evaluatedBiome(unchangedProject, 'F').history,
      1,
      route(unchangedProject).loadout,
      [equippedBranch(unchangedProject, 20)],
    ).simulation.branches[0]!;
    const replacedProject = withPostbossNeutralReplacement(createGoldenFGHProject());
    const replaced = evaluateBiomeRewardsAssemblyInternal(
      catalog,
      evaluatedBiome(replacedProject, 'F').snapshot,
      evaluatedBiome(replacedProject, 'F').history,
      1,
      route(replacedProject).loadout,
      [equippedBranch(replacedProject, 20)],
    ).simulation.branches[0]!;
    expect(unchanged.keepsakes.experimentalHammers.at(-1)).toMatchObject({
      active: true,
      acquisitionIdentity: expect.any(String),
    });
    expect(replaced.keepsakes).toMatchObject({ currentKey: 'BossPreDamageKeepsake' });
    expect(replaced.keepsakes.experimentalHammers.at(-1)).toEqual(
      unchanged.keepsakes.experimentalHammers.at(-1),
    );
  });

  it('permits the same ordinary Hammer again after its temporary acquisition expires', () => {
    const expired = replayThroughRealLifecycle(createCompleteFGProject(), 'F', 1).branches[0]!;
    expect(expired.keepsakes.experimentalHammers.at(-1)).toMatchObject({
      active: false,
      remainingUses: 0,
    });
    expect(
      assessTraitOption(
        catalog,
        'StaffLongAttackTrait',
        expired.traitHistory!,
        route(createCompleteFGProject()).loadout,
      ),
    ).toMatchObject({ legal: true });
  });

  it('publishes missing and incompatible persisted route-start results as repairable findings', () => {
    const start = createRouteStartKeepsakeSelectionAddress('Underworld');
    const project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: start,
      keepsakeKey: 'TempHammerKeepsake',
    });
    expect(simulateProjectAssembly(catalog, project).evaluation.findings).toContainEqual(
      expect.objectContaining({ code: 'keepsakeEquipResultMissing' }),
    );

    const invalid = {
      ...project,
      routes: project.routes.map((candidate) =>
        candidate.routeKey !== 'Underworld'
          ? candidate
          : {
              ...candidate,
              loadout: {
                ...candidate.loadout,
                keepsakeEquipResults: {
                  experimentalHammer: {
                    kind: 'selected' as const,
                    traitKey: 'ApolloWeaponBoon',
                  },
                },
              },
            },
      ),
    };
    expect(simulateProjectAssembly(catalog, invalid).evaluation.findings).toContainEqual(
      expect.objectContaining({ code: 'keepsakeEquipResultUnavailable' }),
    );
    const prematurelyExhausted = {
      ...project,
      routes: project.routes.map((candidate) =>
        candidate.routeKey !== 'Underworld'
          ? candidate
          : {
              ...candidate,
              loadout: {
                ...candidate.loadout,
                keepsakeEquipResults: {
                  experimentalHammer: { kind: 'exhausted' as const },
                },
              },
            },
      ),
    };
    expect(
      simulateProjectAssembly(catalog, prematurelyExhausted).evaluation.findings,
    ).toContainEqual(expect.objectContaining({ code: 'keepsakeEquipResultUnavailable' }));
  });

  it('keeps missing and incompatible Postboss Hammer results at their exact repair owner', () => {
    const selection = createPostbossKeepsakeSelectionAddress(
      automaticOccurrence(createBiomeAddress('Underworld', 'F'), 'postboss'),
    );
    const project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection,
      keepsakeKey: 'TempHammerKeepsake',
    });
    const result = createKeepsakeEquipResultAddress(selection, 'experimentalHammer');
    const missingAssembly = simulateProjectAssembly(catalog, project);
    expect(missingAssembly.evaluation.findings).toContainEqual(
      expect.objectContaining({ code: 'keepsakeEquipResultMissing', origin: result }),
    );
    expect(
      keepsakeEquipResultCandidateForProjectEvaluationAssembly(missingAssembly, result),
    ).toBeDefined();
    const invalid = {
      ...project,
      routes: project.routes.map((candidate) =>
        candidate.routeKey !== 'Underworld'
          ? candidate
          : {
              ...candidate,
              biomes: candidate.biomes.map((biome) =>
                biome.biomeKey !== 'F'
                  ? biome
                  : {
                      ...biome,
                      topology:
                        biome.topology === null
                          ? null
                          : {
                              ...biome.topology,
                              occurrences: biome.topology.occurrences.map((occurrence) =>
                                occurrence.occurrenceId !== 'golden-f-preboss-shop:postboss'
                                  ? occurrence
                                  : {
                                      ...occurrence,
                                      keepsakeRack: {
                                        ...occurrence.keepsakeRack!,
                                        equipResults: {
                                          experimentalHammer: {
                                            kind: 'selected' as const,
                                            traitKey: 'ApolloWeaponBoon',
                                          },
                                        },
                                      },
                                    },
                              ),
                            },
                    },
              ),
            },
      ),
    };
    const invalidAssembly = simulateProjectAssembly(catalog, invalid);
    expect(invalidAssembly.evaluation.findings).toContainEqual(
      expect.objectContaining({ code: 'keepsakeEquipResultUnavailable', origin: result }),
    );
    expect(
      keepsakeEquipResultCandidateForProjectEvaluationAssembly(invalidAssembly, result),
    ).toBeDefined();
    const prematurelyExhausted = {
      ...project,
      routes: project.routes.map((candidate) =>
        candidate.routeKey !== 'Underworld'
          ? candidate
          : {
              ...candidate,
              biomes: candidate.biomes.map((biome) =>
                biome.biomeKey !== 'F'
                  ? biome
                  : {
                      ...biome,
                      topology:
                        biome.topology === null
                          ? null
                          : {
                              ...biome.topology,
                              occurrences: biome.topology.occurrences.map((occurrence) =>
                                occurrence.occurrenceId !== 'golden-f-preboss-shop:postboss'
                                  ? occurrence
                                  : {
                                      ...occurrence,
                                      keepsakeRack: {
                                        ...occurrence.keepsakeRack!,
                                        equipResults: {
                                          experimentalHammer: { kind: 'exhausted' as const },
                                        },
                                      },
                                    },
                              ),
                            },
                    },
              ),
            },
      ),
    };
    expect(
      simulateProjectAssembly(catalog, prematurelyExhausted).evaluation.findings,
    ).toContainEqual(
      expect.objectContaining({ code: 'keepsakeEquipResultUnavailable', origin: result }),
    );
  });
});

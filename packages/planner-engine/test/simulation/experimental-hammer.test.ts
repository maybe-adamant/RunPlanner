import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createCompletionRoomAddress,
  createKeepsakeEquipResultAddress,
  createLocalChildGroupAddress,
  createPostbossKeepsakeSelectionAddress,
  createRouteStartKeepsakeSelectionAddress,
} from '@run-planner/engine/authored-project';
import {
  assessTraitOption,
  simulateProject,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';

import {
  createCompleteFGProject,
  createGoldenFGHProject,
  createRepresentativeNProject,
  nBiome,
  nOccurrenceId,
} from '@run-planner/test-fixtures';
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
    { experimentalHammer: { traitKey } },
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
      experimentalHammer: { ...result.keepsakes.experimentalHammer!, remainingUses },
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
    createCompletionRoomAddress(createBiomeAddress('Underworld', 'F'), 'postboss'),
  );
  const selected = applyProjectCommand(project, catalog, {
    kind: 'ReplacePostbossKeepsake',
    selection,
    value: { kind: 'replace', keepsakeKey: 'TempHammerKeepsake' },
  });
  return applyProjectCommand(selected, catalog, {
    kind: 'ReplaceExperimentalHammerEquipResult',
    result: createKeepsakeEquipResultAddress(selection, 'experimentalHammer'),
    value: { traitKey: 'StaffJumpSpecialTrait' },
  });
}

function withPostbossNeutralReplacement(project: ReturnType<typeof createGoldenFGHProject>) {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplacePostbossKeepsake',
    selection: createPostbossKeepsakeSelectionAddress(
      createCompletionRoomAddress(createBiomeAddress('Underworld', 'F'), 'postboss'),
    ),
    value: { kind: 'replace', keepsakeKey: 'BossPreDamageKeepsake' },
  });
}

function lifecycleCompletions(
  project: ReturnType<typeof createCompleteFGProject>,
  key: 'F' | 'G' | 'H',
) {
  return evaluatedBiome(project, key).history.events.filter(
    (event) => event.kind === 'encounterCompleted',
  );
}

describe('Experimental Hammer', () => {
  it('acquires one compatible Hammer directly without an invented rarity', () => {
    const project = createCompleteFGProject();
    const branch = equippedBranch(project, 20);
    expect(branch.traitHistory?.equippedTraits.StaffLongAttackTrait).toMatchObject({
      traitKey: 'StaffLongAttackTrait',
      hammerRank: 'RankI',
    });
    expect(branch.traitHistory?.equippedTraits.StaffLongAttackTrait?.rarity).toBeUndefined();
  });

  it('uses the production encounterCompleted lifecycle hook to expire and remove the exact acquisition', () => {
    const project = createCompleteFGProject();
    const result = replayThroughRealLifecycle(project, 'F', 1);
    const branch = result.branches[0]!;
    expect(branch.keepsakes.experimentalHammer).toMatchObject({ active: false, remainingUses: 0 });
    expect(branch.traitHistory?.equippedTraits.StaffLongAttackTrait).toBeUndefined();
    expect(branch.traitHistory?.events).toContainEqual(
      expect.objectContaining({
        acquisitionRole: 'experimentalHammerExpiry',
        acquisitionPoint: 'encounterCompleted',
      }),
    );
  });

  it('consumes every qualifying completion in the real room lifecycle, rather than a room counter', () => {
    const project = createCompleteFGProject();
    const result = replayThroughRealLifecycle(project, 'F', 2);
    const branch = result.branches[0]!;
    expect(branch.keepsakes.experimentalHammer).toMatchObject({ active: false, remainingUses: 0 });
    expect(
      branch.traitHistory?.events.filter(
        (event) => event.acquisitionRole === 'experimentalHammerExpiry',
      ),
    ).toHaveLength(1);
  });

  it('uses every real H encounter completion, including multiple phases owned by one room', () => {
    const project = createGoldenFGHProject();
    const completions = lifecycleCompletions(project, 'H');
    const distinctOwners = new Set(completions.map((event) => JSON.stringify(event.origin)));
    expect(completions.length).toBeGreaterThan(distinctOwners.size);

    const g = evaluatedBiome(project, 'G');
    const branch = applyExperimentalHammerEquipResult(
      catalog,
      g.rewards.branches[0]! as Parameters<typeof applyExperimentalHammerEquipResult>[1],
      'TempHammerKeepsake',
      { experimentalHammer: { traitKey: 'StaffJumpSpecialTrait' } },
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
        (branch) => branch.keepsakes.experimentalHammer?.remainingUses === 20 - completions.length,
      ),
    ).toBe(true);
  });

  it('keeps an unavailable Postboss Hammer replacement at its parent and does not reach its child', () => {
    const project = withPostbossHammer(createGoldenFGHProject());
    const evaluated = evaluatedBiome(createGoldenFGHProject(), 'F');
    const plan = route(project).biomes.find((biome) => biome.biomeKey === 'F');
    if (plan?.postbossKeepsakeDisposition === undefined || plan.keepsakeEquipResults === undefined)
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
        postbossKeepsakeDisposition: plan.postbossKeepsakeDisposition,
        keepsakeEquipResults: plan.keepsakeEquipResults,
      },
      evaluated.history,
      1,
      route(project).loadout,
      [carried],
    );
    const selection = createPostbossKeepsakeSelectionAddress(
      createCompletionRoomAddress(createBiomeAddress('Underworld', 'F'), 'postboss'),
    );
    const branch = assembly.simulation.branches[0]!;
    expect(assembly.simulation.findings).toContainEqual(
      expect.objectContaining({ code: 'keepsakeUnavailable', origin: selection }),
    );
    expect(branch.keepsakes).toMatchObject({ currentKey: 'ManaOverTimeRefundKeepsake' });
    expect(branch.keepsakes.experimentalHammer).toBeUndefined();
    expect(
      branch.traitHistory?.events.some((event) => event.acquisitionRole === 'keepsakeEquip'),
    ).toBe(false);
  });

  it('preserves a context-invalid Hammer child default and exposes another compatible result', () => {
    const selection = createPostbossKeepsakeSelectionAddress(
      createCompletionRoomAddress(createBiomeAddress('Underworld', 'F'), 'postboss'),
    );
    const project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection,
      value: { kind: 'replace', keepsakeKey: 'TempHammerKeepsake' },
    });
    const defaultResult = route(project).biomes.find((biome) => biome.biomeKey === 'F')
      ?.keepsakeEquipResults?.experimentalHammer;
    if (defaultResult === undefined) throw new Error('Hammer child default is missing');

    const arcanaFear = createArcanaFearState(catalog, route(project).loadout);
    const alreadyEquipped = equippedBranch(project, 20, defaultResult.traitKey);
    const carried = {
      ...alreadyEquipped,
      keepsakes: createKeepsakeState(catalog, 'ManaOverTimeRefundKeepsake', arcanaFear),
    };
    const evaluated = evaluatedBiome(createGoldenFGHProject(), 'F');
    const plan = route(project).biomes.find((biome) => biome.biomeKey === 'F');
    if (plan?.postbossKeepsakeDisposition === undefined || plan.keepsakeEquipResults === undefined)
      throw new Error('expected authored F Hammer result');
    const rewards = evaluateBiomeRewardsAssemblyInternal(
      catalog,
      {
        ...evaluated.snapshot,
        postbossKeepsakeDisposition: plan.postbossKeepsakeDisposition,
        keepsakeEquipResults: plan.keepsakeEquipResults,
      },
      evaluated.history,
      1,
      route(project).loadout,
      [carried],
    );
    const result = createKeepsakeEquipResultAddress(selection, 'experimentalHammer');
    expect(
      route(project).biomes.find((biome) => biome.biomeKey === 'F')?.keepsakeEquipResults
        ?.experimentalHammer,
    ).toEqual(defaultResult);
    expect(rewards.simulation.findings).toContainEqual(
      expect.objectContaining({ code: 'keepsakeEquipResultUnavailable', origin: result }),
    );

    const candidates = evaluateKeepsakeEquipResultCandidate(
      catalog,
      project,
      simulateProjectAssembly(catalog, project).evaluation,
      rewards.keepsakeEquipResultArtifacts,
      { kind: 'keepsakeEquipResult', result, value: defaultResult },
    );
    expect(candidates).toMatchObject({
      kind: 'keepsakeEquipResult',
      result: { selectedPossible: false },
    });
    if (candidates.kind !== 'keepsakeEquipResult')
      throw new Error('expected reached Hammer child candidates');
    expect(
      candidates.result.options.some(
        (option) => option.traitKey !== defaultResult.traitKey && option.selectedPossible,
      ),
    ).toBe(true);
  });

  it('does not spend an Experimental Hammer use for an entered N side room', () => {
    const base = createRepresentativeNProject();
    const withoutSide = applyProjectCommand(base, catalog, {
      kind: 'ReplaceSideRoomEntryOrder',
      group: createLocalChildGroupAddress(nBiome, nOccurrenceId('combat05'), 'sideRooms'),
      enteredSlotKeys: [],
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
      ).simulation.branches[0]!.keepsakes.experimentalHammer?.remainingUses;
    };
    expect(replay(base)).toBe(replay(withoutSide));
  });

  it('retains its exact temporary Hammer state through both retain and neutral replacement racks', () => {
    const retainedProject = createGoldenFGHProject();
    const retained = evaluateBiomeRewardsAssemblyInternal(
      catalog,
      evaluatedBiome(retainedProject, 'F').snapshot,
      evaluatedBiome(retainedProject, 'F').history,
      1,
      route(retainedProject).loadout,
      [equippedBranch(retainedProject, 20)],
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
    expect(retained.keepsakes.experimentalHammer).toMatchObject({
      active: true,
      acquisitionIdentity: expect.any(String),
    });
    expect(replaced.keepsakes).toMatchObject({ currentKey: 'BossPreDamageKeepsake' });
    expect(replaced.keepsakes.experimentalHammer).toEqual(retained.keepsakes.experimentalHammer);
  });

  it('permits the same ordinary Hammer again after its temporary acquisition expires', () => {
    const expired = replayThroughRealLifecycle(createCompleteFGProject(), 'F', 1).branches[0]!;
    expect(expired.keepsakes.experimentalHammer).toMatchObject({ active: false, remainingUses: 0 });
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
    let project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: start,
      keepsakeKey: 'TempHammerKeepsake',
    });
    project = {
      ...project,
      routes: project.routes.map((candidate) =>
        candidate.routeKey !== 'Underworld'
          ? candidate
          : {
              ...candidate,
              loadout: { ...candidate.loadout, keepsakeEquipResults: {} },
            },
      ),
    };
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
                keepsakeEquipResults: { experimentalHammer: { traitKey: 'ApolloWeaponBoon' } },
              },
            },
      ),
    };
    expect(simulateProjectAssembly(catalog, invalid).evaluation.findings).toContainEqual(
      expect.objectContaining({ code: 'keepsakeEquipResultUnavailable' }),
    );
  });

  it('keeps missing and incompatible Postboss Hammer results at their exact repair owner', () => {
    const selection = createPostbossKeepsakeSelectionAddress(
      createCompletionRoomAddress(createBiomeAddress('Underworld', 'F'), 'postboss'),
    );
    let project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection,
      value: { kind: 'replace', keepsakeKey: 'TempHammerKeepsake' },
    });
    project = {
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
                      keepsakeEquipResults: {},
                    },
              ),
            },
      ),
    };
    const result = createKeepsakeEquipResultAddress(selection, 'experimentalHammer');
    expect(simulateProjectAssembly(catalog, project).evaluation.findings).toContainEqual(
      expect.objectContaining({ code: 'keepsakeEquipResultMissing', origin: result }),
    );
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
                      keepsakeEquipResults: {
                        experimentalHammer: { traitKey: 'ApolloWeaponBoon' },
                      },
                    },
              ),
            },
      ),
    };
    expect(simulateProjectAssembly(catalog, invalid).evaluation.findings).toContainEqual(
      expect.objectContaining({ code: 'keepsakeEquipResultUnavailable', origin: result }),
    );
  });
});

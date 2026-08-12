import { catalog } from '@run-planner/hades2-catalog';
import {
  activateTemporaryArcana,
  createArcanaFearState,
  createPreparedProjectCandidateSession,
  promoteArcana,
  simulateProject,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import {
  applyProjectCommand,
  createBiomeAddress,
  createBossCompletionArcanaAddress,
  createCompletionRoomAddress,
  createRouteAddress,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import { createRepresentativeNOProject } from '@run-planner/test-fixtures';
import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import { initializeTestRewardBranches } from '../support/arcana-fear';
import { evaluateBiomeRewardsAssemblyInternal } from '../../src/simulation/rewards/biome';
import { publicRewardBranch } from '../../src/simulation/rewards/processing';

const surface = createRouteAddress('Surface');
const n = createBiomeAddress('Surface', 'N');
const o = createBiomeAddress('Surface', 'O');

function judgmentOwner(biomeAddress = n) {
  return createBossCompletionArcanaAddress(createCompletionRoomAddress(biomeAddress, 'boss'));
}

function withJudgment(project = createRepresentativeNOProject()) {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceManualArcanaSelection',
    route: surface,
    arcanaKeys: ['CastCount'],
  });
}

function inactive(excluding: readonly string[], count: number): readonly string[] {
  const active = new Set(excluding);
  return catalog.arcanaCards.values
    .filter((card) => !active.has(card.key))
    .slice(0, count)
    .map((card) => card.key);
}

function withBossOutcome(
  project: ReturnType<typeof withJudgment>,
  biome = n,
  keys?: readonly string[],
) {
  const selected =
    keys ?? inactive(['CastCount', 'SorceryRegenUpgrade', 'BonusRarity', 'CardDraw'], 5);
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceBossCompletionArcana',
    completion: judgmentOwner(biome),
    arcanaKeys: selected,
  });
}

function biome(evaluation: ReturnType<typeof simulateProject>, key: 'N' | 'O') {
  const value = evaluation.routes
    .find((route) => route.routeKey === 'Surface')
    ?.biomes.find((candidate) => candidate.biomeKey === key);
  if (value?.authoring !== 'complete') throw new Error(`${key} did not reach complete evaluation`);
  return value;
}

/** A complete N snapshot is a clean lifecycle host for terminal Boss effects. */
function evaluateNBossLifecycle(
  arcanaFear: ReturnType<typeof createArcanaFearState>,
  selected: readonly string[],
) {
  const project = createRepresentativeNOProject();
  const evaluated = biome(simulateProject(catalog, project), 'N');
  if (evaluated.validity !== 'valid')
    throw new Error('N lifecycle fixture must start complete-valid');
  return evaluateBiomeRewardsAssemblyInternal(
    catalog,
    Object.freeze({
      ...evaluated.snapshot,
      bossCompletionArcanaKeys: Object.freeze([...selected]),
    }),
    evaluated.history,
    1,
    project.routes.find((route) => route.routeKey === 'Surface')!.loadout,
    [publicRewardBranch(initializeTestRewardBranches(arcanaFear)[0]!)],
  );
}

describe('Judgment Boss-completion lifecycle', () => {
  it('retains the missing exact-set repair capability at the terminal Boss and suppresses Postboss/later-biome state', () => {
    const project = withJudgment();
    const assembly = simulateProjectAssembly(catalog, project);
    const evaluated = biome(assembly.evaluation, 'N');
    expect(evaluated.validity).toBe('invalid');
    expect(evaluated.coverage).toMatchObject({
      kind: 'prefix',
      blockedAt: judgmentOwner(),
    });
    expect(evaluated.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'judgmentOutcomeMissing',
          origin: judgmentOwner(),
        }),
      ]),
    );
    expect(evaluated.rewards.runStateSnapshots).toHaveLength(3);
    expect(
      assembly.evaluation.routes.find((route) => route.routeKey === 'Surface')?.processing
        .blockedSuffix,
    ).toEqual(['O']);

    const candidate = createPreparedProjectCandidateSession(catalog, assembly).evaluate({
      kind: 'bossCompletionArcana',
      completion: judgmentOwner(),
      arcanaKeys: inactive(['CastCount', 'SorceryRegenUpgrade', 'BonusRarity', 'CardDraw'], 5),
    });
    expect(candidate).toMatchObject({
      kind: 'bossCompletionArcana',
      result: { requiredCount: 5, selectedPossible: true },
    });
  });

  it('applies Epic draws once per Boss, clamps only at the inactive frontier, and carries them into the next Boss', () => {
    const first = inactive(['CastCount', 'SorceryRegenUpgrade', 'BonusRarity', 'CardDraw'], 5);
    const second = inactive(
      ['CastCount', 'SorceryRegenUpgrade', 'BonusRarity', 'CardDraw', ...first],
      5,
    );
    let project = withBossOutcome(withJudgment(), n, first);
    project = withBossOutcome(project, o, second);
    const evaluation = simulateProject(catalog, project);
    const nBiome = biome(evaluation, 'N');
    const oBiome = biome(evaluation, 'O');
    expect(nBiome.validity).toBe('valid');
    expect(oBiome.validity).toBe('valid');
    const active = oBiome.rewards.branches[0]!.arcanaFear.arcana.active;
    expect(active.filter((card) => card.origin === 'temporary').map((card) => card.key)).toEqual([
      ...first,
      ...second,
    ]);
    expect(new Set(active.map((card) => card.key)).size).toBe(active.length);
    expect(active.filter((card) => card.key === first[0]).map((card) => card.origin)).toEqual([
      'temporary',
    ]);
  });

  it('reads Red-activated and Lapis-promoted Gate-B inputs through the clean Boss lifecycle seam', () => {
    const loadout = createDefaultRouteLoadout(catalog);
    const seeded = createArcanaFearState(catalog, { ...loadout, manualArcanaKeys: ['CastCount'] });
    const promoted = promoteArcana(catalog, seeded, ['CardDraw'], {
      owner: n,
      sequence: 1,
    });
    expect(promoted).toMatchObject({ legal: true });
    const redActivated = activateTemporaryArcana(
      catalog,
      createArcanaFearState(catalog, loadout),
      ['CardDraw'],
      {
        owner: n,
        sequence: 1,
      },
    );
    expect(redActivated).toMatchObject({ legal: true });

    const project = withJudgment();
    const assembly = simulateProjectAssembly(catalog, project);
    const candidate = createPreparedProjectCandidateSession(catalog, assembly).evaluate({
      kind: 'bossCompletionArcana',
      completion: judgmentOwner(),
      arcanaKeys: ['CastCount'],
    });
    expect(candidate).toMatchObject({
      kind: 'bossCompletionArcana',
      result: { requiredCount: 5, selectedPossible: false },
    });
    if (!promoted.legal || !redActivated.legal) throw new Error('Gate-B test inputs must be legal');
    const redKeys = inactive(['CardDraw'], 5);
    const red = evaluateNBossLifecycle(redActivated.state, redKeys);
    expect(red.simulation.validity).toBe('valid');
    expect(red.simulation.branches[0]?.arcanaFear.arcana.active).toEqual(
      expect.arrayContaining(
        redKeys.map((key) => expect.objectContaining({ key, origin: 'temporary' })),
      ),
    );

    const heroicKeys = inactive(['CastCount', 'SorceryRegenUpgrade', 'BonusRarity', 'CardDraw'], 6);
    const heroic = evaluateNBossLifecycle(promoted.state, heroicKeys);
    expect(heroic.simulation.validity).toBe('valid');
    expect(
      heroic.simulation.branches[0]?.arcanaFear.arcana.active.filter((card) =>
        heroicKeys.includes(card.key),
      ),
    ).toHaveLength(6);
  });
});

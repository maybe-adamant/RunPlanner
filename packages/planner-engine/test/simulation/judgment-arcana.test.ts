import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createFigurineArcanaAddress,
  createJudgmentArcanaAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRouteAddress,
} from '@run-planner/engine/authored-project';
import {
  activateTemporaryArcana,
  blockedOccurrenceRoomForProjectEvaluationAssembly,
  createArcanaFearState,
  createPreparedProjectCandidateSession,
  promoteArcana,
  simulateProject,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { createGoldenFGHProject } from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNOProject, loadSurfaceNOPQProject } from '@run-planner/test-fixtures/surface';
import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import { initializeTestRewardBranches } from '../support/arcana-fear';
import { evaluateBiomeRewardsAssemblyInternal } from '../../src/simulation/rewards/biome';
import { publicRewardBranch } from '../../src/simulation/rewards/processing';
import {
  attachTraitHistory,
  createTraitHistoryState,
  foldTraitHistoryEvents,
} from '../../src/simulation/traits';
import {
  advanceCurrentKeepsake,
  createKeepsakeState,
  type KeepsakeState,
} from '../../src/simulation/keepsakes';

const biome = createBiomeAddress('Underworld', 'F');
const boss = createOccurrenceAddress(biome, createOccurrenceId('golden-f-preboss-shop:boss'));
const judgment = createJudgmentArcanaAddress(boss, 'Encounter');
const surface = createRouteAddress('Surface');
const n = createBiomeAddress('Surface', 'N');
const o = createBiomeAddress('Surface', 'O');
const p = createBiomeAddress('Surface', 'P');
const q = createBiomeAddress('Surface', 'Q');

function judgmentOwner(biomeAddress = n) {
  const prebossOccurrenceId = {
    N: 'surface-n-preboss',
    O: 'surface-o-preboss',
    P: 'surface-p-preboss-shop',
    Q: 'surface-q-preboss',
  }[biomeAddress.biomeKey];
  if (prebossOccurrenceId === undefined)
    throw new Error('missing Surface Preboss fixture identity');
  return createJudgmentArcanaAddress(
    createOccurrenceAddress(biomeAddress, createOccurrenceId(`${prebossOccurrenceId}:boss`)),
    'Encounter',
  );
}

function withJudgment(project = loadSurfaceNOProject()) {
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

function stateWithExactInactiveArcana(inactiveKeys: readonly string[]) {
  const initial = createArcanaFearState(catalog, createDefaultRouteLoadout(catalog));
  const desired = new Set(inactiveKeys);
  const initialActive = new Set(initial.arcana.active.map((card) => card.key));
  const toActivate = catalog.arcanaCards.values
    .filter((card) => !desired.has(card.key) && !initialActive.has(card.key))
    .map((card) => card.key);
  const activated = activateTemporaryArcana(catalog, initial, toActivate, {
    owner: n,
    sequence: 1,
  });
  if (!activated.legal) throw new Error('exact Arcana setup must be legal');
  return activated.state;
}

function withBossOutcome(
  project: ReturnType<typeof withJudgment>,
  biomeAddress = n,
  keys?: readonly string[],
) {
  const selected =
    keys ?? inactive(['CastCount', 'SorceryRegenUpgrade', 'BonusRarity', 'CardDraw'], 5);
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceJudgmentArcana',
    judgment: judgmentOwner(biomeAddress),
    arcanaKeys: selected,
  });
}

function evaluatedBiome(
  evaluation: ReturnType<typeof simulateProject>,
  key: 'N' | 'O' | 'P' | 'Q',
) {
  const value = evaluation.routes
    .find((route) => route.routeKey === 'Surface')
    ?.biomes.find((candidate) => candidate.biomeKey === key);
  if (value?.authoring !== 'complete') throw new Error(`${key} did not reach complete evaluation`);
  return value;
}

function evaluateNBossLifecycle(
  arcanaFear: ReturnType<typeof createArcanaFearState>,
  selected: readonly string[],
  traitHistory = createTraitHistoryState(),
  figurineSelected: readonly string[] = [],
  keepsakes: KeepsakeState = createKeepsakeState(
    catalog,
    catalog.defaultStartingKeepsakeKey,
    arcanaFear,
  ),
) {
  const project = loadSurfaceNOProject();
  const evaluated = evaluatedBiome(simulateProject(catalog, project), 'N');
  if (evaluated.validity !== 'valid')
    throw new Error('N lifecycle fixture must start complete-valid');
  const bossOccurrenceId = judgmentOwner().occurrenceId;
  return evaluateBiomeRewardsAssemblyInternal(
    catalog,
    Object.freeze({
      ...evaluated.snapshot,
      fixedRoomLinks: Object.freeze(
        evaluated.snapshot.fixedRoomLinks.map((link) =>
          link.target.origin.occurrenceId === bossOccurrenceId
            ? Object.freeze({
                ...link,
                target: Object.freeze({
                  ...link.target,
                  encounters: Object.freeze({
                    ...link.target.encounters,
                    judgmentArcanaKeysByPhase: Object.freeze({ Encounter: selected }),
                    ...(figurineSelected.length === 0
                      ? {}
                      : {
                          figurineArcanaKeysByPhase: Object.freeze({ Encounter: figurineSelected }),
                        }),
                  }),
                }),
              })
            : link,
        ),
      ),
    }),
    evaluated.history,
    1,
    project.routes.find((route) => route.routeKey === 'Surface')!.loadout,
    [
      publicRewardBranch(
        Object.freeze({
          ...initializeTestRewardBranches(arcanaFear)[0]!,
          history: attachTraitHistory(
            initializeTestRewardBranches(arcanaFear)[0]!.history,
            traitHistory,
          ),
          traitHistory,
          keepsakes,
        }),
      ),
    ],
  );
}

describe('Judgment automatic Boss ownership', () => {
  it('stores its canonical selection on the addressed Boss-defeated phase', () => {
    const project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceJudgmentArcana',
      judgment,
      arcanaKeys: ['CardDraw', 'CastCount'],
    });
    const authoredBoss = project.routes[0]?.biomes[0]?.topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === boss.occurrenceId,
    );
    expect(authoredBoss?.encounters.judgmentArcanaKeysByPhase).toEqual({
      Encounter: ['CastCount', 'CardDraw'],
    });
  });

  it('stores Crystal Figurine independently on the same Boss-defeated phase', () => {
    const figurine = createFigurineArcanaAddress(boss, 'Encounter');
    const project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceFigurineArcana',
      figurine,
      arcanaKeys: ['CardDraw', 'CastCount'],
    });
    const authoredBoss = project.routes[0]?.biomes[0]?.topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === boss.occurrenceId,
    );
    expect(authoredBoss?.encounters.figurineArcanaKeysByPhase).toEqual({
      Encounter: ['CastCount', 'CardDraw'],
    });
    expect(authoredBoss?.encounters.judgmentArcanaKeysByPhase).toBeUndefined();
  });

  it('rejects a fabricated phase instead of treating the phase address as cosmetic', () => {
    const project = createGoldenFGHProject();
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceJudgmentArcana',
        judgment: createJudgmentArcanaAddress(boss, 'fabricated'),
        arcanaKeys: ['CardDraw'],
      }),
    ).toThrow('not an active Boss-defeated phase');
  });
});

describe('Judgment automatic Boss lifecycle', () => {
  it('applies Judgment at Boss defeated before generic encounter completion', () => {
    const evaluated = evaluatedBiome(simulateProject(catalog, loadSurfaceNOProject()), 'N');
    const bossEvents = evaluated.history.events.filter(
      (event) =>
        event.origin.kind === 'occurrence' &&
        event.origin.occurrenceId === judgmentOwner().occurrenceId &&
        (event.kind === 'bossDefeated' || event.kind === 'encounterCompleted'),
    );
    const defeated = bossEvents.find(
      (event): event is Extract<(typeof bossEvents)[number], { readonly kind: 'bossDefeated' }> =>
        event.kind === 'bossDefeated',
    );
    const completed = bossEvents.find(
      (
        event,
      ): event is Extract<(typeof bossEvents)[number], { readonly kind: 'encounterCompleted' }> =>
        event.kind === 'encounterCompleted',
    );
    if (defeated === undefined || completed === undefined)
      throw new Error('N Boss lifecycle is missing its automatic occurrence seams');

    const seededJudgment = activateTemporaryArcana(
      catalog,
      createArcanaFearState(catalog, createDefaultRouteLoadout(catalog)),
      ['CardDraw'],
      { owner: n, sequence: 1 },
    );
    if (!seededJudgment.legal) throw new Error('Judgment test setup must be legal');
    const selected = inactive(['CardDraw'], 5);
    const result = evaluateNBossLifecycle(seededJudgment.state, selected);
    const activation = result.simulation.branches[0]?.arcanaFear.events.find(
      (event) => event.kind === 'temporaryArcanaActivated' && event.sequence === defeated.sequence,
    );

    expect(defeated.sequence).toBeLessThan(completed.sequence);
    expect(activation).toMatchObject({
      kind: 'temporaryArcanaActivated',
      arcanaKeys: selected,
      sequence: defeated.sequence,
    });
  });

  it('keeps final-use Barren active through Boss-defeated Judgment, then matures it at end effects', () => {
    const evaluated = evaluatedBiome(simulateProject(catalog, loadSurfaceNOProject()), 'N');
    const bossEvents = evaluated.history.events.filter(
      (event) =>
        event.origin.kind === 'occurrence' &&
        event.origin.occurrenceId === judgmentOwner().occurrenceId &&
        (event.kind === 'encounterCompleted' || event.kind === 'encounterEndEffectsApplied'),
    );
    const completed = bossEvents.find(
      (
        event,
      ): event is Extract<(typeof bossEvents)[number], { readonly kind: 'encounterCompleted' }> =>
        event.kind === 'encounterCompleted',
    );
    const endEffects = bossEvents.find(
      (
        event,
      ): event is Extract<
        (typeof bossEvents)[number],
        { readonly kind: 'encounterEndEffectsApplied' }
      > => event.kind === 'encounterEndEffectsApplied',
    );
    if (completed === undefined || endEffects === undefined)
      throw new Error('N Boss completion/end-effects seams are missing');
    expect(endEffects.sequence).toBe(completed.sequence + 1);
    const seeded = activateTemporaryArcana(
      catalog,
      createArcanaFearState(catalog, createDefaultRouteLoadout(catalog)),
      ['CardDraw'],
      { owner: n, sequence: 1 },
    );
    if (!seeded.legal) throw new Error('Barren setup Arcana must be legal');
    const barren = foldTraitHistoryEvents(catalog, [
      Object.freeze({
        kind: 'chaosPair' as const,
        owner: n,
        acquisitionRole: 'self',
        sequence: completed.sequence - 7,
        acquisitionPoint: 'reward',
        acquisitionIdentity: 'barren-prerequisite',
        offer: Object.freeze({
          kind: 'chaos' as const,
          giverKey: 'Chaos' as const,
          curseOptions: Object.freeze([
            { curseKey: 'ChaosNoMoneyCurse', requirementCount: 3 },
            { curseKey: 'ChaosNoMoneyCurse', requirementCount: 3 },
            { curseKey: 'ChaosNoMoneyCurse', requirementCount: 3 },
          ]) as readonly [
            { curseKey: string; requirementCount: number },
            { curseKey: string; requirementCount: number },
            { curseKey: string; requirementCount: number },
          ],
          selectedOptionKey: 'option1' as const,
          selectedCurseValues: Object.freeze({}),
          blessingKey: 'ChaosElementalBlessing',
          rarity: 'Common' as const,
          blessingValues: Object.freeze({}),
        }),
      }),
      ...[-6, -5, -4].map((offset) =>
        Object.freeze({
          kind: 'chaosClock' as const,
          owner: n,
          acquisitionRole: 'chaosClock' as const,
          sequence: completed.sequence + offset,
          clock: 'encounters' as const,
        }),
      ),
      Object.freeze({
        kind: 'chaosPair' as const,
        owner: n,
        acquisitionRole: 'self',
        sequence: completed.sequence - 3,
        acquisitionPoint: 'reward',
        acquisitionIdentity: 'barren-final-boss-use',
        offer: Object.freeze({
          kind: 'chaos' as const,
          giverKey: 'Chaos' as const,
          curseOptions: Object.freeze([
            { curseKey: 'ChaosMetaUpgradeCurse', requirementCount: 3 },
            { curseKey: 'ChaosMetaUpgradeCurse', requirementCount: 3 },
            { curseKey: 'ChaosMetaUpgradeCurse', requirementCount: 3 },
          ]) as readonly [
            { curseKey: string; requirementCount: number },
            { curseKey: string; requirementCount: number },
            { curseKey: string; requirementCount: number },
          ],
          selectedOptionKey: 'option1' as const,
          selectedCurseValues: Object.freeze({}),
          blessingKey: 'ChaosElementalBlessing',
          rarity: 'Heroic' as const,
          blessingValues: Object.freeze({}),
        }),
      }),
      ...[-2, -1].map((offset) =>
        Object.freeze({
          kind: 'chaosClock' as const,
          owner: n,
          acquisitionRole: 'chaosClock' as const,
          sequence: completed.sequence + offset,
          clock: 'encounters' as const,
        }),
      ),
    ]);
    const result = evaluateNBossLifecycle(seeded.state, inactive(['CardDraw'], 5), barren);
    const branch = result.simulation.branches[0];
    expect(
      branch?.arcanaFear.events.filter((event) => event.kind === 'temporaryArcanaActivated'),
    ).toHaveLength(1);
    expect(branch?.traitHistory?.activeChaosCurses).toHaveLength(0);
    expect(branch?.traitHistory?.maturedChaosBlessings).toContainEqual(
      expect.objectContaining({ acquisitionIdentity: 'barren-final-boss-use' }),
    );
  });

  it('retains terminal Boss repair, room lookup, and Run State while suppressing Postboss and later biome state', () => {
    const project = withJudgment();
    const assembly = simulateProjectAssembly(catalog, project);
    const evaluated = evaluatedBiome(assembly.evaluation, 'N');
    const owner = judgmentOwner();
    expect(evaluated.validity).toBe('invalid');
    expect(evaluated.coverage).toMatchObject({ kind: 'prefix', blockedAt: owner });
    if (!('materializedPrefix' in evaluated))
      throw new Error('terminal Judgment must retain a materialized prefix');
    expect(evaluated.materializedPrefix).toMatchObject({
      kind: 'biomePrefix',
      fixedRoomLinks: [
        expect.objectContaining({ target: expect.objectContaining({ gameName: 'N_Boss01' }) }),
        expect.objectContaining({ target: expect.objectContaining({ gameName: 'N_PostBoss01' }) }),
      ],
    });
    if (evaluated.materializedPrefix.entryRoom === undefined)
      throw new Error('N terminal prefix must retain its fixed entry room');
    const directPrefixRewards = evaluateBiomeRewardsAssemblyInternal(
      catalog,
      Object.freeze({
        ...evaluated.materializedPrefix,
        entryRoom: evaluated.materializedPrefix.entryRoom,
      }),
      evaluated.history,
      1,
      project.routes.find((route) => route.routeKey === 'Surface')!.loadout,
    );
    expect(directPrefixRewards.simulation.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'judgmentOutcomeMissing', origin: owner }),
      ]),
    );
    expect(evaluated.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'judgmentOutcomeMissing', origin: owner }),
      ]),
    );
    expect(
      blockedOccurrenceRoomForProjectEvaluationAssembly(
        assembly,
        createOccurrenceAddress(n, owner.occurrenceId),
      ),
    ).toMatchObject({
      gameName: 'N_Boss01',
      origin: createOccurrenceAddress(n, owner.occurrenceId),
    });
    expect(
      evaluated.rewards.runStateAvailability.some(
        (entry) =>
          entry.owner.kind === 'roomRunStateCheckpoint' &&
          entry.owner.occurrenceId === owner.occurrenceId,
      ),
    ).toBe(true);
    expect(
      assembly.evaluation.routes.find((route) => route.routeKey === 'Surface')?.processing
        .blockedSuffix,
    ).toEqual(['O']);

    const candidate = createPreparedProjectCandidateSession(catalog, assembly).evaluate({
      kind: 'judgmentArcana',
      judgment: owner,
      arcanaKeys: inactive(['CastCount', 'SorceryRegenUpgrade', 'BonusRarity', 'CardDraw'], 5),
    });
    expect(candidate).toMatchObject({
      kind: 'judgmentArcana',
      result: { requiredCount: 5, selectedPossible: true },
    });
  });

  it('suppresses Crystal Figurine at the full-run terminal Boss and retains its pending source', () => {
    const figurine = createFigurineArcanaAddress(
      createOccurrenceAddress(q, createOccurrenceId('surface-q-preboss:boss')),
      'Encounter',
    );
    const project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceFigurineArcana',
      figurine,
      arcanaKeys: ['ChanneledCast', 'HealthRegen'],
    });
    const evaluation = simulateProject(catalog, project);
    const evaluated = evaluatedBiome(evaluation, 'Q');
    if (evaluated.validity !== 'valid') throw new Error('terminal Q must remain valid');
    const previous = evaluatedBiome(evaluation, 'P');
    const arcanaFear = createArcanaFearState(catalog, createDefaultRouteLoadout(catalog));
    const keepsakes = createKeepsakeState(catalog, 'BossMetaUpgradeKeepsake', arcanaFear);
    const priorBranch = previous.rewards.branches[0];
    if (priorBranch === undefined) throw new Error('terminal Q needs a prior reward branch');
    const result = evaluateBiomeRewardsAssemblyInternal(
      catalog,
      evaluated.snapshot,
      evaluated.history,
      4,
      project.routes.find((route) => route.routeKey === 'Surface')!.loadout,
      [Object.freeze({ ...priorBranch, keepsakes })],
    );

    expect(result.figurineArcanaArtifacts.at(figurine)).toBeUndefined();
    expect(result.simulation.findings).not.toContainEqual(
      expect.objectContaining({ origin: figurine, code: 'figurineOutcomeMissing' }),
    );
    expect(result.simulation.branches[0]?.keepsakes.figurine).toEqual({
      origin: 'ordinary',
      status: 'pending',
      rarity: 'Epic',
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
    const nBiome = evaluatedBiome(evaluation, 'N');
    const oBiome = evaluatedBiome(evaluation, 'O');
    expect(nBiome.validity).toBe('valid');
    expect(oBiome.validity).toBe('valid');
    if (oBiome.validity !== 'valid') throw new Error('O must be valid');
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

  it('uses catalog route length rather than configured suffixes to suppress only the final Boss', () => {
    const base = ['CastCount', 'SorceryRegenUpgrade', 'BonusRarity', 'CardDraw'];
    const first = inactive(base, 5);
    const second = inactive([...base, ...first], 5);
    const third = inactive([...base, ...first, ...second], 5);
    let project = withBossOutcome(withJudgment(loadSurfaceNOPQProject()), n, first);
    project = withBossOutcome(project, o, second);
    project = withBossOutcome(project, p, third);

    const evaluation = simulateProject(catalog, project);
    expect(evaluatedBiome(evaluation, 'P').validity).toBe('valid');
    expect(evaluatedBiome(evaluation, 'Q').validity).toBe('valid');
    expect(
      evaluatedBiome(evaluation, 'Q').findings.some(
        (finding) => finding.origin.kind === 'judgmentArcana',
      ),
    ).toBe(false);

    const candidate = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    ).evaluate({ kind: 'judgmentArcana', judgment: judgmentOwner(q), arcanaKeys: [] });
    expect(candidate).toMatchObject({ kind: 'unavailable' });
  });

  it('reads Red-activated and Lapis-promoted inputs through the automatic Boss lifecycle seam', () => {
    const loadout = createDefaultRouteLoadout(catalog);
    const seeded = createArcanaFearState(catalog, { ...loadout, manualArcanaKeys: ['CastCount'] });
    const promoted = promoteArcana(catalog, seeded, ['CardDraw'], { owner: n, sequence: 1 });
    expect(promoted).toMatchObject({ legal: true });
    const redActivated = activateTemporaryArcana(
      catalog,
      createArcanaFearState(catalog, loadout),
      ['CardDraw'],
      { owner: n, sequence: 1 },
    );
    expect(redActivated).toMatchObject({ legal: true });

    const assembly = simulateProjectAssembly(catalog, withJudgment());
    const candidate = createPreparedProjectCandidateSession(catalog, assembly).evaluate({
      kind: 'judgmentArcana',
      judgment: judgmentOwner(),
      arcanaKeys: ['CastCount'],
    });
    expect(candidate).toMatchObject({
      kind: 'judgmentArcana',
      result: { requiredCount: 5, selectedPossible: false },
    });
    if (!promoted.legal || !redActivated.legal) throw new Error('test inputs must be legal');
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

  it('orders Judgment before Crystal Figurine and draws Figurine from the refreshed frontier', () => {
    const seeded = activateTemporaryArcana(
      catalog,
      createArcanaFearState(catalog, createDefaultRouteLoadout(catalog)),
      ['CardDraw'],
      { owner: n, sequence: 1 },
    );
    if (!seeded.legal) throw new Error('Judgment setup must be legal');
    const judgmentKeys = inactive(['CardDraw'], 5);
    const figurineKeys = inactive(['CardDraw', ...judgmentKeys], 2);
    const result = evaluateNBossLifecycle(
      seeded.state,
      judgmentKeys,
      undefined,
      figurineKeys,
      createKeepsakeState(catalog, 'BossMetaUpgradeKeepsake', seeded.state),
    );
    const branch = result.simulation.branches[0];
    if (branch === undefined) throw new Error('combined Boss transition should retain a branch');
    const activations = branch.arcanaFear.events.filter(
      (event) => event.kind === 'temporaryArcanaActivated',
    );
    expect(activations).toHaveLength(3);
    expect(activations[1]?.arcanaKeys).toEqual(judgmentKeys);
    expect(activations[2]?.arcanaKeys).toEqual(figurineKeys);
    expect(activations[2]?.sequence).toBe(activations[1]?.sequence);
    expect(activations[2]?.owner).toEqual(
      createFigurineArcanaAddress(
        createOccurrenceAddress(n, createOccurrenceId('surface-n-preboss:boss')),
        'Encounter',
      ),
    );
    expect(branch.keepsakes.figurine).toEqual({
      origin: 'ordinary',
      status: 'consumed',
      rarity: 'Epic',
    });
  });

  it('uses the post-Judgment remainder for fewer-than-two and empty Figurine domains', () => {
    const baseline = createArcanaFearState(catalog, createDefaultRouteLoadout(catalog));
    const baselineActive = new Set(baseline.arcana.active.map((card) => card.key));
    const sixInactive = catalog.arcanaCards.values
      .filter((card) => card.key !== 'CardDraw' && !baselineActive.has(card.key))
      .slice(0, 6)
      .map((card) => card.key);
    const fewerState = stateWithExactInactiveArcana(sixInactive);
    const fewer = evaluateNBossLifecycle(
      fewerState,
      sixInactive.slice(0, 5),
      undefined,
      [sixInactive[5]!],
      createKeepsakeState(catalog, 'BossMetaUpgradeKeepsake', fewerState),
    );
    const fewerBranch = fewer.simulation.branches[0];
    expect(fewerBranch).toBeDefined();
    expect(fewerBranch?.arcanaFear.arcana.active.map((card) => card.key)).toContain(sixInactive[5]);
    expect(fewerBranch?.keepsakes.figurine?.status).toBe('consumed');

    const fiveInactive = sixInactive.slice(0, 5);
    const emptyState = stateWithExactInactiveArcana(fiveInactive);
    const empty = evaluateNBossLifecycle(
      emptyState,
      fiveInactive,
      undefined,
      [],
      createKeepsakeState(catalog, 'BossMetaUpgradeKeepsake', emptyState),
    );
    const emptyBranch = empty.simulation.branches[0];
    expect(emptyBranch).toBeDefined();
    expect(emptyBranch?.keepsakes.figurine?.status).toBe('consumed');
    expect(
      emptyBranch?.arcanaFear.events.filter((event) => event.kind === 'temporaryArcanaActivated'),
    ).toHaveLength(2);
  });

  it('filters Fated-incompatible Figurine cards from the candidate and rejects an authored exclusion', () => {
    const seeded = createArcanaFearState(catalog, createDefaultRouteLoadout(catalog));
    const safeKey = inactive(['CardDraw', 'DoorReroll'], 1)[0];
    if (safeKey === undefined) throw new Error('Fated Figurine setup needs a safe target');
    const initialKeepsakes = createKeepsakeState(catalog, 'BossMetaUpgradeKeepsake', seeded);
    const fatedKeepsakes = Object.freeze({
      ...initialKeepsakes,
      history: Object.freeze([
        { key: 'HadesAndPersephoneKeepsake', kind: 'start' as const, biomeNumber: 1 },
        { key: 'BossMetaUpgradeKeepsake', kind: 'replace' as const, biomeNumber: 2 },
      ]),
      fatedStatus: 'Fated' as const,
    });
    const selected = ['DoorReroll', safeKey];
    const result = evaluateNBossLifecycle(seeded, [], undefined, selected, fatedKeepsakes);

    const figurine = createFigurineArcanaAddress(
      createOccurrenceAddress(n, createOccurrenceId('surface-n-preboss:boss')),
      'Encounter',
    );
    expect(result.figurineArcanaArtifacts.at(figurine)?.inactiveArcanaKeys).not.toContain(
      'DoorReroll',
    );
    expect(result.simulation.branches).toHaveLength(0);
    expect(result.simulation.findings).toContainEqual(
      expect.objectContaining({
        code: 'figurineOutcomeTargetUnavailable',
        evidence: expect.objectContaining({ reason: 'fatedExcluded' }),
      }),
    );
  });

  it('activates ordinary Epic Figurine cards at Epic and Cherished-advanced cards at Heroic', () => {
    const seeded = createArcanaFearState(catalog, createDefaultRouteLoadout(catalog));
    const selected = inactive([], 2);
    const ordinary = evaluateNBossLifecycle(
      seeded,
      [],
      undefined,
      selected,
      createKeepsakeState(catalog, 'BossMetaUpgradeKeepsake', seeded),
    );
    expect(ordinary.simulation.branches[0]?.arcanaFear.arcana.active).toEqual(
      expect.arrayContaining(
        selected.map((key) =>
          expect.objectContaining({ key, origin: 'temporary', rarity: 'Epic' }),
        ),
      ),
    );

    const advancedSource = advanceCurrentKeepsake(
      catalog,
      createKeepsakeState(catalog, 'BossMetaUpgradeKeepsake', seeded),
      1,
    );
    expect(advancedSource.figurine).toEqual({
      origin: 'ordinary',
      status: 'pending',
      rarity: 'Heroic',
    });
    const heroic = evaluateNBossLifecycle(seeded, [], undefined, selected, advancedSource);
    expect(heroic.simulation.branches[0]?.arcanaFear.arcana.active).toEqual(
      expect.arrayContaining(
        selected.map((key) =>
          expect.objectContaining({ key, origin: 'temporary', rarity: 'Heroic' }),
        ),
      ),
    );
  });
});

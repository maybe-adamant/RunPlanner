import {
  describe,
  expect,
  it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createJudgmentArcanaAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
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
import { loadSurfaceNOProject,
  loadSurfaceNOPQProject } from '@run-planner/test-fixtures/surface';
import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import { initializeTestRewardBranches } from '../support/arcana-fear';
import { evaluateBiomeRewardsAssemblyInternal } from '../../src/simulation/rewards/biome';
import { publicRewardBranch,
} from '../../src/simulation/rewards/processing';
import {
  attachTraitHistory,
  createTraitHistoryState,
  foldTraitHistoryEvents,
} from '../../src/simulation/traits';

const biome = createBiomeAddress('Underworld', 'F');
const boss = createOccurrenceAddress(biome, createOccurrenceId('completion:F:boss'));
const judgment = createJudgmentArcanaAddress(boss, 'Encounter');
const surface = createRouteAddress('Surface');
const n = createBiomeAddress('Surface', 'N');
const o = createBiomeAddress('Surface', 'O');
const p = createBiomeAddress('Surface', 'P');
const q = createBiomeAddress('Surface', 'Q');

function judgmentOwner(biomeAddress = n) {
  return createJudgmentArcanaAddress(
    createOccurrenceAddress(
      biomeAddress,
      createOccurrenceId(`completion:${biomeAddress.biomeKey}:boss`),
    ),
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
      automaticRooms: Object.freeze(
        evaluated.snapshot.automaticRooms.map((room) =>
          room.origin.occurrenceId === bossOccurrenceId
            ? Object.freeze({
                ...room,
                encounters: Object.freeze({
                  ...room.encounters,
                  judgmentArcanaKeysByPhase: Object.freeze({ Encounter: selected }),
                }),
              })
            : room,
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
        }),
      ),
    ],
  );
}

describe('Judgment automatic Boss ownership', () => {
  it('stores its canonical selection on the addressed Boss-defeated phase', () => {
    const project = applyProjectCommand(
      createProjectDocument(catalog, {
        projectId: 'judgment-phase-owner',
        configuredBiomeCounts: { Underworld: 1 },
      }),
      catalog,
      { kind: 'ReplaceJudgmentArcana', judgment, arcanaKeys: ['CardDraw', 'CastCount'] },
    );
    const authoredBoss = project.routes[0]?.biomes[0]?.completionOccurrences.find(
      (occurrence) => occurrence.occurrenceId === boss.occurrenceId,
    );
    expect(authoredBoss?.encounters.judgmentArcanaKeysByPhase).toEqual({
      Encounter: ['CastCount', 'CardDraw'],
    });
  });

  it('rejects a fabricated phase instead of treating the phase address as cosmetic', () => {
    const project = createProjectDocument(catalog, {
      projectId: 'judgment-phase-rejection',
      configuredBiomeCounts: { Underworld: 1 },
    });
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
          curseKey: 'ChaosNoMoneyCurse',
          duration: 3,
          curseValues: Object.freeze({}),
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
          curseKey: 'ChaosMetaUpgradeCurse',
          duration: 3,
          curseValues: Object.freeze({}),
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
      automaticRooms: [
        expect.objectContaining({ gameName: 'N_Boss01' }),
        expect.objectContaining({ gameName: 'N_PostBoss01' }),
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
});

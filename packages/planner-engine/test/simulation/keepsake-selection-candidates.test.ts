import { beforeAll, describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createKeepsakeEquipResultAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPostbossKeepsakeSelectionAddress,
  createProjectDocument,
  createRoomActionAddress,
  roomActionKey,
  createRouteStartKeepsakeSelectionAddress,
  type KeepsakeSelectionAddress,
} from '@run-planner/engine/authored-project';
import {
  createArcanaFearState,
  createPreparedProjectCandidateSession,
  encounterPhaseCandidateSupportForProjectEvaluationAssembly,
  keepsakeEquipResultCandidateForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';

import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import {
  createCompleteFGProject,
  createGoldenFGHProject,
} from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNOPQProject, pBiome, pOccurrenceId } from '@run-planner/test-fixtures/surface';

let representativeNOPQProject: ReturnType<typeof loadSurfaceNOPQProject>;

beforeAll(() => {
  representativeNOPQProject = loadSurfaceNOPQProject();
});
import { createEncounterPhaseAddress } from '@run-planner/engine/authored-project';
import {
  createKeepsakeState,
  keepsakeSelectionUnavailableReason,
} from '../../src/simulation/keepsakes';
import { circeResolutionDomain } from '../../src/simulation/arcana-fear';

type PostbossSelection = Extract<KeepsakeSelectionAddress, { readonly owner: object }>;

function postbossOccurrence(biome: ReturnType<typeof createBiomeAddress>) {
  return createOccurrenceAddress(
    biome,
    createOccurrenceId(`completion:${biome.biomeKey}:postboss`),
  );
}

const fPostboss: PostbossSelection = createPostbossKeepsakeSelectionAddress(
  postbossOccurrence(createBiomeAddress('Underworld', 'F')),
);
const gPostboss: PostbossSelection = createPostbossKeepsakeSelectionAddress(
  postbossOccurrence(createBiomeAddress('Underworld', 'G')),
);
const pPostboss: PostbossSelection = createPostbossKeepsakeSelectionAddress(
  postbossOccurrence(createBiomeAddress('Surface', 'P')),
);

function withPomResult(
  project: ReturnType<typeof createGoldenFGHProject>,
  selection: KeepsakeSelectionAddress,
) {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceJeweledPomEquipResult',
    result: createKeepsakeEquipResultAddress(selection, 'jeweledPom'),
    value: { traitKey: 'HadesLifestealBoon' },
  });
}

function keepsakesAfter(project: ReturnType<typeof createGoldenFGHProject>, biomeKey: string) {
  const biome = simulateProjectAssembly(catalog, project)
    .evaluation.routes.find((route) => route.routeKey === 'Underworld')
    ?.biomes.find((candidate) => candidate.biomeKey === biomeKey);
  if (biome?.authoring !== 'complete' || biome.validity !== 'valid')
    throw new Error(`expected valid ${biomeKey} fixture`);
  return biome.rewards.branches[0]?.keepsakes;
}

describe('keepsake selection candidates', () => {
  it('publishes the complete rank-III inventory at route start without inheriting baseline Fated restrictions', () => {
    const project = createProjectDocument(catalog, {
      projectId: 'keepsake-start-domain',
    });
    const session = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );
    const result = session.evaluate({
      kind: 'keepsakeSelection',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
    });

    expect(result).toMatchObject({
      kind: 'keepsakeSelection',
      result: { currentKey: 'ManaOverTimeRefundKeepsake' },
    });
    if (result.kind !== 'keepsakeSelection') throw new Error('expected keepsake candidate result');
    expect(result.result.options).toHaveLength(33);
    expect(result.result.options.every((option) => option.selectedPossible)).toBe(true);
    expect(result.result.options.map((option) => option.key)).toContain('GoldifyKeepsake');
  });

  it('applies retain and replacement at reached Postboss frontiers with exact chronology', () => {
    const retained = keepsakesAfter(createGoldenFGHProject(), 'F');
    expect(retained).toMatchObject({
      currentKey: 'ManaOverTimeRefundKeepsake',
      history: [{ key: 'ManaOverTimeRefundKeepsake', kind: 'start' }],
      removedKeys: [],
      fatedStatus: 'Unknown',
    });

    const replaced = withPomResult(
      applyProjectCommand(createGoldenFGHProject(), catalog, {
        kind: 'ReplacePostbossKeepsake',
        selection: fPostboss,
        value: { kind: 'replace', keepsakeKey: 'HadesAndPersephoneKeepsake' },
      }),
      fPostboss,
    );
    expect(keepsakesAfter(replaced, 'F')).toMatchObject({
      currentKey: 'HadesAndPersephoneKeepsake',
      history: [
        { key: 'ManaOverTimeRefundKeepsake', kind: 'start' },
        { key: 'HadesAndPersephoneKeepsake', kind: 'replace' },
      ],
      removedKeys: ['ManaOverTimeRefundKeepsake'],
      fatedStatus: 'Fated',
    });
  });

  it('executes Postboss fountain and rack actions in ranked lifecycle order, never at room creation', () => {
    const replaced = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: fPostboss,
      value: { kind: 'replace', keepsakeKey: 'ForceZeusBoonKeepsake' },
    });
    const f = simulateProjectAssembly(catalog, replaced)
      .evaluation.routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F');
    if (f === undefined || f.authoring !== 'complete' || f.validity !== 'valid')
      throw new Error('expected reached F biome');
    const postbossEvents = f.history.events.filter(
      (event) =>
        (event.kind === 'fountainUsed' || event.kind === 'keepsakeRackUsed') &&
        event.origin.kind === 'occurrence' &&
        event.origin.occurrenceId === 'completion:F:postboss',
    );
    expect(postbossEvents.map((event) => event.kind)).toEqual(['fountainUsed', 'keepsakeRackUsed']);
    const postbossCreated = f.history.events.find(
      (event) =>
        event.kind === 'roomCreated' &&
        event.origin.kind === 'occurrence' &&
        event.origin.occurrenceId === 'completion:F:postboss',
    );
    expect(postbossCreated).toBeDefined();
    expect(postbossCreated!.sequence).toBeLessThan(postbossEvents[0]!.sequence);
    expect(postbossEvents[0]!.sequence).toBeLessThan(postbossEvents[1]!.sequence);
    expect(keepsakesAfter(replaced, 'F')?.history).toContainEqual({
      key: 'ForceZeusBoonKeepsake',
      kind: 'replace',
    });
  });

  it('applies the replacement at the rack even when the rack is ranked before the fountain', () => {
    const completion = postbossOccurrence(createBiomeAddress('Underworld', 'F'));
    const rack = { kind: 'interactKeepsakeRack' as const };
    const replaced = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: fPostboss,
      value: { kind: 'replace', keepsakeKey: 'ForceZeusBoonKeepsake' },
    });
    const reordered = applyProjectCommand(replaced, catalog, {
      kind: 'MoveRoomAction',
      action: createRoomActionAddress(
        createBiomeAddress(completion.routeKey, completion.biomeKey),
        completion.occurrenceId,
        roomActionKey(rack),
      ),
      toIndex: 0,
    });
    const f = simulateProjectAssembly(catalog, reordered)
      .evaluation.routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F');
    if (f === undefined || f.authoring !== 'complete' || f.validity !== 'valid')
      throw new Error('expected reached F biome');
    expect(
      f.history.events
        .filter(
          (event) =>
            (event.kind === 'fountainUsed' || event.kind === 'keepsakeRackUsed') &&
            event.origin.kind === 'occurrence' &&
            event.origin.occurrenceId === 'completion:F:postboss',
        )
        .map((event) => event.kind),
    ).toEqual(['keepsakeRackUsed', 'fountainUsed']);
    expect(keepsakesAfter(reordered, 'F')?.currentKey).toBe('ForceZeusBoonKeepsake');
  });

  it('reports a persisted no-return selection without inventing a transition', () => {
    let project = withPomResult(
      applyProjectCommand(createGoldenFGHProject(), catalog, {
        kind: 'ReplacePostbossKeepsake',
        selection: fPostboss,
        value: { kind: 'replace', keepsakeKey: 'HadesAndPersephoneKeepsake' },
      }),
      fPostboss,
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: gPostboss,
      value: { kind: 'replace', keepsakeKey: 'ManaOverTimeRefundKeepsake' },
    });
    const assembled = simulateProjectAssembly(catalog, project);
    const g = assembled.evaluation.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'G');
    expect(g?.findings).toContainEqual(
      expect.objectContaining({ code: 'keepsakeUnavailable', origin: gPostboss }),
    );
    if (g === undefined || !('rewards' in g)) throw new Error('expected reached G reward surface');
    expect(g.rewards.branches[0]?.keepsakes).toMatchObject({
      currentKey: 'HadesAndPersephoneKeepsake',
      removedKeys: ['ManaOverTimeRefundKeepsake'],
      history: [
        { key: 'ManaOverTimeRefundKeepsake', kind: 'start' },
        { key: 'HadesAndPersephoneKeepsake', kind: 'replace' },
      ],
    });
  });

  it('requires the explicit retain disposition instead of replacing with the equipped identity', () => {
    const project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: fPostboss,
      value: { kind: 'replace', keepsakeKey: 'ManaOverTimeRefundKeepsake' },
    });
    const assembled = simulateProjectAssembly(catalog, project);
    const candidates = createPreparedProjectCandidateSession(catalog, assembled).evaluate({
      kind: 'keepsakeSelection',
      selection: fPostboss,
    });
    expect(candidates).toMatchObject({ kind: 'keepsakeSelection' });
    if (candidates.kind !== 'keepsakeSelection') throw new Error('expected F Postboss candidates');
    expect(
      candidates.result.options.find((option) => option.key === 'ManaOverTimeRefundKeepsake'),
    ).toMatchObject({ selectedPossible: false, unavailableReason: 'alreadyEquipped' });

    const f = assembled.evaluation.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F');
    expect(f?.findings).toContainEqual(
      expect.objectContaining({ code: 'keepsakeUnavailable', origin: fPostboss }),
    );
    if (f === undefined || !('rewards' in f)) throw new Error('expected reached F reward surface');
    expect(f.rewards.branches[0]?.keepsakes).toMatchObject({
      currentKey: 'ManaOverTimeRefundKeepsake',
      removedKeys: [],
      history: [{ key: 'ManaOverTimeRefundKeepsake', kind: 'start' }],
    });
  });

  it('keeps the final Postboss rack active with or without a configured successor', () => {
    const finalProject = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: gPostboss,
      value: { kind: 'replace', keepsakeKey: 'BossPreDamageKeepsake' },
    });
    const finalSession = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, finalProject),
    );
    expect(
      finalSession.evaluate({ kind: 'keepsakeSelection', selection: gPostboss }),
    ).toMatchObject({
      kind: 'keepsakeSelection',
      result: { currentKey: 'ManaOverTimeRefundKeepsake' },
    });
    expect(keepsakesAfter(finalProject, 'G')?.currentKey).toBe('BossPreDamageKeepsake');

    const reachedProject = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: gPostboss,
      value: { kind: 'replace', keepsakeKey: 'BossPreDamageKeepsake' },
    });
    const reachedSession = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, reachedProject),
    );
    expect(
      reachedSession.evaluate({ kind: 'keepsakeSelection', selection: gPostboss }),
    ).toMatchObject({
      kind: 'keepsakeSelection',
      result: { currentKey: 'ManaOverTimeRefundKeepsake' },
    });
    expect(keepsakesAfter(reachedProject, 'H')?.currentKey).toBe('BossPreDamageKeepsake');
  });

  it('keeps effect-deferred identities as exact history while only Fated roles change state', () => {
    const neutral = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: fPostboss,
      value: { kind: 'replace', keepsakeKey: 'BossPreDamageKeepsake' },
    });
    expect(keepsakesAfter(neutral, 'F')).toMatchObject({
      currentKey: 'BossPreDamageKeepsake',
      fatedStatus: 'Unknown',
      history: [
        { key: 'ManaOverTimeRefundKeepsake', kind: 'start' },
        { key: 'BossPreDamageKeepsake', kind: 'replace' },
      ],
    });

    const opposing = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: fPostboss,
      value: { kind: 'replace', keepsakeKey: 'ForceZeusBoonKeepsake' },
    });
    expect(keepsakesAfter(opposing, 'F')).toMatchObject({
      currentKey: 'ForceZeusBoonKeepsake',
      fatedStatus: 'Unfated',
      history: [
        { key: 'ManaOverTimeRefundKeepsake', kind: 'start' },
        { key: 'ForceZeusBoonKeepsake', kind: 'replace' },
      ],
    });
  });

  it('derives Unfated from normalized incompatible Arcana and filters Fated Arcana domains', () => {
    const loadout = {
      ...createCompleteFGProject().routes.find((route) => route.routeKey === 'Underworld')!.loadout,
      manualArcanaKeys: ['DoorReroll'],
    };
    const arcanaFear = createArcanaFearState(catalog, loadout);
    expect(createKeepsakeState(catalog, 'HadesAndPersephoneKeepsake', arcanaFear).fatedStatus).toBe(
      'Unfated',
    );
    expect(
      keepsakeSelectionUnavailableReason(
        catalog,
        createKeepsakeState(catalog, 'HadesAndPersephoneKeepsake', arcanaFear),
        'GoldifyKeepsake',
      ),
    ).toBe('unfatedEnabling');
    expect(
      circeResolutionDomain(catalog, arcanaFear, 'activateArcana', 'Fated').arcanaKeys,
    ).not.toContain('ScreenReroll');
  });

  it('uses natural Athena history to block Gorgon candidates and an authored Gorgon transition', () => {
    const phase = createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pOccurrenceId('P_Combat10', 6, 1) },
      'Combat',
    );
    let project = representativeNOPQProject;
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'AthenaCombatP',
    });
    project = authorLegalTraitOffers(project);
    const assembled = simulateProjectAssembly(catalog, project);
    expect(
      encounterPhaseCandidateSupportForProjectEvaluationAssembly(assembled, phase)
        ?.selectedPossible,
    ).toBe(true);
    const session = createPreparedProjectCandidateSession(catalog, assembled);
    const candidates = session.evaluate({ kind: 'keepsakeSelection', selection: pPostboss });
    expect(candidates).toMatchObject({ kind: 'keepsakeSelection' });
    if (candidates.kind !== 'keepsakeSelection') throw new Error('expected P Postboss candidates');
    expect(
      candidates.result.options.find((option) => option.key === 'AthenaEncounterKeepsake'),
    ).toMatchObject({
      selectedPossible: false,
      unavailableReason: 'encounterHistory',
    });

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: pPostboss,
      value: { kind: 'replace', keepsakeKey: 'AthenaEncounterKeepsake' },
    });
    const invalid = simulateProjectAssembly(catalog, project).evaluation;
    expect(invalid.findings).toContainEqual(
      expect.objectContaining({ code: 'keepsakeUnavailable' }),
    );
  });

  it('reports missing Jeweled Pom children and accepts preferred Hades results at their exact owners', () => {
    const start = createRouteStartKeepsakeSelectionAddress('Underworld');
    let startProject = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: start,
      keepsakeKey: 'HadesAndPersephoneKeepsake',
    });
    const startResult = createKeepsakeEquipResultAddress(start, 'jeweledPom');
    const missingStart = simulateProjectAssembly(catalog, startProject);
    expect(missingStart.evaluation).toMatchObject({
      status: 'incomplete',
      summary: {
        evaluatedBiomeCount: 0,
        validatedBiomeCount: 0,
        blockedBiomeCount: 2,
        eligibleForExecutionPlan: false,
      },
    });
    expect(missingStart.evaluation.findings).toContainEqual(
      expect.objectContaining({ code: 'keepsakeEquipResultMissing', origin: startResult }),
    );
    expect(missingStart.evaluation.routes[0]).toMatchObject({
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
    expect(
      keepsakeEquipResultCandidateForProjectEvaluationAssembly(missingStart, startResult),
    ).toBeDefined();
    const completedStart = applyProjectCommand(startProject, catalog, {
      kind: 'ReplaceJeweledPomEquipResult',
      result: startResult,
      value: { traitKey: 'HadesLifestealBoon' },
    });
    const resumedStart = simulateProjectAssembly(catalog, completedStart).evaluation.routes[0];
    expect(resumedStart).toMatchObject({
      status: 'valid',
      processing: { completeValidPrefix: ['F', 'G'], active: null, blockedSuffix: [] },
      summary: { evaluatedBiomeCount: 2, validatedBiomeCount: 2, eligibleForExecutionPlan: true },
    });
    const resumedF = resumedStart?.biomes[0];
    if (resumedF === undefined || !('rewards' in resumedF))
      throw new Error('completed route-start Jeweled Pom did not resume F');
    expect(resumedF.rewards.branches[0]?.traitHistory?.equippedTraits).toHaveProperty(
      'HadesLifestealBoon',
    );
    startProject = applyProjectCommand(
      applyProjectCommand(startProject, catalog, {
        kind: 'ReplaceStartingKeepsake',
        selection: start,
        keepsakeKey: 'ManaOverTimeRefundKeepsake',
      }),
      catalog,
      {
        kind: 'ReplaceStartingKeepsake',
        selection: start,
        keepsakeKey: 'HadesAndPersephoneKeepsake',
      },
    );
    startProject = applyProjectCommand(startProject, catalog, {
      kind: 'ReplaceJeweledPomEquipResult',
      result: startResult,
      value: {
        traitKey: 'HadesDeathDefianceDamageBoon',
      },
    });
    expect(simulateProjectAssembly(catalog, startProject).evaluation.findings).not.toContainEqual(
      expect.objectContaining({ code: 'keepsakeEquipResultUnavailable', origin: startResult }),
    );

    let postbossProject = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: fPostboss,
      value: { kind: 'replace', keepsakeKey: 'HadesAndPersephoneKeepsake' },
    });
    const postbossResult = createKeepsakeEquipResultAddress(fPostboss, 'jeweledPom');
    expect(simulateProjectAssembly(catalog, postbossProject).evaluation.findings).toContainEqual(
      expect.objectContaining({ code: 'keepsakeEquipResultMissing', origin: postbossResult }),
    );
    postbossProject = applyProjectCommand(postbossProject, catalog, {
      kind: 'ReplaceJeweledPomEquipResult',
      result: postbossResult,
      value: {
        traitKey: 'HadesDeathDefianceDamageBoon',
      },
    });
    expect(
      simulateProjectAssembly(catalog, postbossProject).evaluation.findings,
    ).not.toContainEqual(
      expect.objectContaining({ code: 'keepsakeEquipResultUnavailable', origin: postbossResult }),
    );
  });

  it('runs retained Jeweled Pom state through the first real Postboss Unfated transition', () => {
    let project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'HadesAndPersephoneKeepsake',
    });
    project = withPomResult(project, createRouteStartKeepsakeSelectionAddress('Underworld'));
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: fPostboss,
      value: { kind: 'replace', keepsakeKey: 'BossPreDamageKeepsake' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: gPostboss,
      value: { kind: 'replace', keepsakeKey: 'ForceZeusBoonKeepsake' },
    });

    const underworld = simulateProjectAssembly(catalog, project).evaluation.routes.find(
      (route) => route.routeKey === 'Underworld',
    );
    const f = underworld?.biomes.find((biome) => biome.biomeKey === 'F');
    const g = underworld?.biomes.find((biome) => biome.biomeKey === 'G');
    if (f === undefined || g === undefined || !('rewards' in f) || !('rewards' in g))
      throw new Error('expected reached F/G rewards');
    const retained = f.rewards.branches[0];
    const unfated = g.rewards.branches[0];
    expect(retained?.keepsakes.jeweledPom).toMatchObject({ active: true, levels: 3 });
    expect(retained?.traitHistory?.equippedTraits.HadesLifestealBoon).toBeDefined();
    const retainedBoost = Object.values(retained?.traitHistory?.equippedTraits ?? {}).find(
      (trait) => trait.traitKey !== 'HadesLifestealBoon' && trait.level === 4,
    );
    expect(retainedBoost).toBeDefined();

    expect(unfated?.keepsakes).toMatchObject({
      fatedStatus: 'Unfated',
      jeweledPom: { active: false, levels: 3 },
    });
    expect(unfated?.traitHistory?.equippedTraits.HadesLifestealBoon).toBeUndefined();
    expect(
      unfated?.traitHistory?.equippedTraits[retainedBoost?.traitKey ?? '']?.level,
    ).toBeGreaterThanOrEqual(4);
  });
});

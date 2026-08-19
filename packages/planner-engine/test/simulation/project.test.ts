import { describe, expect, it } from 'vitest';

import { catalog, createCatalog } from '@run-planner/hades2-catalog';
import { declarations } from '@run-planner/hades2-catalog/test-support';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createRouteAddress,
  createTargetAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  encounterPhaseCandidateSupportForProjectEvaluationAssembly,
  simulateProject,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';

import {
  createRepresentativeNOProject,
  createRepresentativeNOPQProject,
  createRepresentativeNProject,
  authorLegalTraitOffers,
  nBiome,
  nOccurrenceId,
} from '@run-planner/test-fixtures';
import {
  createCompleteFGProject,
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
  goldenGBiome,
  goldenGOccurrenceId,
  goldenGStartId,
  goldenIBiome,
} from '@run-planner/test-fixtures';

function route(project: ProjectDocument, routeKey: string) {
  const result = simulateProject(catalog, project);
  const evaluatedRoute = result.routes.find((candidate) => candidate.routeKey === routeKey);
  if (evaluatedRoute === undefined) throw new Error(`fixture has no ${routeKey} route`);
  return { result, route: evaluatedRoute };
}

function completeBiome(project: ProjectDocument, routeKey: string, biomeKey: string) {
  const evaluated = route(project, routeKey).route.biomes.find(
    (candidate) => candidate.biomeKey === biomeKey,
  );
  if (evaluated?.authoring !== 'complete' || evaluated.validity !== 'valid') {
    throw new Error(`${biomeKey} is not a complete-valid project product`);
  }
  return evaluated;
}

describe('project simulation composition', () => {
  it('reports an unconfigured project as empty rather than valid', () => {
    const project = createProjectDocument(catalog, {
      projectId: 'empty-project',
    });
    const result = simulateProject(catalog, project);

    expect(result.status).toBe('empty');
    expect(result.routes.map((evaluatedRoute) => evaluatedRoute.status)).toEqual([
      'empty',
      'empty',
    ]);
    expect(result.findings).toEqual([]);
    expect(result.summary).toEqual({
      configuredBiomeCount: 0,
      evaluatedBiomeCount: 0,
      validatedBiomeCount: 0,
      incompleteBiomeCount: 0,
      invalidBiomeCount: 0,
      blockedBiomeCount: 0,
      eligibleForExecutionPlan: false,
    });
  });

  it('keeps the first incomplete biome active and leaves the configured suffix blocked', () => {
    const project = createProjectDocument(catalog, {
      projectId: 'incomplete-underworld-project',
      configuredBiomeCounts: { Underworld: 2 },
    });
    const { result, route: underworld } = route(project, 'Underworld');

    expect(result.status).toBe('incomplete');
    expect(underworld).toMatchObject({
      status: 'incomplete',
      configuredBiomeKeys: ['F', 'G'],
      processing: {
        completeValidPrefix: [],
        active: { kind: 'incomplete', biomeKey: 'F' },
        blockedSuffix: ['G'],
      },
    });
    expect(underworld.biomes).toHaveLength(1);
    expect(underworld.biomes[0]).toMatchObject({
      biomeKey: 'F',
      authoring: 'incomplete',
      origin: createBiomeAddress('Underworld', 'F'),
      coverage: { kind: 'none', reason: 'notEvaluated' },
    });
    expect(underworld.summary).toEqual({
      configuredBiomeCount: 2,
      evaluatedBiomeCount: 1,
      validatedBiomeCount: 0,
      incompleteBiomeCount: 1,
      invalidBiomeCount: 0,
      blockedBiomeCount: 1,
      eligibleForExecutionPlan: false,
    });
  });

  it('reports an earlier contextual block as invalid without erasing the later authored frontier', () => {
    const removedDecision = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(9, 1),
    });
    const incomplete = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision: removedDecision,
    });
    const blockedReward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
    const project = applyProjectCommand(incomplete, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: blockedReward,
      value: {
        rewardType: 'Devotion',
        payload: {
          kind: 'DevotionPair',
          chosenSource: 'ApolloUpgrade',
          spurnedSource: 'ZeusUpgrade',
        },
      },
    });
    const { result, route: underworld } = route(project, 'Underworld');
    const f = underworld.biomes[0];

    expect(result.status).toBe('invalid');
    expect(underworld.status).toBe('invalid');
    expect(underworld.processing).toEqual({
      completeValidPrefix: [],
      active: { kind: 'invalid', biomeKey: 'F' },
      blockedSuffix: ['G'],
    });
    expect(f).toMatchObject({
      authoring: 'incomplete',
      validity: 'invalid',
      frontier: removedDecision,
      coverage: { kind: 'prefix', blockedAt: blockedReward },
    });
    expect(f?.findings).toContainEqual(
      expect.objectContaining({
        code: 'rewardSourceUnavailable',
        origin: blockedReward,
      }),
    );
    expect(f?.findings.every((finding) => finding.phase !== 'completeness')).toBe(true);
    expect(underworld.summary).toMatchObject({
      incompleteBiomeCount: 1,
      invalidBiomeCount: 1,
      blockedBiomeCount: 1,
    });
    expect(result.summary).toMatchObject({
      incompleteBiomeCount: 1,
      invalidBiomeCount: 1,
      blockedBiomeCount: 1,
    });
  });

  it('composes a complete F-through-I route with carried history and canonical products', () => {
    const project = createGoldenFGHIProject();
    const { result, route: underworld } = route(project, 'Underworld');
    const [f, g, h, i] = underworld.biomes;
    if (
      f?.authoring !== 'complete' ||
      f.validity !== 'valid' ||
      g?.authoring !== 'complete' ||
      g.validity !== 'valid' ||
      h?.authoring !== 'complete' ||
      h.validity !== 'valid' ||
      i?.authoring !== 'complete' ||
      i.validity !== 'valid'
    ) {
      throw new Error('complete Underworld fixture lost a canonical biome');
    }

    expect(result.status).toBe('valid');
    expect(result.summary).toEqual({
      configuredBiomeCount: 4,
      evaluatedBiomeCount: 4,
      validatedBiomeCount: 4,
      incompleteBiomeCount: 0,
      invalidBiomeCount: 0,
      blockedBiomeCount: 0,
      eligibleForExecutionPlan: true,
    });
    expect(underworld.processing).toEqual({
      completeValidPrefix: ['F', 'G', 'H', 'I'],
      active: null,
      blockedSuffix: [],
    });
    for (const evaluation of [f, g, h, i]) {
      expect(evaluation).toMatchObject({
        authoring: 'complete',
        validity: 'valid',
        coverage: { kind: 'complete' },
      });
      expect(evaluation.snapshot.completionRooms).toHaveLength(2);
    }
    expect(f.snapshot.entryRoom.gameName).toBe('F_Opening01');
    expect(g.snapshot.entryRoom.gameName).toBe('G_Intro');
    expect(h.snapshot.entryRoom.gameName).toBe('H_Intro');
    expect(i.snapshot.entryRoom.gameName).toBe('I_Intro');
    expect(g.history.events[0]?.sequence).toBe(f.history.afterTransition.sequence + 1);
    expect(h.history.events[0]?.sequence).toBe(g.history.afterTransition.sequence + 1);
    expect(i.history.events[0]?.sequence).toBe(h.history.afterTransition.sequence + 1);
    expect(i.history.events[0]).toMatchObject({
      kind: 'biomeStarted',
      counters: {
        routeEncounterDepth: h.history.afterTransition.ledgers.counters.routeEncounterDepth,
        roomHistoryOrdinal: h.history.afterTransition.ledgers.counters.roomHistoryOrdinal,
      },
    });
  });

  it('keeps an invalid static I Goal selection visible until its exact correction is selected', () => {
    const occurrenceId = createOccurrenceId('golden-i-combat01');
    const phase = createEncounterPhaseAddress(
      goldenIBiome,
      { kind: 'occurrence', occurrenceId },
      'Encounter',
    );
    const initial = createGoldenFGHIProject();
    const initialAssembly = simulateProjectAssembly(catalog, initial);
    expect(
      encounterPhaseCandidateSupportForProjectEvaluationAssembly(initialAssembly, phase),
    ).toMatchObject({
      active: true,
      selectedEncounterKey: 'GeneratedI_GoalReward',
      selectedPossible: true,
      candidateEncounterKeys: ['GeneratedI_GoalReward'],
    });

    const reset = applyProjectCommand(initial, catalog, { kind: 'ResetEncounter', phase });
    const { result, route: underworld } = route(reset, 'Underworld');
    const i = underworld.biomes.find((biome) => biome.biomeKey === 'I');
    if (i?.authoring !== 'complete' || i.validity !== 'invalid' || !('materializedPrefix' in i)) {
      throw new Error('reset I Goal selection did not retain an invalid editable prefix');
    }

    expect(result.status).toBe('invalid');
    expect(i.coverage).toMatchObject({ kind: 'prefix', blockedAt: phase });
    expect(i.findings).toContainEqual(
      expect.objectContaining({ code: 'encounterUnavailable', origin: phase }),
    );
    const blockedLifecycle = i.history.events.filter(
      (event) =>
        'origin' in event &&
        event.origin.kind === 'occurrence' &&
        event.origin.occurrenceId === occurrenceId &&
        (event.kind === 'roomPrepared' ||
          event.kind === 'encounterRecorded' ||
          event.kind === 'encounterStarted' ||
          event.kind === 'encounterDepthAdvanced' ||
          event.kind === 'encounterCompleted'),
    );
    expect(blockedLifecycle.map((event) => event.kind)).toEqual(['roomPrepared']);
    expect(
      i.history.events.some(
        (event) =>
          event.kind === 'clockworkGoalAcquired' &&
          event.origin.kind === 'occurrence' &&
          event.origin.occurrenceId === occurrenceId,
      ),
    ).toBe(false);

    const resetAssembly = simulateProjectAssembly(catalog, reset);
    expect(
      encounterPhaseCandidateSupportForProjectEvaluationAssembly(resetAssembly, phase),
    ).toMatchObject({
      active: true,
      activationSatisfied: true,
      selectedEncounterKey: 'GeneratedI',
      selectedPossible: false,
      candidateEncounterKeys: ['GeneratedI_GoalReward'],
    });
    const corrected = applyProjectCommand(reset, catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'GeneratedI_GoalReward',
    });

    expect(simulateProject(catalog, corrected).status).toBe('valid');
  });

  it('composes N through Q with a completed Hub as the O history seed', () => {
    const project = createRepresentativeNOPQProject();
    const { result, route: surface } = route(project, 'Surface');
    const [n, o, p, q] = surface.biomes;
    if (
      n?.authoring !== 'complete' ||
      n.validity !== 'valid' ||
      o?.authoring !== 'complete' ||
      o.validity !== 'valid' ||
      p?.authoring !== 'complete' ||
      p.validity !== 'valid' ||
      q?.authoring !== 'complete' ||
      q.validity !== 'valid'
    ) {
      throw new Error('complete Surface fixture lost a canonical biome');
    }

    expect(result.status).toBe('valid');
    expect(surface.processing).toEqual({
      completeValidPrefix: ['N', 'O', 'P', 'Q'],
      active: null,
      blockedSuffix: [],
    });
    expect(surface.summary).toMatchObject({
      configuredBiomeCount: 4,
      validatedBiomeCount: 4,
      eligibleForExecutionPlan: true,
    });
    for (const evaluation of [n, o, p, q]) {
      expect(evaluation).toMatchObject({
        authoring: 'complete',
        validity: 'valid',
        coverage: { kind: 'complete' },
      });
    }
    expect(n.snapshot.decisions.some((decision) => decision.kind === 'hub')).toBe(true);
    expect(o.history.events[0]?.sequence).toBe(n.history.afterTransition.sequence + 1);
    expect(o.history.events[0]).toMatchObject({
      kind: 'biomeStarted',
      counters: {
        routeEncounterDepth: n.history.afterTransition.ledgers.counters.routeEncounterDepth,
        roomHistoryOrdinal: n.history.afterTransition.ledgers.counters.roomHistoryOrdinal,
      },
    });
    expect(q.snapshot.decisions.at(-1)).toMatchObject({
      kind: 'batch',
      targets: [
        expect.objectContaining({ room: expect.objectContaining({ gameName: 'Q_PreBoss01' }) }),
      ],
    });
  });

  it('keeps valid prefixes usable when the next biome has no authored topology', () => {
    const underworldProject = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ClearTopology',
      biome: goldenIBiome,
    });
    const surfaceProject = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'ConfigureRoutePrefix',
      route: createRouteAddress('Surface'),
      configuredBiomeCount: 4,
    });
    const underworld = route(underworldProject, 'Underworld').route;
    const surface = route(surfaceProject, 'Surface').route;

    expect(underworld.processing).toEqual({
      completeValidPrefix: ['F', 'G', 'H'],
      active: { kind: 'incomplete', biomeKey: 'I' },
      blockedSuffix: [],
    });
    expect(underworld.biomes.at(-1)).toMatchObject({
      biomeKey: 'I',
      authoring: 'incomplete',
      coverage: { kind: 'none', reason: 'notEvaluated' },
    });
    expect(surface.processing).toEqual({
      completeValidPrefix: ['N'],
      active: { kind: 'incomplete', biomeKey: 'O' },
      blockedSuffix: ['P', 'Q'],
    });
    expect(surface.biomes).toMatchObject([
      { biomeKey: 'N', authoring: 'complete', validity: 'valid' },
      { biomeKey: 'O', authoring: 'incomplete', coverage: { kind: 'none' } },
    ]);
  });

  it('retains a complete invalid F product and blocks its downstream biome at the route boundary', () => {
    const invalidTarget = createTargetAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId: goldenFStartId },
      'exit1',
    );
    const project = authorLegalTraitOffers(
      applyProjectCommand(createCompleteFGProject(), catalog, {
        kind: 'ReplaceOccurrenceRoom',
        occurrence: createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(1, 1)),
        gameName: 'F_Combat14',
      }),
    );
    const { result, route: underworld } = route(project, 'Underworld');
    const f = underworld.biomes[0];
    if (f?.authoring !== 'complete' || f.validity !== 'invalid') {
      throw new Error('invalid F lost its bounded product');
    }

    expect(result.status).toBe('invalid');
    expect(underworld.processing).toEqual({
      completeValidPrefix: [],
      active: { kind: 'invalid', biomeKey: 'F' },
      blockedSuffix: ['G'],
    });
    expect(underworld.biomes).toHaveLength(1);
    expect(f).toMatchObject({
      validity: 'invalid',
      coverage: { kind: 'prefix', blockedAt: invalidTarget },
      materializedPrefix: { entryRoom: { gameName: 'F_Opening01' } },
    });
    expect('snapshot' in f).toBe(false);
    expect(f.findings).toContainEqual(
      expect.objectContaining({ code: 'targetRoomUnavailable', origin: invalidTarget }),
    );
    expect(result.findings.every((finding) => finding.origin.kind !== 'project')).toBe(true);
  });

  it('retains a complete invalid G product while preserving F as its validated route seed', () => {
    const invalidTarget = createTargetAddress(
      goldenGBiome,
      { kind: 'occurrence', occurrenceId: goldenGStartId },
      'exit1',
    );
    const project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenGBiome, goldenGOccurrenceId(1, 1)),
      gameName: 'G_Combat10',
    });
    const { route: underworld } = route(project, 'Underworld');
    const [f, g] = underworld.biomes;
    if (f?.authoring !== 'complete' || f.validity !== 'valid' || g?.authoring !== 'complete') {
      throw new Error('complete invalid G route lost its products');
    }

    expect(underworld.processing).toEqual({
      completeValidPrefix: ['F'],
      active: { kind: 'invalid', biomeKey: 'G' },
      blockedSuffix: [],
    });
    expect(f.validity).toBe('valid');
    expect(g.validity).toBe('invalid');
    expect(g.history.events[0]?.sequence).toBe(f.history.afterTransition.sequence + 1);
    expect(g.findings).toContainEqual(
      expect.objectContaining({ code: 'targetRoomUnavailable', origin: invalidTarget }),
    );
  });

  it('blocks the Surface suffix after an invalid completed Hub without leaking its findings downstream', () => {
    const project = applyProjectCommand(createRepresentativeNOProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat10')),
      value: { rewardType: 'WeaponUpgrade' },
    });
    const { result, route: surface } = route(project, 'Surface');

    expect(result.status).toBe('invalid');
    expect(surface.processing).toEqual({
      completeValidPrefix: [],
      active: { kind: 'invalid', biomeKey: 'N' },
      blockedSuffix: ['O'],
    });
    expect(surface.biomes).toHaveLength(1);
    expect(surface.biomes[0]).toMatchObject({
      biomeKey: 'N',
      authoring: 'complete',
      validity: 'invalid',
      coverage: { kind: 'prefix' },
    });
    expect('snapshot' in surface.biomes[0]!).toBe(false);
    expect(
      surface.findings.every(
        (finding) =>
          finding.origin.kind !== 'project' &&
          finding.origin.kind !== 'route' &&
          finding.origin.biomeKey === 'N',
      ),
    ).toBe(true);
  });

  it('is deterministic, frozen, catalog-independent, and leaves authored project identity intact', () => {
    const project = createRepresentativeNOPQProject();
    const before = JSON.stringify(project);
    const first = simulateProject(catalog, project);
    const second = simulateProject(catalog, project);
    const rebuiltCatalog = createCatalog(declarations);

    expect(second).toEqual(first);
    expect(simulateProject(rebuiltCatalog, project)).toEqual(first);
    expect(JSON.stringify(project)).toBe(before);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.routes)).toBe(true);
    expect(Object.isFrozen(first.routes[1]?.biomes)).toBe(true);
    expect(completeBiome(project, 'Surface', 'N').snapshot).toBeTruthy();
  });
});

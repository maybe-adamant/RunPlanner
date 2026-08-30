import { describe, expect, it } from 'vitest';

import * as fixture from './support/progressive-biome-fixtures';

const {
  applyProjectCommand,
  authorLegalTraitOffers,
  bindTestCandidateSession,
  catalog,
  defaultRouteLoadout,
  EMPTY_RESOURCE_PLACEMENTS,
  evaluateProgressiveBiomeAssembly,
  evaluateProgressiveBiomeAssemblyBeforeClamp,
  createCompleteFGProject,
  createExitDecisionAddress,
  createFGenerationProject,
  createFOpeningBatch,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createTargetAddress,
  createUnselectedFTakeoverProject,
  fBiome,
  fCombatId,
  fGenerationBiome,
  fGenerationOccurrenceId,
  fStartId,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenGBiome,
  goldenGOccurrenceId,
  goldenHBiome,
  goldenIBiome,
  createGoldenFGHIProject,
  incompleteAtMissingDecision,
  loadSurfaceNOPQProject,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
  partialGWithInvalidSecondPhysicalTarget,
  partialGWithOnePhysicalTarget,
  prefix,
  qBiome,
  qOccurrenceIds,
  route,
  semanticAddressKey,
  source,
} = fixture;

describe('progressive prefix and frontier products', () => {
  it.each([
    {
      biomeKey: 'F',
      routeKey: 'Underworld',
      project: incompleteAtMissingDecision(
        createCompleteFGProject(),
        goldenFBiome,
        goldenFOccurrenceId(8, 1),
      ),
    },
    {
      biomeKey: 'G',
      routeKey: 'Underworld',
      project: incompleteAtMissingDecision(
        createCompleteFGProject(),
        goldenGBiome,
        goldenGOccurrenceId(7, 1),
      ),
    },
    {
      biomeKey: 'H',
      routeKey: 'Underworld',
      project: incompleteAtMissingDecision(
        createGoldenFGHIProject(),
        goldenHBiome,
        createOccurrenceId('golden-h-combat05'),
      ),
    },
    {
      biomeKey: 'I',
      routeKey: 'Underworld',
      project: incompleteAtMissingDecision(
        createGoldenFGHIProject(),
        goldenIBiome,
        createOccurrenceId('golden-i-combat09'),
      ),
    },
    {
      biomeKey: 'O',
      routeKey: 'Surface',
      project: incompleteAtMissingDecision(
        loadSurfaceNOPQProject(),
        oBiome,
        oOccurrenceIds.combat02,
      ),
    },
    {
      biomeKey: 'P',
      routeKey: 'Surface',
      project: incompleteAtMissingDecision(
        loadSurfaceNOPQProject(),
        pBiome,
        pOccurrenceId('P_Combat12', 8, 1),
      ),
    },
    {
      biomeKey: 'Q',
      routeKey: 'Surface',
      project: incompleteAtMissingDecision(
        loadSurfaceNOPQProject(),
        qBiome,
        qOccurrenceIds.secondMiniboss1,
      ),
    },
  ])(
    'retains a truthful selected-spine prefix for $biomeKey',
    ({ project, routeKey, biomeKey }) => {
      const { route: evaluatedRoute, evaluation } = prefix(project, routeKey, biomeKey);

      expect(evaluatedRoute.processing.active).toEqual({ kind: 'incomplete', biomeKey });
      expect(evaluation.history.events.some((event) => event.kind === 'biomeCompleted')).toBe(
        false,
      );
      expect('snapshot' in evaluation).toBe(false);
      expect(evaluation.materializedPrefix.entryRoom).toBeDefined();
      expect(evaluation.coverage.through).toMatchObject({
        checkpoint: 'beforeTargetGeneration',
      });

      if (biomeKey === 'H') {
        const fields = evaluation.materializedPrefix.decisions.find(
          (decision) => decision.kind === 'batch' && decision.batchState.kind === 'fields',
        );
        expect(fields).toBeDefined();
      }
      if (biomeKey === 'I') {
        const clockwork = evaluation.materializedPrefix.decisions.find(
          (decision) => decision.kind === 'batch' && decision.batchState.kind === 'clockwork',
        );
        expect(clockwork).toBeDefined();
      }
      if (biomeKey === 'O') {
        expect(
          evaluation.materializedPrefix.decisions.some(
            (decision) =>
              decision.kind === 'batch' &&
              decision.targets.some((target) => (target.room.rewardWheels?.length ?? 0) > 0),
          ),
        ).toBe(true);
      }
    },
  );

  it('replays the generated physical prefix before halting at the missing normal exit', () => {
    const fixture = partialGWithOnePhysicalTarget();
    const { evaluation } = prefix(fixture.project, 'Underworld', 'G');
    const frontier = evaluation.materializedPrefix.frontier;
    const topology = fixture.project.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'G')?.topology;
    const persisted = topology?.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.source.kind === 'occurrence' &&
        decision.source.occurrenceId === fixture.source,
    );

    expect(frontier).toMatchObject({
      kind: 'exitDecision',
      origin: createExitDecisionAddress(goldenGBiome, source(fixture.source)),
      selectedExitKey: 'exit1',
    });
    if (frontier?.kind !== 'exitDecision') throw new Error('G lost its exit decision frontier');
    if (persisted?.kind !== 'exit' || persisted.normal.kind !== 'batch') {
      throw new Error('G lost its persisted batch');
    }
    expect(persisted.normal.targets).toEqual([
      { exitKey: 'exit1', occurrenceId: createOccurrenceId('progressive-g-combat02') },
    ]);
    expect(frontier.targets).toMatchObject([
      {
        exit: { exitKey: 'exit1' },
        room: { gameName: 'G_Combat02' },
        picked: true,
      },
    ]);
    expect(evaluation.history.rooms.at(-1)?.targetGenerations).toMatchObject([
      {
        targetOrigin: createTargetAddress(goldenGBiome, source(fixture.source), 'exit1'),
      },
    ]);
    expect(evaluation.coverage).toMatchObject({
      kind: 'prefix',
      through: {
        owner: createTargetAddress(goldenGBiome, source(fixture.source), 'exit1'),
        checkpoint: 'afterTargetGeneration',
      },
    });
    const sourceHistory = evaluation.history.rooms.find(
      (room) =>
        semanticAddressKey(room.origin) ===
        semanticAddressKey(createOccurrenceAddress(goldenGBiome, fixture.source)),
    );
    expect(sourceHistory?.postCommit).toBeUndefined();
    expect(sourceHistory?.exit).toBeUndefined();
    expect(evaluation.rewards.targetHistory).toContainEqual(
      expect.objectContaining({
        origin: createTargetAddress(goldenGBiome, source(fixture.source), 'exit1'),
      }),
    );
    expect(evaluation.rewards.targetHistory).toContainEqual(
      expect.objectContaining({
        origin: createTargetAddress(goldenGBiome, source(fixture.source), 'exit2'),
      }),
    );
    expect(evaluation.findings).toContainEqual(
      expect.objectContaining({
        code: 'targetMissing',
        origin: createTargetAddress(goldenGBiome, source(fixture.source), 'exit2'),
      }),
    );
    expect(
      bindTestCandidateSession(catalog, fixture.project).evaluate({
        kind: 'roomTarget',
        target: createTargetAddress(goldenGBiome, source(fixture.source), 'exit2'),
        gameName: 'G_Combat02',
      }),
    ).toMatchObject({
      kind: 'roomTarget',
      result: { pressure: { selectedParentCreationCount: 1 } },
    });
    expect(
      bindTestCandidateSession(catalog, fixture.project).evaluate({
        kind: 'incomingReward',
        reward: createIncomingRewardAddress(
          goldenGBiome,
          createOccurrenceId('progressive-g-combat02'),
        ),
        value: { rewardType: 'MetaCurrencyBigDrop' },
      }),
    ).toMatchObject({ kind: 'incomingReward', result: { supported: true, findings: [] } });
  });

  it('keeps an ordinary empty frontier at its outgoing checkpoint', () => {
    const { evaluation } = prefix(createFOpeningBatch(), 'Underworld', 'F');
    const frontier = evaluation.materializedPrefix.frontier;
    const openingHistory = evaluation.history.rooms.find(
      (room) =>
        semanticAddressKey(room.origin) ===
        semanticAddressKey(createOccurrenceAddress(fBiome, fStartId)),
    );

    expect(frontier).toMatchObject({
      kind: 'exitDecision',
      origin: createExitDecisionAddress(fBiome, source(fStartId)),
    });
    if (frontier?.kind !== 'exitDecision') throw new Error('F lost its empty decision frontier');
    expect(frontier.hubContinuation).toBeUndefined();
    expect(openingHistory?.postCommit).toBeUndefined();
    expect(openingHistory?.exit).toBeUndefined();
  });

  it('retains the first physical target when the second selected target is invalid', () => {
    const fixture = partialGWithInvalidSecondPhysicalTarget();
    const { evaluation } = prefix(fixture.project, 'Underworld', 'G');
    const frontier = evaluation.assessmentPrefix?.frontier;

    if (frontier?.kind !== 'exitDecision') {
      throw new Error('invalid G target did not clamp at its source decision');
    }
    expect(frontier.origin).toEqual(
      createExitDecisionAddress(goldenGBiome, source(fixture.source)),
    );
    expect(frontier.targets).toMatchObject([
      {
        origin: createTargetAddress(goldenGBiome, source(fixture.source), 'exit1'),
        room: { occurrenceId: fixture.firstTarget, gameName: 'G_Combat02' },
      },
    ]);
    expect(evaluation.history.rooms.at(-1)?.targetGenerations).toContainEqual(
      expect.objectContaining({
        targetOrigin: createTargetAddress(goldenGBiome, source(fixture.source), 'exit1'),
      }),
    );
    expect(evaluation.materializedPrefix.frontier).toMatchObject({
      kind: 'exitDecision',
      origin: createExitDecisionAddress(goldenGBiome, source(fixture.firstTarget)),
    });
    expect(evaluation.findings).toContainEqual(
      expect.objectContaining({
        origin: createTargetAddress(goldenGBiome, source(fixture.source), 'exit2'),
      }),
    );
  });

  it('blocks a later partial-batch target after an invalid generated first door', () => {
    const fixture = partialGWithOnePhysicalTarget();
    const project = applyProjectCommand(authorLegalTraitOffers(fixture.project), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenGBiome, fixture.firstTarget),
      gameName: 'G_Combat10',
    });
    const { evaluation } = prefix(project, 'Underworld', 'G');

    expect(evaluation.coverage.blockedAt).toEqual(
      createTargetAddress(goldenGBiome, source(fixture.source), 'exit1'),
    );
    expect(evaluation.assessmentPrefix?.frontier).toMatchObject({
      kind: 'exitDecision',
      targets: [],
    });
    const authoredFrontier = evaluation.materializedPrefix.frontier;
    if (authoredFrontier?.kind !== 'exitDecision') {
      throw new Error('authored G target was lost after an invalid predecessor');
    }
    expect(authoredFrontier.targets.map((target) => target.room.occurrenceId)).toContain(
      fixture.firstTarget,
    );
    expect(evaluation.findings).toContainEqual(
      expect.objectContaining({
        code: 'targetRoomUnavailable',
        origin: createTargetAddress(goldenGBiome, source(fixture.source), 'exit1'),
      }),
    );
    const retainedBatch = evaluation.roomGeneration.ordinary.ordinaryBatches.find(
      (batch) =>
        semanticAddressKey(batch.origin) ===
        semanticAddressKey(createExitDecisionAddress(goldenGBiome, source(fixture.source))),
    );
    expect(retainedBatch?.targets.map((target) => semanticAddressKey(target.origin))).toEqual([
      semanticAddressKey(createTargetAddress(goldenGBiome, source(fixture.source), 'exit1')),
    ]);
    expect(retainedBatch?.targets[0]?.pressure.selectedPossible).toBe(false);
    expect(
      evaluation.roomGeneration.ordinary.ordinaryBatches.find(
        (batch) =>
          semanticAddressKey(batch.origin) ===
          semanticAddressKey(createExitDecisionAddress(goldenGBiome, source(fixture.firstTarget))),
      ),
    ).toBeUndefined();
    expect(
      bindTestCandidateSession(catalog, project).evaluate({
        kind: 'roomTarget',
        target: createTargetAddress(goldenGBiome, source(fixture.source), 'exit2'),
        gameName: 'G_Combat02',
      }),
    ).toMatchObject({ kind: 'unavailable', reason: 'coverageNotReached' });
  });

  it('retains a decision-owned invalid Fields assessment without publishing target assessments', () => {
    const project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceFieldsCageOutcome',
      decision: createExitDecisionAddress(
        goldenHBiome,
        source(createOccurrenceId('golden-h-combat02')),
      ),
      cageOutcome: 'max',
    });
    const evaluatedRoute = route(project, 'Underworld');
    const previous = evaluatedRoute.biomes.find((candidate) => candidate.biomeKey === 'G');
    const plan = project.routes
      .find((candidate) => candidate.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'H');
    if (previous?.authoring !== 'complete' || previous.validity !== 'valid' || plan === undefined) {
      throw new Error('invalid Fields fixture has no valid G seed or H plan');
    }
    const options = {
      enteredBiomeCount: 3,
      resourcePlacements: EMPTY_RESOURCE_PLACEMENTS,
      loadout: defaultRouteLoadout,
      seed: { history: previous.history, rewardBranches: previous.rewards.branches },
    } as const;
    const clamped = evaluateProgressiveBiomeAssembly(catalog, goldenHBiome, plan, options);
    const selected = evaluateProgressiveBiomeAssemblyBeforeClamp(
      catalog,
      goldenHBiome,
      plan,
      options,
    );
    const blockedDecision = createExitDecisionAddress(
      goldenHBiome,
      source(createOccurrenceId('golden-h-miniboss01')),
    );
    const selectedBatch = selected?.evaluation.roomGeneration.ordinary.ordinaryBatches.find(
      (batch) => semanticAddressKey(batch.origin) === semanticAddressKey(blockedDecision),
    );
    const retainedBatch = clamped?.evaluation.roomGeneration.ordinary.ordinaryBatches.find(
      (batch) => semanticAddressKey(batch.origin) === semanticAddressKey(blockedDecision),
    );

    expect(clamped?.evaluation.blockedAt).toEqual(blockedDecision);
    expect(selectedBatch?.fields).toMatchObject({
      selectedOutcome: 'max',
      selectedPossible: false,
      fieldsMaxDoorsRolled: 2,
      maxDoorCageCeiling: 2,
    });
    expect(retainedBatch?.fields).toEqual(selectedBatch?.fields);
    expect(retainedBatch?.targets).toEqual([]);
  });

  it('records an unselected takeover’s complete physical target set at its nullable frontier', () => {
    const { evaluation } = prefix(createUnselectedFTakeoverProject(), 'Underworld', 'F');
    const frontier = evaluation.materializedPrefix.frontier;

    expect(frontier).toMatchObject({
      kind: 'exitDecision',
      origin: createExitDecisionAddress(fBiome, source(fCombatId)),
      selectedExitKey: null,
      targets: [
        { exit: { exitKey: 'exit1' }, room: { gameName: 'F_PreBoss01' }, picked: false },
        { exit: { exitKey: 'exit2' }, room: { gameName: 'F_PreBoss01' }, picked: false },
      ],
    });
    expect(
      evaluation.history.events.filter(
        (event) =>
          event.kind === 'roomCreated' &&
          event.source === 'generatedTarget' &&
          event.parentOrigin.kind === 'occurrence' &&
          event.parentOrigin.occurrenceId === fCombatId,
      ),
    ).toHaveLength(2);
  });
  it('clamps an invalid semantic replacement before later generated decisions without deleting it', () => {
    const project = applyProjectCommand(
      createFGenerationProject(undefined, { includeTakeover: false }),
      catalog,
      {
        kind: 'ReplaceOccurrenceRoom',
        occurrence: createOccurrenceAddress(fGenerationBiome, fGenerationOccurrenceId(1, 1)),
        gameName: 'F_Combat14',
      },
    );
    const { evaluation } = prefix(project, 'Underworld', 'F');

    expect(evaluation.coverage.blockedAt).toEqual(
      createTargetAddress(
        fGenerationBiome,
        source(createOccurrenceId('possibility-start')),
        'exit1',
      ),
    );
    expect(evaluation.assessmentPrefix?.decisions).toHaveLength(0);
    expect(evaluation.materializedPrefix.decisions).toHaveLength(10);
    expect(evaluation.findings).toContainEqual(
      expect.objectContaining({ code: 'targetRoomUnavailable' }),
    );
  });

  it('keeps a missing I topology unevaluated without blocking its already valid F-through-H prefix', () => {
    const project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ClearTopology',
      biome: goldenIBiome,
    });
    const evaluatedRoute = route(project, 'Underworld');
    const i = evaluatedRoute.biomes.find((candidate) => candidate.biomeKey === 'I');
    if (i === undefined) throw new Error('fixture lost I');

    expect(evaluatedRoute.processing).toEqual({
      completeValidPrefix: ['F', 'G', 'H'],
      active: { kind: 'incomplete', biomeKey: 'I' },
      blockedSuffix: [],
    });
    expect(i).toMatchObject({ authoring: 'incomplete', coverage: { kind: 'none' } });
    expect('materializedPrefix' in i).toBe(false);
  });
});

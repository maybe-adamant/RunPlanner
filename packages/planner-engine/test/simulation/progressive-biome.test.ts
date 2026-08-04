import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRewardWheelAddress,
  createRouteAddress,
  createTargetAddress,
  semanticAddressKey,
  type BiomeAddress,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  simulateProject,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';

import { bindTestCandidateSession } from './candidateSession';
import {
  createFGenerationProject,
  fGenerationBaselineBatches,
  fGenerationBiome,
  fGenerationOccurrenceId,
  fGenerationTargetAddress,
} from './support/f-generation-project';
import {
  evaluateProgressiveBiomeAssembly,
  evaluateProgressiveBiomeAssemblyBeforeClamp,
} from '../../src/simulation/progressive/biome';
import { candidateArtifactsForProjectEvaluationAssembly } from '../../src/simulation/project';
import {
  createFOpeningBatch,
  createUnselectedFTakeoverProject,
  fBiome,
  fCombatId,
  fStartId,
} from './support/f-takeover-project';
import {
  createGoldenFGHProject,
  createGoldenFGHIProject,
  createCompleteFGProject,
  goldenGBiome,
  goldenGOccurrenceId,
  goldenHBiome,
  goldenIBiome,
} from '@run-planner/test-fixtures';
import {
  createRepresentativeNOPQProject,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
  qBiome,
  qOccurrenceIds,
} from '@run-planner/test-fixtures';

function source(occurrenceId: OccurrenceId) {
  return { kind: 'occurrence' as const, occurrenceId };
}

function appendBatch(
  project: ProjectDocument,
  biome: BiomeAddress,
  sourceOccurrenceId: OccurrenceId,
  targets: readonly { readonly occurrenceId: OccurrenceId; readonly gameName: string }[],
  storeKey?: 'RunProgress' | 'MetaProgress',
): ProjectDocument {
  const decision = createExitDecisionAddress(biome, source(sourceOccurrenceId));
  let next = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
  if (storeKey !== undefined) {
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(biome, decision.source),
      storeKey,
    });
  }
  for (const [offset, target] of targets.entries()) {
    next = applyProjectCommand(next, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, decision.source, `exit${offset + 1}`),
      occurrenceId: target.occurrenceId,
      gameName: target.gameName,
    });
  }
  return next;
}

function incompleteAtMissingDecision(
  project: ProjectDocument,
  biome: BiomeAddress,
  sourceOccurrenceId: OccurrenceId,
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'RemoveExitDecision',
    decision: createExitDecisionAddress(biome, source(sourceOccurrenceId)),
  });
}

function route(project: ProjectDocument, routeKey: string) {
  const result = simulateProject(catalog, project).routes.find(
    (candidate) => candidate.routeKey === routeKey,
  );
  if (result === undefined) throw new Error(`fixture has no ${routeKey} route`);
  return result;
}

function prefix(project: ProjectDocument, routeKey: string, biomeKey: string) {
  const evaluatedRoute = route(project, routeKey);
  const evaluation = evaluatedRoute.biomes.find((candidate) => candidate.biomeKey === biomeKey);
  if (
    evaluation === undefined ||
    evaluation.authoring !== 'incomplete' ||
    evaluation.coverage.kind !== 'prefix' ||
    !('materializedPrefix' in evaluation)
  ) {
    throw new Error(`${biomeKey} did not produce a materialized incomplete prefix`);
  }
  return { route: evaluatedRoute, evaluation };
}

function incompleteHFieldsProject() {
  const hStart = createOccurrenceId('progressive-h-start');
  let project = applyProjectCommand(createCompleteFGProject(), catalog, {
    kind: 'ConfigureRoutePrefix',
    route: createRouteAddress('Underworld'),
    configuredBiomeCount: 3,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: goldenHBiome,
    occurrenceId: hStart,
  });
  return {
    project: applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: createExitDecisionAddress(goldenHBiome, source(hStart)),
    }),
    target: createTargetAddress(goldenHBiome, source(hStart), 'exit1'),
  };
}

function incompleteIFieldProject() {
  const iStart = createOccurrenceId('progressive-i-start');
  const iCombat = createOccurrenceId('progressive-i-combat01');
  let project = applyProjectCommand(createGoldenFGHProject(), catalog, {
    kind: 'ConfigureRoutePrefix',
    route: createRouteAddress('Underworld'),
    configuredBiomeCount: 4,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: goldenIBiome,
    occurrenceId: iStart,
  });
  return {
    project: appendBatch(project, goldenIBiome, iStart, [
      { occurrenceId: iCombat, gameName: 'I_Combat01' },
    ]),
    start: iStart,
    target: createTargetAddress(goldenIBiome, source(iStart), 'exit1'),
  };
}

function partialGWithOnePhysicalTarget() {
  const gStart = createOccurrenceId('progressive-g-start');
  const first = createOccurrenceId('progressive-g-combat01');
  const second = createOccurrenceId('progressive-g-combat02');
  let project = applyProjectCommand(createCompleteFGProject(), catalog, {
    kind: 'ClearTopology',
    biome: goldenGBiome,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: goldenGBiome,
    occurrenceId: gStart,
  });
  project = appendBatch(
    project,
    goldenGBiome,
    gStart,
    [{ occurrenceId: first, gameName: 'G_Combat01' }],
    'RunProgress',
  );
  project = appendBatch(
    project,
    goldenGBiome,
    first,
    [{ occurrenceId: second, gameName: 'G_Combat02' }],
    'MetaProgress',
  );
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenGBiome, second),
    value: { rewardType: 'MetaCurrencyBigDrop' },
  });
  return {
    project,
    source: first,
    firstTarget: second,
  };
}

function partialGWithInvalidSecondPhysicalTarget() {
  const gStart = createOccurrenceId('progressive-invalid-g-start');
  const first = createOccurrenceId('progressive-invalid-g-combat01');
  const second = createOccurrenceId('progressive-invalid-g-combat02');
  const invalid = createOccurrenceId('progressive-invalid-g-combat10');
  let project = applyProjectCommand(createCompleteFGProject(), catalog, {
    kind: 'ClearTopology',
    biome: goldenGBiome,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: goldenGBiome,
    occurrenceId: gStart,
  });
  project = appendBatch(
    project,
    goldenGBiome,
    gStart,
    [{ occurrenceId: first, gameName: 'G_Combat01' }],
    'RunProgress',
  );
  project = appendBatch(
    project,
    goldenGBiome,
    first,
    [
      { occurrenceId: second, gameName: 'G_Combat02' },
      { occurrenceId: invalid, gameName: 'G_Combat10' },
    ],
    'MetaProgress',
  );
  project = applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(goldenGBiome, source(first)),
    value: { kind: 'normal', exitKey: 'exit1' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenGBiome, second),
    value: { rewardType: 'MetaCurrencyBigDrop' },
  });
  return { project, source: first, firstTarget: second };
}

function partialGWithEarlierInvalidReward() {
  const fixture = partialGWithInvalidSecondPhysicalTarget();
  return {
    ...fixture,
    project: applyProjectCommand(fixture.project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(goldenGBiome, fixture.firstTarget),
      value: { rewardType: 'MetaCurrencyDrop' },
    }),
  };
}

describe('progressive biome evaluation', () => {
  it('carries exact room-target and reward-producer artifacts through normal, prefix, clamped, and pre-clamp execution', () => {
    const complete = createFGenerationProject();
    const incomplete = createFGenerationProject(undefined, { includeTakeover: false });
    const firstFTarget = fGenerationTargetAddress(fGenerationBaselineBatches, 1, 1);
    const firstFReward = createIncomingRewardAddress(
      fGenerationBiome,
      fGenerationOccurrenceId(1, 1),
    );
    const normalAssembly = simulateProjectAssembly(catalog, complete);
    const prefixAssembly = simulateProjectAssembly(catalog, incomplete);
    const normalResult = createPreparedProjectCandidateSession(catalog, normalAssembly).evaluate({
      kind: 'roomTarget',
      target: firstFTarget,
      gameName: 'F_Combat02',
    });
    const prefixResult = createPreparedProjectCandidateSession(catalog, prefixAssembly).evaluate({
      kind: 'roomTarget',
      target: firstFTarget,
      gameName: 'F_Combat02',
    });
    const normalProducer = candidateArtifactsForProjectEvaluationAssembly(normalAssembly)
      .biomeAt(fGenerationBiome)
      ?.rewardProducers.at(firstFReward);
    const prefixProducer = candidateArtifactsForProjectEvaluationAssembly(prefixAssembly)
      .biomeAt(fGenerationBiome)
      ?.rewardProducers.at(firstFReward);

    const fixture = partialGWithInvalidSecondPhysicalTarget();
    const routeEvaluation = simulateProject(catalog, fixture.project).routes.find(
      (candidate) => candidate.routeKey === 'Underworld',
    );
    const previous = routeEvaluation?.biomes.find((candidate) => candidate.biomeKey === 'F');
    const plan = fixture.project.routes
      .find((candidate) => candidate.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'G');
    if (previous?.authoring !== 'complete' || previous.validity !== 'valid' || plan === undefined) {
      throw new Error('progressive artifact fixture has no valid F seed or G plan');
    }
    const seed = { history: previous.history, rewardBranches: previous.rewards.branches };
    const clamped = evaluateProgressiveBiomeAssembly(catalog, goldenGBiome, plan, 2, seed);
    const beforeClamp = evaluateProgressiveBiomeAssemblyBeforeClamp(
      catalog,
      goldenGBiome,
      plan,
      2,
      seed,
    );
    const firstGTarget = createTargetAddress(goldenGBiome, source(fixture.source), 'exit1');
    const invalidSecondGTarget = createTargetAddress(goldenGBiome, source(fixture.source), 'exit2');
    const clampedContext = clamped?.candidateArtifacts.roomTargets.at(firstGTarget);
    const beforeClampContext = beforeClamp?.candidateArtifacts.roomTargets.at(firstGTarget);
    const firstGReward = createIncomingRewardAddress(goldenGBiome, fixture.firstTarget);
    const clampedProducer = clamped?.candidateArtifacts.rewardProducers.at(firstGReward);
    const beforeClampProducer = beforeClamp?.candidateArtifacts.rewardProducers.at(firstGReward);

    expect(normalResult).toMatchObject({ kind: 'roomTarget' });
    expect(prefixResult).toMatchObject({ kind: 'roomTarget' });
    expect(normalProducer).toBeDefined();
    expect(prefixProducer).toBeDefined();
    expect(normalProducer).not.toBe(prefixProducer);
    expect(Object.keys(normalProducer ?? {})).toEqual([
      'acquisitionHorizon',
      'evaluateOffer',
      'resolvedStoreKey',
    ]);
    expect(normalProducer?.resolvedStoreKey).toBe('MetaProgress');
    expect(clampedContext).toBeDefined();
    expect(beforeClampContext).toBeDefined();
    expect(beforeClampContext).not.toBe(clampedContext);
    expect(clampedProducer).toBeDefined();
    expect(beforeClampProducer).toBeDefined();
    expect(beforeClampProducer).not.toBe(clampedProducer);
    const clampedFrontierContext = clamped?.candidateArtifacts.roomTargets.at(invalidSecondGTarget);
    const beforeClampInvalidContext =
      beforeClamp?.candidateArtifacts.roomTargets.at(invalidSecondGTarget);
    expect(clampedFrontierContext).toBeDefined();
    expect(beforeClampInvalidContext).toBeDefined();
    expect(beforeClampInvalidContext).not.toBe(clampedFrontierContext);

    const blocked = partialGWithEarlierInvalidReward();
    const blockedRoute = simulateProject(catalog, blocked.project).routes.find(
      (candidate) => candidate.routeKey === 'Underworld',
    );
    const blockedPrevious = blockedRoute?.biomes.find((candidate) => candidate.biomeKey === 'F');
    const blockedPlan = blocked.project.routes
      .find((candidate) => candidate.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'G');
    if (
      blockedPrevious?.authoring !== 'complete' ||
      blockedPrevious.validity !== 'valid' ||
      blockedPlan === undefined
    ) {
      throw new Error('blocked reward artifact fixture has no valid F seed or G plan');
    }
    const blockedSeed = {
      history: blockedPrevious.history,
      rewardBranches: blockedPrevious.rewards.branches,
    };
    const blockedClamped = evaluateProgressiveBiomeAssembly(
      catalog,
      goldenGBiome,
      blockedPlan,
      2,
      blockedSeed,
    );
    const blockedBeforeClamp = evaluateProgressiveBiomeAssemblyBeforeClamp(
      catalog,
      goldenGBiome,
      blockedPlan,
      2,
      blockedSeed,
    );
    const blockedOwner = createIncomingRewardAddress(goldenGBiome, blocked.firstTarget);
    const foreignOwner = createIncomingRewardAddress(
      goldenGBiome,
      createOccurrenceId('not-a-reward-producer'),
    );

    const retainedBlockedProducer =
      blockedClamped?.candidateArtifacts.rewardProducers.at(blockedOwner);
    expect(retainedBlockedProducer).toMatchObject({ acquisitionHorizon: 'generationOnly' });
    expect(blockedBeforeClamp?.candidateArtifacts.rewardProducers.at(blockedOwner)).toMatchObject({
      acquisitionHorizon: 'ownEnteredLifecycle',
    });
    expect(blockedBeforeClamp?.candidateArtifacts.rewardProducers.at(foreignOwner)).toBeUndefined();
    expect(
      blockedClamped?.candidateArtifacts.rewardProducers.at(
        createIncomingRewardAddress(
          goldenGBiome,
          createOccurrenceId('progressive-invalid-g-combat10'),
        ),
      ),
    ).toBeUndefined();
  });

  it('carries opaque lifecycle artifacts through normal, prefix, clamped, and pre-clamp execution', () => {
    const surface = createRepresentativeNOPQProject();
    const prefixProject = incompleteAtMissingDecision(surface, oBiome, oOccurrenceIds.combat02);
    const owner = createOccurrenceAddress(oBiome, oOccurrenceIds.combat04);
    const normalAssembly = simulateProjectAssembly(catalog, surface);
    const prefixAssembly = simulateProjectAssembly(catalog, prefixProject);
    const normalLifecycle = candidateArtifactsForProjectEvaluationAssembly(normalAssembly)
      .biomeAt(oBiome)
      ?.roomLifecycles.shipAt(owner);
    const prefixLifecycle = candidateArtifactsForProjectEvaluationAssembly(prefixAssembly)
      .biomeAt(oBiome)
      ?.roomLifecycles.shipAt(owner);

    expect(normalLifecycle).toBeDefined();
    expect(prefixLifecycle).toBeDefined();
    expect(normalLifecycle).not.toBe(prefixLifecycle);
    expect(Object.keys(normalLifecycle ?? {})).toEqual(['activeWheelKeys', 'evaluateState']);

    const invalid = applyProjectCommand(surface, catalog, {
      kind: 'ReplaceRewardWheelStore',
      wheel: createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1'),
      storeKey: 'MetaProgress',
    });
    const routeEvaluation = simulateProject(catalog, invalid).routes.find(
      (candidate) => candidate.routeKey === 'Surface',
    );
    const previous = routeEvaluation?.biomes.find((candidate) => candidate.biomeKey === 'N');
    const plan = invalid.routes
      .find((candidate) => candidate.routeKey === 'Surface')
      ?.biomes.find((candidate) => candidate.biomeKey === 'O');
    if (previous?.authoring !== 'complete' || previous.validity !== 'valid' || plan === undefined) {
      throw new Error('lifecycle artifact fixture has no valid N seed or O plan');
    }
    const seed = { history: previous.history, rewardBranches: previous.rewards.branches };
    const clamped = evaluateProgressiveBiomeAssembly(catalog, oBiome, plan, 2, seed);
    const beforeClamp = evaluateProgressiveBiomeAssemblyBeforeClamp(catalog, oBiome, plan, 2, seed);
    const clampedLifecycle = clamped?.candidateArtifacts.roomLifecycles.shipAt(owner);
    const beforeClampLifecycle = beforeClamp?.candidateArtifacts.roomLifecycles.shipAt(owner);

    expect(clamped?.evaluation.blockedAt).toMatchObject({
      kind: 'rewardWheelOffer',
      occurrenceId: oOccurrenceIds.combat04,
      wheelKey: 'wheel1',
    });
    expect(clampedLifecycle).toBeUndefined();
    expect(beforeClampLifecycle).toBeDefined();
    expect(beforeClampLifecycle).not.toBe(clampedLifecycle);
  });

  it('requires the Fields outcome before a target can be authored while retaining target eligibility', () => {
    const fixture = incompleteHFieldsProject();
    const evaluation = route(fixture.project, 'Underworld').biomes.find(
      (candidate) => candidate.biomeKey === 'H',
    );
    if (evaluation === undefined) throw new Error('fixture lost H');

    expect(evaluation).toMatchObject({
      authoring: 'incomplete',
      coverage: { kind: 'prefix' },
      frontier: fixture.target,
    });
    expect(
      bindTestCandidateSession(catalog, fixture.project).evaluate({
        kind: 'roomTarget',
        target: fixture.target,
        gameName: 'H_Combat02',
      }),
    ).toMatchObject({ kind: 'roomTarget', result: { pressure: { selectedPossible: true } } });
    expect(() =>
      applyProjectCommand(fixture.project, catalog, {
        kind: 'CreateTarget',
        target: fixture.target,
        occurrenceId: createOccurrenceId('progressive-h-combat02'),
        gameName: 'H_Combat02',
      }),
    ).toThrow('select the Fields cage outcome before authoring targets');
  });

  it('keeps the fixed Clockwork entrance assessable while its required biome field is absent', () => {
    const fixture = incompleteIFieldProject();
    const evaluation = route(fixture.project, 'Underworld').biomes.find(
      (candidate) => candidate.biomeKey === 'I',
    );
    if (evaluation === undefined) throw new Error('fixture lost I');
    const session = bindTestCandidateSession(catalog, fixture.project);

    expect(evaluation).toMatchObject({
      authoring: 'incomplete',
      coverage: { kind: 'none', reason: 'notEvaluated' },
    });
    expect(
      session.evaluate({
        kind: 'startRoom',
        owner: createOccurrenceAddress(goldenIBiome, fixture.start),
        gameName: 'I_Intro',
      }),
    ).toMatchObject({ kind: 'startRoom', result: { selectedPossible: true } });
    expect(
      session.evaluate({
        kind: 'roomTarget',
        target: fixture.target,
        gameName: 'I_Combat01',
      }),
    ).toEqual({
      kind: 'unavailable',
      reason: 'coverageNotReached',
      evidence: {
        kind: 'coverageNotReached',
        requiredOwner: fixture.target,
        requiredCheckpoint: 'afterTargetGeneration',
        coverage: { kind: 'none', reason: 'notEvaluated' },
      },
    });
  });

  it.each([
    {
      biomeKey: 'F',
      routeKey: 'Underworld',
      project: createFGenerationProject(undefined, { includeTakeover: false }),
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
        createRepresentativeNOPQProject(),
        oBiome,
        oOccurrenceIds.combat02,
      ),
    },
    {
      biomeKey: 'P',
      routeKey: 'Surface',
      project: incompleteAtMissingDecision(
        createRepresentativeNOPQProject(),
        pBiome,
        pOccurrenceId('P_Combat12', 8, 1),
      ),
    },
    {
      biomeKey: 'Q',
      routeKey: 'Surface',
      project: incompleteAtMissingDecision(
        createRepresentativeNOPQProject(),
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
        checkpoint: biomeKey === 'F' ? 'afterTargetGeneration' : 'beforeTargetGeneration',
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
    const project = applyProjectCommand(fixture.project, catalog, {
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
    expect(
      bindTestCandidateSession(catalog, project).evaluate({
        kind: 'roomTarget',
        target: createTargetAddress(goldenGBiome, source(fixture.source), 'exit2'),
        gameName: 'G_Combat02',
      }),
    ).toMatchObject({ kind: 'roomTarget' });
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

  it('clamps a same-batch reward failure before a later physical target failure', () => {
    const fixture = partialGWithEarlierInvalidReward();
    const { evaluation } = prefix(fixture.project, 'Underworld', 'G');

    expect(evaluation.coverage.blockedAt).toEqual(
      createIncomingRewardAddress(goldenGBiome, fixture.firstTarget),
    );
    expect(evaluation.assessmentPrefix?.frontier).toMatchObject({
      kind: 'exitDecision',
      targets: [],
    });
    expect(
      bindTestCandidateSession(catalog, fixture.project).evaluate({
        kind: 'incomingReward',
        reward: createIncomingRewardAddress(goldenGBiome, fixture.firstTarget),
        value: { rewardType: 'MetaCurrencyBigDrop' },
      }),
    ).toMatchObject({ kind: 'incomingReward', result: { supported: true } });
    expect(
      bindTestCandidateSession(catalog, fixture.project).evaluate({
        kind: 'incomingReward',
        reward: createIncomingRewardAddress(
          goldenGBiome,
          createOccurrenceId('progressive-invalid-g-combat10'),
        ),
        value: { rewardType: 'MetaCurrencyBigDrop' },
      }),
    ).toMatchObject({ kind: 'unavailable' });
    expect(
      bindTestCandidateSession(catalog, fixture.project).evaluate({
        kind: 'roomTarget',
        target: createTargetAddress(goldenGBiome, source(fixture.source), 'exit2'),
        gameName: 'G_Combat02',
      }),
    ).toMatchObject({ kind: 'roomTarget' });
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

  it('strengthens the same complete routes to canonical products and remains deterministic', () => {
    const underworld = createGoldenFGHIProject();
    const surface = createRepresentativeNOPQProject();
    const firstUnderworld = simulateProject(catalog, underworld);
    const secondUnderworld = simulateProject(catalog, underworld);
    const surfaceResult = simulateProject(catalog, surface);

    expect(secondUnderworld).toEqual(firstUnderworld);
    for (const { result, routeKey } of [
      { result: firstUnderworld, routeKey: 'Underworld' },
      { result: surfaceResult, routeKey: 'Surface' },
    ] as const) {
      const evaluatedRoute = result.routes.find((candidate) => candidate.routeKey === routeKey);
      if (evaluatedRoute === undefined) throw new Error(`missing ${routeKey} route`);
      expect(evaluatedRoute.processing.active).toBeNull();
      expect(evaluatedRoute.processing.blockedSuffix).toEqual([]);
      expect(evaluatedRoute.biomes).toHaveLength(4);
      expect(evaluatedRoute.biomes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            authoring: 'complete',
            validity: 'valid',
            coverage: { kind: 'complete' },
          }),
        ]),
      );
    }
    expect(Object.isFrozen(firstUnderworld)).toBe(true);
    expect(Object.isFrozen(firstUnderworld.routes)).toBe(true);
  });
});

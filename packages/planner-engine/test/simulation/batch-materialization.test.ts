import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceId,
  createOccurrenceAddress,
  createExitDecisionAddress,
  createTargetAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  evaluateBiomeCompleteness,
  materializeBiome,
  materializeBiomePrefix,
} from '@run-planner/engine/simulation';
import {
  createGoldenFGHProject,
  createGoldenFGHIProject,
} from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNProject, nOccurrenceIds } from '@run-planner/test-fixtures/surface';

import { orderedTargets } from '../../src/simulation/materialization/batch';
import {
  createCompleteFTakeoverProject,
  fBiome,
  fCombatId,
  fDecision,
} from './support/f-takeover-project';
import {
  createFGenerationProject,
  fGenerationBaselineBatches,
  fGenerationBiome,
  fGenerationOccurrenceId,
  fGenerationTargetAddress,
  type FGenerationBatchSpec,
} from './support/f-generation-project';
import { evaluate } from './support/f-generation-evaluation';
import { createSelectedContractContinuationProject } from './support/detour-generation-fixtures';

function fPlan(project: ProjectDocument) {
  const plan = project.routes
    .find((route) => route.routeKey === 'Underworld')
    ?.biomes.find((biome) => biome.biomeKey === 'F');
  if (plan === undefined) throw new Error('missing F takeover plan');
  return plan;
}

function materialize(project: ProjectDocument) {
  const completeness = evaluateBiomeCompleteness(catalog, fBiome, fPlan(project));
  if (completeness.completion !== 'complete') throw new Error('F fixture is incomplete');
  const loadout = project.routes.find((route) => route.routeKey === 'Underworld')?.loadout;
  if (loadout === undefined) throw new Error('F fixture has no loadout');
  return materializeBiome(catalog, fBiome, completeness, loadout);
}

function completeBiomeSnapshot(project: ProjectDocument, biomeKey: 'H' | 'I' | 'N') {
  const routeKey = biomeKey === 'N' ? 'Surface' : 'Underworld';
  const plan = project.routes
    .find((route) => route.routeKey === routeKey)
    ?.biomes.find((candidate) => candidate.biomeKey === biomeKey);
  const loadout = project.routes.find((route) => route.routeKey === routeKey)?.loadout;
  const biome = createBiomeAddress(routeKey, biomeKey);
  if (plan === undefined || loadout === undefined) {
    throw new Error(`${biomeKey} fixture is missing direct materialization inputs`);
  }
  const completeness = evaluateBiomeCompleteness(catalog, biome, plan);
  if (completeness.completion !== 'complete') {
    throw new Error(`${biomeKey} fixture is incomplete`);
  }
  return materializeBiome(catalog, biome, completeness, loadout);
}

describe('batch materialization', () => {
  it('orders physical targets by their declaration-owned exit key', () => {
    expect(
      orderedTargets([
        { exitKey: 'exit10', occurrenceId: createOccurrenceId('ten') },
        { exitKey: 'exit2', occurrenceId: createOccurrenceId('two') },
        { exitKey: 'exit1', occurrenceId: createOccurrenceId('one') },
      ]),
    ).toEqual([
      { exitKey: 'exit1', occurrenceId: createOccurrenceId('one') },
      { exitKey: 'exit2', occurrenceId: createOccurrenceId('two') },
      { exitKey: 'exit10', occurrenceId: createOccurrenceId('ten') },
    ]);
  });

  it('keeps target ownership semantic and independent of target insertion order', () => {
    const snapshot = materialize(createCompleteFTakeoverProject());
    const takeover = snapshot.decisions.at(-1);
    if (takeover?.kind !== 'batch') throw new Error('missing F takeover batch');

    expect(takeover.targets.map((target) => semanticAddressKey(target.origin))).toEqual([
      semanticAddressKey(createTargetAddress(fBiome, fDecision(fCombatId).source, 'exit1')),
      semanticAddressKey(createTargetAddress(fBiome, fDecision(fCombatId).source, 'exit2')),
    ]);
  });

  it('lets a later forced target override the authored shared store for its batch peers', () => {
    const batches = [
      {
        targets: ['F_Combat02'],
        pickedExitIndex: 1,
        offers: [{ rewardType: 'MetaCurrencyDrop' }],
      },
      {
        targets: ['F_Combat02', 'F_Combat01'],
        pickedExitIndex: 1,
        storeKey: 'MetaProgress',
        offers: [{ rewardType: 'MaxHealthDrop' }, { rewardType: 'MaxHealthDrop' }],
      },
    ] satisfies readonly FGenerationBatchSpec[];
    const snapshot = materialize(createFGenerationProject(batches));
    const source = createExitDecisionAddress(fGenerationBiome, {
      kind: 'occurrence',
      occurrenceId: fGenerationOccurrenceId(1, 1),
    });
    const batch = snapshot.decisions.find(
      (decision) =>
        decision.kind === 'batch' &&
        semanticAddressKey(decision.origin) === semanticAddressKey(source),
    );
    if (batch?.kind !== 'batch') throw new Error('F fixture has no forced-store batch');

    expect(batch.rewardStore).toMatchObject({
      kind: 'authoredBaseStore',
      baseRewardStoreKey: 'MetaProgress',
    });
    expect(batch.resolvedSharedRewardStoreKey).toBe('RunProgress');
    expect(batch.targets.map((target) => target.room.incomingReward?.resolvedStoreKey)).toEqual([
      'RunProgress',
      'RunProgress',
    ]);
  });

  it('preserves retained overflow for semantic physical-exit validation', () => {
    const project = applyProjectCommand(createFGenerationProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(fGenerationBiome, fGenerationOccurrenceId(7, 1)),
      gameName: 'F_Combat10',
    });
    const result = evaluate(project);
    const overflow = result.snapshot.decisions.find(
      (decision) =>
        decision.kind === 'batch' &&
        semanticAddressKey(decision.origin) ===
          semanticAddressKey(
            createExitDecisionAddress(fGenerationBiome, {
              kind: 'occurrence',
              occurrenceId: fGenerationOccurrenceId(7, 1),
            }),
          ),
    );
    const target = fGenerationTargetAddress(fGenerationBaselineBatches, 8, 2);
    const finding = result.generation.findings.find(
      (candidate) =>
        candidate.code === 'targetRoomUnavailable' &&
        semanticAddressKey(candidate.origin) === semanticAddressKey(target),
    );

    if (overflow?.kind !== 'batch') throw new Error('missing retained overflow batch');
    expect(overflow.targets[1]?.exit).toEqual({ kind: 'unavailable', exitKey: 'exit2', index: 2 });
    expect(finding?.evidence.exclusionReasons).toContain('physicalExitUnavailable');
  });

  it('materializes exact Fields batch state from the complete H fixture', () => {
    const snapshot = completeBiomeSnapshot(createGoldenFGHProject(), 'H');
    const batches = snapshot.decisions.filter(
      (
        decision,
      ): decision is Extract<(typeof snapshot.decisions)[number], { readonly kind: 'batch' }> =>
        decision.kind === 'batch',
    );

    expect(batches.map((batch) => batch.batchState)).toEqual([
      {
        kind: 'fields',
        cageOutcome: 'min',
        batchCapacity: 3,
        cageTargetCount: 1,
        doorCageRewardCount: 2,
      },
      {
        kind: 'fields',
        cageOutcome: 'min',
        batchCapacity: 2,
        cageTargetCount: 2,
        doorCageRewardCount: 2,
      },
      {
        kind: 'fields',
        cageOutcome: 'max',
        batchCapacity: 3,
        cageTargetCount: 0,
        doorCageRewardCount: 3,
      },
      {
        kind: 'fields',
        cageOutcome: 'max',
        batchCapacity: 3,
        cageTargetCount: 2,
        doorCageRewardCount: 3,
      },
      { kind: 'standard' },
    ]);
  });

  it('materializes Clockwork state progression and target reward assignment', () => {
    const snapshot = completeBiomeSnapshot(createGoldenFGHIProject(), 'I');
    const batches = snapshot.decisions.filter(
      (
        decision,
      ): decision is Extract<(typeof snapshot.decisions)[number], { readonly kind: 'batch' }> =>
        decision.kind === 'batch',
    );
    const clockwork = batches.filter(
      (
        batch,
      ): batch is (typeof batches)[number] & {
        readonly batchState: Extract<typeof batch.batchState, { readonly kind: 'clockwork' }>;
      } => batch.batchState.kind === 'clockwork',
    );

    expect(
      clockwork.map((batch) => [
        batch.batchState.goalsRemaining,
        batch.batchState.nonGoalRewardsAcquired,
        batch.batchState.maxNonGoalRewards,
      ]),
    ).toEqual([
      [5, 0, 3],
      [4, 0, 3],
      [3, 0, 3],
      [2, 0, 3],
      [1, 0, 3],
      [0, 0, 3],
    ]);
    expect(
      clockwork.flatMap((batch) => batch.targets).map((target) => target.room.clockworkReward),
    ).toEqual(['goal', 'goal', undefined, 'goal', 'nonGoal', 'goal', 'goal', 'goal', 'nonGoal']);
  });

  it('preserves N prehub as a declaration-owned physical exit', () => {
    const snapshot = completeBiomeSnapshot(loadSurfaceNProject(), 'N');
    const batch = snapshot.decisions.find((decision) => decision.kind === 'batch');
    if (batch?.kind !== 'batch') throw new Error('N fixture has no canonical batch');

    expect(batch.targets).toMatchObject([
      {
        exit: { kind: 'available', exitKey: 'prehub', index: 1 },
        room: { occurrenceId: nOccurrenceIds.preHub },
      },
    ]);
  });

  it('materializes the selected Contract continuation from its additional exit', () => {
    const { project, contract, additional } = createSelectedContractContinuationProject();
    const plan = project.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F');
    const loadout = project.routes.find((route) => route.routeKey === 'Underworld')?.loadout;
    if (plan === undefined || loadout === undefined) {
      throw new Error('Contract fixture has no Underworld materialization inputs');
    }
    const snapshot = materializeBiomePrefix(catalog, fBiome, plan, loadout);
    if (snapshot?.frontier?.kind !== 'exitDecision') {
      throw new Error('Contract fixture did not publish its selected source frontier');
    }

    expect(snapshot.frontier.additional).toMatchObject([
      {
        origin: additional,
        picked: true,
        room: { occurrenceId: contract, gameName: 'C_Boss01' },
      },
    ]);
  });
});

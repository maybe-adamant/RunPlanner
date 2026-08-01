import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createTargetAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  BiomeMaterializationContractError,
  evaluateBiomeCompleteness,
  materializeBiome,
  targetContinuation,
} from '@run-planner/engine/simulation';

import {
  createCompleteFTakeoverProject,
  createFProject,
  fBiome,
  fCombatId,
  fDecision,
} from '../../support/f-takeover-project';

function fPlan(project: ProjectDocument) {
  const plan = project.routes
    .find((route) => route.routeKey === 'Underworld')
    ?.biomes.find((biome) => biome.biomeKey === 'F');
  if (plan === undefined) throw new Error('missing F takeover plan');
  return plan;
}

function materialize(project: ProjectDocument) {
  const completeness = evaluateBiomeCompleteness(catalog, fBiome, fPlan(project));
  if (completeness.completion !== 'complete') {
    throw new Error(
      `fixture is incomplete: ${completeness.findings.map((finding) => finding.code)}`,
    );
  }
  return materializeBiome(catalog, fBiome, completeness);
}

describe('F takeover materialization', () => {
  it.each([
    [true, 'Combat', 'continuesSpine'],
    [true, 'Preboss', 'startsCompletion'],
    [false, 'Preboss', 'deadLeaf'],
  ] as const)('derives %s/%s target continuation as %s', (picked, roomKind, expected) => {
    expect(targetContinuation(picked, roomKind)).toBe(expected);
  });

  it('requires complete authored topology at the public materialization boundary', () => {
    const incomplete = evaluateBiomeCompleteness(catalog, fBiome, fPlan(createFProject()));

    expect(() => materializeBiome(catalog, fBiome, incomplete as never)).toThrowError(
      new BiomeMaterializationContractError('biome materialization requires completeness'),
    );
  });

  it('materializes ordinary and takeover batches as one ordered decision spine', () => {
    const snapshot = materialize(createCompleteFTakeoverProject());

    expect(snapshot).toMatchObject({
      kind: 'biome',
      routeKey: 'Underworld',
      biomeKey: 'F',
      entryRoom: { occurrenceId: 'f-takeover-start', gameName: 'F_Opening01', entered: true },
    });
    expect(snapshot.decisions.map((decision) => decision.kind)).toEqual(['batch', 'batch']);
    const [opening, takeover] = snapshot.decisions;
    if (opening?.kind !== 'batch' || takeover?.kind !== 'batch') {
      throw new Error('F fixture should contain two normal-door batches');
    }
    expect(opening.targets).toMatchObject([
      {
        exit: { exitKey: 'exit1', index: 1 },
        picked: true,
        continuation: 'continuesSpine',
        room: { occurrenceId: fCombatId, gameName: 'F_Combat02' },
      },
    ]);
    expect(takeover.targets.map((target) => target.exit.exitKey)).toEqual(['exit1', 'exit2']);
    expect(takeover.targets.map((target) => target.room.occurrenceId)).toEqual([
      'f-takeover-preboss-shop',
      'f-takeover-preboss-free',
    ]);
  });

  it('derives Shop/free roles and completion entry from the selected physical exit', () => {
    const snapshot = materialize(createCompleteFTakeoverProject());
    const takeover = snapshot.decisions.at(-1);
    if (takeover?.kind !== 'batch') throw new Error('missing F takeover batch');

    expect(takeover).toMatchObject({
      rewardStore: { kind: 'none' },
      batchState: { kind: 'standard' },
      selectedExitKey: 'exit1',
    });
    expect(
      takeover.targets.map((target) => [target.room.entryState?.kind, target.continuation]),
    ).toEqual([
      ['shop', 'startsCompletion'],
      [undefined, 'deadLeaf'],
    ]);
    expect(snapshot.completionRooms.map((room) => room.role)).toEqual(['boss', 'postboss']);
  });

  it('keeps an unpicked Shop dormant when the free-reward peer starts completion', () => {
    const snapshot = materialize(createCompleteFTakeoverProject('exit2'));
    const takeover = snapshot.decisions.at(-1);
    if (takeover?.kind !== 'batch') throw new Error('missing F takeover batch');

    expect(
      takeover.targets.map((target) => [
        target.picked,
        target.room.entryState,
        target.continuation,
      ]),
    ).toEqual([
      [false, undefined, 'deadLeaf'],
      [true, undefined, 'startsCompletion'],
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

  it('is frozen and deterministic for equal F takeover inputs', () => {
    const first = materialize(createCompleteFTakeoverProject());
    const second = materialize(createCompleteFTakeoverProject());

    expect(first).toEqual(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.decisions)).toBe(true);
    expect(
      Object.isFrozen(first.decisions[1]?.kind === 'batch' ? first.decisions[1].targets : []),
    ).toBe(true);
  });
});

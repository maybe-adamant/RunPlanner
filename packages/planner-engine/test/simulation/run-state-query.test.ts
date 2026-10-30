import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createOccurrenceAddress,
  createRoomRunStateCheckpointAddress,
} from '@run-planner/engine/authored-project';
import {
  runStateSnapshotForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';

import { createCompleteFTakeoverProject, fStartId } from './support/f-takeover-project';

describe('run-state snapshot query', () => {
  const assembly = simulateProjectAssembly(catalog, createCompleteFTakeoverProject());
  const biome = assembly.evaluation.route.biomes.find((candidate) => 'rewards' in candidate);
  if (biome === undefined || !('rewards' in biome)) throw new Error('F publishes rewards');
  const { runStateSnapshots, runStateAvailability } = biome.rewards;

  it('returns the published snapshot at every available checkpoint', () => {
    const available = runStateAvailability.filter((item) => item.availability === 'available');
    expect(new Set(available.map((item) => item.owner.kind))).toEqual(
      new Set(['exitDecision', 'roomRunStateCheckpoint']),
    );
    for (const item of available)
      expect(runStateSnapshotForProjectEvaluationAssembly(assembly, item.owner)?.owner).toEqual(
        item.owner,
      );
    for (const snapshot of runStateSnapshots)
      expect(runStateSnapshotForProjectEvaluationAssembly(assembly, snapshot.owner)).toBe(snapshot);
  });

  it('answers an equal address built by the consumer', () => {
    const owner = createRoomRunStateCheckpointAddress(
      createOccurrenceAddress(createBiomeAddress('Underworld', 'F'), fStartId),
      { kind: 'beforeRoomExit' },
    );
    expect(runStateSnapshotForProjectEvaluationAssembly(assembly, owner)?.owner).toEqual(owner);
  });

  it('is undefined at a checkpoint coverage did not reach', () => {
    const unavailable = runStateAvailability.filter((item) => item.availability === 'unavailable');
    expect(unavailable.length).toBeGreaterThan(0);
    for (const item of unavailable)
      expect(runStateSnapshotForProjectEvaluationAssembly(assembly, item.owner)).toBeUndefined();
  });

  it('is undefined for a biome the route did not evaluate or another route', () => {
    const entered = { kind: 'roomEntered' } as const;
    const occurrence = (routeKey: string, biomeKey: string) =>
      createRoomRunStateCheckpointAddress(
        createOccurrenceAddress(createBiomeAddress(routeKey, biomeKey), fStartId),
        entered,
      );
    expect(
      runStateSnapshotForProjectEvaluationAssembly(assembly, occurrence('Underworld', 'G')),
    ).toBeUndefined();
    expect(
      runStateSnapshotForProjectEvaluationAssembly(assembly, occurrence('Surface', 'F')),
    ).toBeUndefined();
  });
});

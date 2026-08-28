import { afterAll, describe, expect, it } from 'vitest';

import {
  createRawPerformanceSnapshot,
  performanceProductTargetsMs,
  runPerformanceRoute,
  writeRawPerformanceSnapshot,
  type RoutePerformanceSamples,
  type TimedPerformanceSample,
} from '../support/performance-snapshot';

const snapshotMode = process.env.RUN_PLANNER_PERFORMANCE_SNAPSHOT === '1';
let underworld: RoutePerformanceSamples | undefined;
let surface: RoutePerformanceSamples | undefined;

function expectRebuildResults(run: RoutePerformanceSamples, label: string): void {
  expect(run.rebuilds).toHaveLength(3);
  for (const rebuild of run.rebuilds) {
    expect(rebuild.result, `${label} must match the warmed evaluation`).toEqual(run.baseline);
  }
}

function expectColdCandidateWork(
  samples: readonly TimedPerformanceSample[],
  label: string,
  route: 'underworld' | 'surface',
): void {
  expect(samples).toHaveLength(3);
  for (const sample of samples) {
    if (route === 'underworld') {
      const result = sample.result as { readonly sections: readonly unknown[] };
      expect(result.sections.length).toBeGreaterThan(0);
    } else {
      expect(sample.result).toHaveLength(2);
    }
    const queryBatches = sample.events.filter((event) => event.kind === 'queryBatch');
    expect(queryBatches, `${label} must evaluate exactly one candidate batch`).toHaveLength(1);
    expect(queryBatches[0]?.queryCount).toBeGreaterThan(0);
    expect(
      sample.events.filter((event) => event.kind === 'projectEvaluation'),
      `${label} must not reacquire project evaluation`,
    ).toHaveLength(0);
  }
}

function expectEditWork(samples: readonly TimedPerformanceSample[], label: string): void {
  expect(samples).toHaveLength(3);
  for (const sample of samples) {
    expect(
      sample.events.filter((event) => event.kind === 'projectEvaluation'),
      `${label} must publish exactly one project evaluation`,
    ).toHaveLength(1);
    expect(
      sample.events.filter((event) => event.kind === 'queryBatch'),
      `${label} must not query candidates`,
    ).toHaveLength(0);
    const result = sample.result as { readonly present: unknown; readonly project: unknown };
    expect(result.present).not.toBe(result.project);
  }
}

function expectCachedUndoWork(samples: readonly TimedPerformanceSample[], label: string): void {
  expect(samples).toHaveLength(3);
  for (const sample of samples) {
    expect(
      sample.events.filter((event) => event.kind === 'projectEvaluation'),
      `${label} must reuse its cached project evaluation`,
    ).toHaveLength(0);
    expect(sample.events, `${label} must not perform candidate work`).toHaveLength(0);
    const result = sample.result as {
      readonly present: unknown;
      readonly project: unknown;
      readonly baseline: unknown;
      readonly evaluation: unknown;
    };
    expect(result.present).toBe(result.project);
    expect(result.evaluation).toBe(result.baseline);
  }
}

function expectInteractiveDurations(run: RoutePerformanceSamples, label: string): void {
  const median = (samples: readonly TimedPerformanceSample[]) => {
    const durations = samples.map(({ durationMs }) => durationMs).sort((a, b) => a - b);
    return durations[Math.floor(durations.length / 2)]!;
  };
  const interactionSamples = [
    ['full rebuild', run.rebuilds],
    ['cold candidate projection', run.candidates],
    ['representative edit publication', run.edits],
  ] as const;
  if (snapshotMode || process.env.RUN_PLANNER_PERFORMANCE_ENFORCE_ABSOLUTE !== '1') return;
  for (const [operation, samples] of interactionSamples) {
    const durationMs = median(samples);
    expect(durationMs, `${label} ${operation} took ${durationMs.toFixed(1)} ms`).toBeLessThan(
      performanceProductTargetsMs.interaction,
    );
  }
  const durationMs = median(run.undos);
  expect(durationMs, `${label} cached undo took ${durationMs.toFixed(1)} ms`).toBeLessThan(
    performanceProductTargetsMs.cachedUndo,
  );
}

describe('unified biome performance', () => {
  it('keeps representative Underworld rebuild, candidate, edit, and cached undo work interactive', () => {
    underworld = runPerformanceRoute('underworld');
    expectRebuildResults(underworld, 'Underworld full rebuild');
    expectColdCandidateWork(
      underworld.candidates,
      'Underworld cold candidate projection',
      'underworld',
    );
    expectEditWork(underworld.edits, 'Underworld representative edit publication');
    expectCachedUndoWork(underworld.undos, 'Underworld cached undo publication');
    expectInteractiveDurations(underworld, 'Underworld');
  });

  it('keeps representative Surface rebuild, candidate, edit, and cached undo work interactive', () => {
    surface = runPerformanceRoute('surface');
    expectRebuildResults(surface, 'Surface full rebuild');
    expectColdCandidateWork(surface.candidates, 'Surface cold candidate projection', 'surface');
    expectEditWork(surface.edits, 'Surface representative edit publication');
    expectCachedUndoWork(surface.undos, 'Surface cached undo publication');
    expectInteractiveDurations(surface, 'Surface');
  });
});

afterAll(() => {
  if (!snapshotMode) return;
  if (underworld === undefined || surface === undefined) {
    throw new Error('performance snapshot did not collect both route witnesses');
  }
  const outputPath = process.env.RUN_PLANNER_PERFORMANCE_SNAPSHOT_OUTPUT;
  if (outputPath === undefined || outputPath.length === 0) {
    throw new Error('RUN_PLANNER_PERFORMANCE_SNAPSHOT_OUTPUT is required for snapshot mode');
  }
  writeRawPerformanceSnapshot(outputPath, createRawPerformanceSnapshot({ underworld, surface }));
});

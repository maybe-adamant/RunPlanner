import { afterAll, describe, expect, it, vi } from 'vitest';

import { fixture } from './support/run-import';
import {
  bucketCounts,
  introducedFamilies,
  measureRun,
  roomLines,
  summaryLines,
  type RunMeasurement,
} from './support/room-buckets';

vi.mock('@run-planner/engine/authoring', async (original) => {
  const engine = await original<typeof import('@run-planner/engine/authoring')>();
  const { timedAuthoring } = await import('./support/authoring-timing');
  return { ...engine, createAuthoringSession: timedAuthoring(engine.createAuthoringSession) };
});

/**
 * Each fixture's rooms and the bounds its buckets hold today: rooms the import
 * settles (exact or solved) only grow; rooms whose next entry save differs, and
 * rooms no save checks, only shrink. Tighten a bound when a change moves it.
 */
const BASELINE = {
  surface: { rooms: 29, settled: 15, mismatch: 0, differing: 0, unchecked: 2 },
  'surface-victory': { rooms: 51, settled: 30, mismatch: 0, differing: 0, unchecked: 2 },
  underworld: { rooms: 42, settled: 23, mismatch: 0, differing: 0, unchecked: 1 },
  'underworld-1010': { rooms: 30, settled: 17, mismatch: 0, differing: 0, unchecked: 1 },
  // A cleared Dream run (Q, P, O, H).
  dream: { rooms: 40, settled: 20, mismatch: 0, differing: 0, unchecked: 1 },
  // A fresh profile's first attempt.
  fresh: { rooms: 13, settled: 10, mismatch: 0, differing: 0, unchecked: 1 },
  // The live recording carries no entry saves.
  'underworld-live': { rooms: 42, settled: 0, mismatch: 0, differing: 0, unchecked: 42 },
} as const;

describe('import room buckets over the capture fixtures', () => {
  const measurements: RunMeasurement[] = [];

  afterAll(() => {
    const mode = process.env['RUN_IMPORT_MEASURE'];
    if (mode === undefined) return;
    const families = introducedFamilies(measurements)
      .map(([family, count]) => `${family} ${count}`)
      .join(', ');
    console.info(
      [
        ...summaryLines(measurements),
        `introduced families: ${families}`,
        ...(mode === 'rooms'
          ? measurements.flatMap((measurement) => [
              `=== ${measurement.name}`,
              ...roomLines(measurement),
            ])
          : []),
      ].join('\n'),
    );
  });

  it.each(Object.keys(BASELINE) as (keyof typeof BASELINE)[])(
    'buckets each room of %s at its next entry save',
    (name) => {
      const measurement = measureRun(name, fixture(name));
      measurements.push(measurement);
      const counts = bucketCounts(measurement.rows);
      const baseline = BASELINE[name];
      expect(measurement.rows.length).toBe(baseline.rooms);
      expect(counts.exact + counts.solved).toBeGreaterThanOrEqual(baseline.settled);
      expect(counts.mismatch).toBeLessThanOrEqual(baseline.mismatch);
      expect(counts.mismatch + counts.carried).toBeLessThanOrEqual(baseline.differing);
      expect(counts.unchecked).toBeLessThanOrEqual(baseline.unchecked);
    },
  );
});

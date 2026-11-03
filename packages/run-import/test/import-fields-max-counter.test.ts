import { describe, expect, it } from 'vitest';

import {
  exitDecisionForSource,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { catalog } from '@run-planner/hades2-catalog';
import { projectFromRunRecord } from '../src/import';
import type { RunRecord } from '../src/run-record';
import { entryLines, fixture } from './support/run-import';

/** Erebus through H's Preboss, each H entry save carrying the Fields Max counter. */
function withMaxCounter(counters: Readonly<Record<number, number>>): RunRecord {
  const record = fixture('underworld');
  return {
    ...record,
    route: { biomes: ['F', 'G', 'H'], dream: false },
    rooms: record.rooms
      .slice(0, 31)
      .map((room, index) =>
        counters[index] === undefined || room.entry === undefined
          ? room
          : { ...room, entry: { ...room.entry, fieldsMaxDoorsRolled: counters[index] } },
      ),
  };
}

function cageOutcome(project: ProjectDocument, occurrenceId: string) {
  const topology = project.route.biomes.find((biome) => biome.biomeKey === 'H')?.topology;
  const state = topology
    ? exitDecisionForSource(topology, {
        kind: 'occurrence',
        occurrenceId: occurrenceId as OccurrenceId,
      })?.normal
    : undefined;
  return state?.kind === 'batch' ? state.batchState?.cageOutcome : undefined;
}

describe('run import of Fields cage rolls by the Max counter', () => {
  // SelectFieldsDoorCageCount counts each Max roll, so the counter's gain across a
  // source room pins its roll even where its doors show no cage count.
  it("pins each source's roll from the counter, untaken doors included", () => {
    // H_Combat15 Max; H_MiniBoss01 Min (its doors to the Bridge and H_Combat14 show two
    // cages either way); the Bridge, whose doors both lead to H_Combat07, Max.
    const imported = projectFromRunRecord(
      catalog,
      withMaxCounter({ 25: 0, 26: 0, 27: 1, 28: 1, 29: 2, 30: 2 }),
    );
    expect(['H-r26', 'H-r27', 'H-r28'].map((id) => cageOutcome(imported.project, id))).toEqual([
      'max',
      'min',
      'max',
    ]);
    expect(entryLines(imported.report).filter((line) => line.includes('exitDecision@H'))).toEqual(
      [],
    );
  });

  it('leaves a roll the counter pins open when the plan cannot make it', () => {
    // A third Max, at the Bridge, passes H's ceiling of two: refused, not swapped for Min.
    const imported = projectFromRunRecord(
      catalog,
      withMaxCounter({ 25: 0, 26: 0, 27: 1, 28: 2, 29: 3, 30: 3 }),
    );
    expect(imported.kind === 'stopped' && imported.stop).toMatchObject({
      code: 'batchStateMissing',
      record: { roomIndex: 28 },
    });
  });
});

import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import type { RunRecord } from '../../../src/run-record';
import { projectFromRunRecord } from '../../../src/simulation';
import { fixture, occurrence } from '../../support/run-import';

describe('run import of Fig Leaf skip marks in the live Underworld recording', () => {
  /**
   * The live run through H; `skipped` marks the named phases as a record written
   * after the skip mark would.
   */
  function liveThroughH(skipped: readonly number[] = []): RunRecord {
    const record = fixture('underworld-live');
    return {
      ...record,
      route: { ...record.route, biomes: ['F', 'G', 'H'] },
      rooms: record.rooms.slice(0, 33).map((room, index) => ({
        ...room,
        ...(!skipped.includes(index)
          ? {}
          : {
              encounters: room.encounters.map((encounter) => ({
                ...encounter,
                skipped: true as const,
              })),
            }),
      })),
    };
  }

  it('imports a marked Fig Leaf skip exactly and infers none beside it', () => {
    const imported = projectFromRunRecord(catalog, liveThroughH([16]));
    expect(imported.kind).toBe('complete');
    expect(occurrence(imported.project, 'G-r16').encounters.figLeafSkipByPhase).toEqual({
      Encounter: true,
    });
    // A record that marks skips leaves H's unmarked zero-kill cage as played.
    expect(occurrence(imported.project, 'H-r26').encounters.figLeafSkipByPhase['Cage02']).toBe(
      false,
    );
    expect(imported.report.entries.filter((entry) => entry.area === 'encounter')).toEqual([]);
  });
});

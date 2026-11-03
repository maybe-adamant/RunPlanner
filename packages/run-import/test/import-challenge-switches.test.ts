import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { projectFromRunRecord } from '../src/import';
import type { RunRecord } from '../src/run-record';
import { describeEntry, fixture, occurrence } from './support/run-import';

describe('run import of a used challenge switch', () => {
  const FIELDS = 26;

  /** The Underworld capture with an Infernal Trove used in H_Combat15, its challenge dropping Nectar. */
  function withTrove(): RunRecord {
    const record = fixture('underworld');
    return {
      ...record,
      rooms: record.rooms.map((room, index) =>
        index === FIELDS
          ? {
              ...room,
              uses: {
                ...room.uses,
                TimeChallengeSwitch_Money: 1,
                GiftDrop: (room.uses['GiftDrop'] ?? 0) + 1,
              },
            }
          : room,
      ),
    };
  }

  it("leaves a used switch's pickups out of the uses its room must explain", () => {
    const base = projectFromRunRecord(catalog, fixture('underworld'));
    const imported = projectFromRunRecord(catalog, withTrove());
    const optionals = (project: typeof base.project) => {
      const state = occurrence(project, 'H-r26').state;
      return state.kind === 'fieldsCombat' ? state.optionalRewards : undefined;
    };
    // The Nectar is not an optional reward collected in combat.
    expect(optionals(imported.project)).toEqual(optionals(base.project));
    expect(imported.report.rooms![FIELDS]).toMatchObject({ verdict: 'accepted', introduced: [] });
    const roomLines = (report: typeof base.report) =>
      report.entries
        .filter((entry) => entry.record?.roomIndex === FIELDS)
        .map(describeEntry)
        .sort();
    expect(roomLines(imported.report)).toEqual(
      [...roomLines(base.report), 'unsupportedArea other r26 -'].sort(),
    );
  });
});

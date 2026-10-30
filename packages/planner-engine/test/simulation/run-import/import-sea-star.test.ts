import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import type { RunRecord } from '../../../src/run-record';
import { projectFromRunRecord } from '../../../src/simulation';
import { fixture, describeEntry, seaStarDuplicates } from '../../support/run-import';

describe('run import of Sea Star duplicates', () => {
  /** The Surface capture with Sea Star picked at O_MiniBoss01 and duplicates counted after it. */
  function surfaceWithSeaStar(): RunRecord {
    const record = fixture('surface');
    const rename = (name: string) =>
      name === 'EncounterStartOffenseBuffBoon' ? 'DoubleRewardBoon' : name;
    return {
      ...record,
      rooms: record.rooms.map((room, index) =>
        index === 23
          ? {
              ...room,
              traitScreens: room.traitScreens.map((screen) => ({
                ...screen,
                options: screen.options.map((option) => ({ ...option, name: rename(option.name) })),
              })),
              traits: {
                ...room.traits,
                acquired: room.traits.acquired.map((trait) => ({
                  ...trait,
                  name: rename(trait.name),
                })),
              },
            }
          : index === 24
            ? { ...room, doubleRewards: 1, uses: { ...room.uses, MaxManaDrop: 1 } }
            : index === 25
              ? { ...room, doubleRewards: 1 }
              : room,
      ),
    };
  }

  it('leaves a duplicate unplaced where no duplicable pickup takes a leftover use', () => {
    const imported = projectFromRunRecord(catalog, surfaceWithSeaStar());
    expect(imported.kind).toBe('complete');
    // O_Reprieve01's Magick reward shows a leftover use, but its Time Piece conversion leaves no
    // pickup Sea Star can duplicate; O_Combat05 used nothing more than the plan collects.
    expect(seaStarDuplicates(imported.project, 'O-r24')).toEqual([]);
    expect(
      imported.report.entries
        .filter((entry) => entry.area === 'reward' && (entry.record?.roomIndex ?? 0) >= 24)
        .map(describeEntry),
    ).toEqual([
      'notInRecord reward r24 occurrence@O-r24',
      'notInRecord reward r25 occurrence@O-r25',
    ]);
  });
});

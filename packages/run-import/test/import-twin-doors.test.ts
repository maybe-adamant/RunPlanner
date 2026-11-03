import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { projectFromRunRecord } from '../src/import';
import type { RunRecord, RunRecordRoom } from '../src/run-record';
import { fixture, occurrence, reward } from './support/run-import';

/** The record with one room rewritten. */
function withRoom(
  record: RunRecord,
  index: number,
  edit: (room: RunRecordRoom) => RunRecordRoom,
): RunRecord {
  return {
    ...record,
    rooms: record.rooms.map((room, at) => (at === index ? edit(room) : room)),
  };
}

const withoutReward = (room: RunRecordRoom): RunRecordRoom => {
  const { reward: _reward, ...rest } = room;
  void _reward;
  return rest;
};

/** The surface-victory capture's Q_Combat14 offers two Boon doors to Q_MiniBoss03. */
const SOURCE = 47;
const HERA_DOOR = 'Q-r47-d768716';

describe('run import of twin doors to one room', () => {
  it("takes the twin the next entry save accepts when the entered room's reward names no god", () => {
    // The MiniBoss's reward as a record without its loot keeps it: both Boon doors stay tied.
    const record = withRoom(fixture('surface-victory'), SOURCE + 1, (room) => ({
      ...room,
      reward: { type: 'Boon', store: room.reward!.store! },
    }));
    const imported = projectFromRunRecord(catalog, record);
    expect(reward(imported.project, 'Q-r48')?.offer.payload).toEqual({
      kind: 'BoonSource',
      source: 'HephaestusUpgrade',
    });
    expect(reward(imported.project, HERA_DOOR)?.offer.payload).toEqual({
      kind: 'BoonSource',
      source: 'HeraUpgrade',
    });
    expect(imported.report.rooms![SOURCE]).toMatchObject({ verdict: 'accepted' });
  });

  it('takes the first in native order of twins that leave one state, unreported', () => {
    // Doors with no reward to a room that holds none and no cages are interchangeable.
    let record = withRoom(fixture('surface-victory'), SOURCE, (room) => ({
      ...room,
      doors: room.doors.map((door) => {
        const { reward: _reward, ...rest } = door;
        void _reward;
        return rest;
      }),
    }));
    record = withRoom(record, SOURCE + 1, withoutReward);
    const imported = projectFromRunRecord(catalog, record);
    expect(occurrence(imported.project, 'Q-r48').gameName).toBe('Q_MiniBoss03');
    expect(
      imported.report.entries.filter(
        (entry) => entry.area === 'doors' && entry.record?.roomIndex === SOURCE,
      ),
    ).toEqual([]);
    expect(imported.kind === 'stopped' && imported.stop.record?.roomIndex).not.toBe(SOURCE);
  });

  it('leaves tied twins open when the next entry save accepts neither', () => {
    // The underworld capture's Bridge offers two reward-less doors to H_Combat07, whose cages
    // differ; a next entry save no draw order explains judges neither taken.
    const record = withRoom(fixture('underworld'), 29, (room) => ({
      ...room,
      entry: {
        ...room.entry!,
        rewardStores: {
          ...room.entry!.rewardStores,
          RunProgress: { ...room.entry!.rewardStores!['RunProgress'], Boon: 0 },
        },
      },
    }));
    const imported = projectFromRunRecord(catalog, record);
    expect(imported.kind === 'stopped' && imported.stop).toMatchObject({
      area: 'doors',
      record: { roomIndex: 28 },
    });
  });
});

import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { projectFromRunRecord, type RunImport } from '../../../src/simulation';
import { fixture, describeEntry } from '../../support/run-import';

describe('run import of unpicked ship-wheel offers the saved stores cannot settle', () => {
  const wheelLines = (imported: RunImport) =>
    imported.report.entries.filter((entry) => entry.area === 'wheel').map(describeEntry);

  it('reports each unpicked offer of a record without entry saves', () => {
    const record = fixture('surface');
    const imported = projectFromRunRecord(catalog, {
      ...record,
      rooms: record.rooms.map((room) => {
        const { entry: _entry, ...rest } = room;
        void _entry;
        return rest;
      }),
    });
    // Each takes the first type of its wheel's store the engine supports.
    expect(wheelLines(imported)).toEqual([
      'notInRecord wheel r21 rewardWheelOffer@O-r21 -> ReplaceRewardWheelOffer(O-r21 GiftDrop)',
      'notInRecord wheel r25 rewardWheelOffer@O-r25 -> ReplaceRewardWheelOffer(O-r25 MetaCurrencyBigDrop)',
      'notInRecord wheel r25 rewardWheelOffer@O-r25 -> ReplaceRewardWheelOffer(O-r25 MaxHealthDrop)',
    ]);
  });

  it('reports each unpicked offer of a ship that is the last room', () => {
    const record = fixture('surface');
    const rooms = record.rooms.slice(0, 26);
    const { exit: _exit, ...last } = rooms[25]!;
    void _exit;
    const imported = projectFromRunRecord(catalog, {
      ...record,
      outcome: { kind: 'abandoned', endingRoom: last.name },
      rooms: [...rooms.slice(0, 25), last],
    });
    expect(wheelLines(imported)).toEqual([
      'notInRecord wheel r25 rewardWheelOffer@O-r25 -> ReplaceRewardWheelOffer(O-r25 GiftDrop)',
      'notInRecord wheel r25 rewardWheelOffer@O-r25 -> ReplaceRewardWheelOffer(O-r25 MaxHealthDrop)',
    ]);
  });
});

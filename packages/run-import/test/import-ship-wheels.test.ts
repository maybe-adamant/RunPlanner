import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { projectFromRunRecord, type RunImport } from '../src/import';
import { fixture, describeEntry } from './support/run-import';

describe('run import of unpicked ship-wheel offers the saved stores cannot settle', () => {
  const wheelLines = (imported: RunImport) =>
    imported.report.entries.filter((entry) => entry.area === 'wheel').map(describeEntry);

  it('stops at the first ship of a record without entry saves, whose unpicked offers no save judges', () => {
    const record = fixture('surface');
    const imported = projectFromRunRecord(catalog, {
      ...record,
      rooms: record.rooms.map((room) => {
        const { entry: _entry, ...rest } = room;
        void _entry;
        return rest;
      }),
    });
    // The provisional offer cannot be withdrawn, so the plan stops at its ship.
    expect(imported).toMatchObject({
      kind: 'stopped',
      stop: { area: 'wheel', code: 'wheelOffersUnaccepted', record: { roomIndex: 21 } },
    });
    expect(wheelLines(imported)).toEqual([
      'notInRecord wheel r21 rewardWheelOffer@O-r21 -> ReplaceRewardWheelOffer(O-r21 GiftDrop)',
      'stopped wheel r21 occurrence@O-r21',
    ]);
  });

  it('reports each unpicked offer of a ship that is the last room, where the plan stops', () => {
    const record = fixture('surface');
    const rooms = record.rooms.slice(0, 26);
    const { exit: _exit, ...last } = rooms[25]!;
    void _exit;
    const imported = projectFromRunRecord(catalog, {
      ...record,
      outcome: { kind: 'abandoned', endingRoom: last.name },
      rooms: [...rooms.slice(0, 25), last],
    });
    // Its picked Spell asks a screen no save judges, so the plan stops in the ship itself.
    expect(imported).toMatchObject({ kind: 'stopped', stop: { record: { roomIndex: 25 } } });
    expect(wheelLines(imported)).toEqual([
      'notInRecord wheel r25 rewardWheelOffer@O-r25 -> ReplaceRewardWheelOffer(O-r25 GiftDrop)',
      'notInRecord wheel r25 rewardWheelOffer@O-r25 -> ReplaceRewardWheelOffer(O-r25 MaxHealthDrop)',
    ]);
  });
});

import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import type { RunRecord } from '../src/run-record';
import { projectFromRunRecord } from '../src/import';
import { fixture, occurrence } from './support/run-import';

/** The trait-dropped pickups an occurrence collects, by entry key. */
function collectedDrops(record: RunRecord, occurrenceId: string): readonly string[] {
  const imported = projectFromRunRecord(catalog, record);
  expect(imported.kind).toBe('complete');
  return occurrence(imported.project, occurrenceId).roomActions.order.flatMap((action) =>
    action.kind === 'interactAcquisitionEntry' && action.siteKey.startsWith('traitGenerated:')
      ? [action.entryKey]
      : [],
  );
}

describe('run import of trait-dropped pickups', () => {
  it("puts back the last of Buried Treasure's drops past Q_PreBoss01's recorded uses", () => {
    const record = fixture('surface-victory');
    const fewerUses: RunRecord = {
      ...record,
      rooms: record.rooms.map((room, index) => {
        if (index !== 49) return room;
        const uses = Object.fromEntries(
          Object.entries(room.uses).filter(([name]) => name !== 'MetaCurrencyDrop'),
        );
        return { ...room, uses: { ...uses, HealDropMinor: 1 } };
      }),
    };
    expect(collectedDrops(fewerUses, 'Q-r49')).toEqual([
      'smallGold',
      'tinyGold1',
      'tinyGold2',
      'minorHeal1',
    ]);
  });
});

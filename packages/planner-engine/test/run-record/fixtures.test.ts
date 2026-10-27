import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { decodeRunRecord, type RunRecord } from '@run-planner/engine/run-record';

function fixture(name: string): RunRecord {
  return decodeRunRecord(
    JSON.parse(
      readFileSync(new URL(`./fixtures/${name}.run-record.json`, import.meta.url), 'utf8'),
    ),
  );
}

/** Spot facts of the two unmodded capture records, checked against the save audit. */
describe('run record capture fixtures', () => {
  it('records the Surface run', () => {
    const record = fixture('surface');
    expect(record.rooms).toHaveLength(29);
    expect(record.outcome).toEqual({
      kind: 'death',
      endingRoom: 'O_Boss02',
      runResult: 4,
      killedBy: 'BiomeTimer',
    });
    const room = (index: number) => record.rooms[index]!;
    // Re-entering N_Combat02 from its side room collects nothing and fights nothing.
    expect(room(5)).toMatchObject({ name: 'N_Combat02', encounters: [] });
    expect(room(5).reward).toBeUndefined();
    expect(room(19)).toMatchObject({
      name: 'N_PostBoss01',
      store: {
        kind: 'hermesShrine',
        purchases: [{ slot: 3, delivery: 'rushed' }],
        purchaseCount: 2,
      },
      keepsakeSwap: { from: 'HadesAndPersephoneKeepsake', to: 'GoldifyKeepsake' },
    });
    expect(room(21).traits.upgraded).toEqual([
      {
        name: 'AphroditeCastBoon',
        from: { rarity: 'Rare', level: 4 },
        to: { rarity: 'Rare', level: 5 },
        worldTime: 565.27367708576,
      },
    ]);
    expect(room(24)).toMatchObject({
      name: 'O_Reprieve01',
      store: {
        kind: 'hermesShrine',
        purchases: [
          { slot: 1, delivery: 'delayed', delay: 8 },
          { slot: 3, delivery: 'rushed' },
        ],
        purchaseCount: 3,
      },
      conversions: { timePiece: 1 },
    });
    expect(room(25)).toMatchObject({
      name: 'O_Combat05',
      wheels: [
        {
          store: 'MetaProgress',
          picked: { type: 'MetaCardPointsCommonBigDrop' },
          offers: 2,
          side: 'left',
          unpicked: { type: 'GiftDrop' },
        },
        {
          store: 'RunProgress',
          picked: { type: 'SpellDrop' },
          offers: 2,
          side: 'left',
          unpicked: { type: 'MaxManaDrop' },
        },
      ],
      conversions: { artificer: 1, timePiece: 1 },
    });
  });

  it('records the Underworld victory', () => {
    const record = fixture('underworld');
    expect(record.rooms).toHaveLength(42);
    expect(record.outcome).toEqual({ kind: 'victory', endingRoom: 'I_Boss01', runResult: 1 });
    const room = (index: number) => record.rooms[index]!;
    expect(room(13)).toMatchObject({
      name: 'F_PostBoss01',
      reward: { store: 'MetaProgress' },
      store: { kind: 'well', purchases: [{ slot: 3 }] },
      pool: { soldSlots: [1], sales: 1 },
      keepsakeSwap: { from: 'HadesAndPersephoneKeepsake', to: 'RandomBlessingKeepsake' },
    });
    expect(room(13).traits.removed).toEqual(['WetState', 'BoonDecayBoon']);
    const fields = room(29).fields!;
    expect(room(29).name).toBe('H_Combat07');
    expect(fields.cageOrder).toBe('opening');
    expect(fields.entryPoint).toBe(755826);
    expect(fields.cages.map((cage) => cage.reward)).toEqual([
      { type: 'MaxHealthDrop' },
      { type: 'Boon', lootName: 'ZeusUpgrade' },
      { type: 'Boon', lootName: 'HeraUpgrade' },
    ]);
    // Every optional reward was picked up before the room's combat ended.
    expect(fields.optionalRewards).toEqual([]);
    expect(room(32).store).toMatchObject({
      purchases: [{ slot: 3 }],
      unstockedPurchases: ['TemporaryMoveSpeedTrait'],
    });
    expect(record.route.maxClockworkNonGoalRewards).toBe(5);
    // Each gathering tool's element, in the room that granted it.
    expect(
      record.rooms.flatMap((entry, index) =>
        (entry.toolElements ?? []).map((tool) => `${index}:${tool}`),
      ),
    ).toEqual(['0:ToolShovel2', '1:ToolPickaxe2', '26:ToolFishingRod2', '36:ToolExorcismBook2']);
  });
});

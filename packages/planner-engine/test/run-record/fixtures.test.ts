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

/** Spot facts of the unmodded capture records, checked against the save audit. */
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

  it('records the Underworld attempt reset at H_Combat04', () => {
    const record = fixture('underworld-1010');
    expect(record.rooms).toHaveLength(30);
    expect(record.outcome).toEqual({ kind: 'abandoned', endingRoom: 'H_Combat04' });
    const room = (index: number) => record.rooms[index]!;
    // Judgment's five cards, then the Crystal Figurine's two, as their traits joined.
    expect(room(12)).toMatchObject({
      name: 'F_Boss01',
      grantedArcana: [
        'BonusHealth',
        'DoorReroll',
        'TradeOff',
        'StatusVulnerability',
        'ScreenReroll',
        'StartingGold',
        'EpicRarityBoost',
      ],
    });
    expect(room(23)).toMatchObject({
      name: 'G_Boss01',
      grantedArcana: [
        'BonusDodge',
        'ManaOverTime',
        'RarityBoost',
        'LowManaDamageBonus',
        'LowHealthBonus',
      ],
    });
    // The game was relaunched in G_Combat05, restarting the world clock.
    expect(room(16).traits.upgraded).toEqual([
      {
        name: 'ZeusCastBoon',
        from: { rarity: 'Rare' },
        to: { rarity: 'Rare', level: 2 },
        worldTime: 21.0754178036,
      },
    ]);
    // G_MiniBoss02 and G_PreBoss01 rerolled a boon screen; no door was rerolled.
    expect(record.rooms.filter((entry) => entry.rerolls !== undefined)).toEqual([]);
    expect(
      record.rooms.flatMap((entry, index) =>
        entry.spentRerolls === undefined ? [] : [[index, entry.spentRerolls]],
      ),
    ).toEqual([
      [18, { '2000591': 1 }],
      [22, { '2000031': 1 }],
    ]);
    // The reroll cards drawn at the F Boss grant ten rerolls; each screen reroll spends one.
    expect(record.rooms.map((entry) => entry.entry?.numRerolls ?? 0).slice(12, 24)).toEqual([
      0, 10, 10, 10, 10, 10, 10, 9, 9, 9, 9, 8,
    ]);
  });

  it('records the Surface victory', () => {
    const record = fixture('surface-victory');
    expect(record.rooms).toHaveLength(51);
    expect(record.outcome).toEqual({ kind: 'victory', endingRoom: 'Q_Boss01', runResult: 3 });
    const room = (index: number) => record.rooms[index]!;
    // Aspect of Selene's Nacelle tree numbers its third row's first slot 0.
    expect(record.rooms.find((entry) => entry.spell !== undefined)?.spell).toMatchObject({
      layout: 'Nacelle',
      talents: { '3:0': { name: 'MoonBeamDamageTalent', invested: false } },
    });
    // The Phial's fountain raised Apollo's sprint boon in the Hub.
    expect(room(6)).toMatchObject({
      name: 'N_Hub',
      uses: { HealthFountainN: 1 },
      traits: {
        upgraded: [
          { name: 'ApolloSprintBoon', from: { rarity: 'Common' }, to: { rarity: 'Heroic' } },
        ],
      },
    });
    // P_PostBoss01: the first rush restocked its slot under Travel Deal; that refill was delayed.
    expect(room(41).store).toMatchObject({
      kind: 'hermesShrine',
      purchases: [
        { slot: 1, delivery: 'delayed', delay: 3 },
        { slot: 2, delivery: 'rushed' },
        { slot: 3, delivery: 'rushed' },
      ],
      purchaseCount: 6,
      refill: {
        option: { slot: 2, name: 'MaxManaDrop' },
        purchase: { slot: 2, delivery: 'delayed', delay: 3 },
      },
    });
    expect(
      record.rooms.flatMap((entry, index) =>
        entry.doubleRewards === undefined ? [] : [`${index}:${entry.doubleRewards}`],
      ),
    ).toEqual(['23:1', '31:1', '37:1', '38:1', '49:2']);
    expect(
      record.rooms.flatMap((entry, index) => (entry.olympusEagleSpawn ? [index] : [])),
    ).toEqual([38]);
  });
});

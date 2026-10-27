import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { LuaTable } from '@planner/workspace/run-recording/luabins';
import { buildRunRecord } from '@planner/workspace/run-recording/runRecordBuilder';
import { extractSaveCheckpoint } from '@planner/workspace/run-recording/saveCheckpoint';
import type { DecodedSave } from '@planner/workspace/run-recording/saveFile';

interface Sample {
  readonly header: {
    timestamp: number;
    location: string;
    runs: number;
    shrine: number;
    mapName: string;
    nextMap: string;
  };
  readonly globals: LuaTable;
}

/** Trimmed decoded `_Temp` saves of two unmodded captures. */
function sample(name: string): DecodedSave {
  const raw = JSON.parse(
    readFileSync(new URL(`./samples/${name}.json`, import.meta.url), 'utf8'),
  ) as Sample;
  return {
    header: {
      version: 0x00010012,
      flags: 0,
      timestamp: raw.header.timestamp,
      location: raw.header.location,
      runCount: raw.header.runs,
      fear: raw.header.shrine,
      displayNames: [],
      mapName: raw.header.mapName,
      nextMap: raw.header.nextMap,
    },
    globals: raw.globals,
  };
}

describe('save checkpoint extraction', () => {
  it('reduces an entry save to its departure record, counters and build', () => {
    const checkpoint = extractSaveCheckpoint(sample('underworld-062'), true);
    expect(checkpoint).toMatchObject({
      kind: 'entry',
      runCount: 1003,
      mapName: 'F_PostBoss01',
      nextMap: 'G_Intro',
      worldTime: 363.1030826038914,
      currentRoom: { name: 'G_Intro', wellShop: true, encounter: { name: 'Empty' } },
      run: {
        metaConversionUses: 3,
        traitsSold: 1,
        wellShopPurchases: {
          TemporaryForcedSecretDoorTrait: 1,
          TemporaryMoveSpeedTrait: 2,
          TemporaryEmptySlotDamageTrait: 1,
        },
      },
    });
    expect(checkpoint.history).toHaveLength(14);
    expect(checkpoint.departure).toMatchObject({
      name: 'F_PostBoss01',
      timesVisited: 1,
      useRecord: { WellShop: 2, GiftRack: 1, SellTraitShop: 1 },
      // The sold first slot leaves a gap in the saved sell options.
      sellOptions: [
        { slot: 2, name: 'AphroditeManaBoon', rarity: 'Common', value: 100 },
        { slot: 3, name: 'AresCastBoon', rarity: 'Epic', value: 230 },
      ],
      store: [
        { slot: 1, name: 'TemporaryDoorHealTrait', type: 'Trait' },
        { slot: 2, name: 'TemporaryEmptySlotDamageTrait', type: 'Trait' },
      ],
    });
    expect(checkpoint.run.lootChoices[1]).toEqual({
      giver: 'TrialUpgrade',
      depth: 1,
      options: [
        { name: 'ChaosExSpeedBlessing', rarity: 'Epic', chosen: true },
        { name: 'ChaosHarvestBlessing', rarity: 'Rare', chosen: false },
        { name: 'ChaosDoorHealBlessing', rarity: 'Common', chosen: false },
      ],
    });
    expect(checkpoint.hero?.slotted.Keepsake).toBe('RandomBlessingKeepsake');
  });

  it('marks a save without a next map as the PostReward checkpoint', () => {
    const checkpoint = extractSaveCheckpoint(sample('surface-004'), true);
    expect(checkpoint.kind).toBe('postReward');
    expect(checkpoint.currentRoom.encounter?.waves[0]?.spawns).toEqual([
      {
        name: 'ZombieSpawner',
        totalCount: 2,
        generated: true,
        requiredMiniBossShrine: false,
        infiniteSpawns: false,
      },
      {
        name: 'Carrion',
        totalCount: 2,
        generated: true,
        requiredMiniBossShrine: false,
        infiniteSpawns: false,
      },
    ]);
    expect(extractSaveCheckpoint(sample('surface-004'), false).kind).toBe('hub');
  });

  it("reads a Fig Leaf skip from the started encounter's SpawnsSkipped", () => {
    const save = sample('surface-004');
    expect(extractSaveCheckpoint(save, true).currentRoom.encounter?.spawnsSkipped).toBe(false);
    const run = save.globals.CurrentRun as LuaTable;
    const room = run.CurrentRoom as LuaTable;
    const skipped: DecodedSave = {
      ...save,
      globals: {
        ...save.globals,
        CurrentRun: {
          ...run,
          CurrentRoom: {
            ...room,
            Encounter: { ...(room.Encounter as LuaTable), SpawnsSkipped: true },
          },
        },
      },
    };
    expect(extractSaveCheckpoint(skipped, true).currentRoom.encounter?.spawnsSkipped).toBe(true);
  });

  it('folds the first checkpoints of a run into an abandoned record', () => {
    const checkpoints = ['002', '004', '006', '009', '011'].map((id) =>
      extractSaveCheckpoint(sample(`surface-${id}`), true),
    );
    const record = buildRunRecord(checkpoints);
    expect(record.run).toEqual({ runCount: 1002, startedAt: 1_793_057_328 });
    expect(record.outcome).toEqual({ kind: 'abandoned', endingRoom: 'N_Hub' });
    expect(record.route).toEqual({ biomes: ['N'], dream: false });
    expect(record.loadout).toMatchObject({
      weapon: 'WeaponStaffSwing',
      aspect: { name: 'StaffClearCastAspect', rarity: 'Legendary' },
      familiar: { name: 'PolecatFamiliar', trait: 'DodgeFamiliar', level: 4 },
      keepsake: { name: 'HadesAndPersephoneKeepsake', rarity: 'Epic' },
      startingGold: 300,
    });
    expect(record.loadout.vows.ShopPricesShrineUpgrade).toBe(2);
    expect(record.rooms.map((room) => [room.name, room.exit])).toEqual([
      ['N_Opening01', 'N_PreHub01'],
      ['N_PreHub01', 'N_Hub'],
      ['N_Hub', undefined],
    ]);
    const [opening, preHub] = record.rooms;
    expect(opening).toMatchObject({
      forfeitSkips: 1,
      uses: { RoomRewardConsolationPrize: 1 },
      doors: [{ room: 'N_PreHub01', reward: { type: 'Boon', lootName: 'AphroditeUpgrade' } }],
    });
    expect(preHub).toMatchObject({
      encounters: [
        {
          name: 'PreHubGeneratedN',
          waves: [
            {
              spawns: [
                { enemy: 'Carrion', count: 10, generated: true },
                { enemy: 'Mudman', count: 2, generated: true },
              ],
            },
          ],
        },
      ],
      // Menace converted part of the rolled roster into next-biome enemies.
      kills: { Carrion: 6, Mudman: 1, Scimiterror: 4, Stickler: 1 },
      traitScreens: [
        {
          giver: 'AphroditeUpgrade',
          options: [
            { name: 'AphroditeSpecialBoon', rarity: 'Rare', chosen: true },
            { name: 'AphroditeSprintBoon', rarity: 'Common', chosen: false },
            { name: 'AphroditeManaBoon', rarity: 'Common', chosen: false },
          ],
        },
      ],
      traits: {
        acquired: [
          { name: 'AphroditeSpecialBoon', rarity: 'Rare', level: 4, worldTime: 66.139543229016 },
        ],
        removed: [],
      },
    });
  });
});

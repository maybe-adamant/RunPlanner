import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { LuaTable } from '@planner/workspace/run-recording/luabins';
import { buildRunRecord } from '@planner/workspace/run-recording/runRecordBuilder';
import { extractSaveCheckpoint } from '@planner/workspace/run-recording/saveCheckpoint';
import type { DecodedSave } from '@planner/workspace/run-recording/saveFile';

const NO_SAVED_VALUES = new Map<string, readonly string[]>();

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
    const checkpoint = extractSaveCheckpoint(sample('underworld-062'), true, NO_SAVED_VALUES);
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
    const checkpoint = extractSaveCheckpoint(sample('surface-004'), true, NO_SAVED_VALUES);
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
    expect(extractSaveCheckpoint(sample('surface-004'), false, NO_SAVED_VALUES).kind).toBe('hub');
  });

  it("reads a Fig Leaf skip from the started encounter's SpawnsSkipped", () => {
    const save = sample('surface-004');
    expect(
      extractSaveCheckpoint(save, true, NO_SAVED_VALUES).currentRoom.encounter?.spawnsSkipped,
    ).toBe(false);
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
    expect(
      extractSaveCheckpoint(skipped, true, NO_SAVED_VALUES).currentRoom.encounter?.spawnsSkipped,
    ).toBe(true);
  });

  it("keeps the numbers at each trait name's given paths, Lua array keys included", () => {
    const save = sample('underworld-062');
    const run = save.globals.CurrentRun as LuaTable;
    const hero = run.Hero as LuaTable;
    const curse: LuaTable = {
      Name: 'ChaosDashCurse',
      Id: '4016382.919750304080.80000641569495',
      RemainingUses: 5,
      OnWeaponFiredFunctions: {
        FunctionArgs: { Cost: 19, ReportValues: { ReportedDrain: 'Cost' } },
      },
      OnExpire: {
        TraitData: {
          Name: 'ChaosExSpeedBlessing',
          PropertyChanges: [{ ChangeValue: 0.77 }, { ChangeValue: 0.7 }],
          WeaponSpeedMultiplier: { Value: 0.72 },
        },
      },
    };
    const withCurse: DecodedSave = {
      ...save,
      globals: {
        ...save.globals,
        CurrentRun: { ...run, Hero: { ...hero, Traits: [...(hero.Traits as LuaTable[]), curse] } },
      },
    };
    const paths = new Map([
      [
        'ChaosDashCurse',
        [
          'OnWeaponFiredFunctions.FunctionArgs.Cost',
          'OnExpire.TraitData.PropertyChanges.1.ChangeValue',
          'OnExpire.TraitData.WeaponSpeedMultiplier.Value',
          'OnExpire.TraitData.MoneyMultiplier',
          'OnWeaponFiredFunctions.FunctionArgs.ReportValues.ReportedDrain',
        ],
      ],
      ['ChaosManaCostBlessing', ['ManaCostModifiers.ManaCostMultiplier']],
    ]);
    const traits = extractSaveCheckpoint(withCurse, true, paths).hero!.traits;
    expect(traits.find((trait) => trait.name === 'ChaosDashCurse')?.savedValues).toEqual({
      'OnWeaponFiredFunctions.FunctionArgs.Cost': 19,
      'OnExpire.TraitData.PropertyChanges.1.ChangeValue': 0.77,
      'OnExpire.TraitData.WeaponSpeedMultiplier.Value': 0.72,
    });
    // The trimmed sample keeps no values; an unnamed trait keeps nothing.
    expect(traits.some((trait) => 'savedValues' in trait && trait.name !== 'ChaosDashCurse')).toBe(
      false,
    );
  });

  it("reads the hero's element counts, leaving out zeros", () => {
    const save = sample('underworld-062');
    const run = save.globals.CurrentRun as LuaTable;
    const withElements: DecodedSave = {
      ...save,
      globals: {
        ...save.globals,
        CurrentRun: {
          ...run,
          Hero: { ...(run.Hero as LuaTable), Elements: { Earth: 6, Fire: 3, Aether: 0 } },
        },
      },
    };
    expect(extractSaveCheckpoint(withElements, true, NO_SAVED_VALUES).hero?.elements).toEqual({
      Earth: 6,
      Fire: 3,
    });
  });

  it("reads a Rarify source's charges from its nested data, not the keepsake's own uses", () => {
    const save = sample('underworld-062');
    const run = save.globals.CurrentRun as LuaTable;
    const hero = run.Hero as LuaTable;
    const conch = {
      Name: 'ForcePoseidonBoonKeepsake',
      Rarity: 'Epic',
      Uses: -1,
      RarityUpgradeData: { Uses: 1, LootName: 'PoseidonUpgrade', MaxRarity: 3 },
    };
    const withConch: DecodedSave = {
      ...save,
      globals: {
        ...save.globals,
        CurrentRun: { ...run, Hero: { ...hero, Traits: [conch] } },
      },
    };
    expect(extractSaveCheckpoint(withConch, true, NO_SAVED_VALUES).hero?.traits).toEqual([
      { name: 'ForcePoseidonBoonKeepsake', rarity: 'Epic', rarityUpgradeUses: 1 },
    ]);
  });

  it("keeps a Hex tree's slot 0, which Nacelle's third row holds", () => {
    const save = sample('underworld-062');
    const run = save.globals.CurrentRun as LuaTable;
    const talent = (name: string) => ({ Name: name, Invested: true });
    const withTree: DecodedSave = {
      ...save,
      globals: {
        ...save.globals,
        CurrentRun: {
          ...run,
          Hero: {
            ...(run.Hero as LuaTable),
            SlottedSpell: {
              Name: 'MoonBeam',
              Talents: {
                Name: 'Nacelle',
                1: { 2: talent('MoonBeamDamageTalent') },
                3: { 0: talent('MoonBeamDamageTalent'), 1: talent('MoonBeamVulnerabilityTalent') },
              },
            },
          },
        },
      },
    };
    expect(
      Object.keys(
        extractSaveCheckpoint(withTree, true, NO_SAVED_VALUES).hero?.spell?.talents ?? {},
      ),
    ).toEqual(['1:2', '3:0', '3:1']);
  });

  it('folds the first checkpoints of a run into an abandoned record', () => {
    const checkpoints = ['002', '004', '006', '009', '011'].map((id) =>
      extractSaveCheckpoint(sample(`surface-${id}`), true, NO_SAVED_VALUES),
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

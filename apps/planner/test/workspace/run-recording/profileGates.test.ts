import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';

import { sampleSaveBytes } from '@planner-test/support/syntheticSave';
import type { LuaTable } from '@planner/workspace/run-recording/luabins';
import { unmetProfileGates } from '@planner/workspace/run-recording/profileGates';
import { extractSaveCheckpoint } from '@planner/workspace/run-recording/saveCheckpoint';
import { decodeSaveFile } from '@planner/workspace/run-recording/saveFile';

const ARCANA = catalog.arcanaCards.values.map((card) => card.key);

/** A sample save's checkpoint, its `GameState` or `CurrentRun.Hero` edited. */
function checkpoint(
  name: string,
  edit: { gameState?: (state: LuaTable) => LuaTable; hero?: (hero: LuaTable) => LuaTable } = {},
  runCount?: number,
) {
  const bytes = sampleSaveBytes(name, runCount === undefined ? {} : { runCount }, (globals) => {
    const run = globals['CurrentRun'] as LuaTable;
    return {
      ...globals,
      GameState: (edit.gameState ?? ((state) => state))(globals['GameState'] as LuaTable),
      CurrentRun: { ...run, Hero: (edit.hero ?? ((hero) => hero))(run['Hero'] as LuaTable) },
    };
  });
  return extractSaveCheckpoint(decodeSaveFile(bytes), true, new Map());
}

/** The sample Hub start of a mature profile, then one room, each optionally edited. */
function run(
  edit: Parameters<typeof checkpoint>[1] = {},
  room: Parameters<typeof checkpoint>[1] = {},
) {
  return {
    runCount: 1002,
    checkpoints: [checkpoint('surface-002', edit), checkpoint('surface-004', room)],
  };
}

const table = (state: LuaTable, key: string) => state[key] as LuaTable;

describe('profile gates', () => {
  it('passes a mature profile, read at the run start', () => {
    expect(unmetProfileGates(run(), ARCANA)).toEqual([]);
  });

  it.each([
    ['trueEnding', (state: LuaTable): LuaTable => ({ ...state, ReachedTrueEnding: false })],
    [
      'arcanaRanks',
      (state: LuaTable): LuaTable => ({
        ...state,
        MetaUpgradeState: {
          ...table(state, 'MetaUpgradeState'),
          ChanneledCast: { Equipped: true, Level: 2, Unlocked: true },
        },
      }),
    ],
    [
      'aspectRank',
      (state: LuaTable): LuaTable => {
        const { StaffClearCastAspect5: _rank, ...weapons } = table(state, 'WeaponsUnlocked');
        void _rank;
        return { ...state, WeaponsUnlocked: weapons };
      },
    ],
    [
      'keepsakeRanks',
      (state: LuaTable): LuaTable => ({
        ...state,
        KeepsakeChambers: { HadesAndPersephoneKeepsake: 74 },
      }),
    ],
    [
      'familiarRank',
      (state: LuaTable): LuaTable => {
        const { PolecatDamage3: _level, ...upgrades } = table(state, 'FamiliarUpgrades');
        void _level;
        return { ...state, FamiliarUpgrades: upgrades };
      },
    ],
    ['autoHarvestOnExit', (state: LuaTable): LuaTable => ({ ...state, WorldUpgrades: {} })],
  ] as const)('fails %s alone', (gate, gameState) => {
    expect(unmetProfileGates(run({ gameState }), ARCANA)).toEqual([gate]);
  });

  it('judges every keepsake the run equips, a rack swap included', () => {
    const swapped = run(
      {},
      {
        hero: (hero) => ({
          ...hero,
          SlottedTraits: { ...table(hero, 'SlottedTraits'), Keepsake: 'BlockDeathKeepsake' },
        }),
      },
    );
    expect(unmetProfileGates(swapped, ARCANA)).toEqual(['keepsakeRanks']);
  });

  it("reads stored ranks at the run's start, never a later save's", () => {
    // A later save of the run reaching the threshold does not count; its progression is not kept.
    const later = run(
      {
        gameState: (state) => ({ ...state, KeepsakeChambers: { HadesAndPersephoneKeepsake: 74 } }),
      },
      {
        gameState: (state) => ({ ...state, KeepsakeChambers: { HadesAndPersephoneKeepsake: 75 } }),
      },
    );
    expect(later.checkpoints[1]!.profile.progression).toBeUndefined();
    expect(unmetProfileGates(later, ARCANA)).toEqual(['keepsakeRanks']);
  });

  it("exempts a new profile's first attempt, which the Fresh File route describes", () => {
    const fresh = checkpoint('surface-002', { gameState: () => ({}) }, 0);
    expect(fresh.profile.progression?.reachedTrueEnding).toBe(false);
    expect(unmetProfileGates({ runCount: 0, checkpoints: [fresh] }, ARCANA)).toEqual([]);
    // The same profile past its first attempt fails every gate but the familiar's: none is equipped.
    expect(unmetProfileGates({ runCount: 1, checkpoints: [fresh] }, ARCANA)).toEqual([
      'trueEnding',
      'arcanaRanks',
      'aspectRank',
      'keepsakeRanks',
      'autoHarvestOnExit',
    ]);
  });
});

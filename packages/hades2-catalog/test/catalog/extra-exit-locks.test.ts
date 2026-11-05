import { describe, expect, it } from 'vitest';

import { catalog, createCatalog } from '@run-planner/hades2-catalog';

import { declarations } from '../../src/declarations';

const locks = catalog.extraExitLocks;

function withLocks(edit: (raw: Record<string, unknown>) => void) {
  const raw = JSON.parse(JSON.stringify(declarations.extraExitLocks)) as Record<string, unknown>;
  edit(raw);
  return () => createCatalog({ ...declarations, extraExitLocks: raw as never });
}

describe('locked extra exit declarations', () => {
  it('hosts the twenty ordinary G combats at their own LockExtraExitsChance', () => {
    expect(locks.hosts.values.map((host) => host.gameName)).toEqual(
      Array.from({ length: 20 }, (_, index) => `G_Combat${String(index + 1).padStart(2, '0')}`),
    );
    const chances = Object.fromEntries(
      locks.hosts.values.map((host) => [host.gameName, host.chance]),
    );
    expect(chances).toMatchObject({
      G_Combat01: 0.1,
      G_Combat02: 0.35,
      G_Combat03: 0.35,
      G_Combat05: 0.8,
      G_Combat09: 0.35,
      G_Combat20: 0.1,
    });
    // No other G room, Shop, miniboss, Story or Preboss can lock its exits.
    for (const gameName of ['G_Intro', 'G_Shop01', 'G_MiniBoss01', 'G_Story01', 'G_PreBoss01'])
      expect(locks.hosts.byKey[gameName]).toBeUndefined();
  });

  it('never locks the first door and locks each later one at the door chance', () => {
    const twoDoors = locks.hosts.byKey.G_Combat01!;
    const threeDoors = locks.hosts.byKey.G_Combat02!;
    expect(catalog.rooms.byKey.G_Combat01?.exits).toHaveLength(2);
    expect(twoDoors.lockableExits).toEqual([{ index: 2, chance: 0.8 }]);
    expect(threeDoors.lockableExits).toEqual([
      { index: 2, chance: 0.8 },
      { index: 3, chance: 0.8 },
    ]);
    expect(new Set(locks.hosts.values.map((host) => host.encounterKey))).toEqual(
      new Set(['GeneratedG_ExtraDoor']),
    );
  });

  it('declares the reward-free one-wave fight outside every encounter set', () => {
    const fight = catalog.encounterDefinitions.byKey.GeneratedG_ExtraDoor!;
    expect(fight).toMatchObject({
      kind: 'combat',
      countsEncounterDepth: true,
      canEncounterSkip: false,
      blocksGorgon: true,
      hostsGorgon: false,
      advancesHermesShrineDeliveryUses: false,
      moneyStore: { capMin: 15, capMax: 25, runDepthRamp: 0 },
    });
    const selection = fight.customization?.[0]?.selection;
    expect(selection?.kind).toBe('generated');
    if (selection?.kind !== 'generated') return;
    expect(selection.waveCount).toEqual({ min: 1, max: 1 });
    expect(selection.types).toMatchObject({ min: 1, max: 2, cap: 3, depthRamp: 0.1 });
    expect(selection.types.hardCap).toBeUndefined();
    expect(selection.maxEliteTypes).toBe(2);
    expect(selection.budget).toMatchObject({
      base: 38,
      depthRamp: 12,
      depthAxis: 'biomeDepthCache',
    });
    // EnemySets.lua BiomeGLockedDoor: no Sea-Serpent or Sop-Spindle.
    expect([...new Set(selection.choices.map((choice) => choice.key))].sort()).toEqual(
      [
        'FishSwarmerSquad',
        'FishSwarmerSquad_Elite',
        'FishmanMelee',
        'FishmanMelee_Elite',
        'FishmanRanged',
        'FishmanRanged_Elite',
        'Guard2',
        'Guard2_Elite',
        'Turtle',
        'Turtle_Elite',
      ].sort(),
    );
    expect(
      catalog.encounterSets.values.some((set) =>
        set.encounterDefinitionKeys.includes('GeneratedG_ExtraDoor'),
      ),
    ).toBe(false);
  });

  it('rejects a host without an extra exit, a foreign door or a counted-out fight', () => {
    expect(
      withLocks((raw) => {
        raw.hosts = [{ gameName: 'G_Story01', chance: 0.1 }];
      }),
    ).toThrow(/no extra exit/);
    expect(
      withLocks((raw) => {
        raw.hosts = [{ gameName: 'F_Combat02', chance: 0.1 }];
      }),
    ).toThrow(/is not a OceanusExitDoor/);
    expect(
      withLocks((raw) => {
        raw.encounterKey = 'GeneratedG';
      }),
    ).toThrow(/also a room encounter/);
    expect(
      withLocks((raw) => {
        raw.doorLockChance = 0;
      }),
    ).toThrow(/must be a chance/);
  });
});

import { describe, expect, it } from 'vitest';

import { catalog, createCatalog } from '@run-planner/hades2-catalog';

import { declarations } from '../../src/declarations';

const switches = catalog.challengeSwitches;

function withSwitches(edit: (raw: Record<string, unknown>) => void) {
  const raw = JSON.parse(JSON.stringify(declarations.challengeSwitches)) as Record<string, unknown>;
  edit(raw);
  return () => createCatalog({ ...declarations, challengeSwitches: raw as never });
}

describe('challenge switch declarations', () => {
  it('normalizes the three kinds, five variants and their source weights', () => {
    expect(switches.kinds.values.map((kind) => kind.key)).toEqual([
      'time',
      'perfectClear',
      'elite',
    ]);
    expect(
      switches.variants.values.map((variant) => [
        variant.key,
        variant.switchKind,
        variant.weight,
        variant.rewardType,
        variant.requirement !== undefined,
      ]),
    ).toEqual([
      ['TimeChallengeSwitch_Money', 'time', 4, 'Money', false],
      ['PerfectClearChallengeSwitch_Pom', 'perfectClear', 3, 'StackUpgrade', true],
      ['PerfectClearChallengeSwitch_MaxHealth', 'perfectClear', 1, 'MaxHealthDrop', false],
      ['EliteChallengeSwitch_Talent', 'elite', 5, 'TalentDrop', true],
      ['EliteChallengeSwitch_MaxMana', 'elite', 2, 'MaxManaDrop', false],
    ]);
    expect(switches.kinds.byKey.perfectClear).toMatchObject({
      defaultVariantKey: 'PerfectClearChallengeSwitch_Pom',
      hitRewardType: 'RoomRewardConsolationPrize',
      goldReward: false,
    });
    expect(switches.kinds.byKey.elite?.minimumBiomeDepth).toBe(3);
    expect(switches.kinds.byKey.elite?.requirement).toBeDefined();
    expect(switches.kinds.byKey.time).toMatchObject({ goldReward: true });
    expect(switches.minimumBiomeDepth).toBe(5);
    expect(switches.minimumRoomsSinceLast).toBe(3);
    expect(switches.gold).toEqual({ startingValue: 100, minimumValue: 10, defaultValue: 90 });
    expect(switches.bonusReward).toEqual({ rewardType: 'GiftDrop', dropChance: 0.05 });
  });

  it('spawns claim pickups through one lifecycle with no RunProgress upgrade', () => {
    const lifecycle = catalog.rewards.producerLifecycles.byKey[switches.producerLifecycleKey]!;
    expect(lifecycle.runProgressUpgradeEligible).toBeUndefined();
    expect(lifecycle.rewardTypes.byKey.GiftDrop?.acquisitionLifecycle).toEqual([
      { role: 'self', lifecyclePoint: 'roomRewardPickup' },
    ]);
    // The gold gush is not a consumable: Sea Star and Time Piece never touch it.
    expect(catalog.rewards.acquisitions.byKey.Money).toMatchObject({
      canDuplicate: false,
      goldConversionEligible: false,
    });
  });

  it('hosts exactly the anchored rooms of a RoomSet with a nonzero chance', () => {
    const hosts = switches.hosts.byKey;
    expect(hosts.F_Combat05).toEqual({
      gameName: 'F_Combat05',
      spawnChance: 0.25,
      encounterKeyBySwitchKind: {
        time: 'TimeChallengeF',
        perfectClear: 'PerfectClearChallengeF',
        elite: 'EliteChallengeF',
      },
    });
    expect(hosts.I_MiniBoss02?.spawnChance).toBe(0.15);
    expect(hosts.Q_Combat09?.encounterKeyBySwitchKind.elite).toBe('EliteChallengeQ');
    for (const gameName of [
      'F_PostBoss01',
      'O_Reprieve01',
      'N_Sub01',
      'Dream_PostBoss02',
      'F_Combat99',
      'F_PreBoss01',
    ])
      expect(hosts[gameName]).toBeUndefined();
    for (const host of switches.hosts.values)
      expect(catalog.rooms.byKey[host.gameName]?.challengeSwitchAnchorCount).toBeGreaterThan(0);
  });

  it('refuses an anchored room without a chance and a spawn-free room without anchors', () => {
    expect(
      withSwitches((raw) => {
        raw.noSpawnRoomGameNames = (raw.noSpawnRoomGameNames as string[]).filter(
          (name) => name !== 'Dream_PostBoss01',
        );
      }),
    ).toThrow(/anchored room Dream_PostBoss01 has no RoomSet switch chance/);
    expect(
      withSwitches((raw) => {
        raw.noSpawnRoomGameNames = [...(raw.noSpawnRoomGameNames as string[]), 'F_Boss01'];
      }),
    ).toThrow(/noSpawnRoomGameNames\[\d+\]: F_Boss01 is not an anchored room/);
  });

  it('refuses a reward outside the lifecycle and a default from another kind', () => {
    expect(
      withSwitches((raw) => {
        (raw.variants as { rewardType: string }[])[2]!.rewardType = 'MaxHealthDropBig';
      }),
    ).toThrow(/variants\[2\]\.rewardType: MaxHealthDropBig is not a ChallengeSwitchLoot reward/);
    expect(
      withSwitches((raw) => {
        (raw.kinds as { defaultVariantKey: string }[])[0]!.defaultVariantKey =
          'EliteChallengeSwitch_Talent';
      }),
    ).toThrow(/kinds\[0\]\.defaultVariantKey: is not a time variant/);
    expect(
      withSwitches((raw) => {
        (raw.gold as { defaultValue: number }).defaultValue = 120;
      }),
    ).toThrow(/gold: must order minimumValue <= defaultValue <= startingValue/);
  });
});

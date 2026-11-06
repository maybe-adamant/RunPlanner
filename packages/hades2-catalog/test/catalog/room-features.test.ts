import { describe, expect, it } from 'vitest';

import { catalog, createCatalog } from '@run-planner/hades2-catalog';

import { declarations } from '../../src/declarations';

describe('room feature declarations', () => {
  it('declares Purging Pools only on the three Underworld Postboss rooms', () => {
    expect(
      catalog.rooms.values
        .filter((room) => room.purgingPool !== undefined)
        .map((room) => room.gameName),
    ).toEqual(['F_PostBoss01', 'G_PostBoss01', 'H_PostBoss01']);
    for (const gameName of ['F_PostBoss01', 'G_PostBoss01', 'H_PostBoss01']) {
      expect(catalog.rooms.byKey[gameName]?.purgingPool).toEqual({
        slotKeys: ['left', 'middle', 'right'],
        excludedRouteKeys: ['FreshFile'],
        screenReroll: true,
      });
    }
  });

  it("declares each boss room's native forced drop and Dream eligibility", () => {
    expect(
      Object.fromEntries(
        catalog.rooms.values
          .filter((room) => room.requiredReward !== undefined)
          .map((room) => [room.gameName, room.requiredReward]),
      ),
    ).toEqual({
      C_Boss01: { dropKey: 'GemPointsBigDrop', canSpawnDreamReward: false },
      ...Object.fromEntries(
        [
          ['F_Boss01', 'F'],
          ['F_Boss02', 'F'],
          ['G_Boss01', 'G'],
          ['G_Boss02', 'G'],
          ['H_Boss01', 'H'],
          ['H_Boss02', 'H'],
          ['I_Boss01', 'I'],
          ['N_Boss01', 'N'],
          ['N_Boss02', 'N'],
          ['O_Boss01', 'O'],
          ['O_Boss02', 'O'],
          ['P_Boss01', 'P'],
          ['Q_Boss01', 'Q'],
          ['Q_Boss02', 'Q'],
        ].map(([gameName, biome]) => [
          gameName,
          { dropKey: `Mixer${biome}BossDrop`, canSpawnDreamReward: true },
        ]),
      ),
    });
  });

  it('declares the forced boss drops and the Dream drop with their resources', () => {
    const drop = (key: string) => catalog.requiredRewardDrops.byKey[key];
    expect(drop('MixerFBossDrop')).toEqual({
      key: 'MixerFBossDrop',
      label: 'Cinder',
      resourceKey: 'MixerFBoss',
      amount: 1,
      amountPerClearedBiome: 0,
    });
    expect(
      ['G', 'H', 'I', 'N', 'O', 'P', 'Q'].map((biome) => drop(`Mixer${biome}BossDrop`)?.label),
    ).toEqual(['Pearl', 'Tears', 'Zodiac Sand', 'Wool', 'Golden Apple', 'Feather', 'Void Lens']);
    expect(drop('GemPointsBigDrop')).toMatchObject({ resourceKey: 'GemPoints', amount: 50 });
    expect(catalog.routes.byKey.Dream?.dreamRewardDropKey).toBe('DreamPointsDrop');
    expect(
      catalog.routes.values.filter((route) => route.dreamRewardDropKey !== undefined),
    ).toHaveLength(1);
    expect(drop('DreamPointsDrop')).toEqual({
      key: 'DreamPointsDrop',
      label: 'Shiny Stars',
      resourceKey: 'DreamPoints',
      amount: 1,
      amountPerClearedBiome: 1,
    });
  });

  it('rejects an undeclared forced drop and a Dream drop off the Dream route', () => {
    const rooms = declarations.rooms.map((room) =>
      room.gameName === 'F_Boss01' ? { ...room, requiredReward: { dropKey: 'Missing' } } : room,
    );
    expect(() => createCatalog({ ...declarations, rooms })).toThrow(
      /F_Boss01\.requiredReward\.dropKey: unknown required reward drop Missing/,
    );
    const routes = declarations.routes.map((route) =>
      route.key === 'Underworld' ? { ...route, dreamRewardDropKey: 'DreamPointsDrop' } : route,
    );
    expect(() => createCatalog({ ...declarations, routes })).toThrow(
      /dreamRewardDropKey: is Dream-only/,
    );
    const dreamless = declarations.routes.map((route) =>
      route.key === 'Dream'
        ? (Object.fromEntries(
            Object.entries(route).filter(([key]) => key !== 'dreamRewardDropKey'),
          ) as typeof route)
        : route,
    );
    expect(() => createCatalog({ ...declarations, routes: dreamless })).toThrow(
      /dreamRewardDropKey: is required for Dream/,
    );
  });

  it('normalizes native timed-pickup deferral for every Dream boss variant', () => {
    const dreamOnlyBosses = [
      'F_Boss01',
      'F_Boss02',
      'G_Boss01',
      'G_Boss02',
      'H_Boss01',
      'H_Boss02',
      'I_Boss01',
      'N_Boss01',
      'N_Boss02',
      'O_Boss01',
      'O_Boss02',
      'P_Boss01',
      'Q_Boss01',
      'Q_Boss02',
    ];
    expect(
      catalog.rooms.values
        .filter((room) => room.skipTimedDropResourcesInDream)
        .map((room) => room.gameName)
        .sort(),
    ).toEqual(dreamOnlyBosses);
    for (const gameName of dreamOnlyBosses) {
      expect(catalog.rooms.byKey[gameName]?.skipTimedDropResourcesInDream).toBe(true);
      expect(catalog.rooms.byKey[gameName]?.skipTimedDropResources).toBe(false);
    }
    expect(catalog.rooms.byKey.C_Boss01).toMatchObject({
      skipTimedDropResources: true,
      skipTimedDropResourcesInDream: false,
    });
    expect(catalog.rooms.byKey.F_Combat01).toMatchObject({
      skipTimedDropResources: false,
      skipTimedDropResourcesInDream: false,
    });
  });

  it('declares every Reprieve and route Postboss fountain as a physical room feature', () => {
    expect(
      catalog.rooms.values
        .filter((room) => room.hasRequiredFountain)
        .map((room) => room.gameName)
        .sort(),
    ).toEqual([
      'Dream_PostBoss01',
      'Dream_PostBoss02',
      'Dream_PostBoss03',
      'F_PostBoss01',
      'F_Reprieve01',
      'G_PostBoss01',
      'G_Reprieve01',
      'H_PostBoss01',
      'I_Reprieve01',
      'N_PostBoss01',
      'O_PostBoss01',
      'O_Reprieve01',
      'P_PostBoss01',
      'P_Reprieve01',
    ]);
  });
});

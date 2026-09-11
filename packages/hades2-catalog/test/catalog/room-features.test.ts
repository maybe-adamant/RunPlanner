import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';

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
      });
    }
  });

  it('declares one effect-neutral required reward on every boss room', () => {
    expect(
      catalog.rooms.values
        .filter((room) => room.effectNeutralRequiredReward)
        .map((room) => room.gameName)
        .sort(),
    ).toEqual([
      'C_Boss01',
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
    ]);
  });

  it('declares every Reprieve and route Postboss fountain as a physical room feature', () => {
    expect(
      catalog.rooms.values
        .filter((room) => room.hasRequiredFountain)
        .map((room) => room.gameName)
        .sort(),
    ).toEqual([
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

import { describe, expect, it } from 'vitest';

import { catalog, createCatalog } from '@run-planner/hades2-catalog';

import { cloneCatalogInput, requireRoom } from './support/catalog-input';

const roomsWhere = (predicate: (room: (typeof catalog.rooms.values)[number]) => boolean) =>
  catalog.rooms.values.filter(predicate).map((room) => room.gameName);

describe('door reroll declarations', () => {
  it('declares each exit type door reroll permission', () => {
    expect(
      Object.fromEntries(
        catalog.exitTypes.values.map((exitType) => [exitType.key, exitType.allowReroll]),
      ),
    ).toEqual({
      ErebusExitDoor: true,
      OceanusExitDoor: true,
      OlympusOutdoorExitDoor: true,
      OlympusIndoorExitDoor: true,
      TyphonExitDoor: false,
      FortressMainDoor: false,
      FieldsExitDoor: true,
      ShipsExitDoor: false,
      TartarusExitDoor: true,
      N_OpeningDoor: true,
      EphyraExitDoor: true,
      EphyraExitDoorReturn: false,
      EphyraExitBossDoor: true,
      N_SubRoomDoor: false,
      AnomalyAutoExitDoor: true,
      ZagContract: false,
      ChaosExitDoor: false,
      ChaosReturnExitDoor: true,
    });
  });

  it('denies a reroll only at the room doors that differ from their exit type', () => {
    expect(
      catalog.rooms.values.flatMap((room) =>
        room.exits
          .filter((exit) => exit.allowReroll !== catalog.exitTypes.byKey[exit.type]?.allowReroll)
          .map((exit) => [room.gameName, exit.index, exit.type, exit.allowReroll]),
      ),
    ).toEqual([
      ['H_PostBoss01', 1, 'FieldsExitDoor', false],
      ['I_PreBoss01', 1, 'TartarusExitDoor', false],
      ['I_PreBoss02', 1, 'TartarusExitDoor', false],
    ]);
    const deny = (gameName: string, allowReroll: unknown) => {
      const input = cloneCatalogInput();
      const room = requireRoom(input, gameName);
      Object.assign(room, {
        exits: room.exits.map((exit) => ({ ...exit, allowReroll })),
      });
      return () => createCatalog(input);
    };
    expect(deny('F_Combat01', true)).toThrow('may only deny a reroll its exit type allows');
    expect(deny('O_Combat01', false)).toThrow("repeats ShipsExitDoor's denial");
  });

  it('declares the destination rooms native NoReroll and ForceDoorAllowReroll flags', () => {
    expect(roomsWhere((room) => room.noReroll)).toEqual([
      'Dream_PostBoss01',
      'Dream_PostBoss02',
      'Dream_PostBoss03',
      'F_Story01',
      'F_Shop01',
      'F_Boss01',
      'F_Boss02',
      'F_PostBoss01',
      'G_Intro',
      'G_Story01',
      'G_Shop01',
      'G_Boss01',
      'G_Boss02',
      'G_PostBoss01',
      'P_Intro',
      'P_Story01',
      'P_Shop01',
      'P_Boss01',
      'P_PostBoss01',
      'Q_Intro',
      'Q_Boss01',
      'Q_Boss02',
      'H_Intro',
      'H_Bridge01',
      'H_Boss01',
      'H_Boss02',
      'H_PostBoss01',
      'O_Intro',
      'O_Shop01',
      'O_Story01',
      'O_Boss01',
      'O_Boss02',
      'O_PostBoss01',
      'I_Intro',
      'I_Story01',
      'N_Hub',
      'N_Story01',
      'N_Sub01',
      'N_Sub02',
      'N_Sub03',
      'N_Sub04',
      'N_Sub05',
      'N_Sub06',
      'N_Sub07',
      'N_Sub08',
      'N_Sub09',
      'N_Sub10',
      'N_Sub11',
      'N_Sub12',
      'N_Sub13',
      'N_Sub14',
      'N_Sub15',
      'N_Shop01',
      'N_Boss01',
      'N_Boss02',
      'N_PostBoss01',
    ]);
    expect(roomsWhere((room) => room.forceDoorAllowReroll)).toEqual([
      'Q_MiniBoss02',
      'Q_MiniBoss05',
      'Q_MiniBoss03',
      'Q_MiniBoss04',
      'O_MiniBoss01',
      'O_MiniBoss02',
      'O_Reprieve01',
    ]);
    const input = cloneCatalogInput();
    Object.assign(requireRoom(input, 'F_Combat01'), { noReroll: 'yes' });
    expect(() => createCatalog(input)).toThrow('noReroll');
  });

  it('declares the door rewards that are never rerollable', () => {
    expect(
      catalog.rewards.rewardTypes.values
        .filter((rewardType) => rewardType.blocksDoorReroll === true)
        .map((rewardType) => rewardType.gameName),
    ).toEqual(['Shop', 'ClockworkGoal']);
    const input = cloneCatalogInput();
    const rewardTypes = input.rewardKernel.rewardTypes.map((rewardType) =>
      rewardType.gameName === 'Story' ? { ...rewardType, blocksDoorReroll: false } : rewardType,
    );
    expect(() =>
      createCatalog({
        ...input,
        rewardKernel: { ...input.rewardKernel, rewardTypes },
      } as typeof input),
    ).toThrow('blocksDoorReroll');
  });
});

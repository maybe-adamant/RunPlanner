import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';

describe('declaration-owned lifecycle clocks', () => {
  it('declares Experimental Hammer use advancement independently of encounter depth', () => {
    for (const gameName of [
      'F_Combat02',
      'F_MiniBoss01',
      'F_Boss01',
      'G_Story01',
      'F_Reprieve01',
      'F_Shop01',
      'G_Intro',
      'N_Hub',
      'F_PostBoss01',
      'O_Combat04',
      'H_Combat02',
    ]) {
      expect(catalog.rooms.byKey[gameName]?.advancesExperimentalHammerUses, gameName).toBe(true);
    }
    expect(
      catalog.rooms.values
        .filter((room) => !room.advancesExperimentalHammerUses)
        .map((room) => room.gameName),
    ).toEqual([
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
    ]);
    const sideBinding = catalog.rooms.byKey.N_Sub01?.encounterSlotBindings[0];
    expect(sideBinding?.kind).toBe('set');
    if (sideBinding?.kind === 'set') expect(sideBinding.encounterSetKey).toBe('NEncountersSubRoom');
    expect(catalog.rooms.byKey.F_Opening01?.advancesExperimentalHammerUses).toBe(true);
    expect(
      catalog.rooms.values
        .filter((room) => room.gameName.startsWith('N_Sub'))
        .every(
          (room) =>
            room.ignoreEncounterUses &&
            room.skipRoomsPerUpgrade &&
            !room.advancesExperimentalHammerUses &&
            !room.advancesHermesShrineDeliveryUses,
        ),
    ).toBe(true);
  });

  it('declares delayed Hermes Shrine use advancement independently of room shape', () => {
    const ephyraSideRooms = catalog.rooms.values.filter(
      (room) => room.mode.kind === 'authored' && room.mode.templateKey === 'EphyraSideRoom',
    );
    expect(ephyraSideRooms).not.toHaveLength(0);
    expect(ephyraSideRooms.every((room) => room.advancesHermesShrineDeliveryUses === false)).toBe(
      true,
    );
    expect(catalog.rooms.byKey.N_Sub10?.advancesHermesShrineDeliveryUses).toBe(false);
    expect(catalog.rooms.byKey.N_Hub?.advancesHermesShrineDeliveryUses).toBe(true);
    expect(catalog.rooms.byKey.O_Combat04?.advancesHermesShrineDeliveryUses).toBe(true);
    expect(
      catalog.encounterDefinitions.byKey.PreHubGeneratedN?.advancesHermesShrineDeliveryUses,
    ).toBe(true);
    expect(
      catalog.encounterDefinitions.byKey.GeneratedNSubRoom?.advancesHermesShrineDeliveryUses,
    ).toBe(true);
    expect(
      catalog.encounterDefinitions.byKey.GeneratedO_Intro01?.advancesHermesShrineDeliveryUses,
    ).toBe(false);
    expect(
      catalog.encounterDefinitions.byKey.Story_Circe_01?.advancesHermesShrineDeliveryUses,
    ).toBe(false);
    expect(catalog.encounterDefinitions.byKey.DevotionTestO?.advancesHermesShrineDeliveryUses).toBe(
      true,
    );
  });
});

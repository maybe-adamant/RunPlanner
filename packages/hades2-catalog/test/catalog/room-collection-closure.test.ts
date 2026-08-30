import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';

describe('room collection closure', () => {
  it('publishes the exact planner-supported Infernal Contract destination matrix', () => {
    const expected = [
      'F_PreBoss01',
      'G_PreBoss01',
      'H_PreBoss01',
      'I_PreBoss01',
      'I_PreBoss02',
      'N_PreBoss01',
      'O_PreBoss01',
      'P_PreBoss01',
      'Q_PreBoss01',
    ];
    expect(
      catalog.rooms.values
        .filter((room) => room.infernalContractReward !== undefined)
        .map((room) => room.gameName)
        .sort(),
    ).toEqual([...expected].sort());
    for (const gameName of expected) {
      expect(catalog.rooms.byKey[gameName]?.infernalContractReward).toEqual({
        entryKey: 'infernalContractReward',
        producerLifecycleKey: 'ZagPedestal',
        rewardTypes: [
          'BlindBoxLoot',
          'StackUpgradeBig',
          'StackUpgrade',
          'TalentBigDrop',
          'TalentDrop',
        ],
      });
    }
    expect(catalog.rooms.byKey.I_PreBoss01?.infernalContractReward).toBeDefined();
    for (const midshop of ['F_Shop01', 'G_Shop01', 'O_Shop01', 'P_Shop01']) {
      expect(catalog.rooms.byKey[midshop]?.infernalContractReward, midshop).toBeUndefined();
    }
  });
});

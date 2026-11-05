import type { RawExtraExitLockInput } from './extra-exit-locks-types';

// RoomDataG.lua BaseG_Combat: LockExtraExitsChance 0.10, overridden to 0.35 by
// G_Combat02, 03 and 09 and to 0.80 by G_Combat05; every ordinary G combat inherits it.
const chanceByRoom: Readonly<Record<string, number>> = {
  G_Combat02: 0.35,
  G_Combat03: 0.35,
  G_Combat05: 0.8,
  G_Combat09: 0.35,
};

export const extraExitLocks = {
  encounterKey: 'GeneratedG_ExtraDoor',
  // ObstacleDataG.lua OceanusExitDoor: PreExitsUnlockedFunctionName CheckExitPreUnlock.
  doorType: 'OceanusExitDoor',
  doorLockChance: 0.8,
  hosts: Array.from({ length: 20 }, (_, index) => {
    const gameName = `G_Combat${String(index + 1).padStart(2, '0')}`;
    return { gameName, chance: chanceByRoom[gameName] ?? 0.1 };
  }),
} as const satisfies RawExtraExitLockInput;

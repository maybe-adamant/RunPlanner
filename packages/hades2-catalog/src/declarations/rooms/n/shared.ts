export const surfaceShopHost = (
  spawnChance: number,
  forced = false,
  challengeSwitchAnchorCount = 1,
) => ({
  challengeSwitchAnchorCount,
  surfaceShop: {
    profileKey: 'SurfaceShop' as const,
    spawnChance,
    ...(forced ? { forced: true as const } : {}),
  },
});

export const chaosExit = {
  kind: 'chaos' as const,
  key: 'chaos' as const,
  exitType: 'ChaosExitDoor',
  canHost: true,
  canSpawn: true,
};

/** Combat and Mini-Boss return doors draw their placeholder from the main room set. */
export const mainPhantomExit = {
  placeholderRoomSetKey: 'N',
  unlockOrderPosition: 'first',
} as const;

/** A side room's return door draws from its own `N_SubRooms` set. */
export const sidePhantomExit = {
  placeholderRoomSetKey: 'N_SubRooms',
  unlockOrderPosition: 'first',
} as const;

export const soulPylon = {
  key: 'SoulPylon',
  spawnTiming: 'roomEntry',
  completionRequirement: 'destroyBeforeExit',
} as const;

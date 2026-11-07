export const surfaceShopHost = (
  spawnChance: number,
  forced: boolean,
  challengeSwitchAnchorCount: number,
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

export const soulPylon = {
  key: 'SoulPylon',
  spawnTiming: 'roomEntry',
  completionRequirement: 'destroyBeforeExit',
} as const;

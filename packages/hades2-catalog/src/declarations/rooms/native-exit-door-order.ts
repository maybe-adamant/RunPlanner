/**
 * Map door ids in native `DoUnlockRoomExits` processing order, for rooms whose
 * exit doors share an obstacle name: `CompareGameDataTables` ties there and
 * falls back to `MapState` table order, which no save keeps.
 * `scripts/native-exit-door-order.mjs` prints entries from door-order probe output.
 */
export const nativeExitDoorOrders: Readonly<Record<string, readonly number[]>> = {
  // Door-order probe, run 1012.
  F_Combat13: [566353, 561217],
  F_Combat15: [566345, 560915],
  G_Combat12: [608958, 569232],
  G_Combat14: [609523, 609522, 569053],
  G_Combat19: [777358, 777356],
  G_Combat20: [776584, 776586, 569053],
  H_Bridge01: [565616, 564300],
  H_Combat05: [621199, 564448],
};

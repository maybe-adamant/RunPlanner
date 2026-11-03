/**
 * Map door ids in native `DoUnlockRoomExits` processing order, for rooms whose
 * exit doors share an obstacle name: `CompareGameDataTables` ties there and
 * falls back to `MapState` table order, which no save keeps.
 * `scripts/native-exit-door-order.mjs` prints entries from door-order probe output.
 */
export const nativeExitDoorOrders: Readonly<Record<string, readonly number[]>> = {
  // Door-order probe, run 1012.
  G_Combat20: [776584, 776586, 569053],
  // Door-order probe, run 1012.
  H_Combat05: [621199, 564448],
};

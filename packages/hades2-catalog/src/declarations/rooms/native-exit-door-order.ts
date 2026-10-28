/**
 * Map door ids in native `DoUnlockRoomExits` processing order, for rooms whose
 * exit doors share an obstacle name: `CompareGameDataTables` ties there and
 * falls back to `MapState` table order, which no save keeps.
 * `scripts/native-exit-door-order.mjs` prints entries from door-order probe output.
 */
export const nativeExitDoorOrders: Readonly<Record<string, readonly number[]>> = {
  // Inferred from run 1010's reward-store replay; probe pending.
  G_Combat20: [776584, 776586, 569053],
  // Inferred from the live Underworld recording's reward-bag replay; probe pending.
  H_Combat05: [621199, 564448],
};

/**
 * Map door ids in native `DoUnlockRoomExits` processing order, for rooms whose
 * exit doors share an obstacle name: `CompareGameDataTables` ties there and
 * falls back to `MapState` table order, which no save keeps.
 * `scripts/native-exit-door-order.mjs` prints entries from door-order probe output.
 */
export const nativeExitDoorOrders: Readonly<Record<string, readonly number[]>> = {
  // Inferred from the live Underworld recording's reward-bag replay; probe pending.
  H_Combat05: [621199, 564448],
};

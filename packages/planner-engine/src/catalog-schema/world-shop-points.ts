import type { RoomMapPoint, RoomMapPoints } from './index';

/**
 * Where a World Shop's items stand: `SpawnStoreItemsInWorld` sorts the room's
 * `LootPoint` ids and spawns the k-th compact `StoreOptions` item on the k-th,
 * so an empty Shop slot shifts later items and an item past the last point
 * spawns nowhere. A Travel Deal refill respawns on its bought item's point.
 * `stocked` is the inventory in native order with its empty slots left out.
 */
export function worldShopItemPoints<Item>(
  points: RoomMapPoints,
  stocked: readonly Item[],
): readonly { readonly item: Item; readonly point: RoomMapPoint }[] {
  const shopPoints = points.shopPoints ?? [];
  return Object.freeze(
    stocked.flatMap((item, index) => {
      const point = shopPoints[index];
      return point === undefined ? [] : [Object.freeze({ item, point })];
    }),
  );
}

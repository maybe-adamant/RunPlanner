import { describe, expect, it } from 'vitest';

import { worldShopItemPoints, type RoomMapPoints } from '@run-planner/engine/catalog-schema';

const points = (shopPoints?: RoomMapPoints['shopPoints']): RoomMapPoints => ({
  exitDoors: [],
  heroStarts: [],
  heroEnds: [],
  heroExits: [],
  entryPairs: [],
  secretPoints: [],
  challengeSwitchAnchors: [],
  ...(shopPoints === undefined ? {} : { shopPoints }),
});

const loot = [
  { id: 10, x: 300, y: 0 },
  { id: 20, x: 100, y: 0 },
  { id: 30, x: 200, y: 0 },
];

describe('World Shop item points', () => {
  it('stands the k-th stocked item on the k-th LootPoint by ObjectId', () => {
    expect(worldShopItemPoints(points(loot), ['Boon', 'Heal'])).toEqual([
      { item: 'Boon', point: loot[0] },
      { item: 'Heal', point: loot[1] },
    ]);
  });

  it('spawns an item past the last point nowhere', () => {
    expect(worldShopItemPoints(points(loot.slice(0, 1)), ['Boon', 'Heal'])).toEqual([
      { item: 'Boon', point: loot[0] },
    ]);
    expect(worldShopItemPoints(points(), ['Boon'])).toEqual([]);
  });
});

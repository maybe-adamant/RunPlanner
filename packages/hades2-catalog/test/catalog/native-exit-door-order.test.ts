import { describe, expect, it } from 'vitest';

import { catalog, createCatalog, type CatalogInput } from '@run-planner/hades2-catalog';

import { cloneCatalogInput } from './support/catalog-input';

function withOrders(orders: Record<string, readonly number[]>): CatalogInput {
  return { ...cloneCatalogInput(), nativeExitDoorOrders: orders };
}

describe('native exit door order declarations', () => {
  it('declares only the rooms whose native door order is known', () => {
    expect(
      Object.fromEntries(
        catalog.rooms.values.flatMap((room) =>
          room.nativeExitDoorOrder === undefined ? [] : [[room.gameName, room.nativeExitDoorOrder]],
        ),
      ),
    ).toEqual({ H_Combat05: [621199, 564448] });
    expect(Object.isFrozen(catalog.rooms.byKey.H_Combat05?.nativeExitDoorOrder)).toBe(true);
  });

  it.each([
    [
      'an undeclared room',
      { H_Combat99: [1, 2] },
      /nativeExitDoorOrders\.H_Combat99.*not a declared room/,
    ],
    ['a single door', { H_Combat15: [621199] }, /at least two doors/],
    ['more doors than exits', { H_Combat15: [1, 2, 3] }, /more doors than the 2 exits/],
    ['a repeated door', { H_Combat15: [621199, 621199] }, /\[1\].*duplicates 621199/],
    ['a non-integer door', { H_Combat15: [621199, 1.5] }, /\[1\]/],
    ['a room without shared exit types', { H_Intro: [1, 2] }, /two exits of one type/],
  ])('rejects %s', (_, orders, message) => {
    expect(() => createCatalog(withOrders(orders))).toThrow(message);
  });
});

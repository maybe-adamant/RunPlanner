import { describe, expect, it } from 'vitest';

import { catalog, createCatalog, type CatalogInput } from '@run-planner/hades2-catalog';

import { cloneCatalogInput } from './support/catalog-input';

type Orders = CatalogInput['exitDoorSetupOrders'];

function withOrders(orders: Orders): CatalogInput {
  return {
    ...cloneCatalogInput(),
    exitDoorSetupOrders: { ...cloneCatalogInput().exitDoorSetupOrders, ...orders },
  };
}

describe('exit door setup order declarations', () => {
  it('declares the Hub and every room with two or more exits outside Chaos but six the probe missed', () => {
    const declared = catalog.rooms.values.filter((room) => room.exitDoorSetupOrder !== undefined);
    expect(declared).toHaveLength(101);
    expect(
      catalog.rooms.values
        // The door-order probe recorded no setup order for Chaos return doors.
        .filter((room) => room.exits.length >= 2 && room.roomSetKey !== 'Chaos')
        .filter((room) => room.exitDoorSetupOrder === undefined)
        .map((room) => room.gameName),
    ).toEqual(['P_Combat01', 'P_Combat05', 'P_Combat06', 'P_Combat16', 'P_Combat17', 'P_Shop01']);
    expect(catalog.rooms.byKey.G_Combat14?.exitDoorSetupOrder).toEqual([
      { doorId: 569053, obstacleName: 'OceanusExitDoor' },
      { doorId: 609523, obstacleName: 'OceanusExitDoor' },
      { doorId: 609522, obstacleName: 'OceanusExitDoor' },
    ]);
    expect(Object.isFrozen(catalog.rooms.byKey.G_Combat14?.exitDoorSetupOrder?.[0])).toBe(true);
  });

  it('names the obstacle of each door spawned for an additional exit', () => {
    expect(catalog.exitTypes.byKey.ChaosExitDoor?.spawnedObstacleName).toBe('SecretDoor');
    expect(catalog.exitTypes.byKey.ZagContract?.spawnedObstacleName).toBe('ZagContract');
  });

  it.each([
    [
      'an undeclared room',
      {
        H_Combat99: [
          [1, 'ErebusExitDoor'],
          [2, 'ErebusExitDoor'],
        ],
      },
      /exitDoorSetupOrders\.H_Combat99.*not a declared room/,
    ],
    ['a single door', { H_Combat15: [[621199, 'ErebusExitDoor']] }, /at least two doors/],
    [
      'more doors than exits',
      {
        H_Combat15: [
          [1, 'A'],
          [2, 'A'],
          [3, 'A'],
        ],
      },
      /declares 3 doors for the room's 2 exits/,
    ],
    [
      'a repeated door',
      {
        H_Combat15: [
          [1, 'A'],
          [1, 'A'],
        ],
      },
      /\[1\].*duplicates 1/,
    ],
    [
      'a non-integer door',
      {
        H_Combat15: [
          [1, 'A'],
          [1.5, 'A'],
        ],
      },
      /\[1\]\[0\]/,
    ],
    [
      'an empty obstacle name',
      {
        H_Combat15: [
          [1, 'A'],
          [2, ''],
        ],
      },
      /\[1\]\[1\]/,
    ],
    [
      'obstacle names unlike the exit types',
      {
        P_Combat03: [
          [1, 'OlympusOutdoorExitDoor'],
          [2, 'OlympusOutdoorExitDoor'],
        ],
      },
      /exit 2 of type OlympusOutdoorExitDoor/,
    ],
    [
      'two obstacle names on exits of one type',
      {
        H_Combat15: [
          [1, 'A'],
          [2, 'B'],
        ],
      },
      /puts a B door on exit 2/,
    ],
  ] as [string, Orders, RegExp][])('rejects %s', (_, orders, message) => {
    expect(() => createCatalog(withOrders(orders))).toThrow(message);
  });

  it('rejects an additional exit type without a spawned obstacle name', () => {
    const input = cloneCatalogInput();
    const exitTypes = input.exitTypes.map((exitType) => {
      if (exitType.key !== 'ChaosExitDoor') return exitType;
      const { spawnedObstacleName: _name, ...unnamed } = exitType;
      void _name;
      return unnamed;
    });
    expect(() => createCatalog({ ...input, exitTypes })).toThrow(
      /ChaosExitDoor must name its spawned door obstacle/,
    );
  });
});

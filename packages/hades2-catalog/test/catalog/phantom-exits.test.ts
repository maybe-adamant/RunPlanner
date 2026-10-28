import { describe, expect, it } from 'vitest';

import { catalog, createCatalog } from '@run-planner/hades2-catalog';

import { cloneCatalogInput, requireRoom } from './support/catalog-input';

const two = (value: number) => String(value).padStart(2, '0');

describe('phantom exit declarations', () => {
  it('declares the hidden return door on every Ephyra combat, Mini-Boss and side room', () => {
    expect(
      Object.fromEntries(
        catalog.rooms.values.flatMap((room) =>
          room.phantomExit === undefined
            ? []
            : [[room.gameName, room.phantomExit.placeholderRoomSetKey]],
        ),
      ),
    ).toEqual({
      ...Object.fromEntries(
        Array.from({ length: 23 }, (_, index) => [`N_Combat${two(index + 1)}`, 'N']),
      ),
      N_MiniBoss01: 'N',
      N_MiniBoss02: 'N',
      ...Object.fromEntries(
        Array.from({ length: 15 }, (_, index) => [`N_Sub${two(index + 1)}`, 'N_SubRooms']),
      ),
    });
  });

  it('places the return door first in its unlock, before every side door', () => {
    const rooms = catalog.rooms.values.filter((room) => room.phantomExit !== undefined);
    expect(new Set(rooms.map((room) => room.phantomExit?.unlockOrderPosition))).toEqual(
      new Set(['first']),
    );
    // DoUnlockRoomExits sorts the unlock's doors by obstacle name.
    const sideDoorName = 'N_SubRoomDoor';
    for (const returnDoorName of ['EphyraExitDoorReturn', 'EphyraExitDoorReturnNE'])
      expect([sideDoorName, returnDoorName].sort()[0]).toBe(returnDoorName);
    // A side room's return door is its only exit door.
    for (const room of rooms.filter((room) => room.phantomExit?.placeholderRoomSetKey !== 'N'))
      expect(room.localChildren.some((child) => child.kind === 'fixedRoomSlots')).toBe(false);
  });

  it.each([
    [
      'a linked room',
      'N_Story01',
      { placeholderRoomSetKey: 'N', unlockOrderPosition: 'first' },
      'is declared only for Ephyra combat, Mini-Boss and side rooms',
    ],
    [
      'another biome',
      'F_Combat01',
      { placeholderRoomSetKey: 'N', unlockOrderPosition: 'first' },
      'is declared only for Ephyra combat, Mini-Boss and side rooms',
    ],
    [
      'the wrong set',
      'N_Sub01',
      { placeholderRoomSetKey: 'N', unlockOrderPosition: 'first' },
      'must be N_SubRooms',
    ],
    [
      'another position',
      'N_Combat01',
      { placeholderRoomSetKey: 'N', unlockOrderPosition: 'last' },
      'the return door sorts first',
    ],
  ])('rejects a phantom exit on %s', (_, gameName, phantomExit, message) => {
    const input = cloneCatalogInput();
    Object.assign(requireRoom(input, gameName), { phantomExit });
    expect(() => createCatalog(input)).toThrow(message);
  });
});

import { describe, expect, it } from 'vitest';

import { catalog, createCatalog } from '@run-planner/hades2-catalog';

import { cloneCatalogInput, requireRoom } from './support/catalog-input';

const two = (value: number) => String(value).padStart(2, '0');
const combatRooms = Array.from({ length: 23 }, (_, index) => `N_Combat${two(index + 1)}`);
const sideRooms = Array.from({ length: 15 }, (_, index) => `N_Sub${two(index + 1)}`);

function phantomExits() {
  const progression = catalog.biomeLayouts.byKey.N?.progression;
  if (progression?.kind !== 'hub') throw new Error('N has no Hub progression');
  return progression.phantomExits;
}

function nLayoutInput(input: ReturnType<typeof cloneCatalogInput>) {
  const layout = input.biomeLayouts.find((candidate) => candidate.biomeKey === 'N');
  if (layout?.progression.kind !== 'hub') throw new Error('N has no Hub progression');
  return layout.progression;
}

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
      ...Object.fromEntries(combatRooms.map((gameName) => [gameName, 'N'])),
      N_MiniBoss01: 'N',
      N_MiniBoss02: 'N',
      ...Object.fromEntries(sideRooms.map((gameName) => [gameName, 'N_SubRooms'])),
    });
  });

  it('places the return door first in its unlock, before every side door', () => {
    expect(phantomExits().unlockOrderPosition).toBe('first');
    // DoUnlockRoomExits sorts the unlock's doors by obstacle name.
    const sideDoorName = 'N_SubRoomDoor';
    for (const returnDoorName of ['EphyraExitDoorReturn', 'EphyraExitDoorReturnNE'])
      expect([sideDoorName, returnDoorName].sort()[0]).toBe(returnDoorName);
    // A side room's return door is its only exit door.
    for (const room of catalog.rooms.values.filter(
      (room) => room.phantomExit?.placeholderRoomSetKey === 'N_SubRooms',
    ))
      expect(room.localChildren.some((child) => child.kind === 'fixedRoomSlots')).toBe(false);
  });

  it('offers every placeholder IsRoomEligible admits, settling a no-draw room first', () => {
    const sets = phantomExits().placeholderSets;
    // Opening and Hub are entered once already; Bosses and Postboss require a link.
    expect(sets.byKey.N?.roomGameNames).toEqual([
      'N_PreBoss01',
      'N_Shop01',
      'N_PreHub01',
      'N_Story01',
      'N_MiniBoss01',
      'N_MiniBoss02',
      ...combatRooms,
    ]);
    expect(sets.byKey.N_SubRooms?.roomGameNames).toEqual(sideRooms);
    const [first, second] = sets.byKey.N!.roomGameNames;
    for (const gameName of [first!, second!])
      expect(catalog.rooms.byKey[gameName]?.incomingReward.kind).toBe('shop');
  });

  it('declares the native Ephyra Shop as a placeholder-only room', () => {
    const shop = catalog.rooms.byKey.N_Shop01;
    expect(shop).toMatchObject({ roomSetKey: 'N', kind: 'Shop', noReroll: true });
    expect(shop?.incomingReward).toMatchObject({ kind: 'shop', rewardType: 'Shop' });
    const progression = catalog.biomeLayouts.byKey.N?.progression;
    expect(
      progression?.kind === 'hub' &&
        progression.slots.some((slot) => slot.roomGameName === 'N_Shop01'),
    ).toBe(false);
  });

  it.each([
    ['a linked room', 'N_Story01', 'is declared only for Ephyra combat, Mini-Boss and side rooms'],
    ['another biome', 'F_Combat01', 'is declared only for Ephyra combat, Mini-Boss and side rooms'],
  ])('rejects a phantom exit on %s', (_, gameName, message) => {
    const input = cloneCatalogInput();
    Object.assign(requireRoom(input, gameName), { phantomExit: true });
    expect(() => createCatalog(input)).toThrow(message);
  });

  it('rejects a placeholder outside its native room set or without a draw store', () => {
    const wrongSet = cloneCatalogInput();
    Object.assign(nLayoutInput(wrongSet).phantomExits.placeholderSets[1]!, {
      roomGameNames: ['N_Combat01'],
    });
    expect(() => createCatalog(wrongSet)).toThrow('is not in the native N_SubRooms room set');

    const noDraw = cloneCatalogInput();
    Object.assign(nLayoutInput(noDraw).phantomExits.placeholderSets[0]!, {
      roomGameNames: ['N_Hub'],
    });
    expect(() => createCatalog(noDraw)).toThrow('must draw from its own store');

    const missing = cloneCatalogInput();
    Object.assign(nLayoutInput(missing).phantomExits, {
      placeholderSets: [nLayoutInput(missing).phantomExits.placeholderSets[0]],
    });
    expect(() => createCatalog(missing)).toThrow('draws from undeclared set N_SubRooms');
  });
});

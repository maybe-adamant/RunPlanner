import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import type { RoomDeclaration } from '@run-planner/engine/catalog-schema';

import { createDefaultRoomState } from '../../../src/authored-project/room-state/defaults';
import { reconcileReplacementRoomState } from '../../../src/authored-project/room-state/replacement';

function room(gameName: string): RoomDeclaration {
  const declaration = catalog.rooms.byKey[gameName];
  if (declaration === undefined) throw new Error(`missing ${gameName}`);
  return declaration;
}

describe('authored room-state replacement', () => {
  it('retains an admitted counted offer and resets one outside the replacement declaration', () => {
    const previousRoom = room('F_Combat02');
    const previousState = createDefaultRoomState(catalog, previousRoom, {
      role: 'ordinary',
      resolvedStoreKey: 'MetaProgress',
      entryActive: true,
    });

    const compatibleRoom = room('F_Combat03');
    const compatibleDefault = createDefaultRoomState(catalog, compatibleRoom, {
      role: 'ordinary',
      resolvedStoreKey: 'RunProgress',
      entryActive: true,
    });
    expect(
      reconcileReplacementRoomState(
        catalog,
        previousRoom,
        previousState,
        compatibleRoom,
        compatibleDefault,
      ),
    ).toEqual(previousState);

    const forcedRoom = room('F_Combat01');
    const forcedDefault = createDefaultRoomState(catalog, forcedRoom, {
      role: 'ordinary',
      resolvedStoreKey: 'MetaProgress',
      entryActive: true,
    });
    expect(
      reconcileReplacementRoomState(
        catalog,
        previousRoom,
        previousState,
        forcedRoom,
        forcedDefault,
      ),
    ).toEqual(forcedDefault);
  });

  it('retains declaration-compatible Fields cages', () => {
    const previousRoom = room('H_Combat01');
    const previousState = createDefaultRoomState(catalog, previousRoom, {
      role: 'ordinary',
      entryActive: true,
    });
    const replacementRoom = room('H_Combat02');
    const replacementDefault = createDefaultRoomState(catalog, replacementRoom, {
      role: 'ordinary',
      entryActive: true,
    });
    const reconciled = reconcileReplacementRoomState(
      catalog,
      previousRoom,
      previousState,
      replacementRoom,
      replacementDefault,
    );
    expect(reconciled).toEqual(previousState);
    expect(reconciled).not.toBe(previousState);
  });

  it('retains admitted Ship encounter and wheel leaves', () => {
    const previousRoom = room('O_Combat01');
    const defaultState = createDefaultRoomState(catalog, previousRoom, {
      role: 'ordinary',
      entryActive: true,
    });
    if (defaultState.kind !== 'shipCombat') throw new Error('missing ShipCombat default');
    const wheel1 = defaultState.wheels.wheel1;
    if (wheel1 === undefined) throw new Error('missing wheel1 default');
    const previousState = Object.freeze({
      ...defaultState,
      encounterCount: 3 as const,
      wheels: Object.freeze({
        ...defaultState.wheels,
        wheel1: Object.freeze({ ...wheel1, offerCount: 2, pickedOfferIndex: 2 }),
      }),
    });
    const replacementRoom = room('O_Combat02');
    const replacementDefault = createDefaultRoomState(catalog, replacementRoom, {
      role: 'ordinary',
      entryActive: true,
    });
    expect(
      reconcileReplacementRoomState(
        catalog,
        previousRoom,
        previousState,
        replacementRoom,
        replacementDefault,
      ),
    ).toEqual(previousState);
  });

  it('uses complete replacement defaults for Shop and Ephyra state', () => {
    const shopRoom = room('F_Shop01');
    const shopDefault = createDefaultRoomState(catalog, shopRoom, {
      role: 'ordinary',
      entryActive: true,
    });
    if (shopDefault.kind !== 'shop' || shopDefault.shop === undefined) {
      throw new Error('missing active Shop default');
    }
    const orderedShop = Object.freeze({
      kind: 'shop' as const,
      shop: Object.freeze({
        ...shopDefault.shop,
        purchaseOrder: Object.freeze(['Boon']),
      }),
    });
    expect(
      reconcileReplacementRoomState(catalog, shopRoom, orderedShop, shopRoom, shopDefault),
    ).toBe(shopDefault);

    const ephyraRoom = room('N_Combat02');
    const ephyraDefault = createDefaultRoomState(catalog, ephyraRoom, {
      role: 'ordinary',
      entryActive: true,
    });
    if (ephyraDefault.kind !== 'ephyraCombat') throw new Error('missing Ephyra default');
    const sideDoor1 = ephyraDefault.sideRooms.sideDoor1;
    if (sideDoor1 === undefined) throw new Error('missing Ephyra side room');
    const enteredEphyra = Object.freeze({
      ...ephyraDefault,
      sideRooms: Object.freeze({
        ...ephyraDefault.sideRooms,
        sideDoor1: Object.freeze({
          ...sideDoor1,
          generation: 'generated' as const,
          enteredOrdinal: 1,
        }),
      }),
    });
    expect(
      reconcileReplacementRoomState(catalog, ephyraRoom, enteredEphyra, ephyraRoom, ephyraDefault),
    ).toBe(ephyraDefault);
  });
});

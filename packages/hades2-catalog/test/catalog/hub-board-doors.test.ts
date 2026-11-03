import { describe, expect, it } from 'vitest';

import { catalog, createCatalog } from '@run-planner/hades2-catalog';

import { cloneCatalogInput } from './support/catalog-input';

function withHubDoors(
  change: (doors: readonly (readonly [number, string])[]) => (readonly [number, string])[],
) {
  const input = cloneCatalogInput();
  const doors = input.exitDoorSetupOrders.N_Hub!;
  return { ...input, exitDoorSetupOrders: { ...input.exitDoorSetupOrders, N_Hub: change(doors) } };
}

describe('Hub board door declarations', () => {
  it('ranks every Ephyra board door in the offered-exit insertion order', () => {
    const progression = catalog.biomeLayouts.byKey.N?.progression;
    if (progression?.kind !== 'hub') throw new Error('missing N Hub');
    const slots = [...progression.slots].sort(
      (left, right) => left.offeredExitInsertionRank - right.offeredExitInsertionRank,
    );

    expect(slots.map((slot) => slot.offeredExitInsertionRank)).toEqual(
      slots.map((_, index) => index),
    );
    expect(slots.map((slot) => slot.roomGameName)).toEqual([
      'N_Combat15',
      'N_Combat04',
      'N_Combat06',
      'N_Combat21',
      'N_Story01',
      'N_Combat02',
      'N_Combat23',
      'N_Combat18',
      'N_Combat19',
      'N_Combat12',
      'N_Combat01',
      'N_MiniBoss02',
      'N_Combat22',
      'N_Combat20',
      'N_Combat07',
      'N_Combat09',
      'N_Combat17',
      'N_Combat05',
      'N_Combat10',
      'N_Combat13',
      'N_Combat11',
      'N_Combat16',
      'N_MiniBoss01',
      'N_Combat14',
      'N_Combat08',
      'N_Combat03',
    ]);
  });

  it('ranks the board doors in the Hub map door-setup order', () => {
    const progression = catalog.biomeLayouts.byKey.N?.progression;
    if (progression?.kind !== 'hub') throw new Error('missing N Hub');
    const boardDoors = new Set(progression.slots.map((slot) => slot.physicalDoorId));
    expect(
      [...progression.slots]
        .sort((left, right) => left.offeredExitInsertionRank - right.offeredExitInsertionRank)
        .map((slot) => slot.physicalDoorId),
    ).toEqual(
      catalog.rooms.byKey
        .N_Hub!.exitDoorSetupOrder!.map((door) => door.doorId)
        .filter((doorId) => boardDoors.has(doorId)),
    );
  });

  it('rejects a board door missing from the Hub door-setup order', () => {
    const input = withHubDoors((doors) => doors.filter(([doorId]) => doorId !== 560705));
    expect(() => createCatalog(input)).toThrow(/560705 is not in N_Hub's door-setup order/);
  });
});

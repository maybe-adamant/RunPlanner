import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import type { RoomDeclaration } from '@run-planner/engine/catalog-schema';

import { decodeRoomState } from '../../../src/authored-project/room-state/codec';
import { createDefaultRoomState } from '../../../src/authored-project/room-state/defaults';

const path = '$.room.state';

function room(gameName: string): RoomDeclaration {
  const declaration = catalog.rooms.byKey[gameName];
  if (declaration === undefined) throw new Error(`missing ${gameName}`);
  return declaration;
}

function mutable(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

describe('persisted authored room-state codec', () => {
  it.each(['H_Combat02', 'O_Combat01', 'N_Combat02'])(
    'decodes the complete %s declaration default',
    (gameName) => {
      const declaration = room(gameName);
      const state = createDefaultRoomState(catalog, declaration, {
        role: 'ordinary',
        entryActive: true,
      });
      expect(
        decodeRoomState(
          state,
          catalog,
          declaration,
          {
            role: 'ordinary',
            entryActive: true,
          },
          path,
        ),
      ).toEqual(state);
    },
  );

  it('preserves dormant Shop inventory while requiring inventory for an active entry', () => {
    const declaration = room('F_Shop01');
    const dormant = createDefaultRoomState(catalog, declaration, {
      role: 'ordinary',
      entryActive: false,
    });
    const active = createDefaultRoomState(catalog, declaration, {
      role: 'ordinary',
      entryActive: true,
    });
    expect(
      decodeRoomState(
        dormant,
        catalog,
        declaration,
        {
          role: 'ordinary',
          entryActive: false,
        },
        path,
      ),
    ).toEqual(dormant);
    expect(
      decodeRoomState(
        active,
        catalog,
        declaration,
        {
          role: 'ordinary',
          entryActive: false,
        },
        path,
      ),
    ).toEqual(active);
    expect(() =>
      decodeRoomState(
        dormant,
        catalog,
        declaration,
        {
          role: 'ordinary',
          entryActive: true,
        },
        path,
      ),
    ).toThrow('$.room.state.shop: is required for an entered shop occurrence');
  });

  it('requires an exact, distinct Shop purchase order over materialized offer keys', () => {
    const declaration = room('F_Shop01');
    const raw = mutable(
      createDefaultRoomState(catalog, declaration, {
        role: 'ordinary',
        entryActive: true,
      }),
    );
    const shop = raw.shop as Record<string, unknown>;

    shop.purchaseOrder = ['Unknown'];
    expect(() =>
      decodeRoomState(raw, catalog, declaration, { role: 'ordinary', entryActive: true }, path),
    ).toThrow('$.room.state.shop.purchaseOrder: Unknown is not a Shop offer');

    shop.purchaseOrder = ['Boon', 'Boon'];
    expect(() =>
      decodeRoomState(raw, catalog, declaration, { role: 'ordinary', entryActive: true }, path),
    ).toThrow('$.room.state.shop.purchaseOrder: Boon is duplicated');

    shop.purchaseOrder = [];
    const offers = shop.offers as Record<string, Record<string, unknown>>;
    offers.Boon!.purchased = false;
    expect(() =>
      decodeRoomState(raw, catalog, declaration, { role: 'ordinary', entryActive: true }, path),
    ).toThrow('$.room.state.shop.offers.Boon.purchased: is not a project document field');
  });

  it('preserves valid Ephyra side-room ownership and rejects an entered dormant side room', () => {
    const declaration = room('N_Combat02');
    const raw = mutable(
      createDefaultRoomState(catalog, declaration, {
        role: 'ordinary',
        entryActive: true,
      }),
    );
    const sideRooms = raw.sideRooms as Record<string, Record<string, unknown>>;
    sideRooms.sideDoor1!.generation = 'generated';
    sideRooms.sideDoor1!.enteredOrdinal = 1;
    expect(
      decodeRoomState(
        raw,
        catalog,
        declaration,
        {
          role: 'ordinary',
          entryActive: true,
        },
        path,
      ),
    ).toMatchObject({
      kind: 'ephyraCombat',
      sideRooms: { sideDoor1: { generation: 'generated', enteredOrdinal: 1 } },
    });

    sideRooms.sideDoor1!.generation = 'notGenerated';
    expect(() =>
      decodeRoomState(
        raw,
        catalog,
        declaration,
        {
          role: 'ordinary',
          entryActive: true,
        },
        path,
      ),
    ).toThrow('$.room.state.sideRooms.sideDoor1.enteredOrdinal: requires a generated side room');
  });

  it.each([
    {
      label: 'Ephyra side rooms',
      gameName: 'N_Combat02',
      field: 'sideRooms',
      requiredKey: 'sideDoor1',
    },
    {
      label: 'Fields cages',
      gameName: 'H_Combat02',
      field: 'cages',
      requiredKey: 'cage1',
    },
    {
      label: 'Ship wheels',
      gameName: 'O_Combat01',
      field: 'wheels',
      requiredKey: 'wheel1',
    },
  ])(
    'rejects unknown and missing declaration-owned $label keys',
    ({ gameName, field, requiredKey }) => {
      const declaration = room(gameName);
      const raw = mutable(
        createDefaultRoomState(catalog, declaration, {
          role: 'ordinary',
          entryActive: true,
        }),
      );
      const keyedValues = raw[field] as Record<string, unknown>;
      keyedValues.unexpected = {};

      expect(() =>
        decodeRoomState(
          raw,
          catalog,
          declaration,
          {
            role: 'ordinary',
            entryActive: true,
          },
          path,
        ),
      ).toThrow(`${path}.${field}.unexpected: is not a project document field`);

      delete keyedValues.unexpected;
      delete keyedValues[requiredKey];
      expect(() =>
        decodeRoomState(
          raw,
          catalog,
          declaration,
          {
            role: 'ordinary',
            entryActive: true,
          },
          path,
        ),
      ).toThrow(`${path}.${field}.${requiredKey}: must be an object`);
    },
  );

  it('rejects malformed Preboss role state at the exact persisted kind path', () => {
    expect(() =>
      decodeRoomState(
        { kind: 'terminalShop' },
        catalog,
        room('F_PreBoss01'),
        { role: 'prebossShop', entryActive: false },
        path,
      ),
    ).toThrow('$.room.state.kind: expected shop, received terminalShop');
  });

  it('rejects a Ship wheel pick beyond its active offer count at the exact leaf path', () => {
    const declaration = room('O_Combat01');
    const raw = mutable(
      createDefaultRoomState(catalog, declaration, {
        role: 'ordinary',
        entryActive: true,
      }),
    );
    const wheels = raw.wheels as Record<string, Record<string, unknown>>;
    wheels.wheel1!.pickedOfferIndex = 4;
    expect(() =>
      decodeRoomState(
        raw,
        catalog,
        declaration,
        {
          role: 'ordinary',
          entryActive: true,
        },
        path,
      ),
    ).toThrow('$.room.state.wheels.wheel1.pickedOfferIndex: must select an active offer');
  });
});

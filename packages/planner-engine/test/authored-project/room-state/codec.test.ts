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

import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';

import { decodeRoomState } from '../../../src/authored-project/room-state/codec';
import { createTestDefaultRoomState as createDefaultRoomState } from '../support/default-room-state';
import { mutable, room, roomStatePath as path } from '../support/room-state-codec';

describe('Ship and Ephyra room-state decoder', () => {
  it.each([
    { label: 'Fields cages', gameName: 'H_Combat02', field: 'cages', requiredKey: 'cage1' },
    { label: 'Ship wheels', gameName: 'O_Combat01', field: 'wheels', requiredKey: 'wheel1' },
  ])(
    'rejects unknown and missing declaration-owned $label keys',
    ({ gameName, field, requiredKey }) => {
      const declaration = room(gameName);
      const raw = mutable(
        createDefaultRoomState(catalog, declaration, { role: 'ordinary', entryActive: true }),
      );
      const keyedValues = raw[field] as Record<string, unknown>;
      keyedValues.unexpected = {};
      expect(() =>
        decodeRoomState(raw, catalog, declaration, { role: 'ordinary', entryActive: true }, path),
      ).toThrow(`${path}.${field}.unexpected: is not a project document field`);
      delete keyedValues.unexpected;
      delete keyedValues[requiredKey];
      expect(() =>
        decodeRoomState(raw, catalog, declaration, { role: 'ordinary', entryActive: true }, path),
      ).toThrow(`${path}.${field}.${requiredKey}: must be an object`);
    },
  );

  it('rejects a Ship wheel pick beyond its active offer count at the exact leaf path', () => {
    const declaration = room('O_Combat01');
    const raw = mutable(
      createDefaultRoomState(catalog, declaration, { role: 'ordinary', entryActive: true }),
    );
    const wheels = raw.wheels as Record<string, Record<string, unknown>>;
    wheels.wheel1!.pickedOfferIndex = 4;
    expect(() =>
      decodeRoomState(raw, catalog, declaration, { role: 'ordinary', entryActive: true }, path),
    ).toThrow('$.room.state.wheels.wheel1.pickedOfferIndex: must select an active offer');
  });
});

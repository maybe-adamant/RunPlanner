import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import type { RoomDeclaration } from '@run-planner/engine/catalog-schema';

import {
  createDefaultRoomEncounterState,
  encounterBindingsBySlot,
} from '../../../src/authored-project/room-state/encounter-envelope';

function room(gameName: string): RoomDeclaration {
  const declaration = catalog.rooms.byKey[gameName];
  if (declaration === undefined) throw new Error(`missing ${gameName}`);
  return declaration;
}

describe('encounter envelope decoder queries', () => {
  it('constructs only the declaration-owned default selectable phase map', () => {
    const declaration = room('F_Combat04');
    const bindings = encounterBindingsBySlot(catalog, declaration, '$.encounters');
    const state = createDefaultRoomEncounterState(catalog, declaration, '$.encounters');

    expect(Object.keys(state.figLeafSkipByPhase)).toEqual([...bindings.keys()]);
    expect(Object.keys(state.encounterKeyByPhase)).toEqual(
      [...bindings.values()]
        .filter((binding) => binding.kind === 'set')
        .map((binding) => binding.slotKey),
    );
  });
});

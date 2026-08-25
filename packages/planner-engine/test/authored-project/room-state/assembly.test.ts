import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';

import { decodeRoomState } from '../../../src/authored-project/room-state/codec';
import { createTestDefaultRoomState as createDefaultRoomState } from '../support/default-room-state';
import { room, roomStatePath as path } from '../support/room-state-codec';

describe('persisted authored room-state assembly', () => {
  it('decodes representative complete declaration defaults through the full room-state assembly', () => {
    for (const gameName of ['H_Combat02', 'O_Combat01', 'N_Combat02']) {
      const declaration = room(gameName);
      const context = { role: 'ordinary' as const, entryActive: true };
      const state = createDefaultRoomState(catalog, declaration, context);
      expect(decodeRoomState(state, catalog, declaration, context, path)).toEqual(state);
    }
  });
});

import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';

import { PEDESTAL_ROOMS, PHANTOM_EXIT_ROOMS } from '@planner/persistence/project-99-to-100.js';

describe('schema 99 to 100 migration catalog facts', () => {
  it('moves the pedestal on exactly the rooms the catalog declares one for', () => {
    expect(new Set(PEDESTAL_ROOMS)).toEqual(
      new Set(
        catalog.rooms.values
          .filter((room) => room.infernalContractReward !== undefined)
          .map((room) => room.gameName),
      ),
    );
  });

  it('adds a phantom exit on exactly the rooms the catalog declares one for', () => {
    expect(new Set(PHANTOM_EXIT_ROOMS)).toEqual(
      new Set(
        catalog.rooms.values
          .filter((room) => room.phantomExit !== undefined)
          .map((room) => room.gameName),
      ),
    );
  });
});

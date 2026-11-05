import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';
import { occurrenceRoomIcon } from '@planner/projections/structured-workspace/presentation/room-icon';

describe('occurrence room icon', () => {
  it('names an unentered miniboss room by its fixed encounter', () => {
    const declaration = catalog.rooms.byKey['G_MiniBoss02'];
    if (declaration === undefined) throw new Error('G_MiniBoss02 is not declared');
    expect(
      occurrenceRoomIcon({
        catalog,
        biomeKey: 'G',
        declaration,
        encounterPhases: [],
        roomLocal: { kind: 'none' },
      }),
    ).toEqual({ kind: 'miniboss', encounterDefinitionKey: 'MiniBossCrawler' });
  });
});

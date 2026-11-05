import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';
import {
  candidateRoomIcon,
  workspaceRoomIcon,
  occurrenceRoomIcon,
} from '@planner/projections/structured-workspace/presentation/room-icon';

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

  it('shows an Opening by its fight, or as an empty room where it has none', () => {
    const declaration = catalog.rooms.byKey['F_Opening01'];
    if (declaration === undefined) throw new Error('F_Opening01 is not declared');
    expect(candidateRoomIcon(catalog, 'F', declaration)).toEqual({ kind: 'combat', biomeKey: 'F' });
    expect(
      workspaceRoomIcon({
        biomeKey: 'F',
        declaration,
        encounter: { encounterDefinitionKey: 'OpeningEmpty', nonCombat: true },
        shop: false,
      }),
    ).toEqual({ kind: 'empty', biomeKey: 'F' });
  });

  it('shows a Hub by its own room kind', () => {
    const declaration = catalog.rooms.byKey['N_Hub'];
    if (declaration === undefined) throw new Error('N_Hub is not declared');
    expect(candidateRoomIcon(catalog, 'N', declaration)).toEqual({ kind: 'hub', biomeKey: 'N' });
  });
});

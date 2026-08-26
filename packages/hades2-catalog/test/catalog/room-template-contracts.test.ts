import { describe, expect, it } from 'vitest';

import { CatalogContractError, createCatalog } from '@run-planner/hades2-catalog';
import { declarations, type RawCatalogInput } from '@run-planner/hades2-catalog/test-support';

function input(): RawCatalogInput {
  return JSON.parse(JSON.stringify(declarations)) as RawCatalogInput;
}

describe('room template contracts', () => {
  it('rejects an Ephyra combat room without its required SoulPylon', () => {
    const raw = input();
    const room = raw.rooms.find((candidate) => candidate.gameName === 'N_Combat01');
    if (room === undefined) throw new Error('missing N_Combat01 fixture');
    (room as { requiredObjects?: unknown }).requiredObjects = [];
    expect(() => createCatalog(raw)).toThrow(CatalogContractError);
  });

  it('keeps Fields and Ship contracts closed over their encounter envelopes', () => {
    const catalog = createCatalog(declarations);
    expect(catalog.rooms.byKey.H_Combat01?.mode).toEqual({
      kind: 'authored',
      templateKey: 'FieldsCombat',
    });
    expect(catalog.rooms.byKey.N_Combat01?.mode).toEqual({
      kind: 'authored',
      templateKey: 'EphyraCombat',
    });
    expect(catalog.rooms.byKey.O_Combat04?.mode).toEqual({
      kind: 'authored',
      templateKey: 'ShipCombat',
    });
  });
});

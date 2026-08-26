import { describe, expect, it } from 'vitest';

import { CatalogContractError, createCatalog } from '@run-planner/hades2-catalog';
import { declarations, type RawCatalogInput } from '@run-planner/hades2-catalog/test-support';

function input(): RawCatalogInput {
  return JSON.parse(JSON.stringify(declarations)) as RawCatalogInput;
}

describe('room common normalization', () => {
  it('freezes normalized common room fields', () => {
    const room = createCatalog(declarations).rooms.byKey.F_Combat01;
    expect(room).toBeDefined();
    expect(Object.isFrozen(room?.caps)).toBe(true);
    expect(Object.isFrozen(room?.structuralTags)).toBe(true);
    expect(Object.isFrozen(room?.resourcePointSupport)).toBe(true);
  });

  it('rejects unsupported structural tags before collection closure', () => {
    const raw = input();
    const room = raw.rooms.find((candidate) => candidate.gameName === 'F_Combat01');
    if (room === undefined) throw new Error('missing F_Combat01 fixture');
    (room as { structuralTags: unknown }).structuralTags = ['Unknown'];
    expect(() => createCatalog(raw)).toThrow(CatalogContractError);
  });
});

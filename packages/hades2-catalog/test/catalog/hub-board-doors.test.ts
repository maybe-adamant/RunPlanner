import { describe, expect, it } from 'vitest';

import { catalog, createCatalog } from '@run-planner/hades2-catalog';

import { cloneCatalogInput } from './support/catalog-input';

function hubSlots(input: ReturnType<typeof cloneCatalogInput>) {
  const n = input.biomeLayouts.find((layout) => layout.biomeKey === 'N');
  if (n?.progression.kind !== 'hub') throw new Error('missing N Hub fixture');
  return n.progression.slots as unknown as { offeredExitInsertionRank: number }[];
}

describe('Hub board door declarations', () => {
  it('ranks every Ephyra board door in the offered-exit insertion order', () => {
    const progression = catalog.biomeLayouts.byKey.N?.progression;
    if (progression?.kind !== 'hub') throw new Error('missing N Hub');
    const slots = [...progression.slots].sort(
      (left, right) => left.offeredExitInsertionRank - right.offeredExitInsertionRank,
    );

    expect(slots.map((slot) => slot.offeredExitInsertionRank)).toEqual(
      slots.map((_, index) => index),
    );
    expect(slots.map((slot) => slot.roomGameName)).toEqual([
      'N_Combat15',
      'N_Combat04',
      'N_Combat06',
      'N_Combat21',
      'N_Story01',
      'N_Combat02',
      'N_Combat23',
      'N_Combat18',
      'N_Combat19',
      'N_Combat12',
      'N_Combat01',
      'N_MiniBoss02',
      'N_Combat22',
      'N_Combat20',
      'N_Combat07',
      'N_Combat09',
      'N_Combat17',
      'N_Combat05',
      'N_Combat10',
      'N_Combat13',
      'N_Combat11',
      'N_Combat16',
      'N_MiniBoss01',
      'N_Combat14',
      'N_Combat08',
      'N_Combat03',
    ]);
  });

  it.each([
    ['a repeated rank', (ranks: number[]) => ranks.with(1, ranks[0]!), /duplicates/],
    ['a rank past the slots', (ranks: number[]) => ranks.with(0, ranks.length), /slot count/],
    ['a fractional rank', (ranks: number[]) => ranks.with(0, 0.5), /non-negative integer/],
    ['a negative rank', (ranks: number[]) => ranks.with(0, -1), /non-negative integer/],
  ])('rejects %s', (_, change, message) => {
    const input = cloneCatalogInput();
    const slots = hubSlots(input);
    const ranks = change(slots.map((slot) => slot.offeredExitInsertionRank));
    for (const [index, slot] of slots.entries()) slot.offeredExitInsertionRank = ranks[index]!;
    expect(() => createCatalog(input)).toThrow(message);
  });
});

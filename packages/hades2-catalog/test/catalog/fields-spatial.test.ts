import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';

describe('Fields spatial declarations', () => {
  it('declares the exact Fields optional pickup capacity for every H combat map', () => {
    expect(
      Object.fromEntries(
        Array.from({ length: 15 }, (_, index) => {
          const gameName = `H_Combat${String(index + 1).padStart(2, '0')}`;
          return [
            gameName,
            catalog.rooms.byKey[gameName]?.fieldsOptionalRewards?.optionalRewardCapacity,
          ];
        }),
      ),
    ).toEqual({
      H_Combat01: 4,
      H_Combat02: 3,
      H_Combat03: 4,
      H_Combat04: 4,
      H_Combat05: 4,
      H_Combat06: 4,
      H_Combat07: 3,
      H_Combat08: 3,
      H_Combat09: 2,
      H_Combat10: 4,
      H_Combat11: 2,
      H_Combat12: 3,
      H_Combat13: 2,
      H_Combat14: 2,
      H_Combat15: 2,
    });
  });

  it('declares the reviewed physical point domains for every H combat map', () => {
    expect(
      Object.fromEntries(
        Array.from({ length: 15 }, (_, index) => {
          const gameName = `H_Combat${String(index + 1).padStart(2, '0')}`;
          const spatial = catalog.rooms.byKey[gameName]?.fieldsSpatial;
          return [
            gameName,
            [
              spatial?.entryPairs.length,
              spatial?.cagePointIds.length,
              spatial?.optionalPointIds.length,
            ],
          ];
        }),
      ),
    ).toEqual({
      H_Combat01: [1, 5, 4],
      H_Combat02: [2, 3, 3],
      H_Combat03: [1, 3, 5],
      H_Combat04: [4, 4, 7],
      H_Combat05: [2, 5, 7],
      H_Combat06: [4, 5, 4],
      H_Combat07: [4, 3, 3],
      H_Combat08: [2, 3, 3],
      H_Combat09: [1, 3, 2],
      H_Combat10: [3, 5, 4],
      H_Combat11: [3, 5, 2],
      H_Combat12: [2, 3, 3],
      H_Combat13: [2, 2, 2],
      H_Combat14: [2, 2, 2],
      H_Combat15: [2, 3, 2],
    });
    expect(catalog.rooms.byKey.H_Combat04?.fieldsSpatial?.nemesisExcludedOptionalPointIds).toEqual([
      572886,
    ]);
    expect(catalog.rooms.byKey.H_Combat13?.fieldsSpatial?.cagePointIds).toContain(621502);
    expect(catalog.rooms.byKey.H_Combat13?.fieldsSpatial?.cagePointIds).toHaveLength(2);
  });
});

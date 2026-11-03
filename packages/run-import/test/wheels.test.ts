import { describe, expect, it } from 'vitest';

import { alternativeValues, sideSplits } from '../src/wheels';

const same = (left: string, right: string) => left === right;

describe('the values other fits of a ship room hold beside the chosen one', () => {
  it('names nothing when every other fit holds the chosen values', () => {
    expect(alternativeValues(['MaxManaDrop', 'Boon'], [['MaxManaDrop', 'Boon']], same)).toEqual([
      [],
      [],
    ]);
  });

  it('names, per offer, each other value once', () => {
    expect(
      alternativeValues(
        ['MaxManaDrop', 'Boon'],
        [
          ['MaxManaDrop', 'StackUpgrade'],
          ['RoomMoneyDrop', 'Boon'],
          ['RoomMoneyDrop', 'StackUpgrade'],
        ],
        same,
      ),
    ).toEqual([['RoomMoneyDrop'], ['StackUpgrade']]);
  });
});

describe("splitting a mixed-side ship's Left and Right uses among its wheels", () => {
  it('lists every split once, the Left picks first in setup order first', () => {
    expect(sideSplits(2, 1)).toEqual([
      [1, 2],
      [2, 1],
    ]);
    expect(sideSplits(3, 1)).toEqual([
      [1, 2, 2],
      [2, 1, 2],
      [2, 2, 1],
    ]);
    expect(sideSplits(3, 2)).toEqual([
      [1, 1, 2],
      [1, 2, 1],
      [2, 1, 1],
    ]);
  });
});

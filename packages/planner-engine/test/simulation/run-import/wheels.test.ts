import { describe, expect, it } from 'vitest';

import { chooseWheelFit, sideSplits } from '../../../src/simulation/run-import/wheels';

const same = (left: string, right: string) => left === right;

describe('choosing among the fits of a ship room', () => {
  it('authors the first fit and reports nothing when every fit leaves one exit state', () => {
    expect(
      chooseWheelFit(
        [
          { values: ['MaxManaDrop', 'Boon'], fingerprint: 'a' },
          { values: ['Boon', 'MaxManaDrop'], fingerprint: 'a' },
        ],
        same,
      ),
    ).toEqual({ chosen: ['MaxManaDrop', 'Boon'], alternatives: [[], []] });
  });

  it("names, per offer, each other exit state's first value that differs from the chosen one", () => {
    expect(
      chooseWheelFit(
        [
          { values: ['MaxManaDrop', 'Boon'], fingerprint: 'a' },
          { values: ['Boon', 'MaxManaDrop'], fingerprint: 'a' },
          { values: ['MaxManaDrop', 'StackUpgrade'], fingerprint: 'b' },
          { values: ['RoomMoneyDrop', 'Boon'], fingerprint: 'b' },
          { values: ['RoomMoneyDrop', 'StackUpgrade'], fingerprint: 'c' },
        ],
        same,
      ),
    ).toEqual({
      chosen: ['MaxManaDrop', 'Boon'],
      alternatives: [['RoomMoneyDrop'], ['StackUpgrade']],
    });
  });

  it('has nothing to author without a fit', () => {
    expect(chooseWheelFit([], same)).toBeUndefined();
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

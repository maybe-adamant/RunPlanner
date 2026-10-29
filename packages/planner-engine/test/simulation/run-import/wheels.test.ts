import { describe, expect, it } from 'vitest';

import { chooseWheelFit } from '../../../src/simulation/run-import/wheels';

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

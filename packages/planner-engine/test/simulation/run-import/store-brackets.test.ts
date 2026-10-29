import { describe, expect, it } from 'vitest';

import {
  solveReplacedRewards,
  type Counts,
} from '../../../src/simulation/run-import/store-brackets';

const FILLS: Readonly<Record<string, Counts>> = {
  RunProgress: { Boon: 2, MaxHealthDrop: 1, RoomMoneyDrop: 1 },
  MetaProgress: { GiftDrop: 1, MetaCurrencyBigDrop: 1 },
};

const solve = (
  before: Readonly<Record<string, Counts>>,
  after: Readonly<Record<string, Counts>>,
  rerolls: number,
) =>
  solveReplacedRewards({
    before: new Map(Object.entries(before)),
    after: new Map(Object.entries(after)),
    fill: (storeKey) => FILLS[storeKey] ?? {},
    order: (storeKey) => Object.keys(FILLS[storeKey] ?? {}),
    rerolls,
  });

describe('replaced rewards of a reroll bracket', () => {
  it('takes each store its own refill difference, in store and declaration order', () => {
    // The game refilled RunProgress for its extra draw and the plan did not; MetaProgress lost one.
    expect(
      solve(
        { RunProgress: { Boon: 0 }, MetaProgress: { GiftDrop: 0 } },
        {
          RunProgress: { Boon: -2, MaxHealthDrop: 0, RoomMoneyDrop: -1 },
          MetaProgress: { GiftDrop: 1, MetaCurrencyBigDrop: 0 },
        },
        2,
      ),
    ).toEqual({
      kind: 'solved',
      replaced: [
        { storeKey: 'MetaProgress', rewardType: 'GiftDrop' },
        { storeKey: 'RunProgress', rewardType: 'MaxHealthDrop' },
      ],
    });
  });

  it('keeps a persisting difference out of the bracket', () => {
    expect(
      solve({ RunProgress: { Boon: 1 } }, { RunProgress: { Boon: 1, RoomMoneyDrop: 1 } }, 1),
    ).toEqual({
      kind: 'solved',
      replaced: [{ storeKey: 'RunProgress', rewardType: 'RoomMoneyDrop' }],
    });
  });

  it('names the smallest loss when the stores lose another count than expected', () => {
    expect(solve({}, { RunProgress: { Boon: 1, RoomMoneyDrop: 1 } }, 1)).toEqual({
      kind: 'unsolved',
      smallest: 2,
    });
    // A store the plan holds more of than the game, past one whole refill, explains nothing.
    expect(solve({}, { RunProgress: { Boon: -3 } }, 1)).toEqual({ kind: 'unsolved' });
  });
});

import { describe, expect, it } from 'vitest';

import {
  solveBracketDraws,
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

describe('unknown draws of a bracket', () => {
  const draws = (
    before: Readonly<Record<string, Counts>>,
    after: Readonly<Record<string, Counts>>,
    count: number,
    planned: readonly { readonly storeKey: string; readonly rewardType: string }[] = [],
  ) =>
    solveBracketDraws({
      before: new Map(Object.entries(before)),
      after: new Map(Object.entries(after)),
      fill: (storeKey) => FILLS[storeKey] ?? {},
      order: (storeKey) => Object.keys(FILLS[storeKey] ?? {}),
      planned,
      draws: count,
    });

  it("adds back the plan's own draws on the unknown owners", () => {
    // The plan drew RoomMoneyDrop where the game drew a Boon; it now holds one Boon more.
    expect(
      draws({ RunProgress: {} }, { RunProgress: { Boon: 1, RoomMoneyDrop: -1 } }, 1, [
        { storeKey: 'RunProgress', rewardType: 'RoomMoneyDrop' },
      ]),
    ).toEqual({ solutions: [[{ storeKey: 'RunProgress', rewardType: 'Boon' }]], smallest: 1 });
  });

  it('returns every refill choice that explains the count', () => {
    // RunProgress's four draws with no refill difference, or a whole fill less of RunProgress
    // and two MetaProgress fills' worth of draws: both total four.
    expect(
      draws(
        { RunProgress: {}, MetaProgress: {} },
        {
          RunProgress: { Boon: 2, MaxHealthDrop: 1, RoomMoneyDrop: 1 },
          MetaProgress: { GiftDrop: 1, MetaCurrencyBigDrop: 1 },
        },
        4,
      ).solutions,
    ).toEqual([
      [
        { storeKey: 'RunProgress', rewardType: 'Boon' },
        { storeKey: 'RunProgress', rewardType: 'Boon' },
        { storeKey: 'RunProgress', rewardType: 'MaxHealthDrop' },
        { storeKey: 'RunProgress', rewardType: 'RoomMoneyDrop' },
      ],
      [
        { storeKey: 'MetaProgress', rewardType: 'GiftDrop' },
        { storeKey: 'MetaProgress', rewardType: 'GiftDrop' },
        { storeKey: 'MetaProgress', rewardType: 'MetaCurrencyBigDrop' },
        { storeKey: 'MetaProgress', rewardType: 'MetaCurrencyBigDrop' },
      ],
    ]);
  });
});

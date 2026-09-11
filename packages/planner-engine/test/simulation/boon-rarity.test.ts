import { describe, expect, it } from 'vitest';
import { deriveBoonRarityLedger } from '@run-planner/engine/simulation';

const ordinaryOrder = ['Common', 'Rare', 'Epic', 'Duo', 'Legendary'] as const;
const olympian = { Rare: 0.1, Epic: 0.05, Heroic: 0, Duo: 0.12, Legendary: 0.1 } as const;
const hermes = { Rare: 0.06, Epic: 0.03, Heroic: 0, Duo: 0, Legendary: 0.01 } as const;

describe('boon rarity ledger', () => {
  it('uses provider bases and sparse overrides without normalizing', () => {
    expect(
      deriveBoonRarityLedger(
        { providerBase: olympian, rollOrder: ordinaryOrder, contributions: [] },
        ['Common', 'Rare', 'Epic', 'Duo', 'Legendary'],
      ).values,
    ).toEqual(olympian);
    expect(
      deriveBoonRarityLedger(
        {
          providerBase: hermes,
          rollOrder: ordinaryOrder,
          itemOverride: { Rare: 0.9 },
          contributions: [],
        },
        ['Common', 'Rare', 'Epic', 'Duo', 'Legendary'],
      ).values,
    ).toEqual({ Rare: 0.9, Epic: 0.03, Heroic: 0, Duo: 0, Legendary: 0.01 });
  });

  it('lets room override win, sums additions before multipliers, retains values above one, and keeps high tiers optional', () => {
    const result = deriveBoonRarityLedger(
      {
        providerBase: olympian,
        rollOrder: ordinaryOrder,
        roomOverride: { Rare: 1, Epic: 0.7 },
        itemOverride: { Rare: 0.9, Epic: 0.25, Legendary: 0.1 },
        contributions: [
          { additive: { Rare: 0.5, Legendary: 0.1 } },
          { multiplicative: { Rare: 2, Legendary: 1.5 } },
        ],
      },
      ['Common', 'Rare', 'Epic', 'Legendary'],
    );
    expect(result.values).toMatchObject({ Rare: 3, Epic: 0.7, Duo: 0.12 });
    expect(result.values.Legendary).toBeCloseTo(0.3);
    expect(result.possibleFreshRarities).toEqual(['Rare', 'Epic', 'Legendary']);
  });

  it('rejects Common at a guaranteed later check and never introduces Heroic', () => {
    const result = deriveBoonRarityLedger(
      {
        providerBase: olympian,
        rollOrder: ordinaryOrder,
        contributions: [{ additive: { Rare: 1 } }],
      },
      ['Common', 'Rare', 'Epic', 'Heroic'],
    );
    expect(result.possibleFreshRarities).toEqual(['Rare', 'Epic']);
  });

  it('ignores unsupported guaranteed checks when deriving a declared rarity domain', () => {
    const result = deriveBoonRarityLedger(
      {
        providerBase: { Rare: 0.2, Epic: 0, Heroic: 0, Duo: 1, Legendary: 1 },
        rollOrder: ordinaryOrder,
        contributions: [],
      },
      ['Common', 'Rare'],
    );
    expect(result.possibleFreshRarities).toEqual(['Common', 'Rare']);
  });

  it('admits Heroic only when the source order and source chance declare it', () => {
    const athenaOrder = ['Common', 'Rare', 'Epic', 'Heroic'] as const;
    expect(
      deriveBoonRarityLedger(
        {
          providerBase: olympian,
          rollOrder: athenaOrder,
          itemOverride: { Heroic: 1 },
          contributions: [],
        },
        ['Common', 'Rare', 'Epic', 'Heroic'],
      ).possibleFreshRarities,
    ).toEqual(['Heroic']);
    expect(
      deriveBoonRarityLedger(
        {
          providerBase: olympian,
          rollOrder: ordinaryOrder,
          itemOverride: { Heroic: 1 },
          contributions: [],
        },
        ['Common', 'Rare', 'Epic', 'Heroic'],
      ).possibleFreshRarities,
    ).toEqual(['Common', 'Rare', 'Epic']);
  });
});

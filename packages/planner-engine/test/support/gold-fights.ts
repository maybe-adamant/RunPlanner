import { expect } from 'vitest';

import { semanticAddressKey } from '@run-planner/engine/authored-project';
import type { GoldRoomSpending } from '@run-planner/engine/simulation';

/**
 * A room's fight summaries as source lists keyed by fight, after checking each
 * against the ledger gains it joins: means and variances add per source and in total.
 */
export function checkedGoldFights(room: GoldRoomSpending): ReadonlyMap<string, readonly string[]> {
  const byFight = new Map<string, readonly string[]>();
  for (const summary of room.fights) {
    const key = semanticAddressKey(summary.fight);
    const joined = room.gains.filter(
      (gain) => gain.fight !== undefined && semanticAddressKey(gain.fight.fight) === key,
    );
    const total = (gains: typeof joined) => ({
      mean: gains.reduce((sum, gain) => sum + gain.amount!.mean, 0),
      variance: gains.reduce((sum, gain) => sum + gain.amount!.variance, 0),
    });
    const all = total(joined);
    expect(summary.mean).toBeCloseTo(all.mean, 9);
    expect(summary.spread).toBeCloseTo(Math.sqrt(all.variance), 9);
    expect(summary.exact).toBe(all.variance === 0);
    for (const line of summary.breakdown) {
      const part = total(joined.filter((gain) => gain.fight!.source === line.source));
      expect(line.mean).toBeCloseTo(part.mean, 9);
      expect(line.spread).toBeCloseTo(Math.sqrt(part.variance), 9);
      expect(line.exact).toBe(part.variance === 0);
    }
    expect(new Set(summary.breakdown.map((line) => line.source))).toEqual(
      new Set(joined.map((gain) => gain.fight!.source)),
    );
    byFight.set(
      key,
      summary.breakdown.map((line) => line.source),
    );
  }
  return byFight;
}

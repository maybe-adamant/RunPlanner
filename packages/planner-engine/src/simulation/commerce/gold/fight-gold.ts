import {
  semanticAddressKey,
  type EncounterPhaseAddress,
  type RoomActionAddress,
} from '../../../authored-project/addresses';
import type { GoldFightAttribution, GoldFightSource } from './gain-context';
import { sumGold, type GoldAmount } from './prices';

/** One source's share of a fight's gold: its mean and standard deviation. */
export interface GoldFightSourceAmount {
  readonly source: GoldFightSource;
  readonly mean: number;
  readonly spread: number;
  /** No variance: the amount is certain. */
  readonly exact: boolean;
}

/**
 * The gold one fight paid: an encounter phase, or a challenge switch's or
 * locked door's fight at its press. Its terms are independent, so their means
 * and variances add.
 */
export interface GoldFightSummary {
  readonly fight: EncounterPhaseAddress | RoomActionAddress;
  readonly mean: number;
  readonly spread: number;
  readonly exact: boolean;
  /** One entry per source, in source order. */
  readonly breakdown: readonly GoldFightSourceAmount[];
}

/** A priced gain's fight and amount. */
export interface GoldFightGain {
  readonly attribution: GoldFightAttribution;
  readonly amount: GoldAmount;
}

const SOURCE_ORDER: readonly GoldFightSource[] = Object.freeze([
  'enemies',
  'passiveStore',
  'heraclesBounty',
  'medea',
]);

const moments = (amount: GoldAmount) => ({
  mean: amount.mean,
  spread: Math.sqrt(amount.variance),
  exact: amount.variance === 0,
});

/** The gold a room pays at its entry, its urns: its mean and standard deviation. */
export interface GoldRoomEntrySummary {
  readonly mean: number;
  readonly spread: number;
  /** No variance: the amount is certain. */
  readonly exact: boolean;
}

/** The room-entry summary of these amounts; undefined when there are none. */
export function goldRoomEntrySummary(
  amounts: readonly GoldAmount[],
): GoldRoomEntrySummary | undefined {
  return amounts.length === 0 ? undefined : Object.freeze(moments(sumGold(amounts)));
}

/** Each fight's gold summary in the order its first gain was paid. */
export function goldFightSummaries(gains: readonly GoldFightGain[]): readonly GoldFightSummary[] {
  const fights = new Map<
    string,
    {
      readonly fight: EncounterPhaseAddress | RoomActionAddress;
      readonly bySource: Map<GoldFightSource, GoldAmount[]>;
    }
  >();
  for (const { attribution, amount } of gains) {
    const key = semanticAddressKey(attribution.fight);
    let fight = fights.get(key);
    if (fight === undefined) {
      fight = { fight: attribution.fight, bySource: new Map() };
      fights.set(key, fight);
    }
    const amounts = fight.bySource.get(attribution.source) ?? [];
    amounts.push(amount);
    fight.bySource.set(attribution.source, amounts);
  }
  return Object.freeze(
    [...fights.values()].map(({ fight, bySource }) => {
      const breakdown = SOURCE_ORDER.flatMap((source) => {
        const amounts = bySource.get(source);
        return amounts === undefined
          ? []
          : [Object.freeze({ source, ...moments(sumGold(amounts)) })];
      });
      return Object.freeze({
        fight,
        ...moments(sumGold([...bySource.values()].flat())),
        breakdown: Object.freeze(breakdown),
      });
    }),
  );
}

import {
  semanticAddressKey,
  type EncounterPhaseAddress,
  type RoomActionAddress,
  type SemanticAddress,
} from '../../../authored-project/addresses';
import type { GoldEstimate, GoldFightAttribution, GoldFightSource, GoldGain } from './gain-context';
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

/** The gold one timeline action paid or took outside a fight. */
export interface GoldRowSummary {
  readonly roomAction: RoomActionAddress;
  readonly mean: number;
  readonly spread: number;
  /** No variance: the amount is certain. */
  readonly exact: boolean;
  /**
   * The fixed estimates its gains paid, in payment order, such as a Time
   * switch's claim or Heracles's bounty; absent when none is estimated.
   */
  readonly estimates?: readonly GoldEstimate[];
}

/** One encounter phase's settled Nemesis bet. */
export interface GoldBetSummary {
  readonly phase: EncounterPhaseAddress;
  readonly mean: number;
  readonly spread: number;
  /** No variance: the amount is certain. */
  readonly exact: boolean;
}

/** A priced room gain as the summaries read it. */
interface SummarizedGain {
  readonly kind: GoldGain['kind'];
  readonly owner?: SemanticAddress;
  readonly roomAction?: RoomActionAddress;
  readonly amount?: GoldAmount;
  readonly fight?: GoldFightAttribution;
  readonly estimate?: GoldEstimate;
}

/**
 * Each action's summed gold outside its fights, in the order its first gain
 * was paid; an action with a gain past an unavailable balance has none.
 */
export function goldRowSummaries(gains: readonly SummarizedGain[]): readonly GoldRowSummary[] {
  const rows = new Map<
    string,
    {
      readonly roomAction: RoomActionAddress;
      readonly amounts: (GoldAmount | undefined)[];
      readonly estimates: GoldEstimate[];
    }
  >();
  for (const { roomAction, amount, fight, estimate } of gains) {
    if (roomAction === undefined || fight !== undefined) continue;
    const key = semanticAddressKey(roomAction);
    const row = rows.get(key) ?? { roomAction, amounts: [], estimates: [] };
    row.amounts.push(amount);
    if (estimate !== undefined) row.estimates.push(estimate);
    rows.set(key, row);
  }
  return Object.freeze(
    [...rows.values()].flatMap(({ roomAction, amounts, estimates }) =>
      amounts.every((amount): amount is GoldAmount => amount !== undefined)
        ? [
            Object.freeze({
              roomAction,
              ...moments(sumGold(amounts)),
              ...(estimates.length === 0 ? {} : { estimates: Object.freeze(estimates) }),
            }),
          ]
        : [],
    ),
  );
}

/** Each encounter phase's priced Nemesis bet, in settlement order. */
export function goldBetSummaries(gains: readonly SummarizedGain[]): readonly GoldBetSummary[] {
  return Object.freeze(
    gains.flatMap(({ kind, owner, amount }) =>
      kind !== 'nemesisBet' || owner?.kind !== 'encounterPhase' || amount === undefined
        ? []
        : [Object.freeze({ phase: owner, ...moments(amount) })],
    ),
  );
}

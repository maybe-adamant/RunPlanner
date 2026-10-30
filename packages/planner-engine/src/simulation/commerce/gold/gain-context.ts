import type { Catalog } from '../../../catalog-schema';
import type { OccurrenceAddress, SemanticAddress } from '../../../authored-project/addresses';
import type { SimulationState } from '../../state/model';
import type { PurchasePriceUnpriced } from './price-context';

/**
 * The gold multipliers held at one moment: the additive money multiplier
 * (Quick Buck, Chaos Affluence), the money-reward bonus non-NPC money pickups
 * add to it (Buried Treasure), and whether a held curse blocks gold.
 */
export interface GoldMultipliers {
  readonly moneyMultiplier: number;
  readonly moneyRewardBonus: number;
  readonly blocksGold: boolean;
}

/** What one walked contact pays or takes, before its multipliers. */
export type GoldGain =
  /** The Boatman Arcana and Gold Purse at run start, unmultiplied. */
  | { readonly kind: 'startingGold'; readonly gold: number }
  /** A Boatman Arcana activated or raised mid-run pays its difference, unmultiplied. */
  | { readonly kind: 'arcanaGold'; readonly gold: number }
  /** A money pickup; an NPC drop takes no money-reward bonus. */
  | { readonly kind: 'moneyPickup'; readonly gold: number; readonly npcDrop: boolean }
  /** A trait-produced `Currency` pickup (Narcissus), times the money multiplier only. */
  | { readonly kind: 'currencyPickup'; readonly gold: number }
  | { readonly kind: 'fallbackGold'; readonly gold: number }
  /** A Gold Purse equipped mid-run or repeated by Echo. */
  | { readonly kind: 'keepsakeGold'; readonly gold: number }
  /** A reward Time Piece converted, at its `GoldifyValue`. */
  | { readonly kind: 'timePiece'; readonly gold: number }
  /** A Price of Midas purchase's payout. */
  | { readonly kind: 'midasPayout'; readonly itemKey: string }
  | {
      readonly kind: 'poolSale';
      readonly traitKey: string;
      readonly rarity:
        'Common' | 'Rare' | 'Epic' | 'Heroic' | 'Duo' | 'Legendary' | 'infusion' | 'unranked';
      readonly level: number;
    }
  /** A loan takes the held gold and stores it with its return. */
  | { readonly kind: 'loanTake'; readonly traitKey: string; readonly returnGold: number }
  /** A loan's rarity change adds the difference to its stored return. */
  | { readonly kind: 'loanCredit'; readonly traitKey: string; readonly returnGold: number }
  /** The next non-final boss pays a loan's stored gold. */
  | { readonly kind: 'loanPayback'; readonly traitKey: string }
  /** A Nemesis combat's bet, assumed won until its outcome is authored. */
  | { readonly kind: 'nemesisBet'; readonly maxBet: number }
  /** Gold paid for a Nemesis trade, an integer drawn evenly from its range. */
  | { readonly kind: 'nemesisTrade'; readonly min: number; readonly max: number };

export interface GoldEventContext {
  readonly gain: GoldGain;
  readonly multipliers: GoldMultipliers;
}

/** One reached gold contact with the distinct readings of its reached branches. */
export interface GoldGainPublication {
  readonly kind: 'gain';
  readonly sequence: number;
  /** Absent for run-start gold, which precedes every room. */
  readonly room?: OccurrenceAddress;
  readonly owner?: SemanticAddress;
  readonly contexts: readonly GoldEventContext[];
  readonly unpriced?: PurchasePriceUnpriced;
}

/** A room's entry, and the point its doors open, which the room's door-open balance reads. */
export interface GoldRoomMarkerPublication {
  readonly kind: 'roomEntered' | 'doorsOpen';
  readonly sequence: number;
  readonly room: OccurrenceAddress;
}

export type GoldEventPublication = GoldGainPublication | GoldRoomMarkerPublication;

/**
 * The gold multipliers a state holds; undefined while a held money multiplier
 * has no authored value.
 */
export function goldMultipliers(
  catalog: Catalog,
  state: SimulationState,
): GoldMultipliers | undefined {
  let moneyMultiplier = 1;
  let moneyRewardBonus = 1;
  for (const equipped of Object.values(state.traitHistory.equippedTraits)) {
    const gold = catalog.traits.byKey[equipped.traitKey]?.gold;
    if (gold === undefined || gold.kind === 'loan') continue;
    const value =
      equipped.rarity === undefined
        ? undefined
        : gold.byRarity[equipped.rarity as keyof typeof gold.byRarity];
    if (value === undefined) return undefined;
    if (gold.kind === 'moneyMultiplier') moneyMultiplier += value - 1;
    else moneyRewardBonus += value - 1;
  }
  for (const blessing of state.traitHistory.maturedChaosBlessings) {
    const operandKey =
      catalog.chaos.blessings.byKey[blessing.blessingKey]?.moneyMultiplierOperandKey;
    if (operandKey === undefined) continue;
    const value = blessing.blessingValues[operandKey];
    if (value === undefined) return undefined;
    moneyMultiplier += value;
  }
  return Object.freeze({
    moneyMultiplier,
    moneyRewardBonus,
    blocksGold: state.traitHistory.activeChaosCurses.some(
      (curse) => catalog.chaos.curses.byKey[curse.curseKey]?.blocksGold === true,
    ),
  });
}

/**
 * Publishes one gold contact. Each reading pairs the gain a branch settled
 * with the multipliers a branch held; distinct readings are kept for the
 * query to refuse, and a reading with an unauthored multiplier is unresolved.
 */
export function goldGainPublication(inputs: {
  readonly sequence: number;
  readonly room?: OccurrenceAddress;
  readonly owner?: SemanticAddress;
  readonly readings: readonly {
    readonly gain: GoldGain;
    readonly multipliers: GoldMultipliers | undefined;
  }[];
  readonly unpriced?: PurchasePriceUnpriced;
}): GoldGainPublication {
  const distinct = new Map<string, GoldEventContext>();
  let unresolved = false;
  for (const reading of inputs.readings) {
    if (reading.multipliers === undefined) {
      unresolved = true;
      continue;
    }
    const context = Object.freeze({
      gain: Object.freeze(reading.gain),
      multipliers: reading.multipliers,
    });
    distinct.set(JSON.stringify(context), context);
  }
  const unpriced =
    inputs.unpriced ??
    (unresolved ? Object.freeze({ kind: 'itemUnresolved' as const }) : undefined);
  return Object.freeze({
    kind: 'gain',
    sequence: inputs.sequence,
    ...(inputs.room === undefined ? {} : { room: inputs.room }),
    ...(inputs.owner === undefined ? {} : { owner: inputs.owner }),
    contexts: Object.freeze([...distinct.values()]),
    ...(unpriced === undefined ? {} : { unpriced }),
  });
}

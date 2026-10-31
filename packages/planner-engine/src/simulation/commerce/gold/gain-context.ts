import type { Catalog, InRunTraitRarity } from '../../../catalog-schema';
import type { OccurrenceAddress, SemanticAddress } from '../../../authored-project/addresses';
import type { AuthoredNemesisBetOutcome } from '../../../authored-project/model';
import type { SimulationState } from '../../state/model';
import type { KnownRoster } from './known-roster';
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

/** The money multiplier and money-reward bonus a dropped coin object was valued with. */
export interface GoldSpawnMultipliers {
  readonly moneyMultiplier: number;
  readonly moneyRewardBonus: number;
}

/** One held money multiplier: a Quick Buck or a matured Chaos Affluence, with its value. */
export interface MoneyMultiplierSource {
  readonly key: string;
  readonly value: number;
}

/**
 * What a dropped coin object reads when it spawns: the multipliers then, and
 * the money multipliers then held, so the ones taken later can be told apart.
 */
export interface GoldSpawnReading {
  readonly multipliers: GoldSpawnMultipliers;
  readonly sources: readonly MoneyMultiplierSource[];
}

/** What one walked contact pays or takes, before its multipliers. */
export type GoldGain =
  /** The Boatman Arcana and Gold Purse at run start, unmultiplied. */
  | { readonly kind: 'startingGold'; readonly gold: number }
  /** A Boatman Arcana activated or raised mid-run pays its difference, unmultiplied. */
  | { readonly kind: 'arcanaGold'; readonly gold: number }
  /**
   * A money pickup; an NPC drop takes no money-reward bonus. `spawn` holds
   * the multipliers it was valued with when it spawned, and `remultipliers`
   * each money multiplier taken while it lay uncollected as a room object.
   */
  | {
      readonly kind: 'moneyPickup';
      readonly gold: number;
      readonly npcDrop: boolean;
      readonly spawn?: GoldSpawnMultipliers;
      readonly remultipliers?: readonly number[];
    }
  /** A trait-produced `Currency` pickup (Narcissus), times the money multiplier only. */
  | {
      readonly kind: 'currencyPickup';
      readonly gold: number;
      readonly spawn?: GoldSpawnMultipliers;
    }
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
  /** A Nemesis combat's bet on its authored kill race; an unauthored race is won. */
  | {
      readonly kind: 'nemesisBet';
      readonly maxBet: number;
      readonly outcome: AuthoredNemesisBetOutcome;
    }
  /** Gold paid for a Nemesis trade, an integer drawn evenly from its range. */
  | { readonly kind: 'nemesisTrade'; readonly min: number; readonly max: number }
  /**
   * A completed encounter's kill gold, estimated from its store; a Fields
   * room's one Passive store is paid at its first cage. Its multipliers are
   * those held at the door into its room: native chooses and generates every
   * modelled phase there, Nemesis, god and cage combats included
   * (RoomLogic.lua:4376-4387, 4423-4427). Stores generated later
   * (challenge switches, encounter-cost doors, boss spawns) belong to
   * encounters the plan does not model.
   */
  | {
      readonly kind: 'enemyGold';
      readonly encounterKey: string;
      /** The room's biome, whose payout policy a generated combat reads. */
      readonly biomeKey: string;
      readonly runDepth: number;
      readonly hordesRank: number;
      /** The phase's fully determined roster, which pays in place of the biome policy. */
      readonly roster?: KnownRoster;
    }
  /** Heracles's bounty for the encounter's credited kills, unmultiplied. */
  | { readonly kind: 'heraclesBounty'; readonly encounterKey: string }
  /** Wealth from the Dead over the room's completed encounters when its doors open. */
  | {
      readonly kind: 'medeaGold';
      readonly goldPerDrop: number;
      /** The per-kill chance times the held luck multiplier. */
      readonly chance: number;
      readonly dropCap: number;
      readonly encounters: readonly {
        readonly encounterKey: string;
        readonly biomeKey: string;
        readonly hordesRank: number;
        /** A fully determined roster, whose kills replace the policy's expected kills. */
        readonly roster?: KnownRoster;
      }[];
    }
  /** The room's golden urns, swapped in as it starts. */
  | { readonly kind: 'urnGold'; readonly roomGameName: string };

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
    if (gold === undefined || gold.kind === 'loan' || gold.kind === 'goldOnKill') continue;
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
 * Each held money multiplier in acquisition order; undefined while one has
 * no authored value.
 */
export function moneyMultiplierSources(
  catalog: Catalog,
  state: SimulationState,
): readonly MoneyMultiplierSource[] | undefined {
  const sources: MoneyMultiplierSource[] = [];
  for (const equipped of Object.values(state.traitHistory.equippedTraits)) {
    const gold = catalog.traits.byKey[equipped.traitKey]?.gold;
    if (gold?.kind !== 'moneyMultiplier') continue;
    const value =
      equipped.rarity === undefined
        ? undefined
        : gold.byRarity[equipped.rarity as keyof typeof gold.byRarity];
    if (value === undefined) return undefined;
    sources.push({ key: `trait:${equipped.traitKey}:${equipped.rarity}`, value });
  }
  state.traitHistory.maturedChaosBlessings.forEach((blessing, index) => {
    const operandKey =
      catalog.chaos.blessings.byKey[blessing.blessingKey]?.moneyMultiplierOperandKey;
    if (operandKey === undefined) return;
    const value = blessing.blessingValues[operandKey];
    if (value !== undefined)
      sources.push({ key: `blessing:${blessing.blessingKey}:${index}`, value: 1 + value });
  });
  return sources;
}

/** The spawn reading a state gives a coin object; undefined while a multiplier is unauthored. */
export function goldSpawnReading(
  catalog: Catalog,
  state: SimulationState,
): GoldSpawnReading | undefined {
  const multipliers = goldMultipliers(catalog, state);
  const sources = moneyMultiplierSources(catalog, state);
  if (multipliers === undefined || sources === undefined) return undefined;
  return Object.freeze({
    multipliers: Object.freeze({
      moneyMultiplier: multipliers.moneyMultiplier,
      moneyRewardBonus: multipliers.moneyRewardBonus,
    }),
    sources: Object.freeze(sources),
  });
}

/**
 * One spawn contact's reading over the reached branches' states: divergent
 * where they disagree, a gold-input divergence the walk refuses.
 */
export function goldSpawnReadingAcross(
  catalog: Catalog,
  states: readonly SimulationState[],
): GoldSpawnReading | 'divergent' | 'unresolved' {
  const readings = states.map((state) => goldSpawnReading(catalog, state));
  if (readings.some((reading) => reading === undefined)) return 'unresolved';
  return new Set(readings.map((reading) => JSON.stringify(reading))).size > 1
    ? 'divergent'
    : readings[0]!;
}

/**
 * Wealth from the Dead as a held trait pays it: gold per drop at its
 * acquisition ordinal, the per-kill chance times the summed luck multipliers
 * (`LuckMultiplier`, additive like every `IsMultiplier` total), and its cap.
 */
export function goldOnKillFacts(
  catalog: Catalog,
  state: SimulationState,
): { readonly goldPerDrop: number; readonly chance: number; readonly dropCap: number } | undefined {
  let luck = 1;
  let held: { goldPerDrop: number; chance: number; dropCap: number } | undefined;
  for (const equipped of Object.values(state.traitHistory.equippedTraits)) {
    const trait = catalog.traits.byKey[equipped.traitKey];
    const luckValue =
      equipped.rarity === undefined
        ? undefined
        : trait?.luckMultiplierByRarity?.[equipped.rarity as InRunTraitRarity];
    if (luckValue !== undefined) luck += luckValue - 1;
    const gold = trait?.gold;
    if (gold?.kind === 'goldOnKill') {
      const ordinal = Math.min(Math.max(equipped.acquisitionOrdinal ?? 1, 1), 4);
      held = {
        goldPerDrop: gold.goldByAcquisitionOrdinal[ordinal - 1]!,
        chance: gold.chance,
        dropCap: gold.dropCap,
      };
    }
  }
  return held === undefined ? undefined : Object.freeze({ ...held, chance: held.chance * luck });
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

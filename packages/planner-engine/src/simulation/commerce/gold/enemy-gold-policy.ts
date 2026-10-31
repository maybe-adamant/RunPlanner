/**
 * The engine's enemy-gold estimate policy: tunable approximations of what a
 * room's kills, Wealth from the Dead and golden urns pay. The money store is
 * exact catalog data; how much of it the kills pay is not plannable while
 * native still draws the roster, so it is estimated per biome from simulated
 * rosters and recorded runs (`scripts/gold-calibration.mjs` re-derives the
 * observed side). A fully determined roster pays in closed form instead
 * (`known-roster.ts`), so an all-fixed identity, a miniboss or a boss has no
 * entry here. Every value is a row of docs/design/GOLD_ESTIMATE_ASSUMPTIONS.md.
 */

/** Paid gold at the native drop chance, then at an `enemyGoldDropChance` of 25, 50, 75 and 100. */
export type DropChanceCells = readonly [number, number, number, number, number];

export type EnemyGoldPolicy =
  /**
   * Kills exhaust the store: they pay it plus the last drop's overshoot, the
   * cell value in gold before the money multiplier.
   */
  | {
      readonly kind: 'storeOvershoot';
      readonly overshoot: DropChanceCells;
      readonly residualSd: number;
      readonly kills: number;
    }
  /**
   * Kills often run out before the store: they pay the cell's fraction of it,
   * one row per Hordes rank where the rank matters.
   */
  | {
      readonly kind: 'storeFraction';
      readonly fractionByHordesRank: readonly DropChanceCells[];
      readonly residualSd: number;
      readonly kills: number;
    }
  /** A fixed spawn list: a mean and spread of what it pays, before the money multiplier. */
  | {
      readonly kind: 'constant';
      readonly mean: number;
      readonly sd: number;
      readonly kills: number;
    }
  /**
   * Kills drain the room's own encounter's store (a Fields cage drains the
   * Passive store, which prices them): they pay nothing of their own.
   */
  | { readonly kind: 'roomStore'; readonly kills: number }
  /** Kills pay nothing (bosses, story encounters, noncombat rooms). */
  | { readonly kind: 'none'; readonly kills: number };

const overshoot = (cells: DropChanceCells, residualSd: number, kills: number): EnemyGoldPolicy =>
  Object.freeze({ kind: 'storeOvershoot', overshoot: cells, residualSd, kills });
const fraction = (
  rows: readonly DropChanceCells[],
  residualSd: number,
  kills: number,
): EnemyGoldPolicy =>
  Object.freeze({ kind: 'storeFraction', fractionByHordesRank: rows, residualSd, kills });
const constant = (mean: number, sd: number, kills: number): EnemyGoldPolicy =>
  Object.freeze({ kind: 'constant', mean, sd, kills });
const roomStore = (kills: number): EnemyGoldPolicy => Object.freeze({ kind: 'roomStore', kills });

/** A Fields room's one store, which its kills always exhaust: see GOLD_ESTIMATE_ASSUMPTIONS.md "Fields store". */
const fieldsStore = (kills: number) => overshoot([9, 9, 9, 9, 9], 7, kills);

/** Generated combat by the room's biome (GOLD_ESTIMATE_ASSUMPTIONS.md "Enemy gold policy"); Fields combats run only in cages. */
const biomePolicies: Readonly<Record<string, EnemyGoldPolicy>> = Object.freeze({
  F: overshoot([1.9, -4.0, 1.1, 2.2, 2.3], 3.0, 12.5),
  G: overshoot([10.4, 4.4, 9.2, 9.8, 9.8], 14, 20.8),
  // GOLD_ESTIMATE_ASSUMPTIONS.md "Fields kills".
  H: roomStore(7.2),
  I: overshoot([8.0, 0, 7.4, 8.0, 8.0], 20.3, 10.4),
  N: fraction(
    [
      [0.85, 0.45, 0.79, 1.0, 1.13],
      [0.91, 0.5, 0.86, 1.05, 1.16],
      [0.96, 0.56, 0.91, 1.08, 1.19],
      [1.0, 0.61, 0.95, 1.11, 1.22],
    ],
    7.4,
    8.7,
  ),
  O: fraction(
    [
      [1.01, 0.51, 0.88, 1.08, 1.16],
      [1.06, 0.59, 0.96, 1.12, 1.18],
      [1.1, 0.66, 1.02, 1.15, 1.19],
      [1.12, 0.72, 1.05, 1.16, 1.19],
    ],
    9.3,
    9.7,
  ),
  P: fraction(
    [
      [0.9, 0.37, 0.7, 0.93, 1.07],
      [0.95, 0.41, 0.76, 0.99, 1.09],
      [1.0, 0.46, 0.82, 1.03, 1.1],
      [1.03, 0.51, 0.88, 1.05, 1.11],
    ],
    8.0,
    9.2,
  ),
  Q: fraction(
    [
      [0.73, 0.28, 0.54, 0.77, 0.94],
      [0.79, 0.32, 0.61, 0.83, 0.99],
      [0.85, 0.36, 0.67, 0.88, 1.04],
      [0.9, 0.41, 0.72, 0.94, 1.07],
    ],
    27.4,
    6.1,
  ),
});

/** Encounters whose roster or store differs from their biome's ordinary combat (GOLD_ESTIMATE_ASSUMPTIONS.md "Special combats"). */
const encounterPolicies: Readonly<Record<string, EnemyGoldPolicy>> = Object.freeze({
  GeneratedH_Passive: fieldsStore(13.7),
  GeneratedH_PassiveSmall: fieldsStore(13.7),
  // Its store is the Fields room's when it replaces the Passive encounter; it kills nothing.
  NemesisRandomEvent: fieldsStore(0),
  OpeningGeneratedN: fraction(
    [
      [0.55, 0.26, 0.5, 0.7, 0.85],
      [0.61, 0.31, 0.57, 0.77, 0.91],
      [0.68, 0.35, 0.64, 0.83, 0.97],
      [0.73, 0.4, 0.69, 0.88, 0.99],
    ],
    5.6,
    7.0,
  ),
  PreHubGeneratedN: fraction(
    [
      [0.55, 0.26, 0.5, 0.7, 0.85],
      [0.61, 0.31, 0.57, 0.77, 0.91],
      [0.68, 0.35, 0.64, 0.83, 0.97],
      [0.73, 0.4, 0.69, 0.88, 0.99],
    ],
    5.6,
    7.0,
  ),
  // GOLD_ESTIMATE_ASSUMPTIONS.md "Anomaly".
  GeneratedAnomalyB: overshoot([11, 11, 11, 11, 11], 8, 30),
  ArtemisCombatF: fraction([[1.06, 0.64, 1.01, 1.08, 1.09]], 4.5, 22),
  ArtemisCombatG: fraction([[1.21, 1.08, 1.16, 1.15, 1.14]], 6.3, 40.6),
  ArtemisCombatN: fraction([[0.98, 0.52, 0.92, 1.06, 1.07]], 5.4, 22),
  NemesisCombatF: fraction([[1.06, 0.64, 1.01, 1.08, 1.09]], 4.5, 22),
  NemesisCombatG: fraction([[1.21, 1.03, 1.17, 1.16, 1.15]], 6.9, 33.9),
  NemesisCombatH: roomStore(15.4),
  NemesisCombatI: fraction([[1.04, 1.08, 1.07, 1.04, 1.03]], 7.2, 16.4),
  DevotionTestF: fraction([[1.05, 0.57, 0.98, 1.1, 1.11]], 4.4, 14.3),
  DevotionTestG: fraction([[1.29, 0.97, 1.23, 1.26, 1.25]], 7.5, 19.4),
  DevotionTestI: fraction([[1.69, 1.46, 1.66, 1.7, 1.71]], 20.9, 11),
  DevotionTestO: fraction([[1.23, 0.82, 1.16, 1.23, 1.23]], 5.3, 14.2),
  IcarusCombatO: fraction([[1.12, 0.95, 1.11, 1.12, 1.11]], 4.3, 35.6),
  IcarusCombatP: fraction([[1.09, 0.8, 1.07, 1.1, 1.09]], 3.2, 30.9),
  AthenaCombatP: fraction([[1.05, 0.56, 0.94, 1.07, 1.1]], 4.6, 19.3),
  HeraclesCombatN: fraction([[1.11, 0.76, 1.07, 1.11, 1.1]], 2.0, 22.9),
  HeraclesCombatO: fraction([[1.18, 0.78, 1.11, 1.17, 1.16]], 4.5, 17.8),
  HeraclesCombatP: fraction(
    [
      [0.27, 0.09, 0.19, 0.29, 0.39],
      [0.3, 0.11, 0.21, 0.32, 0.43],
      [0.33, 0.12, 0.23, 0.35, 0.47],
      [0.36, 0.13, 0.26, 0.39, 0.51],
    ],
    10.6,
    11.3,
  ),
  // GOLD_ESTIMATE_ASSUMPTIONS.md "Shadow Fog emitter".
  MiniBossFogEmitter_Shrine: constant(38, 21, 8),
  // GOLD_ESTIMATE_ASSUMPTIONS.md "Arachne combat".
  ArachneCombatF: constant(0, 0, 10),
  ArachneCombatG: constant(0, 0, 10),
});

const NONE: EnemyGoldPolicy = Object.freeze({ kind: 'none', kills: 0 });
const BOSS: EnemyGoldPolicy = Object.freeze({ kind: 'none', kills: 1 });

/**
 * The policy for one completed encounter: its own entry, else its room's
 * biome for a generated combat; undefined for a combat the policy misses.
 */
export function enemyGoldPolicy(
  definition: {
    readonly key: string;
    readonly kind: string;
    readonly moneyStore?: unknown;
  },
  biomeKey: string,
): EnemyGoldPolicy | undefined {
  const own = encounterPolicies[definition.key];
  if (own !== undefined) return own;
  if (definition.moneyStore !== undefined) return biomePolicies[biomeKey];
  if (definition.kind === 'boss') return BOSS;
  return definition.kind === 'combat' || definition.kind === 'miniboss' ? undefined : NONE;
}

/** Kills per Hordes rank 0–3, relative to rank 0 (GOLD_ESTIMATE_ASSUMPTIONS.md "Hordes kills"). */
const hordesKillFactors: Readonly<Record<string, readonly number[]>> = Object.freeze({
  H: [1, 1.26, 1.53, 1.83],
  default: [1, 1.18, 1.37, 1.56],
});

/** Expected kills of a completed encounter: a generated roster grows with Hordes. */
export function enemyGoldKills(policy: EnemyGoldPolicy, biomeKey: string, hordesRank: number) {
  if (policy.kind === 'constant' || policy.kind === 'none') return policy.kills;
  const factors = hordesKillFactors[biomeKey] ?? hordesKillFactors.default!;
  return policy.kills * factors[Math.max(0, Math.min(3, hordesRank))]!;
}

/** The native drop chance a constant is taken to pay at (GOLD_ESTIMATE_ASSUMPTIONS.md "Drop-chance scaling"). */
export const NATIVE_ENEMY_GOLD_DROP_CHANCE = 70;

/** GOLD_ESTIMATE_ASSUMPTIONS.md "Egg hatch rate". */
export const EGG_HATCH_RATE = 0.25;

/** GOLD_ESTIMATE_ASSUMPTIONS.md "Collection rate". */
export const DROPPED_GOLD_COLLECTION_RATE = 0.7;

/** GOLD_ESTIMATE_ASSUMPTIONS.md "Heracles bounty". */
export const HERACLES_BOUNTY_GOLD = 100;

/** One golden-urn swap candidate's gold options, tried in order (`HandleBreakableSwap`). */
interface UrnPots {
  readonly options: readonly { readonly gold: number; readonly chance: number }[];
}

// BaseBreakable (ObstacleData.lua:756-834) and the surface pots' own tables
// (ObstacleDataN.lua:491, ObstacleDataP.lua:118, ObstacleDataQ.lua:184).
const chronosPot: UrnPots = {
  options: [15, 10, 5].map((gold, i) => ({ gold, chance: [0.01, 0.02, 0.02][i]! })),
};
const surfacePot: UrnPots = { options: [15, 10, 5].map((gold) => ({ gold, chance: 0.05 })) };

/**
 * A room set's golden-urn swap: `MaxHighValueBreakables` and its pots
 * (RoomDataF.lua:299, RoomDataG.lua:291, RoomDataChaos.lua:165,
 * RoomDataI.lua:306, RoomDataN.lua:354, RoomDataP.lua:345, RoomDataQ.lua:30).
 * Fields, Thessaly, the Anomaly and the Zagreus contract swap none
 * (RoomDataH.lua:503 commented out, RoomDataO.lua:292, RoomDataAnomaly.lua:12,
 * RoomDataC.lua:16).
 */
const urnRoomSets: Readonly<Record<string, { readonly limit: number; readonly pots: UrnPots }>> =
  Object.freeze({
    F: { limit: 3, pots: chronosPot },
    G: { limit: 3, pots: chronosPot },
    Chaos: { limit: 3, pots: chronosPot },
    I: { limit: 6, pots: chronosPot },
    N: { limit: 3, pots: surfacePot },
    P: { limit: 6, pots: surfacePot },
    Q: { limit: 8, pots: surfacePot },
  });

/**
 * Rooms whose own data overrides their set's swap: `I_MiniBoss02` at limit 12
 * and a hundredfold chance (RoomDataI.lua:2931-2932), Ephyra's side rooms at
 * limit 1 and double (BaseN_SubRooms, RoomDataN.lua:3824-3825) and `Q_Intro`
 * at a third (RoomDataQ.lua:401).
 */
const urnRoomOverrides: Readonly<
  Record<string, { readonly limit?: number; readonly chanceMultiplier: number }>
> = Object.freeze({
  I_MiniBoss02: { limit: 12, chanceMultiplier: 100 },
  ...Object.fromEntries(
    Array.from({ length: 15 }, (_, index) => [
      `N_Sub${String(index + 1).padStart(2, '0')}`,
      { limit: 1, chanceMultiplier: 2 },
    ]),
  ),
  Q_Intro: { chanceMultiplier: 0.33 },
});

/** One candidate's gold as a value distribution, the chance scaled and capped at one. */
function urnAttempt(pots: UrnPots, chanceMultiplier: number) {
  let remaining = 1;
  const values: { readonly gold: number; readonly probability: number }[] = [];
  for (const option of pots.options) {
    const hit = remaining * Math.min(1, option.chance * chanceMultiplier);
    values.push({ gold: option.gold, probability: hit });
    remaining -= hit;
  }
  return values;
}

/**
 * A room's golden urns before the money multiplier and collection: native
 * swaps `limit + 1` of the map's swappable breakables, or every one when
 * the map has fewer (RoomLogic.lua:2533-2568). Undefined where none swap.
 */
export function urnAttempts(room: {
  readonly gameName: string;
  readonly roomSetKey: string;
  readonly swappableBreakables?: number;
}):
  | { readonly values: readonly { gold: number; probability: number }[]; readonly attempts: number }
  | undefined {
  const set = urnRoomSets[room.roomSetKey];
  if (set === undefined || room.swappableBreakables === undefined) return undefined;
  const override = urnRoomOverrides[room.gameName];
  const attempts = Math.min((override?.limit ?? set.limit) + 1, room.swappableBreakables);
  return { values: urnAttempt(set.pots, override?.chanceMultiplier ?? 1), attempts };
}

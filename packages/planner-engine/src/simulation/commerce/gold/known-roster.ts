import type { Catalog, EnemyGoldDrop } from '../../../catalog-schema';
import type { GeneratedEncounterOperands } from '../../encounters/generation';
import { GoldLedgerContractError } from './ledger';
import { roundGold } from './prices';

/**
 * A fully determined roster: each wave's spawn requests by native enemy id,
 * before unit groups expand. Waves are killed in order, each in random order.
 */
export type KnownRoster = readonly (readonly {
  readonly enemyKey: string;
  readonly count: number;
}[])[];

/**
 * The roster a completed phase fielded when nothing about it is left to
 * native: an all-fixed identity's declared waves, or a complete generated
 * customization's exact counts with its Menace conversions spawning their
 * targets. Undefined while native generation still draws any of it.
 */
export function knownEncounterRoster(
  catalog: Catalog,
  encounterKey: string,
  operands: GeneratedEncounterOperands | undefined,
): KnownRoster | undefined {
  const definition = catalog.encounterDefinitions.byKey[encounterKey];
  if (definition?.fixedRoster !== undefined)
    return Object.freeze(
      definition.fixedRoster.map((wave) =>
        Object.freeze(
          wave.map((spawn) => Object.freeze({ enemyKey: spawn.enemyKey, count: spawn.count })),
        ),
      ),
    );
  if (operands === undefined) return undefined;
  const selection = definition?.customization?.find(
    (decision) => decision.selection.kind === 'generated',
  )?.selection;
  if (selection?.kind !== 'generated')
    throw new GoldLedgerContractError(`${encounterKey} has generated operands but no composition`);
  const nativeIds = new Map(
    [
      ...selection.choices,
      ...selection.fixedEnemies,
      ...(selection.generatedSeeds ?? []),
      ...(selection.fixedWaves ?? []).flat(),
    ].map((choice) => [choice.key, choice.nativeId]),
  );
  return Object.freeze(
    operands.waves.map((wave) => {
      const counts = new Map<string, number>();
      const add = (enemyKey: string, count: number) =>
        counts.set(enemyKey, (counts.get(enemyKey) ?? 0) + count);
      for (const typeKey of wave.typeKeys) {
        const nativeId = nativeIds.get(typeKey);
        if (nativeId === undefined)
          throw new GoldLedgerContractError(`${encounterKey} fields an undeclared ${typeKey}`);
        add(nativeId, wave.counts[typeKey] ?? 0);
      }
      // A converted request spawns its Menace target instead (EncounterLogic.lua:784-810).
      const menace = operands.menace.find((entry) => entry.waveIndex === wave.waveIndex);
      for (const conversion of menace?.conversions ?? []) {
        if (conversion.count === 0) continue;
        if (conversion.targetNativeId === undefined)
          throw new GoldLedgerContractError(`${encounterKey} converts to no Menace target`);
        add(conversion.sourceNativeId, -conversion.count);
        add(conversion.targetNativeId, conversion.count);
      }
      return Object.freeze(
        [...counts.entries()]
          .filter(([, count]) => count > 0)
          .map(([enemyKey, count]) => Object.freeze({ enemyKey, count })),
      );
    }),
  );
}

/** One kill's drop: the enemy's parcel chance and parcel range, after unit groups expand. */
interface KillDrop {
  readonly key: string;
  readonly drop: Extract<EnemyGoldDrop, { readonly kind: 'parcel' | 'none' }>;
  readonly count: number;
}

function dropOf(catalog: Catalog, key: string): EnemyGoldDrop {
  const drop = catalog.enemyGoldDrops.byKey[key];
  if (drop === undefined) throw new GoldLedgerContractError(`${key} has no enemy gold drop`);
  return drop;
}

/** Each wave's killed enemies, unit groups expanded into their units. */
function waveKills(catalog: Catalog, roster: KnownRoster): readonly (readonly KillDrop[])[] {
  return roster.map((wave) => {
    const kills = new Map<string, KillDrop>();
    for (const spawn of wave) {
      const drop = dropOf(catalog, spawn.enemyKey);
      const [key, unit, size] =
        drop.kind === 'unitGroup'
          ? [drop.unitKey, dropOf(catalog, drop.unitKey), drop.size]
          : [spawn.enemyKey, drop, 1];
      if (unit.kind === 'unitGroup')
        throw new GoldLedgerContractError(`${spawn.enemyKey} nests unit groups`);
      kills.set(key, {
        key,
        drop: unit,
        count: (kills.get(key)?.count ?? 0) + spawn.count * size,
      });
    }
    return [...kills.values()];
  });
}

/** The roster's kills, unit-group members counted one by one. */
export function knownRosterKills(catalog: Catalog, roster: KnownRoster): number {
  return waveKills(catalog, roster)
    .flat()
    .reduce((total, kill) => total + kill.count, 0);
}

/** A kill's paid parcel as gold values with their probabilities, the no-drop at zero. */
type Step = readonly (readonly [gold: number, probability: number])[];

/**
 * One kill's gold (RoomLogic.lua:2340-2395): at its chance, a parcel drawn
 * evenly from the integer range times the money multiplier and rounded. A
 * store-paying parcel is at least one; an uncapped one of zero drops nothing.
 */
function killStep(kill: KillDrop, sigma: number, chance: number, capped: boolean): Step {
  if (kill.drop.kind === 'none' || chance <= 0) return [[0, 1]];
  const { min, max } = kill.drop.value;
  const each = chance / (max - min + 1);
  // The no-drop entry stays even at certainty: a kill not yet made sits at zero.
  const values = new Map<number, number>([[0, 1 - chance]]);
  for (let roll = min; roll <= max; roll += 1) {
    const amount = roundGold(roll * sigma);
    const paid = capped ? Math.max(1, amount) : Math.max(0, amount);
    values.set(paid, (values.get(paid) ?? 0) + each);
  }
  return [...values.entries()];
}

/** Gauss-Legendre nodes and weights on [0, 1]. */
const legendre = new Map<number, readonly [readonly number[], readonly number[]]>();
function gaussLegendre(order: number): readonly [readonly number[], readonly number[]] {
  const known = legendre.get(order);
  if (known !== undefined) return known;
  const nodes: number[] = [];
  const weights: number[] = [];
  for (let i = 1; i <= order; i += 1) {
    let x = Math.cos((Math.PI * (i - 0.25)) / (order + 0.5));
    let derivative = 1;
    for (let iteration = 0; iteration < 100; iteration += 1) {
      let previous = 1;
      let current = x;
      for (let k = 2; k <= order; k += 1) {
        const next = ((2 * k - 1) * x * current - (k - 1) * previous) / k;
        previous = current;
        current = next;
      }
      const value = order === 1 ? x : current;
      const below = order === 1 ? 1 : previous;
      derivative = (order * (x * value - below)) / (x * x - 1);
      const delta = value / derivative;
      x -= delta;
      if (Math.abs(delta) < 1e-15) break;
    }
    nodes.push((1 - x) / 2);
    weights.push(1 / ((1 - x * x) * derivative * derivative));
  }
  const rule = [nodes, weights] as const;
  legendre.set(order, rule);
  return rule;
}

/** A kill made by time `u`: its drop with probability `u`, else nothing yet. */
function byTime(step: Step, u: number): Step {
  return step.map(([value, probability]) => [
    value,
    value === 0 ? 1 - u + u * probability : u * probability,
  ]);
}

/** Adds one kill to a distribution of gold, keeping only gold below its length. */
function addKill(gold: Float64Array, step: Step): Float64Array {
  const next = new Float64Array(gold.length);
  for (let t = 0; t < gold.length; t += 1) {
    const mass = gold[t]!;
    if (mass === 0) continue;
    for (const [value, probability] of step)
      if (t + value < gold.length) next[t + value]! += mass * probability;
  }
  return next;
}

export interface KnownRosterPayoutInputs {
  readonly moneyMultiplier: number;
  /** The equally likely store values, multiplied and rounded up; absent for an uncapped encounter. */
  readonly stores?: readonly number[];
  /** `enemyGoldDropChance` in percent, which rewrites a store-paying kill's positive chance. */
  readonly dropChance?: number;
}

/**
 * The gold a known roster pays, in closed form. Without a store every kill's
 * drop is paid. With one, drops are paid while the store is positive, the
 * crossing parcel in full, and kills come in random order within each wave.
 *
 * Giving each kill of a wave an independent uniform time makes the order
 * uniformly random and makes everything killed before time `u` independent,
 * each kill made with probability `u`. The crossing kill at time `u` then
 * meets the independent gold of the rest of the wave plus what earlier waves
 * left below the store; integrating `u` by Gauss-Legendre (exact up to 32
 * kills a wave) gives the mean and second moment for every store at once,
 * since gold below a store never depends on that store.
 */
export function knownRosterPayout(
  catalog: Catalog,
  roster: KnownRoster,
  inputs: KnownRosterPayoutInputs,
): { readonly mean: number; readonly variance: number } {
  // A walked roster keeps its identity while its biome's evaluation is reused.
  let byRoster = payoutsByCatalog.get(catalog);
  if (byRoster === undefined) {
    byRoster = new WeakMap();
    payoutsByCatalog.set(catalog, byRoster);
  }
  let byInputs = byRoster.get(roster);
  if (byInputs === undefined) {
    byInputs = new Map();
    byRoster.set(roster, byInputs);
  }
  const key = JSON.stringify(inputs);
  let payout = byInputs.get(key);
  if (payout === undefined) {
    payout = Object.freeze(rosterPayout(catalog, roster, inputs));
    byInputs.set(key, payout);
  }
  return payout;
}

const payoutsByCatalog = new WeakMap<
  Catalog,
  WeakMap<KnownRoster, Map<string, { readonly mean: number; readonly variance: number }>>
>();

function rosterPayout(
  catalog: Catalog,
  roster: KnownRoster,
  inputs: KnownRosterPayoutInputs,
): { readonly mean: number; readonly variance: number } {
  const capped = inputs.stores !== undefined;
  const sigma = inputs.moneyMultiplier;
  const steps = waveKills(catalog, roster).map((wave) =>
    wave.flatMap((kill) => {
      const chance =
        kill.drop.kind === 'parcel'
          ? capped && inputs.dropChance !== undefined
            ? Math.max(0, Math.min(100, inputs.dropChance)) / 100
            : kill.drop.chance
          : 0;
      const step = killStep(kill, sigma, chance, capped);
      // A kill that never pays changes nothing below or across the store.
      return step.some(([value, probability]) => value > 0 && probability > 0)
        ? [{ step, count: kill.count }]
        : [];
    }),
  );
  if (!capped) {
    let mean = 0;
    let variance = 0;
    for (const { step, count } of steps.flat()) {
      let first = 0;
      let second = 0;
      for (const [value, probability] of step) {
        first += value * probability;
        second += value * value * probability;
      }
      mean += count * first;
      variance += count * (second - first * first);
    }
    return { mean, variance };
  }
  const stores = inputs.stores!;
  const ceiling = Math.max(...stores);
  // Gold below the largest store before each wave, and per kill type the
  // occupation its crossing reads: P(rest of the wave + earlier gold = t) over time.
  let below: Float64Array = new Float64Array(ceiling);
  below[0] = 1;
  const crossings: { readonly occupation: Float64Array; readonly step: Step }[] = [];
  for (const wave of steps) {
    const kills = wave.reduce((total, kind) => total + kind.count, 0);
    if (kills === 0) continue;
    const [nodes, weights] = gaussLegendre(Math.min(16, Math.ceil(kills / 2)));
    for (const kind of wave) {
      const occupation = new Float64Array(ceiling);
      nodes.forEach((u, node) => {
        let gold: Float64Array = below;
        for (const other of wave) {
          const step = byTime(other.step, u);
          for (let n = other === kind ? 1 : 0; n < other.count; n += 1) gold = addKill(gold, step);
        }
        const weight = weights[node]! * kind.count;
        for (let t = 0; t < ceiling; t += 1) occupation[t]! += weight * gold[t]!;
      });
      crossings.push({ occupation, step: kind.step.filter(([value]) => value > 0) });
    }
    for (const kind of wave)
      for (let n = 0; n < kind.count; n += 1) below = addKill(below, kind.step);
  }
  let mean = 0;
  let second = 0;
  for (const store of stores) {
    let first = 0;
    let squared = 0;
    // Every drop paid and the store never reached.
    for (let t = 0; t < store; t += 1) {
      first += below[t]! * t;
      squared += below[t]! * t * t;
    }
    // The parcel that reaches the store, paid in full.
    for (const { occupation, step } of crossings)
      for (let t = 0; t < store; t += 1) {
        const mass = occupation[t]!;
        if (mass === 0) continue;
        for (const [value, probability] of step) {
          if (t + value < store) continue;
          first += mass * probability * (t + value);
          squared += mass * probability * (t + value) ** 2;
        }
      }
    mean += first / stores.length;
    second += squared / stores.length;
  }
  return { mean, variance: Math.max(0, second - mean * mean) };
}

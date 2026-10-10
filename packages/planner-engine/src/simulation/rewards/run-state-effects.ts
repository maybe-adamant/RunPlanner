import type { Catalog, ChaosClockKind, KeepsakeRank, TraitElement } from '../../catalog-schema';
import type { StygianWellClock } from '../../reward-kernel';
import { artificerStatus } from '../arcana-fear';
import { stygianWellChargeItemKey } from '../commerce/stygian-well';
import { keepsakeRankForEquip } from '../keepsakes/state';
import type { SimulationState } from '../state/model';
import { aspectIsPerfect } from '../traits/equipment-upgrades';
import {
  echoShopDuplicateStatus,
  steadyGrowthInterval,
  traitElementActivation,
} from '../traits/history/fold';

/** The game-facing unit a Run State clock counts. */
export type RunStateClockUnit = 'charges' | 'uses' | 'encounters' | 'rooms' | 'guardians' | 'boons';

/** One running effect clock: a countdown of what is left, or progress toward the next proc. */
export type RunStateClock =
  | { readonly unit: RunStateClockUnit; readonly direction: 'remaining'; readonly value: number }
  | {
      readonly unit: RunStateClockUnit;
      readonly direction: 'progress';
      readonly value: number;
      readonly total: number;
    };

/** A game-facing on/off or one-use state. */
export type RunStateStatus = 'active' | 'inactive' | 'ready' | 'used' | 'pending';

/**
 * What an effect currently shows: a clock, a state, its current signed bonus
 * fraction, or the current count of the element that scales it.
 */
export type RunStateEffectState =
  | { readonly kind: 'clock'; readonly clock: RunStateClock }
  | { readonly kind: 'status'; readonly status: RunStateStatus }
  | { readonly kind: 'bonus'; readonly fraction: number }
  | { readonly kind: 'elementCount'; readonly element: TraitElement; readonly count: number };

/** The equipped keepsake first, then each unslotted keepsake whose effect is still running. */
export interface RunStateKeepsakeEffect {
  readonly keepsakeKey: string;
  readonly rank?: KeepsakeRank;
  readonly state?: RunStateEffectState;
}

/**
 * One non-slot trait-list entry in acquisition order: an equipped trait, a
 * matured Chaos blessing, or a one-use trait already consumed.
 */
export type RunStateTraitEntry =
  | { readonly kind: 'trait'; readonly traitKey: string }
  | {
      readonly kind: 'consumedTrait';
      readonly traitKey: string;
      readonly acquisitionIdentity: string;
    }
  | {
      readonly kind: 'chaosBlessing';
      readonly acquisitionIdentity: string;
      readonly blessingKey: string;
      readonly rarity: string;
    };

/** Running clocks and derived identities of the effects active at one checkpoint. */
export interface RunStateEffects {
  /** The equipped aspect at the planner's rank V, or rank VI once made Perfect. */
  readonly aspect?: { readonly aspectKey: string; readonly rank: 5 | 6 };
  readonly familiarKey?: string;
  readonly keepsakes: readonly RunStateKeepsakeEffect[];
  /**
   * One entry per entered biome: the keepsake equipped there, followed by any
   * keepsake its postboss rack chose for the next biome.
   */
  readonly keepsakeHistory: readonly {
    readonly biomeKey: string;
    readonly keepsakeKeys: readonly string[];
  }[];
  /**
   * By equipped trait key: Steady Growth, clocked producers, `RoomsPerUpgrade`
   * growth and keepsake Hammers as clocks; activation-gated traits as active or
   * inactive; element-scaled traits with their element's count; a pending Gold
   * Gold Gold.
   */
  readonly traitStates: Readonly<Record<string, RunStateEffectState>>;
  /** Equipped and consumed traits outside the boon slots, with matured blessings, in acquisition order. */
  readonly traitEntries: readonly RunStateTraitEntry[];
  /** By Arcana key: room-entry growth progress and The Artificer's charges left. */
  readonly arcanaClocks: Readonly<Record<string, RunStateClock>>;
  /** Barren's clock while it removes every Arcana effect. */
  readonly arcanaBarren?: RunStateClock;
  /** Timed Well instances in purchase order, then held Well charges. */
  readonly stygianWell: readonly { readonly itemKey: string; readonly clock: RunStateClock }[];
  /** Active Chaos curses in acquisition order, with the blessing each matures into. */
  readonly chaosCurses: readonly {
    readonly curseKey: string;
    readonly blessingKey: string;
    readonly rarity: string;
    readonly clock: RunStateClock;
  }[];
  /** Pending Shrine deliveries and the encounters left before each falls due. */
  readonly hermesDeliveries: readonly {
    readonly entryKey: string;
    readonly rewardType: string;
    readonly clock: RunStateClock;
  }[];
  /** Invested Path of Stars talents in first-investment order; each extra node adds a level. */
  readonly hexTalents: readonly { readonly talentKey: string; readonly level: number }[];
}

const wellUnits: Readonly<Record<StygianWellClock, RunStateClockUnit>> = Object.freeze({
  encounters: 'encounters',
  rooms: 'rooms',
  bosses: 'guardians',
});

const chaosUnits: Readonly<Record<ChaosClockKind, RunStateClockUnit>> = Object.freeze({
  encounters: 'encounters',
  locations: 'rooms',
  godBoonScreens: 'boons',
});

const remaining = (unit: RunStateClockUnit, value: number): RunStateClock =>
  Object.freeze({ unit, direction: 'remaining', value });
const progress = (unit: RunStateClockUnit, value: number, total: number): RunStateClock =>
  Object.freeze({ unit, direction: 'progress', value, total });

const status = (value: RunStateStatus): RunStateEffectState =>
  Object.freeze({ kind: 'status', status: value });
const clockState = (value: RunStateClock): RunStateEffectState =>
  Object.freeze({ kind: 'clock', clock: value });
const bonus = (multiplier: number): RunStateEffectState =>
  Object.freeze({ kind: 'bonus', fraction: multiplier - 1 });

function traitClock(
  catalog: Catalog,
  equipped: SimulationState['traitHistory']['equippedTraits'][string],
): RunStateClock | undefined {
  const trait = catalog.traits.byKey[equipped.traitKey];
  const disposition = trait?.selectedDisposition;
  if (disposition?.kind === 'steadyGrowth') {
    const interval = steadyGrowthInterval(catalog, equipped);
    return interval === undefined
      ? undefined
      : progress('encounters', equipped.steadyGrowthProgress ?? 0, interval);
  }
  if (
    disposition?.kind === 'producePickups' &&
    disposition.clock !== undefined &&
    equipped.pickupProducerInterval !== undefined
  )
    return progress(
      'encounters',
      equipped.pickupProducerProgress ?? 0,
      equipped.pickupProducerInterval,
    );
  if (trait?.roomsPerUpgradeGrowth !== undefined && equipped.roomsPerUpgradeGrowth)
    return progress(
      'encounters',
      equipped.roomsPerUpgradeGrowth.progress,
      trait.roomsPerUpgradeGrowth.interval,
    );
  return undefined;
}

function traitStates(catalog: Catalog, state: SimulationState): RunStateEffects['traitStates'] {
  const history = state.traitHistory;
  const states: Record<string, RunStateEffectState> = {};
  for (const equipped of Object.values(history.equippedTraits)) {
    const trait = catalog.traits.byKey[equipped.traitKey];
    const traitClockValue = traitClock(catalog, equipped);
    const activation = traitElementActivation(catalog, equipped.traitKey, history);
    if (traitClockValue !== undefined) states[equipped.traitKey] = clockState(traitClockValue);
    else if (activation !== undefined)
      states[equipped.traitKey] = status(activation ? 'active' : 'inactive');
    else if (trait?.elementalMultiplier !== undefined)
      states[equipped.traitKey] = Object.freeze({
        kind: 'elementCount',
        element: trait.elementalMultiplier,
        count: history.elementCounts[trait.elementalMultiplier],
      });
  }
  const echoShop = echoShopDuplicateStatus(catalog, history);
  if (echoShop?.status === 'pending') states[echoShop.traitKey] = status('pending');
  // A keepsake-granted Hammer is an ordinary Hammer with its qualifying encounters left.
  for (const hammer of state.keepsakes.experimentalHammers) {
    if (!hammer.active || history.equippedTraits[hammer.traitKey] === undefined) continue;
    states[hammer.traitKey] = clockState(remaining('encounters', hammer.remainingUses));
  }
  return Object.freeze(states);
}

function keepsakeOwner(catalog: Catalog, kind: string): string | undefined {
  return catalog.keepsakes.values.find((keepsake) => keepsake.effect?.kind === kind)?.key;
}

/**
 * Each keepsake effect's current state by owning keepsake. A spent one-use
 * effect reads `used` only while its keepsake is equipped.
 */
function keepsakeEffects(
  catalog: Catalog,
  state: SimulationState,
): readonly RunStateKeepsakeEffect[] {
  const keepsakes = state.keepsakes;
  const currentKey = keepsakes.currentKey;
  const states = new Map<string, { state: RunStateEffectState; running: boolean }>();
  const ranks = new Map<string, KeepsakeRank>();
  const put = (kind: string, value: RunStateEffectState, running = true) => {
    const key = keepsakeOwner(catalog, kind);
    if (key !== undefined) states.set(key, { state: value, running });
  };
  if (keepsakes.callingCard !== undefined)
    put('callingCard', clockState(remaining('charges', keepsakes.callingCard.remainingCharges)));
  if (keepsakes.timePiece !== undefined)
    put('timePiece', clockState(remaining('charges', keepsakes.timePiece.remainingCharges)));
  if (keepsakes.figLeaf !== undefined)
    put('figLeaf', clockState(remaining('uses', keepsakes.figLeaf.remainingUses)));
  const gorgon = keepsakes.gorgon;
  if (gorgon?.status === 'pending') put('gorgonAmulet', clockState(remaining('charges', 1)));
  else if (gorgon !== undefined) put('gorgonAmulet', status('used'), false);
  if (keepsakes.phial !== undefined) {
    const pending = keepsakes.phial.status === 'pending';
    put('fountainRarity', status(pending ? 'ready' : 'used'), pending);
  }
  if (keepsakes.figurine !== undefined) {
    const pending = keepsakes.figurine.status === 'pending';
    put('crystalFigurine', pending ? clockState(remaining('charges', 1)) : status('used'), pending);
  }
  if (keepsakes.stone !== undefined) {
    const pending = keepsakes.stone.status === 'pending';
    put('concaveStone', status(pending ? 'active' : 'used'), pending);
    const key = keepsakeOwner(catalog, 'concaveStone');
    if (key !== undefined) ranks.set(key, keepsakes.stone.rank);
  }
  const embryo = keepsakes.transcendentEmbryo;
  if (embryo !== undefined) {
    const interval = catalog.keepsakes.values.flatMap((keepsake) =>
      keepsake.effect?.kind === 'transcendentEmbryo' ? [keepsake.effect.interval] : [],
    )[0];
    if (interval !== undefined)
      put('transcendentEmbryo', clockState(progress('encounters', embryo.progress, interval)));
  }
  if (keepsakes.lionFang !== undefined && !keepsakes.lionFang.expired)
    put('lionFang', bonus(keepsakes.lionFang.multiplier));
  if (keepsakes.discordantBell !== undefined) {
    put('discordantBell', bonus(keepsakes.discordantBell.multiplier));
    const key = keepsakeOwner(catalog, 'discordantBell');
    if (key !== undefined) ranks.set(key, keepsakes.discordantBell.rank);
  }
  // A forced-boon keepsake is ready until its forced Boon is delivered.
  for (const source of keepsakes.olympianSources) {
    const ready = source.remainingForceUses > 0;
    states.set(source.keepsakeKey, { state: status(ready ? 'ready' : 'used'), running: ready });
  }
  if (keepsakes.jeweledPom !== undefined)
    put(
      'jeweledPom',
      status(keepsakes.jeweledPom.active ? 'active' : 'inactive'),
      keepsakes.jeweledPom.active,
    );
  for (const entry of keepsakes.retained ?? []) ranks.set(entry.key, entry.rank);

  const order: string[] = currentKey === null ? [] : [currentKey];
  for (const [key, value] of states) if (value.running && !order.includes(key)) order.push(key);
  for (const entry of keepsakes.retained ?? [])
    if (!order.includes(entry.key)) order.push(entry.key);
  return Object.freeze(
    order.map((key) => {
      const rank =
        key === currentKey
          ? keepsakeRankForEquip(catalog, key, state.traitHistory)
          : ranks.get(key);
      const effect = states.get(key)?.state;
      return Object.freeze({
        keepsakeKey: key,
        ...(rank === undefined ? {} : { rank }),
        ...(effect === undefined ? {} : { state: effect }),
      });
    }),
  );
}

const ECHO_SHOP_DUPLICATE_CONSUMED = 'echoShopDuplicateConsumed';

/**
 * Non-slot traits ordered by the history event that acquired them. Traits
 * without an identified acquisition keep their place after the previous one.
 */
function traitEntries(catalog: Catalog, state: SimulationState): RunStateEffects['traitEntries'] {
  const history = state.traitHistory;
  const sequenceByIdentity = new Map<string, number>();
  const grantSequenceByTrait = new Map<string, number>();
  for (const event of history.events) {
    const identity = 'acquisitionIdentity' in event ? event.acquisitionIdentity : undefined;
    if (
      identity !== undefined &&
      event.kind !== 'traitRemoval' &&
      !sequenceByIdentity.has(identity)
    )
      sequenceByIdentity.set(identity, event.sequence);
    if (event.kind === 'directTraitGrant' && !grantSequenceByTrait.has(event.traitKey))
      grantSequenceByTrait.set(event.traitKey, event.sequence);
  }
  const slotTraitKeys = new Set(Object.values(history.equippedSlots).map((slot) => slot.traitKey));
  const entries: { readonly sequence: number; readonly entry: RunStateTraitEntry }[] = [];
  let previous = -1;
  for (const equipped of Object.values(history.equippedTraits)) {
    if (slotTraitKeys.has(equipped.traitKey)) continue;
    const sequence =
      (equipped.acquisitionIdentity === undefined
        ? undefined
        : sequenceByIdentity.get(equipped.acquisitionIdentity)) ??
      grantSequenceByTrait.get(equipped.traitKey) ??
      previous;
    previous = sequence;
    entries.push({
      sequence,
      entry: Object.freeze({ kind: 'trait', traitKey: equipped.traitKey }),
    });
  }
  const consumed = echoShopDuplicateStatus(catalog, history)?.status === 'consumed';
  for (const event of history.events) {
    if (
      !consumed ||
      event.kind !== 'traitRemoval' ||
      event.acquisitionRole !== ECHO_SHOP_DUPLICATE_CONSUMED ||
      event.acquisitionIdentity === undefined
    )
      continue;
    entries.push({
      sequence: sequenceByIdentity.get(event.acquisitionIdentity) ?? event.sequence,
      entry: Object.freeze({
        kind: 'consumedTrait',
        traitKey: event.traitKey,
        acquisitionIdentity: event.acquisitionIdentity,
      }),
    });
  }
  for (const blessing of history.maturedChaosBlessings) {
    entries.push({
      sequence: sequenceByIdentity.get(blessing.acquisitionIdentity) ?? Number.MAX_SAFE_INTEGER,
      entry: Object.freeze({
        kind: 'chaosBlessing',
        acquisitionIdentity: blessing.acquisitionIdentity,
        blessingKey: blessing.blessingKey,
        rarity: blessing.rarity,
      }),
    });
  }
  // Array sort is stable, so equal sequences keep equipped-history order.
  return Object.freeze(
    entries.sort((left, right) => left.sequence - right.sequence).map(({ entry }) => entry),
  );
}

function arcanaClocks(
  catalog: Catalog,
  arcanaFear: SimulationState['arcanaFear'],
): RunStateEffects['arcanaClocks'] {
  const clocks: Record<string, RunStateClock> = {};
  for (const card of arcanaFear.arcana.active) {
    const growth = catalog.arcanaCards.byKey[card.key]?.roomEntryStatGrowth;
    if (growth === undefined) continue;
    clocks[card.key] = progress(
      'rooms',
      arcanaFear.arcana.roomEntryGrowth?.[card.key]?.progress ?? 0,
      growth.interval,
    );
  }
  const artificer = artificerStatus(catalog, arcanaFear);
  const artificerCard = arcanaFear.arcana.active.find(
    (card) => catalog.arcanaCards.byKey[card.key]?.artificerCapacityByRarity !== undefined,
  );
  if (artificer !== undefined && artificerCard !== undefined)
    clocks[artificerCard.key] = remaining('charges', artificer.remaining);
  return Object.freeze(clocks);
}

function hexTalents(state: SimulationState): RunStateEffects['hexTalents'] {
  const nodes = state.hexProgress.tree?.nodes ?? {};
  const levels = new Map<string, number>();
  for (const nodeKey of state.hexProgress.investedNodeKeys) {
    const talentKey = nodes[nodeKey];
    if (talentKey === undefined) continue;
    levels.set(talentKey, (levels.get(talentKey) ?? 0) + 1);
  }
  return Object.freeze(
    [...levels].map(([talentKey, level]) => Object.freeze({ talentKey, level })),
  );
}

function stygianWell(
  catalog: Catalog,
  well: SimulationState['stygianWell'],
): RunStateEffects['stygianWell'] {
  const charges = (
    [
      ['spark', well.sparkUses],
      ['yarn', well.yarnUses],
      ['hymn', well.hymnUses],
      ['extended', well.extendedUses],
    ] as const
  ).flatMap(([charge, uses]) => {
    const itemKey = stygianWellChargeItemKey(catalog, charge);
    return uses > 0 && itemKey !== undefined
      ? [Object.freeze({ itemKey, clock: remaining('charges', uses) })]
      : [];
  });
  return Object.freeze([
    ...well.timedInstances.map((instance) =>
      Object.freeze({
        itemKey: instance.itemKey,
        clock: remaining(wellUnits[instance.clock], instance.remainingUses),
      }),
    ),
    ...charges,
  ]);
}

/** Each history entry takes effect from the start of its biome, so a postboss choice names the next one. */
function keepsakeHistory(state: SimulationState): RunStateEffects['keepsakeHistory'] {
  const { history } = state.keepsakes;
  const { itineraryBiomeKeys, ordinal } = state.reached.routePosition;
  const keysEffectiveIn = (biomeNumber: number) =>
    history.filter((entry) => entry.biomeNumber === biomeNumber).map((entry) => entry.key);
  const rows: { readonly biomeKey: string; readonly keepsakeKeys: readonly string[] }[] = [];
  let carried: string | undefined;
  for (let biomeNumber = 1; biomeNumber <= Math.max(ordinal, 1); biomeNumber += 1) {
    carried = keysEffectiveIn(biomeNumber).at(-1) ?? carried;
    const biomeKey = itineraryBiomeKeys[biomeNumber - 1];
    if (carried === undefined || biomeKey === undefined) continue;
    const keepsakeKeys = [carried, ...keysEffectiveIn(biomeNumber + 1)].filter(
      (key, index, keys) => index === 0 || keys[index - 1] !== key,
    );
    rows.push(Object.freeze({ biomeKey, keepsakeKeys: Object.freeze(keepsakeKeys) }));
  }
  return Object.freeze(rows);
}

export function deriveRunStateEffects(catalog: Catalog, state: SimulationState): RunStateEffects {
  const { aspectKey, familiarKey } = state.equipment;
  const barren = state.traitHistory.activeChaosCurses.find(
    (curse) => curse.semanticTag === 'Barren',
  );
  return Object.freeze({
    ...(aspectKey === null
      ? {}
      : {
          aspect: Object.freeze({
            aspectKey,
            rank: aspectIsPerfect(catalog, state.traitHistory) ? (6 as const) : (5 as const),
          }),
        }),
    ...(familiarKey === null ? {} : { familiarKey }),
    keepsakes: keepsakeEffects(catalog, state),
    traitStates: traitStates(catalog, state),
    traitEntries: traitEntries(catalog, state),
    arcanaClocks: arcanaClocks(catalog, state.arcanaFear),
    ...(barren === undefined
      ? {}
      : {
          arcanaBarren: remaining(chaosUnits[barren.clock], barren.remaining),
        }),
    keepsakeHistory: keepsakeHistory(state),
    stygianWell: stygianWell(catalog, state.stygianWell),
    chaosCurses: Object.freeze(
      state.traitHistory.activeChaosCurses.map((curse) =>
        Object.freeze({
          curseKey: curse.curseKey,
          blessingKey: curse.blessingKey,
          rarity: curse.rarity,
          clock: remaining(chaosUnits[curse.clock], curse.remaining),
        }),
      ),
    ),
    hermesDeliveries: Object.freeze(
      Object.values(state.pendingHermesShrineDeliveries).map((delivery) =>
        Object.freeze({
          entryKey: delivery.entryKey,
          rewardType: delivery.rewardType,
          clock: remaining('encounters', delivery.remainingUses),
        }),
      ),
    ),
    hexTalents: hexTalents(state),
  });
}

import {
  INITIAL_ROLL_KEY,
  PURGING_POOL_SLOT_KEYS,
  STYGIAN_WELL_SLOT_KEYS,
  type RollFeature,
} from '../../authored-project/feature-rolls';
import type {
  PurgingPoolSlotKey,
  PurgingPoolState,
  RoomActionReference,
  StygianWellSlotKey,
} from '../../authored-project/model';

/** Whether a Well or Pool reroll can be pressed where it is appended. */
export interface FeatureRerollOption {
  /** One more than the feature's earlier rerolls in the room. */
  readonly cost: number;
  /** A held card enables screen rerolls. */
  readonly enabled: boolean;
  /** Something is left to reroll: the game hides the button otherwise. */
  readonly available: boolean;
  /** The run's pool there, lowest over reached branches. */
  readonly poolRemaining: number;
}

/**
 * A Well's room-local roll state as its actions settle. Bought slots stay
 * blank in every later roll, except the room's first purchase under Travel
 * Deal, whose slot is restocked in place and stays offered.
 */
export interface StygianWellRollWalk {
  readonly rollKey: string;
  readonly blanked: readonly StygianWellSlotKey[];
  /** Slots of the current roll already bought or restocked by Travel Deal. */
  readonly taken: readonly StygianWellSlotKey[];
  /** The Travel Deal restock: offered while its roll is on show and it is unbought. */
  readonly refill?: {
    readonly rollKey: string;
    readonly slotKey: StygianWellSlotKey;
    readonly bought: boolean;
  };
  readonly rerollCount: number;
  readonly purchaseCount: number;
}

/** A Pool's room-local roll state: each reroll redraws the whole list. */
export interface PurgingPoolRollWalk {
  readonly rollKey: string;
  readonly offeredSlotKeys: readonly PurgingPoolSlotKey[];
  /** Eligible traits when the list was drawn; more than it shows leaves unshown values. */
  readonly eligibleCount: number;
  readonly sold: readonly PurgingPoolSlotKey[];
  readonly rerollCount: number;
}

export type FeatureRollWalk =
  | ({ readonly feature: 'stygianWell' } & StygianWellRollWalk)
  | ({ readonly feature: 'purgingPool' } & PurgingPoolRollWalk);

export function featureRollWalkKey(roomKey: string, feature: RollFeature): string {
  return `${roomKey} ${feature}`;
}

export function initialStygianWellRollWalk(): Extract<
  FeatureRollWalk,
  { readonly feature: 'stygianWell' }
> {
  return Object.freeze({
    feature: 'stygianWell',
    rollKey: INITIAL_ROLL_KEY,
    blanked: Object.freeze([]),
    taken: Object.freeze([]),
    rerollCount: 0,
    purchaseCount: 0,
  });
}

/** The initial list offers its authored slots. */
export function initialPurgingPoolRollWalk(
  pool: PurgingPoolState,
  eligibleCount: number,
): Extract<FeatureRollWalk, { readonly feature: 'purgingPool' }> {
  return Object.freeze({
    feature: 'purgingPool',
    rollKey: INITIAL_ROLL_KEY,
    eligibleCount,
    offeredSlotKeys: Object.freeze(
      PURGING_POOL_SLOT_KEYS.filter((slotKey) => pool.traitKeyBySlot[slotKey] !== null),
    ),
    sold: Object.freeze([]),
    rerollCount: 0,
  });
}

/** The slots a new Well roll restocks: every slot not bought earlier in the room. */
export function stygianWellRestockedSlots(
  walk: StygianWellRollWalk,
): readonly StygianWellSlotKey[] {
  return Object.freeze(STYGIAN_WELL_SLOT_KEYS.filter((slotKey) => !walk.blanked.includes(slotKey)));
}

/** The current roll's slots still for sale. */
export function stygianWellOfferedSlots(walk: StygianWellRollWalk): readonly StygianWellSlotKey[] {
  return Object.freeze(
    STYGIAN_WELL_SLOT_KEYS.filter(
      (slotKey) => !walk.blanked.includes(slotKey) && !walk.taken.includes(slotKey),
    ),
  );
}

/** The Travel Deal restock's slot while it can be bought. */
export function stygianWellLiveRefillSlot(
  walk: StygianWellRollWalk,
): StygianWellSlotKey | undefined {
  return walk.refill !== undefined && walk.refill.rollKey === walk.rollKey && !walk.refill.bought
    ? walk.refill.slotKey
    : undefined;
}

export function stygianWellSomethingLeft(walk: StygianWellRollWalk): boolean {
  return stygianWellOfferedSlots(walk).length > 0 || stygianWellLiveRefillSlot(walk) !== undefined;
}

/**
 * One purchase from the current roll. The room's first purchase under Travel
 * Deal restocks its slot instead of leaving it blank.
 */
export function stygianWellAfterPurchase<W extends StygianWellRollWalk>(
  walk: W,
  purchase:
    | { readonly kind: 'slot'; readonly slotKey: StygianWellSlotKey; readonly restocked: boolean }
    | { readonly kind: 'refill' },
): W {
  if (purchase.kind === 'refill') {
    const refill = walk.refill;
    if (refill === undefined)
      return Object.freeze({ ...walk, purchaseCount: walk.purchaseCount + 1 });
    return Object.freeze({
      ...walk,
      blanked: Object.freeze([...new Set([...walk.blanked, refill.slotKey])]),
      refill: Object.freeze({ ...refill, bought: true }),
      purchaseCount: walk.purchaseCount + 1,
    });
  }
  const { slotKey } = purchase;
  return Object.freeze({
    ...walk,
    taken: Object.freeze([...new Set([...walk.taken, slotKey])]),
    blanked: purchase.restocked
      ? walk.blanked
      : Object.freeze([...new Set([...walk.blanked, slotKey])]),
    ...(purchase.restocked
      ? { refill: Object.freeze({ rollKey: walk.rollKey, slotKey, bought: false }) }
      : {}),
    purchaseCount: walk.purchaseCount + 1,
  });
}

export function stygianWellAfterReroll<W extends StygianWellRollWalk>(
  walk: W,
  rerollId: string,
): W {
  return Object.freeze({
    ...walk,
    rollKey: rerollId,
    taken: Object.freeze([]),
    rerollCount: walk.rerollCount + 1,
  });
}

/** The slots the current Pool list still offers. */
export function purgingPoolOfferedSlots(walk: PurgingPoolRollWalk): readonly PurgingPoolSlotKey[] {
  return Object.freeze(walk.offeredSlotKeys.filter((slotKey) => !walk.sold.includes(slotKey)));
}

/**
 * The slots a redrawn list fills: as many as there are eligible traits, up to
 * three, pinned slots first by the planner's slot convention.
 */
export function purgingPoolRerollSlots(
  traitKeyBySlot: Readonly<Partial<Record<PurgingPoolSlotKey, string>>>,
  eligibleCount: number,
): readonly PurgingPoolSlotKey[] {
  const pinned = PURGING_POOL_SLOT_KEYS.filter((slotKey) => traitKeyBySlot[slotKey] !== undefined);
  const open = PURGING_POOL_SLOT_KEYS.filter((slotKey) => traitKeyBySlot[slotKey] === undefined);
  const count = Math.min(PURGING_POOL_SLOT_KEYS.length, eligibleCount);
  const filled = new Set([...pinned, ...open].slice(0, Math.max(count, 0)));
  return Object.freeze(PURGING_POOL_SLOT_KEYS.filter((slotKey) => filled.has(slotKey)));
}

export function purgingPoolAfterSale<W extends PurgingPoolRollWalk>(
  walk: W,
  slotKey: PurgingPoolSlotKey,
): W {
  return Object.freeze({ ...walk, sold: Object.freeze([...new Set([...walk.sold, slotKey])]) });
}

export function purgingPoolAfterReroll<W extends PurgingPoolRollWalk>(
  walk: W,
  rerollId: string,
  offeredSlotKeys: readonly PurgingPoolSlotKey[],
  eligibleCount: number,
): W {
  return Object.freeze({
    ...walk,
    rollKey: rerollId,
    offeredSlotKeys,
    eligibleCount,
    sold: Object.freeze([]),
    rerollCount: walk.rerollCount + 1,
  });
}

/**
 * Where a purchase or sale's roll stands against the roll on show: a roll
 * whose reroll is gone, one already replaced, or one not yet rolled.
 */
export function rollPosition(
  rankedOrder: readonly RoomActionReference[],
  feature: RollFeature,
  rollKey: string,
  currentRollKey: string,
): 'current' | 'missing' | 'replaced' | 'notReached' {
  if (rollKey === currentRollKey) return 'current';
  const kind = feature === 'stygianWell' ? 'rerollStygianWell' : 'rerollPurgingPool';
  const ids = rankedOrder.flatMap((reference) =>
    reference.kind === kind ? [reference.rerollId] : [],
  );
  const position = (key: string) => (key === INITIAL_ROLL_KEY ? -1 : ids.indexOf(key));
  if (rollKey !== INITIAL_ROLL_KEY && !ids.includes(rollKey)) return 'missing';
  return position(rollKey) < position(currentRollKey) ? 'replaced' : 'notReached';
}

/** The chronology point of one Pool sale; the initial list keeps its bare slot. */
export function purgingPoolSalePoint(
  reference: Extract<RoomActionReference, { readonly kind: 'sellPurgingPoolTrait' }>,
): string {
  return reference.rollKey === undefined
    ? `purgingPool:${reference.slotKey}`
    : `purgingPool:${reference.slotKey}:${reference.rollKey}`;
}

/** The Pool sale a chronology point names. */
export function parsePurgingPoolSalePoint(
  point: string,
): Extract<RoomActionReference, { readonly kind: 'sellPurgingPoolTrait' }> | undefined {
  if (!point.startsWith('purgingPool:')) return undefined;
  const [slotKey, rollKey, ...rest] = point.slice('purgingPool:'.length).split(':');
  if (rest.length > 0 || !(PURGING_POOL_SLOT_KEYS as readonly string[]).includes(slotKey ?? ''))
    return undefined;
  return Object.freeze({
    kind: 'sellPurgingPoolTrait',
    slotKey: slotKey as PurgingPoolSlotKey,
    ...(rollKey === undefined ? {} : { rollKey }),
  });
}

/**
 * The game bans one random item still on show from each reroll's draw, so a
 * reroll whose pins include every item on show right before it cannot occur.
 * An unpinned slot on show, or none on show, never proves it.
 */
export function rollRepeatsAllOffers(
  onShow: readonly (string | null)[],
  pins: readonly string[],
): boolean {
  return onShow.length > 0 && onShow.every((itemKey) => itemKey !== null && pins.includes(itemKey));
}

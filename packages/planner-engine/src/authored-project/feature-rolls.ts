import type {
  PurgingPoolRerollAction,
  PurgingPoolSlotKey,
  PurgingPoolState,
  RoomActionReference,
  RoomOccurrence,
  StygianWellGenerationKey,
  StygianWellRerollAction,
  StygianWellSlotKey,
  StygianWellState,
} from './model';

/**
 * Stygian Well and Pool of Purging rolls. A roll is one generation of the
 * screen's offers: the feature state's initial one, then one per reroll
 * action, named by its `rerollId`.
 */
export type RollFeature = 'stygianWell' | 'purgingPool';

export const INITIAL_ROLL_KEY = 'initial';
/** The Pool's list regenerated when the fountain use makes its entry list stale. */
export const PURGING_POOL_REFRESH_ROLL_KEY = 'refresh';
export const STYGIAN_WELL_SLOT_KEYS = Object.freeze([
  'healing',
  'secondLeft',
  'secondRight',
] as const satisfies readonly StygianWellSlotKey[]);
export const PURGING_POOL_SLOT_KEYS = Object.freeze([
  'left',
  'middle',
  'right',
] as const satisfies readonly PurgingPoolSlotKey[]);

export type FeatureRerollAction = StygianWellRerollAction | PurgingPoolRerollAction;

export function rerollActionKind(feature: RollFeature): FeatureRerollAction['kind'] {
  return feature === 'stygianWell' ? 'rerollStygianWell' : 'rerollPurgingPool';
}

export function stygianWellGenerationKey(
  rollKey: string,
  slotKey: StygianWellSlotKey,
): Exclude<StygianWellGenerationKey, 'travelDealRefill'> {
  return `${rollKey}:${slotKey}`;
}

/** A roll slot's generation; undefined for the Travel Deal refill or a malformed key. */
export function parseStygianWellGenerationKey(
  generationKey: string,
): { readonly rollKey: string; readonly slotKey: StygianWellSlotKey } | undefined {
  const separator = generationKey.lastIndexOf(':');
  if (separator <= 0) return undefined;
  const slotKey = generationKey.slice(separator + 1);
  return (STYGIAN_WELL_SLOT_KEYS as readonly string[]).includes(slotKey)
    ? Object.freeze({
        rollKey: generationKey.slice(0, separator),
        slotKey: slotKey as StygianWellSlotKey,
      })
    : undefined;
}

export function stygianWellRerolls(
  order: readonly RoomActionReference[],
): readonly StygianWellRerollAction[] {
  return order.filter(
    (reference): reference is StygianWellRerollAction => reference.kind === 'rerollStygianWell',
  );
}

export function purgingPoolRerolls(
  order: readonly RoomActionReference[],
): readonly PurgingPoolRerollAction[] {
  return order.filter(
    (reference): reference is PurgingPoolRerollAction => reference.kind === 'rerollPurgingPool',
  );
}

export function featureRerolls(
  order: readonly RoomActionReference[],
  feature: RollFeature,
): readonly FeatureRerollAction[] {
  return feature === 'stygianWell' ? stygianWellRerolls(order) : purgingPoolRerolls(order);
}

/**
 * Every reroll id the room still names for one feature: its reroll rows, and
 * the purchases, sales, Twist results and pins keyed by a reroll id. A
 * removed reroll's purchase or sale stays authored, so its id is never reused.
 */
export function featureRerollIdsInUse(
  occurrence: Pick<RoomOccurrence, 'roomActions' | 'stygianWell' | 'purgingPool'>,
  feature: RollFeature,
): ReadonlySet<string> {
  const ids = new Set(featureRerolls(occurrence.roomActions.order, feature).map((r) => r.rerollId));
  const addRoll = (rollKey: string | undefined) => {
    if (rollKey !== undefined && rollKey !== INITIAL_ROLL_KEY) ids.add(rollKey);
  };
  if (feature === 'stygianWell') {
    for (const reference of occurrence.roomActions.order)
      if (reference.kind === 'purchaseStygianWellOffer')
        addRoll(parseStygianWellGenerationKey(reference.generationKey)?.rollKey);
    const well = occurrence.stygianWell;
    for (const generationKey of Object.keys(well?.twistResultKeyByGeneration ?? {}))
      addRoll(parseStygianWellGenerationKey(generationKey)?.rollKey);
    for (const rerollId of Object.keys(well?.rerollOfferKeyBySlot ?? {})) addRoll(rerollId);
  } else {
    for (const reference of occurrence.roomActions.order)
      if (reference.kind === 'sellPurgingPoolTrait') addRoll(reference.rollKey);
    for (const rerollId of Object.keys(occurrence.purgingPool?.rerollTraitKeyBySlot ?? {}))
      addRoll(rerollId);
  }
  return ids;
}

const NO_PINS = Object.freeze({});

/** The pinned slots of one Well reroll; empty when none is pinned. */
export function stygianWellRerollPins(
  well: StygianWellState | undefined,
  rerollId: string,
): Readonly<Partial<Record<StygianWellSlotKey, string>>> {
  return well?.rerollOfferKeyBySlot?.[rerollId] ?? NO_PINS;
}

/** The pinned slots of one Pool reroll's list; empty when none is pinned. */
export function purgingPoolRerollPins(
  pool: PurgingPoolState | undefined,
  rerollId: string,
): Readonly<Partial<Record<PurgingPoolSlotKey, string>>> {
  return pool?.rerollTraitKeyBySlot?.[rerollId] ?? NO_PINS;
}

/** The Well generations bought in a room, in action order: each purchase row is one. */
export function stygianWellPurchasedGenerationKeys(
  order: readonly RoomActionReference[],
): readonly StygianWellGenerationKey[] {
  return order.flatMap((reference) =>
    reference.kind === 'purchaseStygianWellOffer' ? [reference.generationKey] : [],
  );
}

/** The Pool sale's roll: its reroll id, or the initial list. */
export function purgingPoolSaleRollKey(
  reference: Extract<RoomActionReference, { readonly kind: 'sellPurgingPoolTrait' }>,
): string {
  return reference.rollKey ?? INITIAL_ROLL_KEY;
}

/**
 * The authored item at one Well generation: undefined when the generation
 * names no present roll, null while it is unresolved or unpinned.
 */
export function stygianWellGenerationItemKey(
  occurrence: {
    readonly stygianWell?: RoomOccurrence['stygianWell'] | undefined;
    readonly roomActions: RoomOccurrence['roomActions'];
  },
  generationKey: StygianWellGenerationKey,
): string | null | undefined {
  const well = occurrence.stygianWell;
  if (well === undefined) return undefined;
  if (generationKey === 'travelDealRefill') return well.travelDealRefillKey;
  const parsed = parseStygianWellGenerationKey(generationKey);
  if (parsed === undefined) return undefined;
  if (parsed.rollKey === INITIAL_ROLL_KEY) return well.offerKeyBySlot[parsed.slotKey];
  const present = stygianWellRerolls(occurrence.roomActions.order).some(
    (candidate) => candidate.rerollId === parsed.rollKey,
  );
  return present
    ? (stygianWellRerollPins(well, parsed.rollKey)[parsed.slotKey] ?? null)
    : undefined;
}

/**
 * Where a Well generation was stocked: its slot and its roll's number in the
 * room, the initial stock being roll 1. Undefined for the Travel Deal refill;
 * the number is absent once its reroll is no longer authored.
 */
export function stygianWellGenerationSlot(
  occurrence: { readonly roomActions: RoomOccurrence['roomActions'] },
  generationKey: StygianWellGenerationKey,
): { readonly slotKey: StygianWellSlotKey; readonly rollNumber?: number } | undefined {
  const parsed = parseStygianWellGenerationKey(generationKey);
  if (parsed === undefined) return undefined;
  if (parsed.rollKey === INITIAL_ROLL_KEY)
    return Object.freeze({ slotKey: parsed.slotKey, rollNumber: 1 });
  const index = stygianWellRerolls(occurrence.roomActions.order).findIndex(
    (reroll) => reroll.rerollId === parsed.rollKey,
  );
  return Object.freeze(
    index < 0 ? { slotKey: parsed.slotKey } : { slotKey: parsed.slotKey, rollNumber: index + 2 },
  );
}

/** The authored Fateful Twist result of one Well generation. */
export function stygianWellGenerationTwistResultKey(
  occurrence: { readonly stygianWell?: RoomOccurrence['stygianWell'] | undefined },
  generationKey: StygianWellGenerationKey,
): string | null | undefined {
  return occurrence.stygianWell?.twistResultKeyByGeneration?.[generationKey];
}

/**
 * The authored trait of one Pool list slot: the initial list's is the
 * regenerated list's while one is stored, else the entry list's. Undefined
 * when the roll is not present, null while the slot is blank.
 */
export function purgingPoolRollTraitKey(
  occurrence: {
    readonly purgingPool?: RoomOccurrence['purgingPool'] | undefined;
    readonly roomActions: RoomOccurrence['roomActions'];
  },
  rollKey: string,
  slotKey: PurgingPoolSlotKey,
): string | null | undefined {
  const pool = occurrence.purgingPool;
  if (pool === undefined) return undefined;
  // A stored refresh replaces the entry list once the fountain use opens the Pool.
  if (rollKey === INITIAL_ROLL_KEY || rollKey === PURGING_POOL_REFRESH_ROLL_KEY)
    return pool.refreshTraitKeyBySlot === undefined
      ? pool.traitKeyBySlot[slotKey]
      : (pool.refreshTraitKeyBySlot[slotKey] ?? null);
  const present = purgingPoolRerolls(occurrence.roomActions.order).some(
    (candidate) => candidate.rerollId === rollKey,
  );
  return present ? (purgingPoolRerollPins(pool, rollKey)[slotKey] ?? null) : undefined;
}

import type {
  PurgingPoolRerollAction,
  PurgingPoolSlotKey,
  RoomActionReference,
  RoomOccurrence,
  StygianWellGenerationKey,
  StygianWellRerollAction,
  StygianWellSlotKey,
} from './model';

/**
 * Stygian Well and Pool of Purging rolls. A roll is one generation of the
 * screen's offers: the feature state's initial one, then one per reroll
 * action, named by its `rerollId`.
 */
export type RollFeature = 'stygianWell' | 'purgingPool';

export const INITIAL_ROLL_KEY = 'initial';
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
  const reroll = stygianWellRerolls(occurrence.roomActions.order).find(
    (candidate) => candidate.rerollId === parsed.rollKey,
  );
  return reroll === undefined ? undefined : (reroll.offerKeyBySlot[parsed.slotKey] ?? null);
}

/** The authored Fateful Twist result of one Well generation. */
export function stygianWellGenerationTwistResultKey(
  occurrence: {
    readonly stygianWell?: RoomOccurrence['stygianWell'] | undefined;
    readonly roomActions: RoomOccurrence['roomActions'];
  },
  generationKey: StygianWellGenerationKey,
): string | null | undefined {
  const well = occurrence.stygianWell;
  if (well === undefined) return undefined;
  if (generationKey === 'travelDealRefill') return well.twistResultKeyBySlot?.travelDealRefill;
  const parsed = parseStygianWellGenerationKey(generationKey);
  if (parsed === undefined) return undefined;
  if (parsed.rollKey === INITIAL_ROLL_KEY) return well.twistResultKeyBySlot?.[parsed.slotKey];
  return stygianWellRerolls(occurrence.roomActions.order).find(
    (candidate) => candidate.rerollId === parsed.rollKey,
  )?.twistResultKeyBySlot?.[parsed.slotKey];
}

/**
 * The authored trait of one Pool roll slot: undefined when the roll is not
 * present, null while it is unresolved or unpinned.
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
  if (rollKey === INITIAL_ROLL_KEY) return pool.traitKeyBySlot[slotKey];
  const reroll = purgingPoolRerolls(occurrence.roomActions.order).find(
    (candidate) => candidate.rerollId === rollKey,
  );
  return reroll === undefined ? undefined : (reroll.traitKeyBySlot[slotKey] ?? null);
}

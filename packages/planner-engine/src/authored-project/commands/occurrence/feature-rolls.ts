import type { Catalog } from '../../../catalog-schema';
import {
  INITIAL_ROLL_KEY,
  PURGING_POOL_SLOT_KEYS,
  STYGIAN_WELL_SLOT_KEYS,
  featureRerolls,
  parseStygianWellGenerationKey,
  purgingPoolRerollPins,
  rerollActionKind,
  stygianWellGenerationKey,
  stygianWellRerollPins,
  type FeatureRerollAction,
  type RollFeature,
} from '../../feature-rolls';
import type {
  ProjectDocument,
  PurgingPoolSlotKey,
  PurgingPoolState,
  RoomActionReference,
  RoomOccurrence,
  StygianWellGenerationKey,
  StygianWellSlotKey,
  StygianWellState,
} from '../../model';
import { nextRerollId } from '../../rerolls';
import { roomActionKey } from '../../room-actions/key';
import { screenRerollSupported } from '../../screen-rerolls';
import { failCommand, requireOccurrence, type LocatedBiome } from '../contract';
import type { OccurrenceLeafCommand } from '../types';
import { updateOccurrence } from './mutation';

export type FeatureRollCommand = Extract<
  OccurrenceLeafCommand,
  {
    readonly kind:
      | 'InsertStygianWellReroll'
      | 'InsertPurgingPoolReroll'
      | 'ReplaceStygianWellRollOffer'
      | 'ReplacePurgingPoolRollSlot'
      | 'SellPurgingPoolRollSlot';
  }
>;

export function roomShopItemKeys(catalog: Catalog): ReadonlySet<string> {
  return new Set(
    catalog.rewards.shops.byKey.RoomShop?.groups.values.flatMap((group) =>
      group.options.values.map((option) => option.key),
    ) ?? [],
  );
}

function requirePresentFeature(
  command: FeatureRollCommand,
  occurrence: RoomOccurrence,
  feature: RollFeature,
): void {
  const state = feature === 'stygianWell' ? occurrence.stygianWell : occurrence.purgingPool;
  if (state === undefined)
    failCommand(
      command,
      feature === 'stygianWell'
        ? 'occurrence has no present Stygian Well'
        : 'occurrence has no Purging Pool',
    );
}

function withOrder(
  occurrence: RoomOccurrence,
  order: readonly RoomActionReference[],
): RoomOccurrence {
  return Object.freeze({
    ...occurrence,
    roomActions: Object.freeze({ ...occurrence.roomActions, order: Object.freeze([...order]) }),
  });
}

/** Inserts, pins and unpins Well and Pool rerolls; removal and moves are room-action commands. */
export function applyFeatureRollCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: FeatureRollCommand,
): ProjectDocument {
  switch (command.kind) {
    case 'InsertStygianWellReroll':
    case 'InsertPurgingPoolReroll': {
      const feature: RollFeature =
        command.kind === 'InsertStygianWellReroll' ? 'stygianWell' : 'purgingPool';
      const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      requirePresentFeature(command, occurrence, feature);
      const room = catalog.rooms.byKey[occurrence.gameName];
      if (room === undefined || !screenRerollSupported(catalog, { kind: feature, room }))
        failCommand(command, 'this screen cannot be rerolled');
      const order = occurrence.roomActions.order;
      if (!Number.isInteger(command.index) || command.index < 0 || command.index > order.length)
        failCommand(command, `index must be an integer from 0 through ${order.length}`);
      const rerollId = nextRerollId(featureRerolls(order, feature));
      const reroll: RoomActionReference = Object.freeze({
        kind: rerollActionKind(feature),
        rerollId,
      });
      const nextOrder = [...order];
      nextOrder.splice(command.index, 0, reroll);
      return updateOccurrence(document, located, withOrder(occurrence, nextOrder));
    }
    case 'ReplaceStygianWellRollOffer':
    case 'ReplacePurgingPoolRollSlot': {
      const occurrence = requireOccurrence(located.plan, command.action.occurrenceId, command);
      const rerollId = rerollIdOf(command, occurrence, command.action.actionKey);
      const pinned =
        command.kind === 'ReplaceStygianWellRollOffer'
          ? pinRollSlot(
              catalog,
              command,
              occurrence,
              'stygianWell',
              rerollId,
              command.slotKey,
              command.itemKey,
            )
          : pinRollSlot(
              catalog,
              command,
              occurrence,
              'purgingPool',
              rerollId,
              command.slotKey,
              command.traitKey,
            );
      return pinned === occurrence ? document : updateOccurrence(document, located, pinned);
    }
    case 'SellPurgingPoolRollSlot': {
      const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      requirePresentFeature(command, occurrence, 'purgingPool');
      const initial = command.rollKey === INITIAL_ROLL_KEY;
      if (
        !initial &&
        !featureRerolls(occurrence.roomActions.order, 'purgingPool').some(
          (reroll) => reroll.rerollId === command.rollKey,
        )
      )
        failCommand(command, 'room action is not an ordered Pool reroll');
      const pinned = initial
        ? pinInitialPoolSlot(catalog, command, occurrence, command.slotKey, command.traitKey)
        : pinRollSlot(
            catalog,
            command,
            occurrence,
            'purgingPool',
            command.rollKey,
            command.slotKey,
            command.traitKey,
          );
      const sale: RoomActionReference = Object.freeze({
        kind: 'sellPurgingPoolTrait',
        slotKey: command.slotKey,
        ...(initial ? {} : { rollKey: command.rollKey }),
      });
      const order = pinned.roomActions.order;
      if (order.some((reference) => roomActionKey(reference) === roomActionKey(sale)))
        failCommand(command, 'the slot is already sold');
      if (!Number.isInteger(command.index) || command.index < 0 || command.index > order.length)
        failCommand(command, `index must be an integer from 0 through ${order.length}`);
      const nextOrder = [...order];
      nextOrder.splice(command.index, 0, sale);
      return updateOccurrence(document, located, withOrder(pinned, nextOrder));
    }
  }
}

/** The reroll id an action key names, when it is an ordered Well or Pool reroll. */
function rerollIdOf(
  command: Parameters<typeof failCommand>[0],
  occurrence: RoomOccurrence,
  actionKey: string,
): string {
  const reference = occurrence.roomActions.order.find(
    (candidate) => roomActionKey(candidate) === actionKey,
  );
  if (reference?.kind !== 'rerollStygianWell' && reference?.kind !== 'rerollPurgingPool')
    failCommand(command, 'room action is not an ordered Well or Pool reroll');
  return reference.rerollId;
}

/** Pins one slot of the Pool's initial list. */
function pinInitialPoolSlot(
  catalog: Catalog,
  command: Parameters<typeof failCommand>[0],
  occurrence: RoomOccurrence,
  slotKey: string,
  traitKey: string,
): RoomOccurrence {
  const pool = occurrence.purgingPool;
  if (pool === undefined) failCommand(command, 'occurrence has no Purging Pool');
  if (!(PURGING_POOL_SLOT_KEYS as readonly string[]).includes(slotKey))
    failCommand(command, `unknown Purging Pool slot ${slotKey}`);
  if (catalog.traits.byKey[traitKey] === undefined) failCommand(command, 'unknown trait');
  return Object.freeze({
    ...occurrence,
    purgingPool: Object.freeze({
      ...pool,
      traitKeyBySlot: Object.freeze({ ...pool.traitKeyBySlot, [slotKey]: traitKey }),
    }),
  });
}

/** One reroll's pins in a by-reroll record; absent when none is left. */
function withRerollPins<Slot extends string>(
  byReroll: Readonly<Record<string, Readonly<Partial<Record<Slot, string>>>>> | undefined,
  rerollId: string,
  pins: Readonly<Partial<Record<Slot, string>>>,
): Readonly<Record<string, Readonly<Partial<Record<Slot, string>>>>> | undefined {
  const next = { ...byReroll };
  if (Object.keys(pins).length === 0) delete next[rerollId];
  else next[rerollId] = Object.freeze({ ...pins });
  return Object.keys(next).length === 0 ? undefined : Object.freeze(next);
}

/**
 * The Well without the Twist results of the given generations; a result
 * belongs to the Fateful Twist it resolved.
 */
export function withoutStygianWellTwistResults(
  well: StygianWellState,
  dropped: (generationKey: StygianWellGenerationKey) => boolean,
): StygianWellState {
  const results = well.twistResultKeyByGeneration;
  if (results === undefined) return well;
  const kept = Object.entries(results).filter(
    ([generationKey]) => !dropped(generationKey as StygianWellGenerationKey),
  );
  if (kept.length === Object.keys(results).length) return well;
  const { twistResultKeyByGeneration: _previous, ...rest } = well;
  void _previous;
  return Object.freeze({
    ...rest,
    ...(kept.length === 0
      ? {}
      : { twistResultKeyByGeneration: Object.freeze(Object.fromEntries(kept)) }),
  });
}

function withStygianWellRerollPins(
  well: StygianWellState,
  rerollId: string,
  pins: Readonly<Partial<Record<StygianWellSlotKey, string>>>,
): StygianWellState {
  const { rerollOfferKeyBySlot: _previous, ...rest } = well;
  void _previous;
  const next = withRerollPins(well.rerollOfferKeyBySlot, rerollId, pins);
  return Object.freeze({ ...rest, ...(next === undefined ? {} : { rerollOfferKeyBySlot: next }) });
}

function withPurgingPoolRerollPins(
  pool: PurgingPoolState,
  rerollId: string,
  pins: Readonly<Partial<Record<PurgingPoolSlotKey, string>>>,
): PurgingPoolState {
  const { rerollTraitKeyBySlot: _previous, ...rest } = pool;
  void _previous;
  const next = withRerollPins(pool.rerollTraitKeyBySlot, rerollId, pins);
  return Object.freeze({ ...rest, ...(next === undefined ? {} : { rerollTraitKeyBySlot: next }) });
}

/**
 * The occurrence without what a removed Well or Pool reroll drew: its pins
 * and the Twist results of its generations.
 */
export function withoutFeatureRerollObservations(
  occurrence: RoomOccurrence,
  reroll: FeatureRerollAction,
): RoomOccurrence {
  if (reroll.kind === 'rerollStygianWell') {
    const well = occurrence.stygianWell;
    if (well === undefined) return occurrence;
    const next = withoutStygianWellTwistResults(
      withStygianWellRerollPins(well, reroll.rerollId, {}),
      (generationKey) => parseStygianWellGenerationKey(generationKey)?.rollKey === reroll.rerollId,
    );
    return next === well ? occurrence : Object.freeze({ ...occurrence, stygianWell: next });
  }
  const pool = occurrence.purgingPool;
  if (pool?.rerollTraitKeyBySlot?.[reroll.rerollId] === undefined) return occurrence;
  return Object.freeze({
    ...occurrence,
    purgingPool: withPurgingPoolRerollPins(pool, reroll.rerollId, {}),
  });
}

/**
 * Pins or, with null, unpins one slot of a Well or Pool reroll; returns the
 * occurrence itself when nothing changes.
 */
export function pinRollSlot(
  catalog: Catalog,
  command: Parameters<typeof failCommand>[0],
  occurrence: RoomOccurrence,
  feature: RollFeature,
  rerollId: string,
  slotKey: string,
  value: string | null,
): RoomOccurrence {
  const present = featureRerolls(occurrence.roomActions.order, feature).some(
    (reference) => reference.rerollId === rerollId,
  );
  if (feature === 'stygianWell') {
    const well = occurrence.stygianWell;
    if (!present || well === undefined)
      failCommand(command, 'room action is not an ordered Well reroll');
    if (!(STYGIAN_WELL_SLOT_KEYS as readonly string[]).includes(slotKey))
      failCommand(command, 'unknown Stygian Well slot');
    if (value !== null && !roomShopItemKeys(catalog).has(value))
      failCommand(command, 'unknown RoomShop item');
    const key = slotKey as StygianWellSlotKey;
    const existing = stygianWellRerollPins(well, rerollId);
    if ((existing[key] ?? null) === value) return occurrence;
    const pins: Partial<Record<StygianWellSlotKey, string>> = { ...existing };
    if (value === null) delete pins[key];
    else pins[key] = value;
    const generation = stygianWellGenerationKey(rerollId, key);
    return Object.freeze({
      ...occurrence,
      stygianWell: withoutStygianWellTwistResults(
        withStygianWellRerollPins(well, rerollId, pins),
        (generationKey) => generationKey === generation,
      ),
    });
  }
  const pool = occurrence.purgingPool;
  if (!present || pool === undefined)
    failCommand(command, 'room action is not an ordered Pool reroll');
  if (!(PURGING_POOL_SLOT_KEYS as readonly string[]).includes(slotKey))
    failCommand(command, `unknown Purging Pool slot ${slotKey}`);
  if (value !== null && catalog.traits.byKey[value] === undefined)
    failCommand(command, 'unknown trait');
  const key = slotKey as PurgingPoolSlotKey;
  const existing = purgingPoolRerollPins(pool, rerollId);
  if ((existing[key] ?? null) === value) return occurrence;
  const pins: Partial<Record<PurgingPoolSlotKey, string>> = { ...existing };
  if (value === null) delete pins[key];
  else pins[key] = value;
  return Object.freeze({
    ...occurrence,
    purgingPool: withPurgingPoolRerollPins(pool, rerollId, pins),
  });
}

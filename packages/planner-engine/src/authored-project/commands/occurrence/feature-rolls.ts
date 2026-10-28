import type { Catalog } from '../../../catalog-schema';
import {
  PURGING_POOL_SLOT_KEYS,
  STYGIAN_WELL_SLOT_KEYS,
  featureRerolls,
  rerollActionKind,
  type RollFeature,
} from '../../feature-rolls';
import type { ProjectDocument, RoomActionReference, RoomOccurrence } from '../../model';
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
      const reroll: RoomActionReference =
        feature === 'stygianWell'
          ? Object.freeze({
              kind: rerollActionKind(feature) as 'rerollStygianWell',
              rerollId,
              offerKeyBySlot: Object.freeze({}),
            })
          : Object.freeze({
              kind: rerollActionKind(feature) as 'rerollPurgingPool',
              rerollId,
              traitKeyBySlot: Object.freeze({}),
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
      const occurrence = requireOccurrence(located.plan, command.reroll.occurrenceId, command);
      const rerollId = rerollIdOf(command, occurrence, command.reroll.actionKey);
      const pinned = pinRollSlot(
        catalog,
        command,
        occurrence,
        'purgingPool',
        rerollId,
        command.slotKey,
        command.traitKey,
      );
      const sale: RoomActionReference = Object.freeze({
        kind: 'sellPurgingPoolTrait',
        slotKey: command.slotKey,
        rollKey: rerollId,
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
  const order = occurrence.roomActions.order;
  const index = order.findIndex(
    (reference) => reference.kind === rerollActionKind(feature) && reference.rerollId === rerollId,
  );
  const existing = order[index];
  const nextOrder = [...order];
  if (feature === 'stygianWell') {
    if (existing?.kind !== 'rerollStygianWell')
      failCommand(command, 'room action is not an ordered Well reroll');
    if (!(STYGIAN_WELL_SLOT_KEYS as readonly string[]).includes(slotKey))
      failCommand(command, 'unknown Stygian Well slot');
    if (value !== null && !roomShopItemKeys(catalog).has(value))
      failCommand(command, 'unknown RoomShop item');
    const key = slotKey as keyof typeof existing.offerKeyBySlot;
    if ((existing.offerKeyBySlot[key] ?? null) === value) return occurrence;
    const offers: Record<string, string> = { ...existing.offerKeyBySlot };
    if (value === null) delete offers[key];
    else offers[key] = value;
    // A Twist result belongs to the Fateful Twist it resolved.
    const twists: Record<string, string | null> = { ...existing.twistResultKeyBySlot };
    delete twists[key];
    const { twistResultKeyBySlot: _previousTwists, ...rest } = existing;
    void _previousTwists;
    nextOrder[index] = Object.freeze({
      ...rest,
      offerKeyBySlot: Object.freeze(offers),
      ...(Object.keys(twists).length === 0 ? {} : { twistResultKeyBySlot: Object.freeze(twists) }),
    });
  } else {
    if (existing?.kind !== 'rerollPurgingPool')
      failCommand(command, 'room action is not an ordered Pool reroll');
    if (!(PURGING_POOL_SLOT_KEYS as readonly string[]).includes(slotKey))
      failCommand(command, `unknown Purging Pool slot ${slotKey}`);
    if (value !== null && catalog.traits.byKey[value] === undefined)
      failCommand(command, 'unknown trait');
    const key = slotKey as keyof typeof existing.traitKeyBySlot;
    if ((existing.traitKeyBySlot[key] ?? null) === value) return occurrence;
    const traits: Record<string, string> = { ...existing.traitKeyBySlot };
    if (value === null) delete traits[key];
    else traits[key] = value;
    nextOrder[index] = Object.freeze({ ...existing, traitKeyBySlot: Object.freeze(traits) });
  }
  return withOrder(occurrence, nextOrder);
}

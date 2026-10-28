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
      | 'ReplacePurgingPoolRollSlot';
  }
>;

export function roomShopItemKeys(catalog: Catalog): ReadonlySet<string> {
  return new Set(
    catalog.rewards.shops.byKey.RoomShop?.groups.values.flatMap((group) =>
      group.options.values.map((option) => option.key),
    ) ?? [],
  );
}

function requireInteractedFeature(
  command: FeatureRollCommand,
  occurrence: RoomOccurrence,
  feature: RollFeature,
): void {
  const state = feature === 'stygianWell' ? occurrence.stygianWell : occurrence.purgingPool;
  if (state?.interacted !== true)
    failCommand(
      command,
      feature === 'stygianWell'
        ? 'Stygian Well is not being interacted with'
        : 'Purging Pool is not being interacted with',
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
      requireInteractedFeature(command, occurrence, feature);
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
      const order = occurrence.roomActions.order;
      const index = order.findIndex(
        (reference) => roomActionKey(reference) === command.action.actionKey,
      );
      const existing = order[index];
      const nextOrder = [...order];
      if (command.kind === 'ReplaceStygianWellRollOffer') {
        if (existing?.kind !== 'rerollStygianWell')
          failCommand(command, 'room action is not an ordered Well reroll');
        if (!(STYGIAN_WELL_SLOT_KEYS as readonly string[]).includes(command.slotKey))
          failCommand(command, 'unknown Stygian Well slot');
        if (command.itemKey !== null && !roomShopItemKeys(catalog).has(command.itemKey))
          failCommand(command, 'unknown RoomShop item');
        const previous = existing.offerKeyBySlot[command.slotKey];
        if ((previous ?? null) === command.itemKey) return document;
        const offers: Record<string, string> = { ...existing.offerKeyBySlot };
        if (command.itemKey === null) delete offers[command.slotKey];
        else offers[command.slotKey] = command.itemKey;
        // A Twist result belongs to the Fateful Twist it resolved.
        const twists: Record<string, string | null> = { ...existing.twistResultKeyBySlot };
        delete twists[command.slotKey];
        const { twistResultKeyBySlot: _previousTwists, ...rest } = existing;
        void _previousTwists;
        nextOrder[index] = Object.freeze({
          ...rest,
          offerKeyBySlot: Object.freeze(offers),
          ...(Object.keys(twists).length === 0
            ? {}
            : { twistResultKeyBySlot: Object.freeze(twists) }),
        });
      } else {
        if (existing?.kind !== 'rerollPurgingPool')
          failCommand(command, 'room action is not an ordered Pool reroll');
        if (!(PURGING_POOL_SLOT_KEYS as readonly string[]).includes(command.slotKey))
          failCommand(command, `unknown Purging Pool slot ${String(command.slotKey)}`);
        if (command.traitKey !== null && catalog.traits.byKey[command.traitKey] === undefined)
          failCommand(command, 'unknown trait');
        if ((existing.traitKeyBySlot[command.slotKey] ?? null) === command.traitKey)
          return document;
        const traits: Record<string, string> = { ...existing.traitKeyBySlot };
        if (command.traitKey === null) delete traits[command.slotKey];
        else traits[command.slotKey] = command.traitKey;
        nextOrder[index] = Object.freeze({ ...existing, traitKeyBySlot: Object.freeze(traits) });
      }
      return updateOccurrence(document, located, withOrder(occurrence, nextOrder));
    }
  }
}

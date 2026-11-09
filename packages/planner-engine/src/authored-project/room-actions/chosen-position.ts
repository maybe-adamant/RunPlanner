import type { Catalog } from '../../catalog-schema';
import { createBiomeAddress, type OccurrenceAddress } from '../addresses';
import type { ProjectDocument, RoomActionReference } from '../model';
import { replaceOccurrenceOrders, roomActionDomainForOccurrence } from './defaults';
import {
  assessRoomActionPlacement,
  roomActionOrderContextForOccurrence,
  roomActionPlacementRefusal,
} from './order-assessment';
import { roomActionKey } from './state';

/**
 * Actions an object command has just placed at its default position: `keys`
 * name them in the order they move together, the first to a chosen index and
 * the rest right after it.
 */
export interface PlacedRoomActions {
  readonly document: ProjectDocument;
  readonly occurrence: OccurrenceAddress;
  readonly keys: readonly string[];
}

export type ChosenRoomActionPosition =
  | { readonly kind: 'placed'; readonly document: ProjectDocument }
  | { readonly kind: 'refused'; readonly reason: string };

function frozen<T>(value: T): T {
  return Object.freeze(value);
}

function placedOrder(placed: PlacedRoomActions) {
  const plan =
    placed.document.route.routeKey === placed.occurrence.routeKey
      ? placed.document.route.biomes.find(
          (candidate) => candidate.biomeKey === placed.occurrence.biomeKey,
        )
      : undefined;
  const host = plan?.topology?.occurrences.find(
    (candidate) => candidate.occurrenceId === placed.occurrence.occurrenceId,
  );
  if (host === undefined) return undefined;
  const order = host.roomActions.order;
  const moved = placed.keys.map((key) =>
    order.find((reference) => roomActionKey(reference) === key),
  );
  if (moved.length === 0 || moved.some((reference) => reference === undefined)) return undefined;
  const keys = new Set(placed.keys);
  return {
    order,
    moved: moved as RoomActionReference[],
    remaining: order.filter((reference) => !keys.has(roomActionKey(reference))),
  };
}

/**
 * Moves the placed actions to `index` of the order they leave behind. The
 * resulting order is judged with the room's actions as they would then be,
 * by window, dependencies, checkpoints and the terminal action; an order equal
 * to the default placement is always accepted.
 */
export function placeRoomActionsAtChosenIndex(
  catalog: Catalog,
  placed: PlacedRoomActions,
  index: number,
): ChosenRoomActionPosition {
  const current = placedOrder(placed);
  if (current === undefined)
    return frozen({ kind: 'refused', reason: 'has no placed action to position' });
  const { order, moved, remaining } = current;
  if (!Number.isInteger(index) || index < 0 || index > remaining.length)
    return frozen({
      kind: 'refused',
      reason: `index must be an integer from 0 through ${remaining.length}`,
    });
  const next = [...remaining.slice(0, index), ...moved, ...remaining.slice(index)];
  if (next.every((reference, position) => reference === order[position]))
    return frozen({ kind: 'placed', document: placed.document });
  const document = replaceOccurrenceOrders(
    placed.document,
    new Map([
      [
        JSON.stringify([
          placed.occurrence.routeKey,
          placed.occurrence.biomeKey,
          placed.occurrence.occurrenceId,
        ]),
        frozen(next),
      ],
    ]),
  );
  const host = roomActionDomainForOccurrence(
    document,
    catalog,
    createBiomeAddress(placed.occurrence.routeKey, placed.occurrence.biomeKey),
    placed.occurrence.occurrenceId,
  );
  if (host === undefined)
    return frozen({ kind: 'refused', reason: 'has no room-action domain to position in' });
  const refusal = roomActionPlacementRefusal(
    index,
    moved[0]!,
    assessRoomActionPlacement(
      remaining,
      next,
      roomActionOrderContextForOccurrence(host.domain, host.occurrence),
    ),
  );
  return refusal === undefined
    ? frozen({ kind: 'placed', document })
    : frozen({ kind: 'refused', reason: refusal });
}

/** Every index of the remaining order at which the placed actions may stand, ascending. */
export function chosenRoomActionIndexes(
  catalog: Catalog,
  placed: PlacedRoomActions,
): readonly number[] {
  const current = placedOrder(placed);
  if (current === undefined) return frozen([]);
  const indexes: number[] = [];
  for (let index = 0; index <= current.remaining.length; index += 1)
    if (placeRoomActionsAtChosenIndex(catalog, placed, index).kind === 'placed')
      indexes.push(index);
  return frozen(indexes);
}

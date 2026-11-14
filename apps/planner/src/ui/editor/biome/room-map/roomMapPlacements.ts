import type {
  WorkspaceRoomFeature,
  WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';
import { offerIcon, shopItemIcon } from '@planner/ui/artwork/rewardIcon';
import { heldObjectIcon, heldObjectName } from '../room-features/roomObjectFace';
import { fieldsSlotBadge, fieldsSlotIcon } from '../room-layout/fieldsSlotFace';
import type { RoomMapOccupant, RoomMapPlacements } from './RoomMapPoints';

type ShopItemControl = Extract<
  WorkspaceRoomFeature,
  { readonly kind: 'infernalContractPedestal' }
>['rewardControl'];

/** A Shop item's face: its stocked item, or none while it is unset. */
function shopItemFace(control: ShopItemControl, fallback: string): RoomMapOccupant | undefined {
  const offer = control.offer;
  if (offer === null) return undefined;
  const optionKey = control.shopOption?.selectedOptionKey ?? null;
  const option = control.shopOption?.options.find((candidate) => candidate.key === optionKey);
  return {
    label: option?.label ?? fallback,
    icon: optionKey === null ? offerIcon(offer) : shopItemIcon(optionKey, offer),
  };
}

/**
 * How far into the room's Timeline the map stands: `start` before any row,
 * `end` after every row, or the keys of the rows made by then.
 */
export type RoomMapStockStage = 'start' | 'end' | ReadonlySet<string>;

/** The room's Timeline rows made by the stage, as the walk takes them. */
function madeRows(room: WorkspaceRoomSummary, stage: RoomMapStockStage) {
  if (stage === 'start') return [];
  return (room.roomActions?.rows ?? []).filter(
    (row) => row.rank !== null && !row.stale && (stage === 'end' || stage.has(row.key)),
  );
}

/**
 * The Shop item standing on each offer's point at the stage: a bought item
 * is gone, and the Travel Deal refill stands on the item whose purchase the
 * engine names as its trigger until the refill is bought.
 */
function shopItems(
  room: WorkspaceRoomSummary,
  made: ReturnType<typeof madeRows>,
): ReadonlyMap<string, RoomMapOccupant> {
  if (room.roomLocal.kind !== 'shop') return new Map();
  const bought = new Set(
    made.flatMap((row) =>
      row.reference.kind === 'interactShopOffer' ? [row.reference.offerKey] : [],
    ),
  );
  const refillBought = made.some((row) => row.sourceFamily?.kind === 'shopTravelDealRefill');
  const refill = room.roomLocal.supplementalOffers.find(
    (offer) => offer.kind === 'travelDealRefill',
  );
  return new Map(
    room.roomLocal.offers.flatMap((offer) => {
      const face = !bought.has(offer.key)
        ? shopItemFace(offer.rewardControl, offer.label)
        : refill?.sourceOfferKey === offer.key && !refillBought
          ? shopItemFace(refill.rewardControl, 'Travel Deal refill')
          : undefined;
      return face === undefined ? [] : [[offer.key, face] as const];
    }),
  );
}

/** The pedestal's item until it is collected. */
function contractPedestal(
  room: WorkspaceRoomSummary,
  made: ReturnType<typeof madeRows>,
): RoomMapOccupant | undefined {
  const pedestal = room.workbench.features.find(
    (feature) => feature.kind === 'infernalContractPedestal',
  );
  if (pedestal?.kind !== 'infernalContractPedestal') return undefined;
  if (made.some((row) => row.reference.kind === 'interactInfernalContractPedestal'))
    return undefined;
  return shopItemFace(pedestal.rewardControl, 'Contract pedestal');
}

/**
 * The room's planned entry, anchor occupants, Fields slots and the Shop and
 * pedestal stock standing at the stage, as its map shows them.
 */
export function roomMapPlacements(
  room: WorkspaceRoomSummary,
  stage: RoomMapStockStage,
): Omit<RoomMapPlacements, 'preview'> {
  const layout = room.layout;
  const anchors = room.objectSlots?.anchors ?? [];
  const fields = room.roomLocal.kind === 'fields' ? room.roomLocal : undefined;
  const made = madeRows(room, stage);
  const pedestal = contractPedestal(room, made);
  return {
    shopItems: shopItems(room, made),
    ...(pedestal === undefined ? {} : { contractPedestal: pedestal }),
    ...(layout?.entryId === undefined ? {} : { entryId: layout.entryId }),
    entryEligible: layout?.eligible ?? [],
    entryNumbers: new Map(layout?.entries.map((entry) => [entry.pointId, entry.number]) ?? []),
    anchors: new Map(
      anchors.flatMap((anchor) =>
        anchor.occupant === undefined
          ? []
          : [
              [
                anchor.anchorId,
                { label: heldObjectName(anchor.occupant), icon: heldObjectIcon(anchor.occupant) },
              ] as const,
            ],
      ),
    ),
    anchorNumbers: new Map(anchors.map((anchor) => [anchor.anchorId, anchor.number])),
    fieldsPoints: new Map(
      (fields?.spatial ?? []).flatMap((control) => {
        const pointId = control.pointId;
        return pointId === null || fields === undefined
          ? []
          : [
              [
                pointId,
                {
                  label: control.label,
                  icon: fieldsSlotIcon(fields, control.target),
                  badge: fieldsSlotBadge(fields, control.target),
                },
              ] as const,
            ];
      }),
    ),
  };
}

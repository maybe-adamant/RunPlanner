import type {
  WorkspaceRoomFeature,
  WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';
import { offerIcon, shopItemIcon } from '@planner/ui/artwork/rewardIcon';
import { heldObjectIcon, heldObjectName } from '../room-features/roomObjectFace';
import { fieldsSlotBadge, fieldsSlotIcon } from '../room-layout/fieldsSlotFace';
import type { RoomMapOccupant, RoomMapPlacements, RoomMapShopItem } from './RoomMapPoints';

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

/** The Shop's stock by offer, each with its purchase and any Travel Deal refill on its point. */
function shopItems(room: WorkspaceRoomSummary): ReadonlyMap<string, RoomMapShopItem> {
  if (room.roomLocal.kind !== 'shop') return new Map();
  const refill = room.roomLocal.supplementalOffers.find(
    (offer) => offer.kind === 'travelDealRefill',
  );
  return new Map(
    room.roomLocal.offers.map((offer) => {
      const refillFace =
        refill?.sourceOfferKey === offer.key
          ? shopItemFace(refill.rewardControl, 'Travel Deal refill')
          : undefined;
      return [
        offer.key,
        {
          slotLabel: offer.label,
          purchased: offer.purchase.purchased,
          ...(shopItemFace(offer.rewardControl, offer.label) ?? {}),
          ...(refillFace === undefined ? {} : { refill: refillFace }),
        },
      ] as const;
    }),
  );
}

function contractPedestal(room: WorkspaceRoomSummary): RoomMapOccupant | undefined {
  const pedestal = room.workbench.features.find(
    (feature) => feature.kind === 'infernalContractPedestal',
  );
  if (pedestal?.kind !== 'infernalContractPedestal') return undefined;
  return (
    shopItemFace(pedestal.rewardControl, 'Contract pedestal') ?? { label: 'Contract pedestal' }
  );
}

/** The room's planned entry, anchor occupants, Fields slots and Shop stock, as its map shows them. */
export function roomMapPlacements(room: WorkspaceRoomSummary): Omit<RoomMapPlacements, 'preview'> {
  const layout = room.layout;
  const anchors = room.objectSlots?.anchors ?? [];
  const fields = room.roomLocal.kind === 'fields' ? room.roomLocal : undefined;
  const pedestal = contractPedestal(room);
  return {
    shopItems: shopItems(room),
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

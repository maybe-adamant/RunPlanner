import {
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';
import { NumberedSlot, NumberedSlots } from '@planner/ui/editor/rewards/NumberedSlots';
import { RewardControlEditor } from '@planner/ui/editor/rewards/RewardControlEditor';

/** The Shop's stock; purchases are timeline actions, and Travel Deal is authored under its purchase. */
export function ShopWorkbench({
  interactions,
  room,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly room: Extract<WorkspaceRoomSummary['roomLocal'], { readonly kind: 'shop' }>;
}) {
  if (!room.materialized) {
    return (
      <section aria-label="Shop inventory" className="shop-editor">
        <p className="fixed-room-state">Shop inventory appears when you select this room.</p>
      </section>
    );
  }
  return (
    <section aria-label="Shop inventory" className="shop-editor">
      <div className="shop-family-offer-list">
        <NumberedSlots label="Shop slots">
          {room.offers.map((offer, index) => (
            <NumberedSlot hint={`Slot ${index + 1}`} key={offer.key} number={index + 1}>
              <RewardControlEditor
                control={offer.rewardControl}
                idPrefix={`shop-${offer.rewardControl.marker.focusKey}`}
                interactions={interactions}
                ariaLabel={`${offer.label} Item`}
                label=""
                triggerSize="icon"
              />
            </NumberedSlot>
          ))}
        </NumberedSlots>
      </div>
    </section>
  );
}

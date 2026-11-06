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
        <h5 className="room-feature-category-heading">Shop inventory</h5>
        <div className="room-overview-panel">
          <p className="fixed-room-state">Shop inventory appears when you select this room.</p>
        </div>
      </section>
    );
  }
  return (
    <section aria-label="Shop inventory" className="shop-editor">
      <h5 className="room-feature-category-heading">Shop inventory</h5>
      <div className="room-overview-panel shop-family-offer-list">
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

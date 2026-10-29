import {
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';
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
        {room.offers.map((offer) => (
          <div className="shop-family-offer-row" key={offer.key}>
            <div className="shop-family-item-control">
              <RewardControlEditor
                control={offer.rewardControl}
                idPrefix={`shop-${offer.rewardControl.marker.focusKey}`}
                interactions={interactions}
                label={`${offer.label} Item`}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

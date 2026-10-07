import {
  requireWorkspaceInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { RewardControlEditor } from '@planner/ui/editor/rewards/RewardControlEditor';

/** Fixed Shop inventory; Travel Deal is authored on the timeline under its purchase. */
export function ShopWorkbench({
  interactions,
  room,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly room: Extract<WorkspaceRoomSummary['roomLocal'], { readonly kind: 'shop' }>;
}) {
  const executeIntent = useCommandIntent();
  const findingTarget = useFindingTarget();
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
            <label className="shop-family-participation">
              <input
                {...findingTarget(offer.purchase.address)}
                aria-label={`Purchased ${offer.label}`}
                checked={offer.participation.purchased}
                onChange={(event) =>
                  executeIntent(
                    requireWorkspaceInteraction(
                      interactions.shopPurchaseParticipations,
                      offer.participation.interactionKey,
                    ).intentFor(event.target.checked),
                  )
                }
                type="checkbox"
              />
              Purchased
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}

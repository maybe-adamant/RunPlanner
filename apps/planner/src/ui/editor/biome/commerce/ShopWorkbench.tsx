import {
  requireWorkspaceInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomActions,
  type WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { RewardControlEditor } from '@planner/ui/editor/rewards/RewardControlEditor';

export function ShopWorkbench({
  actions,
  interactions,
  room,
}: {
  readonly actions?: WorkspaceRoomActions;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly room: Extract<WorkspaceRoomSummary['roomLocal'], { readonly kind: 'shop' }>;
}) {
  const executeIntent = useCommandIntent();
  const actionInteraction =
    actions === undefined
      ? undefined
      : requireWorkspaceInteraction(interactions.roomActions, actions.interactionKey);
  const toggleSupplementalPurchase = (
    purchase: Extract<
      (typeof room.supplementalOffers)[number],
      { readonly purchase: unknown }
    >['purchase'],
  ): void => {
    const proposal = actions?.proposals.find(
      (candidate) =>
        candidate.structurallyAuthorable &&
        candidate.kind === (purchase.purchased ? 'remove' : 'insert') &&
        candidate.reference.kind === 'interactAcquisitionEntry' &&
        candidate.reference.siteKey === purchase.reference.siteKey &&
        candidate.reference.entryKey === purchase.reference.entryKey,
    );
    if (proposal?.structurallyAuthorable !== true || actionInteraction === undefined) return;
    executeIntent(actionInteraction.intentFor(proposal.key));
  };
  if (!room.materialized) {
    return (
      <section aria-label="Shop inventory and conditions" className="shop-editor">
        <div className="local-reward-heading">
          <h4>Shop inventory and conditions</h4>
        </div>
        <p className="fixed-room-state">Shop inventory appears when you select this room.</p>
      </section>
    );
  }
  return (
    <section aria-label="Shop inventory and conditions" className="shop-editor">
      <div className="local-reward-heading">
        <h4>Shop inventory and conditions</h4>
      </div>
      <div className="shop-family-offer-list">
        {room.offers.map((offer) => (
          <div className="shop-family-offer-row" key={offer.key}>
            <div className="shop-family-item-control">
              <RewardControlEditor
                control={offer.rewardControl}
                idPrefix={`shop-${offer.rewardControl.marker.focusKey}`}
                interactions={interactions}
                label={`${offer.label} Item`}
                showAcquisitionChildren={false}
              />
            </div>
            <label className="shop-family-participation">
              <input
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
        {room.supplementalOffers
          .filter(
            (offer) =>
              offer.kind !== 'echoDoubleShopReward' &&
              offer.kind !== 'echoDoubleShopPlaceholder' &&
              offer.kind !== 'echoDoubleShopInvalid',
          )
          .map((offer) =>
            offer.kind === 'travelDealPlaceholder' ? (
              <div className="shop-family-offer-placeholder" key={offer.key}>
                <strong>Travel Deal</strong>
                <span>{offer.explanation}</span>
              </div>
            ) : offer.kind === 'travelDealInvalid' ? (
              <div className="shop-family-offer-row shop-family-offer-invalid" key={offer.key}>
                <div>
                  <strong>Travel Deal</strong>
                  <span>{offer.explanation}</span>
                </div>
                <label className="shop-family-participation">
                  <input
                    aria-label="Purchased Travel Deal"
                    checked={offer.purchase.purchased}
                    onChange={() => toggleSupplementalPurchase(offer.purchase)}
                    type="checkbox"
                  />
                  Purchased
                </label>
              </div>
            ) : 'rewardControl' in offer ? (
              <div className="shop-family-offer-row" key={offer.key}>
                <div className="shop-family-item-control">
                  <RewardControlEditor
                    control={offer.rewardControl}
                    idPrefix={`shop-${offer.rewardControl.marker.focusKey}`}
                    interactions={interactions}
                    label="Travel Deal Item"
                    showAcquisitionChildren={false}
                  />
                </div>
                <label className="shop-family-participation">
                  <input
                    aria-label="Purchased Travel Deal"
                    checked={offer.purchase.purchased}
                    onChange={() => toggleSupplementalPurchase(offer.purchase)}
                    type="checkbox"
                  />
                  Purchased
                </label>
              </div>
            ) : null,
          )}
      </div>
    </section>
  );
}

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
  const supplementalLabel = (kind: (typeof room.supplementalOffers)[number]['kind']): string =>
    kind === 'infernalContractReward'
      ? 'Contract'
      : kind === 'travelDealPlaceholder' ||
          kind === 'travelDealInvalid' ||
          kind === 'travelDealRefill'
        ? 'Travel Deal'
        : 'Echo Gold';
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
        {room.supplementalOffers.map((offer) =>
          offer.kind === 'travelDealPlaceholder' || offer.kind === 'echoDoubleShopPlaceholder' ? (
            <div className="shop-family-offer-placeholder" key={offer.key}>
              <strong>{supplementalLabel(offer.kind)}</strong>
              <span>{offer.explanation}</span>
            </div>
          ) : offer.kind === 'travelDealInvalid' || offer.kind === 'echoDoubleShopInvalid' ? (
            <div className="shop-family-offer-row shop-family-offer-invalid" key={offer.key}>
              <div>
                <strong>{supplementalLabel(offer.kind)}</strong>
                <span>{offer.explanation}</span>
              </div>
              <label className="shop-family-participation">
                <input
                  aria-label={`Purchased ${supplementalLabel(offer.kind)}`}
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
                  label={`${supplementalLabel(offer.kind)} Item`}
                  showAcquisitionChildren={false}
                />
              </div>
              <label className="shop-family-participation">
                <input
                  aria-label={`Purchased ${supplementalLabel(offer.kind)}`}
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

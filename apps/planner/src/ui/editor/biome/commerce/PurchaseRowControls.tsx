import {
  requireWorkspaceInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomActionProposal,
  type WorkspaceRoomActionRow,
} from '@planner/projections/structured-workspace';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { RewardControlEditor } from '@planner/ui/editor/rewards/RewardControlEditor';
import { HermesShrineSlotEditor, StygianWellSlotEditor } from './RoomInventoryPanel';

/** Rush on one Shrine purchase action. */
export function HermesShrineRushControl({
  interactions,
  label,
  purchase,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly label: string;
  readonly purchase: NonNullable<WorkspaceRoomActionRow['hermesShrinePurchase']>;
}) {
  const executeIntent = useCommandIntent();
  const interaction = requireWorkspaceInteraction(
    interactions.hermesShrinePurchases,
    purchase.purchaseInteractionKey,
  );
  return (
    <label className="shop-family-participation">
      <input
        aria-label={`Rush ${label}`}
        checked={purchase.rushed}
        onChange={(event) => executeIntent(interaction.rushIntentFor(event.target.checked))}
        type="checkbox"
      />
      Rush
    </label>
  );
}

/** The Travel Deal refill authored under the purchase that triggers it. */
export function TravelDealLine({
  interactions,
  line,
  onApply,
  proposals,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly line: NonNullable<WorkspaceRoomActionRow['travelDealLine']>;
  readonly onApply: (proposalKey: string) => void;
  readonly proposals: readonly WorkspaceRoomActionProposal[];
}) {
  return (
    <div aria-label="Travel Deal" className="room-action-travel-deal" role="group">
      <TravelDealLineEditor
        interactions={interactions}
        line={line}
        onApply={onApply}
        proposals={proposals}
      />
    </div>
  );
}

function TravelDealLineEditor({
  interactions,
  line,
  onApply,
  proposals,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly line: NonNullable<WorkspaceRoomActionRow['travelDealLine']>;
  readonly onApply: (proposalKey: string) => void;
  readonly proposals: readonly WorkspaceRoomActionProposal[];
}) {
  switch (line.kind) {
    case 'hermesShrine':
      return (
        <HermesShrineSlotEditor
          label="Travel Deal"
          marker={line.refill.marker}
          {...(line.refill.rewardLabel === undefined
            ? {}
            : { rewardLabel: line.refill.rewardLabel })}
          offer={requireWorkspaceInteraction(
            interactions.hermesShrineOffers,
            line.refill.offerInteractionKey,
          )}
          purchase={requireWorkspaceInteraction(
            interactions.hermesShrinePurchases,
            line.refill.purchaseInteractionKey,
          )}
        />
      );
    case 'stygianWell':
      return <StygianWellSlotEditor interactions={interactions} slot={line.refill} />;
    case 'worldShop':
      return (
        <WorldShopTravelDealEditor
          interactions={interactions}
          offer={line.offer}
          onApply={onApply}
          proposals={proposals}
        />
      );
    default: {
      const unreachable: never = line;
      return unreachable;
    }
  }
}

function WorldShopTravelDealEditor({
  interactions,
  offer,
  onApply,
  proposals,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly offer: Extract<
    NonNullable<WorkspaceRoomActionRow['travelDealLine']>,
    { readonly kind: 'worldShop' }
  >['offer'];
  readonly onApply: (proposalKey: string) => void;
  readonly proposals: readonly WorkspaceRoomActionProposal[];
}) {
  const reference = offer.purchase.reference;
  const proposal = proposals.find(
    (candidate) =>
      candidate.structurallyAuthorable &&
      candidate.kind === (offer.purchase.purchased ? 'remove' : 'insert') &&
      candidate.reference.kind === 'interactAcquisitionEntry' &&
      candidate.reference.siteKey === reference.siteKey &&
      candidate.reference.entryKey === reference.entryKey,
  );
  return (
    <div className="shop-family-offer-row">
      <div className="shop-family-item-control">
        <RewardControlEditor
          control={offer.rewardControl}
          idPrefix={`shop-${offer.rewardControl.marker.focusKey}`}
          interactions={interactions}
          label="Travel Deal Item"
        />
      </div>
      <label className="shop-family-participation">
        <input
          aria-label="Purchased Travel Deal"
          checked={offer.purchase.purchased}
          disabled={proposal === undefined}
          {...(proposal === undefined ? { title: 'No position to purchase the refill.' } : {})}
          onChange={() => (proposal === undefined ? undefined : onApply(proposal.key))}
          type="checkbox"
        />
        Purchased
      </label>
    </div>
  );
}

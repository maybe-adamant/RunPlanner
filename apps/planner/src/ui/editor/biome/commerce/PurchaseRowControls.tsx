import type { ReactNode } from 'react';
import {
  requireWorkspaceInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomActionProposal,
  type WorkspaceRoomActionRow,
} from '@planner/projections/structured-workspace';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { RewardControlEditor } from '@planner/ui/editor/rewards/RewardControlEditor';
import { TimelineRow } from '../TimelineRow';
import {
  HermesShrinePurchasedControl,
  HermesShrineSlotEditor,
  StygianWellPurchasedControl,
  StygianWellSlotEditor,
} from './RoomInventoryPanel';

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
    <label className="timeline-checkbox">
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

/** The Travel Deal refill authored as the continuation of the purchase that triggers it. */
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
  const cells = travelDealLineCells(interactions, line, onApply, proposals);
  return (
    <TimelineRow
      aria-label="Travel Deal"
      editors={cells.editors}
      kind="continuation"
      label={<span className="timeline-continuation-label">Travel Deal</span>}
      placement={cells.purchased}
    />
  );
}

function travelDealLineCells(
  interactions: WorkspaceInteractionCatalog,
  line: NonNullable<WorkspaceRoomActionRow['travelDealLine']>,
  onApply: (proposalKey: string) => void,
  proposals: readonly WorkspaceRoomActionProposal[],
): { readonly editors: ReactNode; readonly purchased: ReactNode } {
  switch (line.kind) {
    case 'hermesShrine': {
      const offer = requireWorkspaceInteraction(
        interactions.hermesShrineOffers,
        line.refill.offerInteractionKey,
      );
      const purchase = requireWorkspaceInteraction(
        interactions.hermesShrinePurchases,
        line.refill.purchaseInteractionKey,
      );
      return {
        editors: (
          <HermesShrineSlotEditor
            label="Travel Deal"
            marker={line.refill.marker}
            {...(line.refill.rewardLabel === undefined
              ? {}
              : { rewardLabel: line.refill.rewardLabel })}
            offer={offer}
            purchase={purchase}
            withPurchased={false}
          />
        ),
        purchased: (
          <HermesShrinePurchasedControl
            className="timeline-checkbox"
            label="Travel Deal"
            offer={offer}
            purchase={purchase}
          />
        ),
      };
    }
    case 'stygianWell':
      return {
        editors: (
          <StygianWellSlotEditor
            interactions={interactions}
            slot={line.refill}
            withPurchased={false}
          />
        ),
        purchased: (
          <StygianWellPurchasedControl
            className="timeline-checkbox"
            interactions={interactions}
            slot={line.refill}
          />
        ),
      };
    case 'worldShop': {
      const offer = line.offer;
      const reference = offer.purchase.reference;
      const proposal = proposals.find(
        (candidate) =>
          candidate.structurallyAuthorable &&
          candidate.kind === (offer.purchase.purchased ? 'remove' : 'insert') &&
          candidate.reference.kind === 'interactAcquisitionEntry' &&
          candidate.reference.siteKey === reference.siteKey &&
          candidate.reference.entryKey === reference.entryKey,
      );
      return {
        editors: (
          <RewardControlEditor
            control={offer.rewardControl}
            idPrefix={`shop-${offer.rewardControl.marker.focusKey}`}
            interactions={interactions}
            label="Travel Deal Item"
          />
        ),
        purchased: (
          <label className="timeline-checkbox">
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
        ),
      };
    }
    default: {
      const unreachable: never = line;
      return unreachable;
    }
  }
}

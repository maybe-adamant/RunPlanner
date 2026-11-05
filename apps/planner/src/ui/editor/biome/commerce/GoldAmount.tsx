import type {
  WorkspaceGoldAmount,
  WorkspacePurchaseAffordability,
} from '@planner/projections/structured-workspace';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { hintProps } from '@planner/ui/controls/hint';
import { rewardArtwork } from '@planner/ui/artwork/rewards/rewardArtwork';

/** A gold amount with the game's gold icon. */
export function GoldAmount({
  amount,
  className,
}: {
  readonly amount: WorkspaceGoldAmount;
  readonly className?: string;
}) {
  return (
    <span className={className === undefined ? 'gold-amount' : `gold-amount ${className}`}>
      <ArtworkIcon
        className="artwork-label-icon-small"
        source={rewardArtwork.Currency ?? undefined}
      />
      <span className="gold-amount-value">{amount.label}</span>
      <span className="visually-hidden"> gold</span>
    </span>
  );
}

/** A purchase's price and the chance the gold held covers it, at the end of its row. */
export function PurchaseCost({
  affordability,
  price,
}: {
  readonly affordability?: WorkspacePurchaseAffordability;
  readonly price?: WorkspaceGoldAmount;
}) {
  if (affordability === undefined && price === undefined) return null;
  return (
    <span className="purchase-cost">
      {price === undefined ? null : <GoldAmount amount={price} className="purchase-cost-price" />}
      {affordability === undefined ? null : (
        <span
          className="purchase-affordability"
          data-tone={affordability.tone}
          {...hintProps(`${affordability.balanceBefore.label} gold before this purchase`)}
          tabIndex={0}
        >
          {affordability.label}
          <span className="visually-hidden"> chance to afford</span>
        </span>
      )}
    </span>
  );
}

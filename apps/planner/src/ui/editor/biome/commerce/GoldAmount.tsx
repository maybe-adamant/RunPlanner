import type {
  WorkspaceGoldAmount,
  WorkspacePurchaseAffordability,
} from '@planner/projections/structured-workspace';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
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

/**
 * The room's gold when its doors open, before its purchases, and what those
 * purchases cost, on its Doors open banner. Spent keeps its slot when absent so
 * Current stays in one column across rooms.
 */
export function RoomGoldSummary({
  current,
  spent,
}: {
  readonly current?: WorkspaceGoldAmount;
  readonly spent?: WorkspaceGoldAmount;
}) {
  if (current === undefined && spent === undefined) return null;
  return (
    <span className="room-gold-summary">
      {current === undefined ? null : (
        <span className="room-gold-figure">
          Current <GoldAmount amount={current} />
        </span>
      )}
      <span
        className="room-gold-figure"
        {...(spent === undefined ? { 'aria-hidden': true, 'data-placeholder': true } : {})}
      >
        {current === undefined ? null : <span aria-hidden="true">·</span>}
        Spent <GoldAmount amount={spent ?? { label: '' }} />
      </span>
    </span>
  );
}

/** The chance the gold held covers a purchase, at the end of its row. */
export function PurchaseAffordability({
  affordability,
}: {
  readonly affordability: WorkspacePurchaseAffordability;
}) {
  return (
    <span className="purchase-affordability" data-tone={affordability.tone}>
      {affordability.label}
      <span className="visually-hidden"> chance to afford</span>
    </span>
  );
}

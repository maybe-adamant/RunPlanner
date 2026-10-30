import type { WorkspaceGoldAmount } from '@planner/projections/structured-workspace';
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
      {amount.label}
      <span className="visually-hidden"> gold</span>
    </span>
  );
}

/** What the room's purchases cost together, on its Doors open banner. */
export function RoomGoldSummary({ spent }: { readonly spent: WorkspaceGoldAmount }) {
  return (
    <span className="room-gold-summary">
      Spent <GoldAmount amount={spent} />
    </span>
  );
}

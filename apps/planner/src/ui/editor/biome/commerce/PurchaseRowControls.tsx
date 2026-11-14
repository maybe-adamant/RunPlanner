import { traitIcon } from '@planner/ui/artwork/traitArtwork';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import type { ReactNode } from 'react';
import {
  requireWorkspaceInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomActionRow,
} from '@planner/projections/structured-workspace';
import { RewardControlEditor } from '@planner/ui/editor/rewards/RewardControlEditor';
import { RowChoice } from '../RowChoice';
import { TimelineRow } from '../TimelineRow';
import { HermesShrineSlotEditor, StygianWellSlotEditor } from './RoomInventoryPanel';

/**
 * The Travel Deal item authored as the continuation of the purchase that
 * triggers it; buying it is its own timeline action.
 */
export function TravelDealLine({
  interactions,
  line,
  rowKey,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly line: NonNullable<WorkspaceRoomActionRow['travelDealLine']>;
  /** The purchase or rush row that restocks. */
  readonly rowKey: string;
}) {
  return (
    <TimelineRow
      aria-label="Restock"
      hooked
      notice
      editors={
        <RowChoice choice="travelDealRefill" rowKey={rowKey}>
          {travelDealLineEditor(interactions, line)}
        </RowChoice>
      }
      data-travel-deal-line=""
      kind="continuation"
      label={
        <>
          <ArtworkIcon className="artwork-label-icon" source={traitIcon('RestockBoon')} />
          <strong>Restock</strong>
        </>
      }
    />
  );
}

function travelDealLineEditor(
  interactions: WorkspaceInteractionCatalog,
  line: NonNullable<WorkspaceRoomActionRow['travelDealLine']>,
): ReactNode {
  switch (line.kind) {
    case 'hermesShrine':
      return (
        <HermesShrineSlotEditor
          label="Travel Deal"
          marker={line.refill.marker}
          rewardType={line.refill.rewardType}
          {...(line.refill.rewardLabel === undefined
            ? {}
            : { rewardLabel: line.refill.rewardLabel })}
          offer={requireWorkspaceInteraction(
            interactions.hermesShrineOffers,
            line.refill.offerInteractionKey,
          )}
        />
      );
    case 'stygianWell':
      return <StygianWellSlotEditor fieldLabel="" interactions={interactions} slot={line.refill} />;
    case 'worldShop':
      return (
        <RewardControlEditor
          ariaLabel="Travel Deal Item"
          control={line.offer.rewardControl}
          idPrefix={`shop-${line.offer.rewardControl.marker.focusKey}`}
          interactions={interactions}
          label=""
          triggerSize="icon"
        />
      );
    default: {
      const unreachable: never = line;
      return unreachable;
    }
  }
}

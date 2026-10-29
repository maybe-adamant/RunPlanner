import type { ReactNode } from 'react';
import {
  requireWorkspaceInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomActionRow,
} from '@planner/projections/structured-workspace';
import { RewardControlEditor } from '@planner/ui/editor/rewards/RewardControlEditor';
import { TimelineRow } from '../TimelineRow';
import { HermesShrineSlotEditor, StygianWellSlotEditor } from './RoomInventoryPanel';

/**
 * The Travel Deal item authored as the continuation of the purchase that
 * triggers it; buying it is its own timeline action.
 */
export function TravelDealLine({
  interactions,
  line,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly line: NonNullable<WorkspaceRoomActionRow['travelDealLine']>;
}) {
  // The Well's line names Travel Deal on its item picker alone.
  const compact = line.kind === 'stygianWell';
  return (
    <TimelineRow
      aria-label="Travel Deal"
      {...(compact ? { className: 'travel-deal-line-compact' } : {})}
      editors={travelDealLineEditor(interactions, line)}
      kind="continuation"
      label={compact ? null : <span className="timeline-continuation-label">Travel Deal</span>}
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
      return <StygianWellSlotEditor interactions={interactions} slot={line.refill} />;
    case 'worldShop':
      return (
        <RewardControlEditor
          control={line.offer.rewardControl}
          idPrefix={`shop-${line.offer.rewardControl.marker.focusKey}`}
          interactions={interactions}
          label="Travel Deal Item"
        />
      );
    default: {
      const unreachable: never = line;
      return unreachable;
    }
  }
}

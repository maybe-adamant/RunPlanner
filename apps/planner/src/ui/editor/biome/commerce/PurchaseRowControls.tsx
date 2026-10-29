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
  return (
    <TimelineRow
      aria-label="Travel Deal"
      editors={travelDealLineEditor(interactions, line)}
      kind="continuation"
      label={<strong>Travel Deal</strong>}
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
          fieldLabel="Item"
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
      return (
        <StygianWellSlotEditor fieldLabel="Item" interactions={interactions} slot={line.refill} />
      );
    case 'worldShop':
      return (
        <RewardControlEditor
          ariaLabel="Travel Deal Item"
          control={line.offer.rewardControl}
          idPrefix={`shop-${line.offer.rewardControl.marker.focusKey}`}
          interactions={interactions}
          label="Item"
        />
      );
    default: {
      const unreachable: never = line;
      return unreachable;
    }
  }
}

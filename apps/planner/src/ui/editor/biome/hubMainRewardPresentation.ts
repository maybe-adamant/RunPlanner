import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceMarker,
  type WorkspaceRewardControl,
  type WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';

export interface HubMainRewardPresentation {
  readonly control?: WorkspaceRewardControl;
  readonly marker: WorkspaceMarker;
  readonly summary: string;
}

function rewardSummary(
  control: WorkspaceRewardControl,
  interactions: WorkspaceInteractionCatalog,
): string {
  if (control.offer === null) return 'Choose reward';
  return requireWorkspaceInteraction(
    interactions.rewards,
    workspaceInteractionKey(control.owner.address),
  ).summary(control.offer);
}

/**
 * The Hub board owns main-reward editing. Other Hub surfaces consume this
 * presentation-only product to show the same authored value and navigate back
 * to its existing semantic owner.
 */
export function hubMainRewardPresentation(
  room: WorkspaceRoomSummary | undefined,
  interactions: WorkspaceInteractionCatalog,
): HubMainRewardPresentation | undefined {
  if (room === undefined) return undefined;
  switch (room.roomLocal.kind) {
    case 'fixed': {
      const control = room.roomLocal.control;
      return Object.freeze({
        ...(control === undefined ? {} : { control }),
        marker: room.roomLocal.marker,
        summary:
          control === undefined ? room.roomLocal.summary : rewardSummary(control, interactions),
      });
    }
    case 'incomingReward':
      return Object.freeze({
        control: room.roomLocal.control,
        marker: room.roomLocal.control.marker,
        summary: rewardSummary(room.roomLocal.control, interactions),
      });
    case 'ephyra':
      return Object.freeze({
        control: room.roomLocal.incomingReward,
        marker: room.roomLocal.incomingReward.marker,
        summary: rewardSummary(room.roomLocal.incomingReward, interactions),
      });
    case 'none':
    case 'fields':
    case 'ship':
    case 'shop':
      return undefined;
  }
}

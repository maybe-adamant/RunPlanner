import type {
  WorkspaceInteractionCatalog,
  WorkspaceRoomActionRow,
} from '@planner/projections/structured-workspace';
import { RewardControlEditor } from '../rewards/RewardControlEditor';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';

/** Reward authoring on one action's pickup line: the offer picker when the row exposes it. */
export function RoomActionAcquisitionRow({
  hideOffer = false,
  row,
  interactions,
}: {
  readonly hideOffer?: boolean;
  readonly row: WorkspaceRoomActionRow;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const findingTarget = useFindingTarget();
  const payload = row.rewardPayload;
  if (payload === undefined) return null;
  const showOffer = payload.showOffer && !hideOffer;
  return (
    <div
      className="acquisition-entry-resolution"
      data-empty={!showOffer || undefined}
      {...(payload.control.owner.kind === 'acquisitionEntry' &&
      payload.control.offerEditVisibility === 'hidden'
        ? findingTarget(payload.control.owner.address)
        : {})}
      tabIndex={-1}
    >
      <RewardControlEditor
        control={payload.control}
        idPrefix={`room-action-${payload.control.marker.focusKey}`}
        interactions={interactions}
        showOffer={showOffer}
        {...(payload.control.offerEditStartStep === undefined
          ? {}
          : { offerStartStep: payload.control.offerEditStartStep })}
      />
    </div>
  );
}

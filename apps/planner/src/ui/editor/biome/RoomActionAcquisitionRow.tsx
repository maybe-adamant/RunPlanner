import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomActionRow,
} from '@planner/projections/structured-workspace';
import { SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { RewardControlEditor } from '../rewards/RewardControlEditor';

/** Acquisition, conversion, and Artificer-output presentation for one action. */
export function RoomActionAcquisitionRow({
  hideOffer = false,
  row,
  interactions,
}: {
  readonly hideOffer?: boolean;
  readonly row: WorkspaceRoomActionRow;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const payload = row.rewardPayload;
  if (payload === undefined) return null;
  const showOffer = payload.showOffer && !hideOffer;
  const visible =
    showOffer ||
    payload.control.realizedAcquisition !== undefined ||
    (payload.showOwner && payload.control.marker.findingCount > 0) ||
    (payload.control.conversions ?? []).some(
      (conversion) =>
        requireWorkspaceInteraction(
          interactions.acquisitionConversions,
          workspaceInteractionKey(conversion.address),
        ).visible,
    ) ||
    row.artificerOutput !== undefined;
  return (
    <div
      className="acquisition-entry-resolution"
      data-empty={!visible || undefined}
      {...(payload.showOwner
        ? { id: semanticOwnerControlElementId(payload.control.owner.address), tabIndex: -1 }
        : {})}
    >
      {payload.showOwner ? <SemanticOwnerMarker address={payload.control.marker.address} /> : null}
      <div className="room-action-outcome-controls">
        <RewardControlEditor
          control={payload.control}
          idPrefix={`room-action-${payload.control.marker.focusKey}`}
          interactions={interactions}
          showAcquisitionChildren
          showLevelResolutions={false}
          showOffer={showOffer}
          showTraitOffers={false}
          {...(payload.control.offerEditStartStep === undefined
            ? {}
            : { offerStartStep: payload.control.offerEditStartStep })}
        />
        {row.artificerOutput === undefined ? null : (
          <div
            className="room-action-artificer-output"
            id={semanticOwnerControlElementId(row.artificerOutput.control.owner.address)}
            tabIndex={-1}
          >
            <SemanticOwnerMarker address={row.artificerOutput.control.marker.address} />
            <RewardControlEditor
              control={row.artificerOutput.control}
              idPrefix={`room-action-artificer-${row.artificerOutput.control.marker.focusKey}`}
              interactions={interactions}
              label={row.artificerOutput.label}
              {...(row.artificerOutput.control.offerEditStartStep === undefined
                ? {}
                : { offerStartStep: row.artificerOutput.control.offerEditStartStep })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

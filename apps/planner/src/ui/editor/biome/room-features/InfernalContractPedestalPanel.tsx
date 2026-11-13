import {
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomFeature,
} from '@planner/projections/structured-workspace';
import { RewardControlEditor } from '@planner/ui/editor/rewards/RewardControlEditor';
import { traitIcon } from '@planner/ui/artwork/traitArtwork';
import { OverviewRow } from '../RoomOverviewSections';

type PedestalFeature = Extract<WorkspaceRoomFeature, { readonly kind: 'infernalContractPedestal' }>;

/** The Preboss Contract pedestal, granted by Champion of Elysium: its one free item. */
export function InfernalContractPedestalPanel({
  feature,
  interactions,
}: {
  readonly feature: PedestalFeature;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  return (
    <OverviewRow icon={traitIcon('InfernalContractBoon')} label="Pedestal">
      <div className="room-object-inventory">
        <RewardControlEditor
          ariaLabel="Pedestal Item"
          control={feature.rewardControl}
          idPrefix={`pedestal-${feature.rewardControl.marker.focusKey}`}
          interactions={interactions}
          label=""
          triggerSize="icon"
        />
      </div>
    </OverviewRow>
  );
}

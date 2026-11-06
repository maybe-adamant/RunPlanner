import {
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomFeature,
} from '@planner/projections/structured-workspace';
import { RewardControlEditor } from '@planner/ui/editor/rewards/RewardControlEditor';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { traitIcon } from '@planner/ui/artwork/traitArtwork';

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
    <fieldset className="room-contract-pedestal room-inventory-line">
      <legend className="visually-hidden">Pedestal configuration</legend>
      <div className="room-feature-presence-row">
        <ArtworkIcon className="artwork-label-icon" source={traitIcon('InfernalContractBoon')} />
        <span>Pedestal</span>
      </div>
      <RewardControlEditor
        ariaLabel="Pedestal Item"
        control={feature.rewardControl}
        idPrefix={`pedestal-${feature.rewardControl.marker.focusKey}`}
        interactions={interactions}
        label=""
        triggerSize="icon"
      />
    </fieldset>
  );
}

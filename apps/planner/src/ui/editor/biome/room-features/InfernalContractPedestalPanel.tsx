import {
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomFeature,
} from '@planner/projections/structured-workspace';
import { RewardControlEditor } from '@planner/ui/editor/rewards/RewardControlEditor';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { traitIcon } from '@planner/ui/artwork/traitArtwork';
import { hintProps } from '@planner/ui/controls/hint';

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
    <fieldset className="room-contract-pedestal room-inventory-line" data-open="">
      <legend className="visually-hidden">Pedestal configuration</legend>
      <span
        {...hintProps('Pedestal', undefined, 'Pedestal')}
        aria-label="Pedestal"
        className="room-object-fixed"
        role="img"
      >
        <ArtworkIcon className="artwork-label-icon" source={traitIcon('InfernalContractBoon')} />
      </span>
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

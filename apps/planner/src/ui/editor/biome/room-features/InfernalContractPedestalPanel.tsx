import {
  requireWorkspaceInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomFeature,
} from '@planner/projections/structured-workspace';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { traitIcon } from '@planner/ui/artwork/traitArtwork';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { RewardControlEditor } from '@planner/ui/editor/rewards/RewardControlEditor';

type PedestalFeature = Extract<WorkspaceRoomFeature, { readonly kind: 'infernalContractPedestal' }>;

/** The Preboss Contract pedestal: its one free item and whether it is collected. */
export function InfernalContractPedestalPanel({
  feature,
  interactions,
}: {
  readonly feature: PedestalFeature;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const executeIntent = useCommandIntent();
  const findingTarget = useFindingTarget();
  const collect = requireWorkspaceInteraction(
    interactions.infernalContractPedestalCollects,
    feature.collect.interactionKey,
  );
  return (
    <fieldset className="room-purging-pool">
      <legend className="visually-hidden">Contract Pedestal configuration</legend>
      <div className="room-feature-interaction-header">
        <span className="room-feature-presence-row">
          <ArtworkIcon className="artwork-label-icon" source={traitIcon('InfernalContractBoon')} />
          <span>Contract Pedestal</span>
        </span>
      </div>
      <div className="shop-family-offer-row">
        <div className="shop-family-item-control">
          <RewardControlEditor
            control={feature.rewardControl}
            idPrefix={`pedestal-${feature.rewardControl.marker.focusKey}`}
            interactions={interactions}
            label="Item"
          />
        </div>
        <label className="shop-family-participation">
          <input
            {...findingTarget(feature.collect.address)}
            aria-label="Collect Contract Pedestal item"
            checked={feature.collect.collected}
            disabled={!feature.collect.collected && feature.rewardControl.offer === null}
            onChange={(event) => executeIntent(collect.intentFor(event.target.checked))}
            type="checkbox"
          />
          Collect
        </label>
      </div>
    </fieldset>
  );
}

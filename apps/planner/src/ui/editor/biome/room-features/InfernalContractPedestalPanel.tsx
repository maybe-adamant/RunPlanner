import {
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomFeature,
} from '@planner/projections/structured-workspace';
import { RewardControlEditor } from '@planner/ui/editor/rewards/RewardControlEditor';

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
    <fieldset className="room-purging-pool">
      <legend className="visually-hidden">Champion Item configuration</legend>
      <div className="shop-family-offer-row">
        <div className="shop-family-item-control">
          <RewardControlEditor
            control={feature.rewardControl}
            idPrefix={`pedestal-${feature.rewardControl.marker.focusKey}`}
            interactions={interactions}
            label="Champion Item"
          />
        </div>
      </div>
    </fieldset>
  );
}

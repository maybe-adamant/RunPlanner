import {
  type WorkspaceDoorContract,
  type WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import { SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';
import { RewardControlEditor } from '../rewards/RewardControlEditor';

/** Exact base reward identity editor for one physical door contract. */
export function DoorRewardEditor({
  door,
  idPrefix,
  interactions,
}: {
  readonly door: WorkspaceDoorContract;
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  if (door.rewardPreview.kind === 'hidden') {
    return <p className="fixed-room-state">Reward hidden on this door.</p>;
  }
  if (door.rewardPreview.kind === 'none') return null;
  const showRewardLabels = door.rewardPreview.rewards.length > 1;
  return (
    <div aria-label={`${door.room.label} door rewards`} className="door-reward-list">
      {door.rewardPreview.rewards.map((reward) => (
        <section className="room-state-with-marker" key={reward.key}>
          <SemanticOwnerMarker address={reward.marker.address} />
          {reward.control === undefined ? (
            <div className="field-control field-control-inline door-fixed-reward">
              <span>{showRewardLabels ? reward.label : 'Reward'}</span>
              <span className="fixed-room-state">{reward.summary}</span>
            </div>
          ) : (
            <RewardControlEditor
              control={reward.control}
              idPrefix={`${idPrefix}-${reward.key}`}
              interactions={interactions}
              label={showRewardLabels ? reward.label : 'Reward'}
              showAcquisitionChildren={false}
            />
          )}
        </section>
      ))}
    </div>
  );
}

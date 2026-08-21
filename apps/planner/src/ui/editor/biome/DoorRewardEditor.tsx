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
  const rewards =
    door.rewardPreview.kind === 'visible'
      ? door.rewardPreview.rewards
      : door.rewardPreview.kind === 'hidden'
        ? door.rewardPreview.authoringRewards
        : [];
  if (door.rewardPreview.kind === 'hidden' && rewards.length === 0) {
    return <p className="fixed-room-state">Reward hidden on this door.</p>;
  }
  if (rewards.length === 0) return null;
  const showRewardLabels = rewards.length > 1;
  return (
    <div aria-label={`${door.room.label} door rewards`} className="door-reward-list">
      {rewards.map((reward) => (
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

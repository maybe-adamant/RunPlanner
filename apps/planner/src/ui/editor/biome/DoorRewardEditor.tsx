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
  return (
    <div aria-label={`${door.room.label} door rewards`} className="door-reward-list">
      {door.rewardPreview.rewards.map((reward) => (
        <section className="room-state-with-marker" key={reward.key}>
          <div className="owner-markers">
            <span>{reward.label}</span>
            <SemanticOwnerMarker address={reward.marker.address} />
          </div>
          {reward.control === undefined ? (
            <p className="fixed-room-state">{reward.summary}</p>
          ) : (
            <RewardControlEditor
              control={reward.control}
              idPrefix={`${idPrefix}-${reward.key}`}
              interactions={interactions}
              showAcquisitionChildren={false}
            />
          )}
        </section>
      ))}
    </div>
  );
}

import type { SemanticAddress } from '@run-planner/engine/authored-project';
import { semanticAddressKey } from '@run-planner/engine/authored-project';
import {
  type WorkspaceDoorContract,
  type WorkspaceDoorReward,
  type WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import { useAppSelector } from '@planner/state/store';
import { SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';
import { RewardControlEditor } from '../rewards/RewardControlEditor';
import { useEffect } from 'react';

/** Shared editor for any complete room-owned offer reward surface. */
export function RewardSurfaceEditor({
  ariaLabel,
  idPrefix,
  interactions,
  focusOwner,
  rewards,
  visibility,
}: {
  readonly ariaLabel: string;
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly focusOwner?: SemanticAddress;
  readonly rewards: readonly WorkspaceDoorReward[];
  readonly visibility: 'hidden' | 'visible';
}) {
  const focusedOwner = useAppSelector((state) => state.editorSession.focusedSemanticOwner);
  const editableRewards =
    visibility === 'hidden' ? rewards.filter((reward) => reward.control !== undefined) : rewards;
  const firstEditableReward = editableRewards.find((reward) => reward.control !== undefined);
  useEffect(() => {
    if (
      focusOwner === undefined ||
      focusedOwner === null ||
      semanticAddressKey(focusedOwner) !== semanticAddressKey(focusOwner)
    ) {
      return;
    }
    const target =
      firstEditableReward === undefined
        ? document.getElementById(`${idPrefix}-status`)
        : document.getElementById(`${idPrefix}-${firstEditableReward.key}-reward`);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }, [firstEditableReward, focusOwner, focusedOwner, idPrefix]);
  if (visibility === 'hidden' && editableRewards.length === 0) {
    return (
      <p className="fixed-room-state" id={`${idPrefix}-status`} tabIndex={-1}>
        Reward hidden on this door.
      </p>
    );
  }
  if (editableRewards.length === 0) {
    return (
      <p aria-live="polite" className="fixed-room-state" id={`${idPrefix}-status`} tabIndex={-1}>
        No reward
      </p>
    );
  }
  const showRewardLabels = editableRewards.length > 1;
  return (
    <div aria-label={ariaLabel} className="door-reward-list">
      {visibility === 'hidden' ? (
        <p className="fixed-room-state">Reward hidden on this door.</p>
      ) : null}
      {editableRewards.map((reward, index) => (
        <section className="room-state-with-marker" key={reward.key}>
          <SemanticOwnerMarker address={reward.marker.address} />
          {reward.control === undefined ? (
            <div
              aria-live={firstEditableReward === undefined && index === 0 ? 'polite' : undefined}
              className="field-control field-control-inline door-fixed-reward"
              id={
                firstEditableReward === undefined && index === 0 ? `${idPrefix}-status` : undefined
              }
              tabIndex={firstEditableReward === undefined && index === 0 ? -1 : undefined}
            >
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

/** Exact base reward identity editor for one physical door contract. */
export function DoorRewardEditor({
  door,
  focusOwner,
  idPrefix,
  interactions,
}: {
  readonly door: WorkspaceDoorContract;
  readonly focusOwner?: SemanticAddress;
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  return (
    <RewardSurfaceEditor
      ariaLabel={`${door.room.label} door rewards`}
      idPrefix={idPrefix}
      interactions={interactions}
      {...(focusOwner === undefined ? {} : { focusOwner })}
      rewards={door.offerRewardSurface.rewards}
      visibility={door.offerRewardSurface.visibility}
    />
  );
}

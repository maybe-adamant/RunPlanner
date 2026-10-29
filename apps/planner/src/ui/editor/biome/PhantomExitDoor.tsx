import { useState } from 'react';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import {
  requireWorkspaceInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspacePhantomExitControl,
} from '@planner/projections/structured-workspace';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { hintProps } from '@planner/ui/controls/hint';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';
import { useFindingMark, useFindingTarget } from '@planner/ui/feedback/useFindingTarget';

const emptyModel: ContextualPickerModel<string> = Object.freeze({
  sections: Object.freeze([]),
});

const rewardFinding = (finding: { readonly code: string }) =>
  finding.code === 'phantomExitRewardUnavailable';

/**
 * The hidden door a room fills when its doors first unlock. It stays one
 * automatic line until the planner chooses to pin its room or reward.
 */
export function PhantomExitDoor({
  control,
  idPrefix,
  interactions,
}: {
  readonly control: WorkspacePhantomExitControl;
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const findingTarget = useFindingTarget();
  const findingMark = useFindingMark();
  const executeIntent = useCommandIntent();
  const interaction = requireWorkspaceInteraction(
    interactions.phantomExits,
    control.interactionKey,
  );
  const rooms = useWorkspaceInteraction(interaction.rooms);
  const rewards = useWorkspaceInteraction(interaction.rewards);
  const [choosing, setChoosing] = useState(false);
  const expanded = choosing || control.pinned || findingMark(control.address)['data-has-findings'];
  const roomId = `${idPrefix}-hidden-door-room`;
  const rewardId = `${idPrefix}-hidden-door-reward`;
  const rewardLocked = control.reward.locked;
  const title = <h4 className="hidden-door-title">Hidden return door</h4>;
  return (
    <article aria-label="Hidden return door" className="hidden-door">
      {expanded ? (
        <>
          <div className="hidden-door-line">
            {title}
            {control.pinned ? (
              <button
                className="quiet-action action-compact"
                onClick={() => {
                  setChoosing(false);
                  executeIntent(interaction.resetIntent());
                }}
                type="button"
              >
                Reset to automatic
              </button>
            ) : (
              <button
                className="quiet-action action-compact"
                onClick={() => setChoosing(false)}
                type="button"
              >
                Cancel
              </button>
            )}
          </div>
          <div className="door-reward-list">
            <ContextualPicker<string>
              findingTarget={findingTarget(
                control.address,
                roomId,
                control.address,
                (finding) => !rewardFinding(finding),
              )}
              id={roomId}
              label="Room"
              layout="inline"
              {...(control.room.locked === 'unreached'
                ? { disabledHint: candidateWaitingHint }
                : {})}
              loading={rooms.pending}
              model={rooms.result ?? emptyModel}
              onOpenChange={(open) => {
                if (open) rooms.activate();
              }}
              onSelect={(value) => executeIntent(interaction.roomIntent(value))}
              placeholder={control.room.summary}
              triggerLabel={control.room.summary}
            />
            <ContextualPicker<string>
              findingTarget={findingTarget(
                control.address,
                rewardId,
                control.address,
                rewardFinding,
              )}
              id={rewardId}
              label="Reward"
              layout="inline"
              {...(rewardLocked === 'unreached'
                ? { disabledHint: candidateWaitingHint }
                : rewardLocked === 'autoRoom'
                  ? { disabledHint: 'Choose the room first.' }
                  : rewardLocked === 'noDraw'
                    ? { locked: true }
                    : {})}
              loading={rewards.pending}
              model={rewards.result ?? emptyModel}
              onOpenChange={(open) => {
                if (open) rewards.activate();
              }}
              onSelect={(value) => executeIntent(interaction.rewardIntent(value))}
              placeholder={control.reward.summary}
              triggerLabel={control.reward.summary}
            />
          </div>
        </>
      ) : (
        <div className="hidden-door-line">
          {title}
          {control.summary === undefined ? null : (
            <span className="hidden-door-summary">{control.summary}</span>
          )}
          <span className="hidden-door-state">Automatic</span>
          <button
            className="quiet-action action-compact"
            disabled={control.room.locked === 'unreached'}
            onClick={() => setChoosing(true)}
            {...hintProps(control.room.locked === 'unreached' ? candidateWaitingHint : undefined)}
            type="button"
          >
            Choose
          </button>
        </div>
      )}
    </article>
  );
}

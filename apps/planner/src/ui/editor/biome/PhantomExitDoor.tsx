import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import {
  requireWorkspaceInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspacePhantomExitControl,
} from '@planner/projections/structured-workspace';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';

const emptyModel: ContextualPickerModel<string | null> = Object.freeze({
  sections: Object.freeze([]),
});

const rewardFinding = (finding: { readonly code: string }) =>
  finding.code === 'phantomExitRewardUnavailable';

/** The hidden door a room fills when its doors first unlock: its room and reward. */
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
  const executeIntent = useCommandIntent();
  const interaction = requireWorkspaceInteraction(
    interactions.phantomExits,
    control.interactionKey,
  );
  const rooms = useWorkspaceInteraction(interaction.rooms);
  const rewards = useWorkspaceInteraction(interaction.rewards);
  const roomId = `${idPrefix}-hidden-door-room`;
  const rewardId = `${idPrefix}-hidden-door-reward`;
  const rewardLocked = control.reward.locked;
  return (
    <section aria-label="Outgoing doors" className="decision-card outgoing-occurrence-state">
      <header className="decision-heading">
        <div>
          <p className="card-kicker">Outgoing doors</p>
          <h3>Hidden return door</h3>
        </div>
      </header>
      <div className="exit-list">
        <article aria-label="Hidden return door" className="exit-row">
          <div className="exit-marker" aria-hidden="true" />
          <div className="exit-content">
            <div className="door-reward-list">
              <ContextualPicker<string | null>
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
              <ContextualPicker<string | null>
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
          </div>
        </article>
      </div>
    </section>
  );
}

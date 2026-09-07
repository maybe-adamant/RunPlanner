import {
  type WorkspaceCompletedHubHandoffInteraction,
  type WorkspaceHubDecisionNode,
} from '@planner/projections/structured-workspace';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { useAppDispatch } from '@planner/state/store';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';

export function HubCompletionHandoff({
  interaction,
  node,
}: {
  readonly interaction: WorkspaceCompletedHubHandoffInteraction | undefined;
  readonly node: WorkspaceHubDecisionNode;
}) {
  const findingTarget = useFindingTarget();
  const executeIntent = useCommandIntent();
  const dispatch = useAppDispatch();
  const exit = node.completedExit;
  const available = exit.kind === 'ready';
  if (available && interaction === undefined)
    throw new Error('The ready completed-Hub exit must expose its handoff interaction.');
  return (
    <article
      {...(exit.kind === 'locked' ? findingTarget(exit.marker.address) : {})}
      tabIndex={exit.kind === 'locked' ? -1 : undefined}
      aria-label={`${node.completedExit.targetLabel} room offer`}
      className="exit-row hub-exit-door"
      data-available={exit.kind !== 'locked'}
      data-hub-exit-state={exit.kind}
      data-hub-exit-door="true"
    >
      <div className="exit-marker" aria-hidden="true" />
      <div className="exit-content">
        <div className="exit-heading">
          <div>
            <h4>{node.completedExit.targetLabel}</h4>
          </div>
          <span className="neutral-status">
            {exit.kind === 'opened' ? 'Opened' : available ? 'Ready' : 'Locked'}
          </span>
        </div>
        {exit.kind === 'ready' ? (
          <p className="fixed-room-state">All required Hub visits are complete.</p>
        ) : exit.kind === 'opened' ? (
          <p className="fixed-room-state">This door leads to the authored Preboss room.</p>
        ) : (
          <p className="fixed-room-state">Complete the required Hub visits to unlock this door.</p>
        )}
        <button
          {...(exit.kind === 'locked' ? {} : findingTarget(exit.marker.address))}
          className="primary-action"
          disabled={exit.kind === 'locked'}
          onClick={() => {
            if (exit.kind === 'ready') {
              if (interaction === undefined)
                throw new Error(
                  'The ready completed-Hub exit must expose its handoff interaction.',
                );
              executeIntent(interaction.intent());
            }
            if (exit.kind === 'opened') dispatch(semanticOwnerFocused(exit.target.marker.address));
          }}
          type="button"
        >
          Open next room
        </button>
      </div>
    </article>
  );
}

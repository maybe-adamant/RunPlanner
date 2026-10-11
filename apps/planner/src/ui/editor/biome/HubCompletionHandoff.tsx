import { type WorkspaceHubDecisionNode } from '@planner/projections/structured-workspace';
import { useAuthoringLocked } from '@planner/ui/feedback/useFindingTarget';
import { SelectedContinuationAction } from './DecisionWorkbench';

/** The Hub's completed exit: its fixed Preboss room, reached once the Hub is complete. */
export function HubCompletionHandoff({ node }: { readonly node: WorkspaceHubDecisionNode }) {
  const target = node.completedExit.target;
  const locked = useAuthoringLocked(target.marker.address);
  return (
    <section className="decision-card">
      <header className="decision-heading">
        <div>
          <p className="card-kicker">Outgoing doors</p>
          <h3>Door offer</h3>
        </div>
      </header>
      <div className="exit-list">
        <article
          aria-label={`${target.label} room`}
          className="exit-row hub-exit-door"
          data-available={!locked}
        >
          <div className="exit-marker" aria-hidden="true" />
          <div className="exit-content">
            <div className="exit-heading">
              <div>
                <p className="card-kicker">Door 1</p>
                <h4>{target.label}</h4>
              </div>
            </div>
          </div>
        </article>
      </div>
      <div className="workbench-action-row">
        <SelectedContinuationAction
          continuation={locked ? undefined : target}
          disabledHint="Complete the Hub to continue."
        />
      </div>
    </section>
  );
}

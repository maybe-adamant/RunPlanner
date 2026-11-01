import { type WorkspaceHubDecisionNode } from '@planner/projections/structured-workspace';
import { useAuthoringLocked } from '@planner/ui/feedback/useFindingTarget';
import { DoorRowsHeader, FixedExitRow, SelectedContinuationAction } from './DecisionWorkbench';

/** The Hub's completed exit: its fixed Preboss room, reached once the Hub is complete. */
export function HubCompletionHandoff({ node }: { readonly node: WorkspaceHubDecisionNode }) {
  const target = node.completedExit.target;
  const locked = useAuthoringLocked(target.marker.address);
  return (
    <section aria-label="Hub exit" className="door-workbench">
      <div className="door-rows">
        <DoorRowsHeader />
        <FixedExitRow
          available={!locked}
          gameName={target.gameName}
          hostId={target.marker.focusKey}
          label={target.label}
        />
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

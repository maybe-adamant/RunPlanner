import { semanticAddressKey } from '@run-planner/engine/authored-project';
import { type Catalog } from '@run-planner/engine/catalog-schema';
import { type AssessmentIssue } from '@run-planner/engine/simulation';

import {
  findingDestinationLabel,
  nextRepairSelection,
  presentAssessmentIssue,
  type StatusPresentation,
} from '@planner/projections/evaluationProjection';
import {
  findingRepairTarget,
  type WorkspaceInspectorDestination,
  type WorkspaceRoute,
} from '@planner/projections/structured-workspace';
import { findingSelected } from '@planner/state/editorSessionSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';
import { hintProps } from '@planner/ui/controls/hint';

export function StatusBadge({ status }: { readonly status: StatusPresentation }) {
  return (
    <span className="status-badge" data-tone={status.tone}>
      {status.label}
    </span>
  );
}

function navigationStatusSymbol(tone: StatusPresentation['tone']): string {
  switch (tone) {
    case 'valid':
      return '✓';
    case 'incomplete':
      return '…';
    case 'invalid':
      return '!';
    case 'blocked':
      return '–';
    case 'empty':
      return '○';
  }
}

export function NavigationStatusMarker({ status }: { readonly status: StatusPresentation }) {
  return (
    <span
      aria-hidden="true"
      className="navigation-status-marker"
      data-tone={status.tone}
      {...hintProps(status.label)}
    >
      {navigationStatusSymbol(status.tone)}
    </span>
  );
}

export function FindingCount({ count, label }: { readonly count: number; readonly label: string }) {
  return count === 0 ? null : (
    <span
      aria-label={`${count} ${label}`}
      className="findings-count"
      {...hintProps(`${count} ${label}`, undefined, `${count} ${label}`)}
    >
      {count}
    </span>
  );
}

export function ProjectFindings({
  catalog,
  issue,
  focusByOwner,
  route,
}: {
  readonly catalog: Catalog;
  readonly issue: AssessmentIssue | undefined;
  readonly focusByOwner: ReadonlyMap<string, WorkspaceInspectorDestination>;
  readonly route?: WorkspaceRoute;
}) {
  const dispatch = useAppDispatch();
  const selectedFinding = useAppSelector((state) => state.editorSession.selectedFinding);
  const selectedKey = selectedFinding === null ? null : selectedFinding.key;
  // A running draft holds the workspace on the Draft panel.
  const drafting = useAppSelector((state) => state.draftSession.run.kind === 'running');

  if (issue === undefined) return null;

  const destination = focusByOwner.get(semanticAddressKey(issue.owner));
  const destinationLabel = findingDestinationLabel(
    catalog,
    destination?.focusAddress ?? issue.owner,
    destination,
    route,
  );
  // Navigates to the blocking owner's launcher; it never opens a dialog.
  const navigate = () => dispatch(findingSelected(nextRepairSelection(issue, focusByOwner)));
  const copy = presentAssessmentIssue(
    issue,
    (finding) => findingRepairTarget(finding, focusByOwner) ?? semanticAddressKey(finding.origin),
  );

  return (
    <section className="project-findings" aria-labelledby="project-findings-title">
      <h2 className="visually-hidden" id="project-findings-title">
        Next repair
      </h2>
      <button
        aria-current={selectedKey === issue.regionKey ? 'true' : undefined}
        className="assessment-issue-button"
        data-selected={selectedKey === issue.regionKey}
        disabled={drafting}
        onClick={navigate}
        type="button"
      >
        <span className="assessment-issue-summary">
          <span className="finding-title">{copy.title}</span>
          <span className="finding-destination">{destinationLabel}</span>
        </span>
        {copy.description !== undefined && (
          <span className="finding-description">{copy.description}</span>
        )}
      </button>
    </section>
  );
}

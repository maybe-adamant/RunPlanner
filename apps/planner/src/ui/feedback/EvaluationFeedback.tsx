import { semanticAddressKey } from '@run-planner/engine/authored-project';
import { type Catalog } from '@run-planner/engine/catalog-schema';
import { type AssessmentIssue } from '@run-planner/engine/simulation';

import {
  type BiomeFeedbackPresentation,
  findingDestinationLabel,
  nextRepairSelection,
  presentAssessmentIssue,
  presentBlockedView,
  type StatusPresentation,
} from '@planner/projections/evaluationProjection';
import type {
  WorkspaceInspectorDestination,
  WorkspaceRoute,
} from '@planner/projections/structured-workspace';
import { findingSelected } from '@planner/state/editorSessionSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';

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
      title={status.label}
    >
      {navigationStatusSymbol(status.tone)}
    </span>
  );
}

export function FindingCount({ count, label }: { readonly count: number; readonly label: string }) {
  return count === 0 ? null : (
    <span aria-label={`${count} ${label}`} className="findings-count" title={`${count} ${label}`}>
      {count}
    </span>
  );
}

export function ProjectFindings({
  catalog,
  issue,
  focusByOwner,
  route,
  blockedView,
}: {
  readonly catalog: Catalog;
  readonly issue: AssessmentIssue | undefined;
  readonly focusByOwner: ReadonlyMap<string, WorkspaceInspectorDestination>;
  readonly route?: WorkspaceRoute;
  /** Feedback of the displayed biome; a blocked or unevaluated view leads the panel. */
  readonly blockedView?: BiomeFeedbackPresentation | undefined;
}) {
  const dispatch = useAppDispatch();
  const selectedFinding = useAppSelector((state) => state.editorSession.selectedFinding);
  const selectedKey = selectedFinding === null ? null : selectedFinding.key;

  const destination =
    issue === undefined ? undefined : focusByOwner.get(semanticAddressKey(issue.owner));
  const destinationLabel =
    issue === undefined
      ? undefined
      : findingDestinationLabel(
          catalog,
          destination?.focusAddress ?? issue.owner,
          destination,
          route,
        );
  const blocked =
    blockedView === undefined
      ? undefined
      : presentBlockedView(catalog, blockedView, destinationLabel);

  if (issue === undefined && blocked === undefined) return null;

  // Both entries navigate to the blocking owner's launcher; neither opens a dialog.
  const navigate =
    issue === undefined
      ? undefined
      : () => dispatch(findingSelected(nextRepairSelection(issue, focusByOwner)));
  const copy = issue === undefined ? undefined : presentAssessmentIssue(issue);

  return (
    <section className="project-findings" aria-labelledby="project-findings-title">
      <h2 className="visually-hidden" id="project-findings-title">
        Next repair
      </h2>
      {blocked === undefined ? null : (
        <button
          className="assessment-issue-button"
          data-feedback-context={blockedView?.context}
          disabled={navigate === undefined}
          onClick={navigate}
          type="button"
        >
          <span className="assessment-issue-summary">
            <span className="finding-title">{blocked.title}</span>
          </span>
          {blocked.description !== undefined && (
            <span className="finding-description">{blocked.description}</span>
          )}
        </button>
      )}
      {issue === undefined || copy === undefined ? null : (
        <button
          aria-current={selectedKey === issue.regionKey ? 'true' : undefined}
          className="assessment-issue-button"
          data-selected={selectedKey === issue.regionKey}
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
      )}
    </section>
  );
}

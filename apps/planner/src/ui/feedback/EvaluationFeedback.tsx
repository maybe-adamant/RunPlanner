import { semanticAddressKey } from '@run-planner/engine/authored-project';
import { type Catalog } from '@run-planner/engine/catalog-schema';
import { type AssessmentIssue } from '@run-planner/engine/simulation';

import {
  findingDestinationLabel,
  presentAssessmentIssue,
  type StatusPresentation,
} from '@planner/projections/evaluationProjection';
import type { WorkspaceInspectorDestination } from '@planner/projections/structured-workspace';
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
}: {
  readonly catalog: Catalog;
  readonly issue: AssessmentIssue | undefined;
  readonly focusByOwner: ReadonlyMap<string, WorkspaceInspectorDestination>;
}) {
  const dispatch = useAppDispatch();
  const selectedFinding = useAppSelector((state) => state.editorSession.selectedFinding);
  const selectedKey = selectedFinding === null ? null : selectedFinding.key;

  if (issue === undefined) return null;

  const copy = presentAssessmentIssue(issue);
  const destination = focusByOwner.get(semanticAddressKey(issue.owner));

  return (
    <section className="project-findings" aria-labelledby="project-findings-title">
      <h2 className="visually-hidden" id="project-findings-title">
        Next repair
      </h2>
      <button
        aria-current={selectedKey === issue.regionKey ? 'true' : undefined}
        className="assessment-issue-button"
        data-selected={selectedKey === issue.regionKey}
        onClick={() =>
          dispatch(
            findingSelected({
              focusAddress: destination?.focusAddress ?? issue.owner,
              key: issue.regionKey,
              origin: issue.owner,
              // Banner selection reaches an existing visible launcher. Dialogs
              // remain explicit local editing actions, including for trait offers.
              traitDialogTarget: null,
              levelResolutionDialogTarget: null,
            }),
          )
        }
        type="button"
      >
        <span className="assessment-issue-summary">
          <span className="finding-title">{copy.title}</span>
          <span className="finding-destination">
            {findingDestinationLabel(catalog, destination?.focusAddress ?? issue.owner)}
          </span>
        </span>
        {copy.description !== undefined && (
          <span className="finding-description">{copy.description}</span>
        )}
      </button>
    </section>
  );
}

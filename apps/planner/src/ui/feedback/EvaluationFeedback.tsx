import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { roomKindIcon } from '@planner/ui/editor/biome/roomIcon';
import { semanticAddressKey } from '@run-planner/engine/authored-project';
import { type Catalog } from '@run-planner/engine/catalog-schema';
import { type AssessmentIssue } from '@run-planner/engine/simulation';

import {
  catalogFindingLabels,
  findingDestination,
  nextRepairSelection,
  presentAssessmentIssue,
  type FindingLabels,
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

// Clean shows ✓; a finding or anything pending shows !; other states show nothing.
function navigationStatusSymbol(tone: StatusPresentation['tone']): string | undefined {
  switch (tone) {
    case 'valid':
      return '✓';
    case 'incomplete':
    case 'invalid':
      return '!';
    case 'blocked':
    case 'empty':
      return undefined;
  }
}

export function NavigationStatusMarker({ status }: { readonly status: StatusPresentation }) {
  const symbol = navigationStatusSymbol(status.tone);
  return symbol === undefined ? null : (
    <span
      aria-hidden="true"
      className="navigation-status-marker"
      data-tone={status.tone}
      {...hintProps(status.label)}
    >
      {symbol}
    </span>
  );
}

export function FindingCount({ count, label }: { readonly count: number; readonly label: string }) {
  return count === 0 ? null : (
    <span aria-label={`${count} ${label}`} className="findings-count">
      {count}
    </span>
  );
}

export function ProjectFindings({
  catalog,
  issue,
  focusByOwner,
  route,
  labels,
  otherFindings = 0,
}: {
  readonly catalog: Catalog;
  readonly issue: AssessmentIssue | undefined;
  /** Names in finding titles; the catalog's alone where absent. */
  readonly labels?: FindingLabels;
  readonly focusByOwner: ReadonlyMap<string, WorkspaceInspectorDestination>;
  readonly route?: WorkspaceRoute;
  /** The plan's findings beyond those of the repair shown, counted on the pill. */
  readonly otherFindings?: number;
}) {
  const dispatch = useAppDispatch();
  const selectedFinding = useAppSelector((state) => state.editorSession.selectedFinding);
  const selectedKey = selectedFinding === null ? null : selectedFinding.key;
  // A running draft holds the workspace on the Draft panel.
  const drafting = useAppSelector((state) => state.draftSession.run.kind === 'running');

  // A plan without issues shows nothing; the heading keeps its place.
  if (issue === undefined) return null;

  const destination = focusByOwner.get(semanticAddressKey(issue.owner));
  const place = findingDestination(
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
    labels ?? catalogFindingLabels(catalog),
  );

  const text = `${copy.title} · ${place.label}`;
  // The pill is one line; its description, where one adds a rule or repair, is on hover.
  const hint = copy.description === undefined ? text : `${text} — ${copy.description}`;
  return (
    <section
      aria-labelledby="project-findings-title"
      className="project-findings finding-pill-group"
    >
      <h2 className="visually-hidden" id="project-findings-title">
        Next repair
      </h2>
      <button
        aria-current={selectedKey === issue.regionKey ? 'true' : undefined}
        className="assessment-issue-button finding-pill"
        data-selected={selectedKey === issue.regionKey}
        data-status="issue"
        // Coloured by the repair it shows: red when it breaks a rule, amber when it awaits a choice.
        data-tone={issue.kind}
        disabled={drafting}
        onClick={navigate}
        type="button"
        {...hintProps(hint, undefined, text)}
      >
        <span aria-hidden="true" className="finding-pill-mark">
          !
        </span>
        <span className="finding-pill-text">
          <span className="finding-title">{copy.title}</span>
          {' · '}
          <span className="finding-destination">
            {place.place}
            {place.room === undefined ? null : (
              <>
                {' · '}
                <span className="finding-room">
                  <ArtworkIcon
                    className="finding-room-icon"
                    source={roomKindIcon(place.room.icon)}
                  />
                  {place.room.number === undefined ? null : (
                    <span className="finding-room-number">{place.room.number}</span>
                  )}
                </span>
              </>
            )}
          </span>
        </span>
      </button>
      {otherFindings > 0 ? <span className="finding-pill-more">+{otherFindings}</span> : null}
    </section>
  );
}

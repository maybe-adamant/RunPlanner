import { semanticAddressKey } from '@run-planner/engine/authored-project';
import { type Catalog } from '@run-planner/engine/catalog-schema';
import { type SemanticFinding } from '@run-planner/engine/simulation';

import {
  findingDestinationLabel,
  presentFinding,
  semanticFindingKey,
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
  emptyMessage,
  findings,
  focusByOwner,
}: {
  readonly catalog: Catalog;
  readonly emptyMessage: string;
  readonly findings: readonly SemanticFinding[];
  readonly focusByOwner: ReadonlyMap<string, WorkspaceInspectorDestination>;
}) {
  const dispatch = useAppDispatch();
  const selectedFinding = useAppSelector((state) => state.editorSession.selectedFinding);
  const selectedKey = selectedFinding === null ? null : selectedFinding.key;

  return (
    <section
      className="project-findings"
      data-findings-present={findings.length > 0 || undefined}
      aria-labelledby="project-findings-title"
    >
      <header className="project-findings-heading">
        <h2 id="project-findings-title">Findings</h2>
        <span className="findings-count">{findings.length}</span>
      </header>
      {findings.length === 0 ? (
        <p className="findings-empty">{emptyMessage}</p>
      ) : (
        <ol className="findings-list">
          {findings.map((finding, index) => {
            const copy = presentFinding(finding);
            const key = semanticFindingKey(finding);
            const destination = focusByOwner.get(semanticAddressKey(finding.origin));
            return (
              <li key={`${key}-${index}`}>
                <button
                  aria-current={selectedKey === key ? 'true' : undefined}
                  className="findings-list-entry"
                  data-selected={selectedKey === key}
                  onClick={() =>
                    dispatch(
                      findingSelected({
                        focusAddress: destination?.focusAddress ?? finding.origin,
                        key,
                        origin: finding.origin,
                        traitDialogTarget: destination?.traitDialogTarget ?? null,
                        levelResolutionDialogTarget:
                          destination?.levelResolutionDialogTarget ?? null,
                      }),
                    )
                  }
                  type="button"
                >
                  <span className="finding-title">{copy.title}</span>
                  <span className="finding-destination">
                    {findingDestinationLabel(catalog, destination?.focusAddress ?? finding.origin)}
                  </span>
                  <span className="finding-description">{copy.description}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

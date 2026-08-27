import { semanticAddressKey, type SemanticAddress } from '@run-planner/engine/authored-project';
import { type Catalog } from '@run-planner/engine/catalog-schema';
import { type SemanticFinding } from '@run-planner/engine/simulation';
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';

import {
  findingDestinationLabel,
  indexFindingsByOwner,
  presentFinding,
  semanticFindingKey,
  type StatusPresentation,
} from '@planner/projections/evaluationProjection';
import type { WorkspaceInspectorDestination } from '@planner/projections/structured-workspace';
import { findingSelected } from '@planner/state/editorSessionSlice';
import { selectProjectFindingsByOwner, useAppDispatch, useAppSelector } from '@planner/state/store';
import { semanticOwnerElementId } from './semanticOwner';

const scopedFindings = createContext<ReturnType<typeof indexFindingsByOwner> | undefined>(
  undefined,
);

export function SemanticFindingsScope({
  children,
  findings,
}: {
  readonly children: ReactNode;
  readonly findings: readonly SemanticFinding[];
}) {
  const index = useMemo(() => indexFindingsByOwner(findings), [findings]);
  return <scopedFindings.Provider value={index}>{children}</scopedFindings.Provider>;
}

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

export function SemanticOwnerMarker({ address }: { readonly address: SemanticAddress }) {
  const ownerKey = semanticAddressKey(address);
  const elementId = semanticOwnerElementId(address);
  const localFindings = useContext(scopedFindings);
  const projectFindings = useAppSelector(selectProjectFindingsByOwner);
  const findings = (localFindings ?? projectFindings).get(ownerKey) ?? [];
  const selectedFinding = useAppSelector((state) => state.editorSession.selectedFinding);
  const navigationRevision = useAppSelector(
    (state) => state.editorSession.semanticNavigationRevision,
  );
  const selectedKey = selectedFinding === null ? null : selectedFinding.key;
  const selectedAtOwner =
    selectedFinding !== null &&
    semanticAddressKey(selectedFinding.origin) === ownerKey &&
    findings.some((finding) => semanticFindingKey(finding) === selectedFinding.key);
  const marker = useRef<HTMLSpanElement>(null);
  const firstFinding = findings[0];
  const firstFindingCopy = firstFinding === undefined ? undefined : presentFinding(firstFinding);
  const focusedDetail =
    firstFindingCopy === undefined
      ? undefined
      : `${firstFindingCopy.title}: ${firstFindingCopy.description}`;
  const focusedDetailId = `${elementId}-finding-detail`;

  useEffect(() => {
    if (!selectedAtOwner || marker.current === null) {
      return;
    }
    marker.current.focus({ preventScroll: true });
    marker.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [navigationRevision, selectedAtOwner, selectedKey]);

  return (
    <>
      <span
        aria-describedby={focusedDetail === undefined ? undefined : focusedDetailId}
        aria-label={
          findings.length === 0
            ? undefined
            : `${findings.length} ${findings.length === 1 ? 'finding' : 'findings'}`
        }
        className="semantic-owner-marker"
        data-has-findings={findings.length > 0}
        data-selected={selectedAtOwner}
        data-semantic-owner={ownerKey}
        id={elementId}
        ref={marker}
        tabIndex={-1}
        title={focusedDetail}
      >
        {findings.length === 0 ? null : findings.length}
      </span>
      {focusedDetail === undefined ? null : (
        <span className="visually-hidden" id={focusedDetailId}>
          {focusedDetail}
        </span>
      )}
    </>
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
    <section className="project-findings" aria-labelledby="project-findings-title">
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
                        key,
                        origin: finding.origin,
                        ...(destination?.traitDialogTarget === undefined
                          ? {}
                          : { traitDialogTarget: destination.traitDialogTarget }),
                      }),
                    )
                  }
                  type="button"
                >
                  <span className="finding-title">{copy.title}</span>
                  <span className="finding-destination">
                    {findingDestinationLabel(catalog, finding.origin)}
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

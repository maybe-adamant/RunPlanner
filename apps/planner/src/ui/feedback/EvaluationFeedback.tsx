import { semanticAddressKey, type SemanticAddress } from '@run-planner/engine/authored-project';
import { type Catalog } from '@run-planner/engine/catalog-schema';
import { type ProjectEvaluation, type SemanticFinding } from '@run-planner/engine/simulation';
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';

import {
  findingDestinationLabel,
  indexFindingsByOwner,
  presentFinding,
  semanticFindingKey,
  type StatusPresentation,
} from '../../projections/evaluationProjection';
import { findingSelected } from '../../state/editorSessionSlice';
import { selectProjectFindingsByOwner, useAppDispatch, useAppSelector } from '../../state/store';
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

export function SemanticOwnerMarker({ address }: { readonly address: SemanticAddress }) {
  const ownerKey = semanticAddressKey(address);
  const localFindings = useContext(scopedFindings);
  const projectFindings = useAppSelector(selectProjectFindingsByOwner);
  const findings = (localFindings ?? projectFindings).get(ownerKey) ?? [];
  const selectedFinding = useAppSelector((state) => state.editorSession.selectedFinding);
  const navigationRevision = useAppSelector(
    (state) => state.editorSession.findingNavigationRevision,
  );
  const selectedKey = selectedFinding === null ? null : selectedFinding.key;
  const selectedAtOwner =
    selectedFinding !== null &&
    semanticAddressKey(selectedFinding.origin) === ownerKey &&
    findings.some((finding) => semanticFindingKey(finding) === selectedFinding.key);
  const marker = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!selectedAtOwner || marker.current === null) {
      return;
    }
    marker.current.focus({ preventScroll: true });
    marker.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [navigationRevision, selectedAtOwner, selectedKey]);

  return (
    <span
      aria-label={
        findings.length === 0
          ? undefined
          : `${findings.length} ${findings.length === 1 ? 'finding' : 'findings'}`
      }
      className="semantic-owner-marker"
      data-has-findings={findings.length > 0}
      data-selected={selectedAtOwner}
      data-semantic-owner={ownerKey}
      id={semanticOwnerElementId(address)}
      ref={marker}
      tabIndex={-1}
    >
      {findings.length === 0 ? null : findings.length}
    </span>
  );
}

export function ProjectFindings({
  catalog,
  evaluation,
}: {
  readonly catalog: Catalog;
  readonly evaluation: ProjectEvaluation;
}) {
  const dispatch = useAppDispatch();
  const selectedFinding = useAppSelector((state) => state.editorSession.selectedFinding);
  const selectedKey = selectedFinding === null ? null : selectedFinding.key;

  return (
    <section className="project-findings" aria-labelledby="project-findings-title">
      <header className="project-findings-heading">
        <div>
          <p className="eyebrow">Simulation</p>
          <h2 id="project-findings-title">Project findings</h2>
        </div>
        <span className="findings-count">{evaluation.findings.length}</span>
      </header>
      {evaluation.findings.length === 0 ? (
        <p className="findings-empty">
          {evaluation.status === 'empty'
            ? 'Configure a biome to begin simulation.'
            : 'No findings in the evaluated route prefix.'}
        </p>
      ) : (
        <ol className="findings-list">
          {evaluation.findings.map((finding, index) => {
            const copy = presentFinding(finding);
            const key = semanticFindingKey(finding);
            return (
              <li key={`${key}-${index}`}>
                <button
                  aria-current={selectedKey === key ? 'true' : undefined}
                  data-selected={selectedKey === key}
                  onClick={() => dispatch(findingSelected({ key, origin: finding.origin }))}
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

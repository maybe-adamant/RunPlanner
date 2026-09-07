import { semanticAddressKey, type SemanticAddress } from '@run-planner/engine/authored-project';
import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import type { StructuredWorkspaceProjection } from '@planner/projections/structured-workspace';
import { presentFinding, semanticFindingKey } from '@planner/projections/evaluationProjection';
import { useAppSelector } from '@planner/state/store';
import { semanticOwnerControlElementId } from './semanticOwner';

interface TargetFeedback {
  readonly authoringReadiness: StructuredWorkspaceProjection['authoringReadiness'] | undefined;
  readonly findings: StructuredWorkspaceProjection['findingsByRepairTarget'];
  readonly selectedKey: string | undefined;
  readonly focusKey: string | undefined;
  readonly revision: number;
}
const emptyFindings: StructuredWorkspaceProjection['findingsByRepairTarget'] = new Map();
const feedback = createContext<TargetFeedback>({
  authoringReadiness: undefined,
  findings: emptyFindings,
  selectedKey: undefined,
  focusKey: undefined,
  revision: 0,
});

export function FindingTargetScope({
  authoringReadiness,
  children,
  findings,
}: {
  readonly authoringReadiness?: StructuredWorkspaceProjection['authoringReadiness'];
  readonly children: ReactNode;
  readonly findings: StructuredWorkspaceProjection['findingsByRepairTarget'] | undefined;
}) {
  const selected = useAppSelector((state) => state.editorSession.selectedFinding);
  const focused = useAppSelector((state) => state.editorSession.focusedSemanticOwner);
  const revision = useAppSelector((state) => state.editorSession.semanticNavigationRevision);
  const value = useMemo(
    () => ({
      authoringReadiness,
      findings: findings ?? emptyFindings,
      selectedKey: selected?.key,
      focusKey: focused == null ? undefined : semanticAddressKey(focused),
      revision,
    }),
    [authoringReadiness, findings, selected, focused, revision],
  );
  return <feedback.Provider value={value}>{children}</feedback.Provider>;
}

export interface FindingTargetProps {
  readonly 'aria-disabled': true | undefined;
  readonly 'data-authoring-locked': true | undefined;
  readonly inert: boolean;
  readonly id: string;
  readonly 'data-semantic-owner': string;
  readonly 'data-has-findings': boolean;
  readonly 'data-selected-finding': boolean;
  readonly 'aria-description': string | undefined;
  readonly ref: (element: HTMLElement | null) => void;
}

/** Binds feedback directly to an existing control or truthful group, including mapped controls. */
// eslint-disable-next-line react-refresh/only-export-components -- The scope and hook form one feedback boundary.
export function useFindingTarget() {
  const {
    authoringReadiness,
    findings: findingsByTarget,
    selectedKey,
    focusKey,
    revision,
  } = useContext(feedback);
  const handledRequest = useRef<string | undefined>(undefined);
  return (
    address: SemanticAddress,
    id = semanticOwnerControlElementId(address),
    readinessOwner: SemanticAddress = address,
  ): FindingTargetProps => {
    const key = semanticAddressKey(address);
    const locked = authoringReadiness?.(readinessOwner) === 'locked';
    const findings = findingsByTarget.get(key) ?? [];
    const selectedAtTarget =
      selectedKey !== undefined &&
      focusKey === key &&
      findings.some((finding) => semanticFindingKey(finding) === selectedKey);
    const request = `${revision}:${selectedKey ?? ''}:${key}`;
    return {
      id,
      'aria-disabled': locked || undefined,
      'data-authoring-locked': locked || undefined,
      inert: locked,
      'data-semantic-owner': key,
      'data-has-findings': findings.length > 0,
      'data-selected-finding': selectedAtTarget,
      'aria-description':
        findings.length === 0
          ? undefined
          : findings
              .map((finding) => {
                const copy = presentFinding(finding);
                return `${copy.title}: ${copy.description}`;
              })
              .join(' '),
      ref: (element) => {
        if (element === null || !selectedAtTarget || handledRequest.current === request) return;
        handledRequest.current = request;
        element.focus({ preventScroll: true });
        element.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      },
    };
  };
}

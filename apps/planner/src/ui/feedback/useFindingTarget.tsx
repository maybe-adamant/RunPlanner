import { semanticAddressKey, type SemanticAddress } from '@run-planner/engine/authored-project';
import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import {
  findingControlKey,
  type StructuredWorkspaceProjection,
  type WorkspaceFindingControl,
} from '@planner/projections/structured-workspace';
import {
  formatFindingExplanation,
  formatFindingSentence,
  presentFinding,
  semanticFindingKey,
} from '@planner/projections/evaluationProjection';
import { useAppSelector } from '@planner/state/store';
import { semanticOwnerControlElementId } from './semanticOwner';

interface TargetFeedback {
  readonly authoringReadiness: StructuredWorkspaceProjection['authoringReadiness'] | undefined;
  readonly findings: StructuredWorkspaceProjection['findingsByRepairTarget'];
  readonly selectedKey: string | undefined;
  /** The selection names the assessment issue whose reasons the findings index holds. */
  readonly issueSelected: boolean;
  readonly focusKey: string | undefined;
  readonly revision: number;
  /** Set inside an open dialog whose findings map holds only that dialog's findings. */
  readonly dialog?: true;
}
const emptyFindings: StructuredWorkspaceProjection['findingsByRepairTarget'] = new Map();
const feedback = createContext<TargetFeedback>({
  authoringReadiness: undefined,
  findings: emptyFindings,
  selectedKey: undefined,
  issueSelected: false,
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
  const issueKey = useAppSelector(
    (state) => state.projectWorkspace.assembly?.evaluation.issue?.regionKey,
  );
  const value = useMemo(
    () => ({
      authoringReadiness,
      findings: findings ?? emptyFindings,
      selectedKey: selected?.key,
      issueSelected: selected != null && selected.key === issueKey,
      focusKey: focused == null ? undefined : semanticAddressKey(focused),
      revision,
    }),
    [authoringReadiness, findings, selected, focused, revision, issueKey],
  );
  return <feedback.Provider value={value}>{children}</feedback.Provider>;
}

/** An open dialog's own marks: its controls read these findings instead of the outer ones. */
export function DialogFindingScope({
  children,
  findings,
}: {
  readonly children: ReactNode;
  readonly findings: StructuredWorkspaceProjection['findingsByRepairTarget'];
}) {
  const outer = useContext(feedback);
  const value = useMemo(() => ({ ...outer, findings, dialog: true as const }), [outer, findings]);
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

export type FindingTargetFilter = (finding: { readonly code: string }) => boolean;

/** Presented explanations of the owner's findings that pass the filter. */
// eslint-disable-next-line react-refresh/only-export-components -- Reads the same feedback boundary.
export function useFindingExplanations(
  address: SemanticAddress,
  filter: FindingTargetFilter,
): readonly string[] {
  const { findings } = useContext(feedback);
  return (findings.get(semanticAddressKey(address)) ?? [])
    .filter(filter)
    .map((finding) => formatFindingExplanation(presentFinding(finding)));
}

/** The owner's findings as dialog feedback entries, folded as its launcher marks them. */
// eslint-disable-next-line react-refresh/only-export-components -- Reads the same feedback boundary.
export function useFindingFeedbackEntries(
  address: SemanticAddress,
): readonly (readonly [key: string, message: string])[] {
  const { findings } = useContext(feedback);
  return (findings.get(semanticAddressKey(address)) ?? []).map(
    (finding) =>
      [semanticFindingKey(finding), formatFindingExplanation(presentFinding(finding))] as const,
  );
}

/**
 * An open dialog's findings as feedback entries, once each; `owner` narrows them to one
 * nested owner. Undefined outside a dialog scope.
 */
// eslint-disable-next-line react-refresh/only-export-components -- Reads the same feedback boundary.
export function useDialogFindingEntries(
  owner?: SemanticAddress,
): readonly (readonly [key: string, message: string])[] | undefined {
  const { dialog, findings } = useContext(feedback);
  if (dialog !== true) return undefined;
  const ownerKey = owner === undefined ? undefined : semanticAddressKey(owner);
  const entries = new Map<string, string>();
  for (const group of findings.values())
    for (const finding of group)
      if (ownerKey === undefined || semanticAddressKey(finding.origin) === ownerKey)
        entries.set(semanticFindingKey(finding), formatFindingExplanation(presentFinding(finding)));
  return [...entries];
}

type FocusTarget = (anchor: HTMLElement) => HTMLElement | null;

const nativeControls = 'button, input, select, textarea';

function isEnabled(element: Element): boolean {
  return !element.matches(':disabled') && element.getAttribute('aria-disabled') !== 'true';
}

/** The marked element itself, or the first enabled control inside a marked group. */
function focusableMark(marked: HTMLElement): HTMLElement | null {
  if (marked.matches(nativeControls)) return isEnabled(marked) ? marked : null;
  const inner = [...marked.querySelectorAll<HTMLElement>(nativeControls)].find(isEnabled);
  return inner ?? (marked.hasAttribute('tabindex') ? marked : null);
}

/** Navigation lands on the selected finding's mark inside the anchor, else on the anchor. */
function navigationFocus(anchor: HTMLElement, markKeys: ReadonlySet<string>): HTMLElement {
  for (const marked of anchor.querySelectorAll<HTMLElement>(
    '[data-semantic-owner][data-has-findings="true"]',
  )) {
    if (!markKeys.has(marked.dataset.semanticOwner ?? '')) continue;
    const control = focusableMark(marked);
    if (control !== null) return control;
  }
  return anchor;
}

/** Binds feedback directly to an existing control or truthful group, including mapped controls. */
// eslint-disable-next-line react-refresh/only-export-components -- The scope and hook form one feedback boundary.
export function useFindingTarget() {
  const bind = useTargetBinder();
  return (
    address: SemanticAddress,
    id = semanticOwnerControlElementId(address),
    readinessOwner: SemanticAddress = address,
    filter?: FindingTargetFilter,
  ): FindingTargetProps => bind(address, id, readinessOwner, filter);
}

function useTargetBinder() {
  const {
    authoringReadiness,
    findings: findingsByTarget,
    selectedKey,
    issueSelected,
    focusKey,
    revision,
  } = useContext(feedback);
  const handledRequest = useRef<string | undefined>(undefined);
  return (
    address: SemanticAddress,
    id: string,
    readinessOwner: SemanticAddress,
    filter: FindingTargetFilter | undefined,
    focusTarget?: FocusTarget,
  ): FindingTargetProps => {
    const key = semanticAddressKey(address);
    const locked = authoringReadiness?.(readinessOwner) === 'locked';
    const allFindings = findingsByTarget.get(key) ?? [];
    const findings = filter === undefined ? allFindings : allFindings.filter(filter);
    const selectedAtTarget =
      selectedKey !== undefined &&
      focusKey === key &&
      (filter === undefined ||
        findings.some((finding) => semanticFindingKey(finding) === selectedKey));
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
          : findings.map((finding) => formatFindingSentence(presentFinding(finding))).join(' '),
      ref: (element) => {
        if (element === null || !selectedAtTarget || handledRequest.current === request) return;
        handledRequest.current = request;
        const markKeys = new Set(
          [...findingsByTarget]
            .filter(
              ([, marked]) =>
                issueSelected ||
                marked.some((finding) => semanticFindingKey(finding) === selectedKey),
            )
            .map(([markKey]) => markKey),
        );
        const landing = navigationFocus(focusTarget?.(element) ?? element, markKeys);
        landing.focus({ preventScroll: true, focusVisible: true });
        element.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      },
    };
  };
}

export type FindingAnchorProps = Omit<FindingTargetProps, 'data-has-findings' | 'aria-description'>;

/**
 * Binds a navigation anchor: it is focused and locked like its owner, but its
 * owner's findings mark the controls inside it, never the anchor.
 */
// eslint-disable-next-line react-refresh/only-export-components -- The scope and hook form one feedback boundary.
export function useFindingAnchor() {
  const bind = useTargetBinder();
  return (
    address: SemanticAddress,
    options: {
      readonly id?: string;
      readonly readinessOwner?: SemanticAddress;
      /** The element inside the anchor that navigation focuses, when one exists. */
      readonly focusTarget?: FocusTarget;
    } = {},
  ): FindingAnchorProps => {
    const {
      'data-has-findings': _hasFindings,
      'aria-description': _description,
      ...anchor
    } = bind(
      address,
      options.id ?? semanticOwnerControlElementId(address),
      options.readinessOwner ?? address,
      undefined,
      options.focusTarget,
    );
    void _hasFindings;
    void _description;
    return anchor;
  };
}

export interface FindingMarkProps {
  readonly 'data-semantic-owner': string;
  readonly 'data-has-findings': boolean;
  readonly 'aria-description': string | undefined;
}

/** Marks a control with its owner's findings without making it a navigation target. */
// eslint-disable-next-line react-refresh/only-export-components -- The scope and hook form one feedback boundary.
export function useFindingMark() {
  const { findings: findingsByTarget } = useContext(feedback);
  return (address: SemanticAddress, control?: WorkspaceFindingControl): FindingMarkProps => {
    const key = findingControlKey(address, control);
    const findings = findingsByTarget.get(key) ?? [];
    return {
      'data-semantic-owner': key,
      'data-has-findings': findings.length > 0,
      'aria-description':
        findings.length === 0
          ? undefined
          : findings.map((finding) => formatFindingSentence(presentFinding(finding))).join(' '),
    };
  };
}

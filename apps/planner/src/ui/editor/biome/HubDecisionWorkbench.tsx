import { type KeyboardEvent as ReactKeyboardEvent, useLayoutEffect, useRef, useState } from 'react';

import { semanticAddressKey } from '@run-planner/engine/authored-project';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceAuthoringFrontier,
  type WorkspaceHubDecisionNode,
  type WorkspaceHubTab,
  type WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { candidateMayBeAuthored } from '@planner/ui/feedback/candidatePresentation';
import { HubCompletionHandoff } from './HubCompletionHandoff';
import { HubFountainControls } from './HubFountainControls';
import {
  ClosedHubRoomOption,
  MarkerAssessment,
  membershipControlIn,
  type HubMembershipTransition,
} from './HubMembershipBoard';
import { OpenHubRoomCard } from './HubRoomCards';
import { HubMapOverview } from './hub-map/HubMapOverview';
import { HubMapTimeline } from './hub-map/HubMapTimeline';
import { RunStateLauncher } from './RunStateSheet';

interface HubDecisionWorkbenchProps {
  readonly frontier: WorkspaceAuthoringFrontier | null;
  readonly initialTab?: WorkspaceHubTab;
  /** Reapply a finding-owned tab request even when the requested tab is unchanged. */
  readonly findingNavigationRevision?: number;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly node: WorkspaceHubDecisionNode;
}

const hubWorkbenchTabs: readonly { readonly key: WorkspaceHubTab; readonly label: string }[] =
  Object.freeze([
    Object.freeze({ key: 'overview', label: 'Hub Overview' }),
    Object.freeze({ key: 'timeline', label: 'Hub Timeline' }),
    Object.freeze({ key: 'exit', label: 'Hub Exit' }),
  ]);

function domId(value: string): string {
  return value.replaceAll(/[^A-Za-z0-9_-]/g, '-');
}

interface PendingHubMembershipFocus extends HubMembershipTransition {
  readonly beforeSlots: WorkspaceHubDecisionNode['slots'];
}

export function HubDecisionWorkbench({
  frontier,
  initialTab,
  findingNavigationRevision,
  interactions,
  node,
}: HubDecisionWorkbenchProps) {
  const findingTarget = useFindingTarget();
  const hubTarget = findingTarget(node.owner);
  const hubTargetProps = {
    'aria-description': hubTarget['aria-description'],
    'data-has-findings': hubTarget['data-has-findings'],
    'data-selected-finding': hubTarget['data-selected-finding'],
    'data-semantic-owner': hubTarget['data-semantic-owner'],
    id: hubTarget.id,
    ref: hubTarget.ref,
  };
  const openSetTarget = findingTarget(node.openSet.address);
  const executeIntent = useCommandIntent();
  const dispatch = useAppDispatch();
  const focusedOwner = useAppSelector((state) => state.editorSession.focusedSemanticOwner);
  const handoff =
    frontier?.kind === 'exitDecision' && frontier.owner.source.kind === 'hubDecision'
      ? requireWorkspaceInteraction(interactions.takeoverBatches, frontier.interactionKey)
      : undefined;
  if (handoff !== undefined && handoff.presentation !== 'completedHubHandoff') {
    throw new Error('The completed Hub frontier must expose its fixed Preboss handoff.');
  }
  const titleId = `hub-${domId(node.marker.focusKey)}`;
  const actionOrderInteraction = requireWorkspaceInteraction(
    interactions.hubActionOrders,
    workspaceInteractionKey(node.owner),
  );
  const resetActionOrder = actionOrderInteraction.proposalFor([]);
  const resetCandidates = useWorkspaceInteraction(resetActionOrder);
  const authoredVisitCount = actionOrderInteraction.selectedHubSlotKeys.length;
  const nextVisit = node.visits[authoredVisitCount];
  if (authoredVisitCount < node.requiredVisitCount && nextVisit === undefined) {
    throw new Error('An incomplete Hub visit order must expose its next visit marker.');
  }
  const continueKeyboardMembershipAfterTransition = (transition: HubMembershipTransition): void => {
    if (transition.input !== 'keyboard') return;
    pendingMembershipFocus.current = Object.freeze({ ...transition, beforeSlots: node.slots });
  };
  const removal = requireWorkspaceInteraction(
    interactions.topologyRemovals,
    workspaceInteractionKey(node.owner),
  );
  const resetBoard = requireWorkspaceInteraction(
    interactions.hubBoardResets,
    workspaceInteractionKey(node.owner),
  );
  const focusedOwnerKey = focusedOwner === null ? undefined : semanticAddressKey(focusedOwner);
  const overviewOpenMembershipRegion = useRef<HTMLDivElement>(null);
  const tabList = useRef<HTMLElement>(null);
  const requestedTab = initialTab ?? 'overview';
  const initialOverviewView =
    findingNavigationRevision !== undefined && requestedTab === 'overview' ? 'list' : 'map';
  const hubIdentity = semanticAddressKey(node.owner);
  const [tabState, setTabState] = useState({
    active: requestedTab,
    findingNavigationRevision,
    hubIdentity,
    requested: requestedTab,
  });
  const [viewState, setViewState] = useState<{
    readonly handledFindingNavigationRevision: number | undefined;
    readonly hubIdentity: string;
    readonly overview: 'list' | 'map';
  }>({
    handledFindingNavigationRevision: findingNavigationRevision,
    hubIdentity,
    overview: initialOverviewView,
  });
  if (viewState.hubIdentity !== hubIdentity) {
    setViewState({
      handledFindingNavigationRevision: findingNavigationRevision,
      hubIdentity,
      overview: initialOverviewView,
    });
  } else if (
    findingNavigationRevision !== undefined &&
    viewState.handledFindingNavigationRevision !== findingNavigationRevision
  ) {
    setViewState({
      ...viewState,
      handledFindingNavigationRevision: findingNavigationRevision,
      ...(requestedTab === 'overview' ? { overview: 'list' as const } : {}),
    });
  }
  // Overview findings are canonical in List. Ordinary publication preserves
  // its chosen Map view; Timeline is always its map surface.
  const overviewView =
    viewState.hubIdentity === hubIdentity ? viewState.overview : initialOverviewView;
  const overviewNavigation = useRef<HTMLButtonElement>(null);
  const pendingOverviewFocus = useRef(false);
  const setOverviewView = (overview: 'list' | 'map'): void => {
    pendingOverviewFocus.current = true;
    setViewState({ ...viewState, overview });
  };
  useLayoutEffect(() => {
    if (!pendingOverviewFocus.current) return;
    pendingOverviewFocus.current = false;
    overviewNavigation.current?.focus({ preventScroll: true });
  }, [overviewView]);
  const activeTab =
    tabState.hubIdentity === hubIdentity &&
    tabState.requested === requestedTab &&
    tabState.findingNavigationRevision === findingNavigationRevision
      ? tabState.active
      : requestedTab;
  const nextVisitTarget =
    activeTab !== 'timeline' || nextVisit === undefined
      ? undefined
      : findingTarget(nextVisit.marker.address, undefined, node.owner);
  const setActiveTab = (tab: WorkspaceHubTab): void =>
    setTabState({ active: tab, findingNavigationRevision, hubIdentity, requested: requestedTab });
  const pendingMembershipFocus = useRef<PendingHubMembershipFocus | undefined>(undefined);
  // Overview keeps every fixed slot in one stable declaration-ordered grid.
  // After a keyboard membership edit remounts that card, restore focus to the
  // same slot's checkbox without moving the user to a different row.
  useLayoutEffect(() => {
    const pending = pendingMembershipFocus.current;
    if (pending === undefined) return;
    if (node.slots === pending.beforeSlots) return;
    const slot = node.slots.find((candidate) => candidate.hubSlotKey === pending.slotKey);
    const expectedOpen = pending.source === 'closed';
    if (slot === undefined || slot.open !== expectedOpen) {
      pendingMembershipFocus.current = undefined;
      return;
    }
    const control = membershipControlIn(overviewOpenMembershipRegion.current, pending.slotKey);
    if (control !== undefined) {
      control.focus({ preventScroll: true });
    } else {
      overviewOpenMembershipRegion.current?.focus({ preventScroll: true });
    }
    pendingMembershipFocus.current = undefined;
  }, [node.slots]);

  const activateTab = (tab: WorkspaceHubTab): void => {
    setActiveTab(tab);
    tabList.current
      ?.querySelector<HTMLButtonElement>(`[data-hub-workbench-tab="${tab}"]`)
      ?.focus({ preventScroll: true });
  };
  const onTabKeyDown = (event: ReactKeyboardEvent<HTMLElement>): void => {
    const current = hubWorkbenchTabs.findIndex((tab) => tab.key === activeTab);
    if (current < 0) return;
    let next: number | undefined;
    if (event.key === 'ArrowLeft')
      next = (current + hubWorkbenchTabs.length - 1) % hubWorkbenchTabs.length;
    if (event.key === 'ArrowRight') next = (current + 1) % hubWorkbenchTabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = hubWorkbenchTabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    const tab = hubWorkbenchTabs[next];
    if (tab !== undefined) activateTab(tab.key);
  };
  const overviewNavigationControl = (
    <button
      className="quiet-action action-compact"
      onClick={() => setOverviewView(overviewView === 'map' ? 'list' : 'map')}
      ref={overviewNavigation}
      type="button"
    >
      {overviewView === 'map' ? 'Details →' : 'Back to Map'}
    </button>
  );
  const resetVisitsControl = (
    <button
      aria-busy={resetCandidates.pending || undefined}
      className="danger-action action-compact"
      disabled={
        hubTarget.inert ||
        actionOrderInteraction.selectedActions.length === 0 ||
        resetCandidates.pending ||
        (resetCandidates.result !== undefined && !candidateMayBeAuthored(resetCandidates.result[0]))
      }
      onClick={() => {
        const options = resetCandidates.result ?? resetCandidates.activate();
        if (candidateMayBeAuthored(options?.[0])) executeIntent(resetActionOrder.intent());
      }}
      onFocus={() => resetCandidates.activate()}
      onPointerDown={() => resetCandidates.activate()}
      type="button"
    >
      Reset visits
    </button>
  );
  const resetBoardControl = (
    <button
      className="danger-action action-compact"
      disabled={hubTarget.inert || node.openSlotCount.current === 0}
      onClick={() => executeIntent(resetBoard.intent)}
      type="button"
    >
      Reset Board
    </button>
  );

  return (
    <section
      {...hubTargetProps}
      tabIndex={-1}
      className="room-card hub-decision-workbench"
      aria-label="Ephyra Hub"
    >
      <header className="room-card-heading">
        <h3 id={`${titleId}-title`}>Ephyra Hub</h3>
        <div className="hub-board-status">
          <span className="neutral-status">
            {node.openSlotCount.current} open · {node.openSlotCount.min}–{node.openSlotCount.max}{' '}
            required
          </span>
          <span
            {...nextVisitTarget}
            className="neutral-status"
            tabIndex={nextVisitTarget === undefined ? undefined : -1}
          >
            {authoredVisitCount} of {node.requiredVisitCount} planned
          </span>
        </div>
      </header>
      <div className="room-workbench-tab-row">
        <nav
          aria-label="Hub workbench"
          className="room-workbench-tabs"
          onKeyDown={onTabKeyDown}
          ref={tabList}
          role="tablist"
        >
          {hubWorkbenchTabs.map((tab) => (
            <button
              aria-controls={`${titleId}-tabpanel`}
              aria-selected={activeTab === tab.key}
              className="room-workbench-tab"
              data-hub-workbench-tab={tab.key}
              id={`${titleId}-tab-${tab.key}`}
              key={tab.key}
              onClick={() => activateTab(tab.key)}
              role="tab"
              tabIndex={activeTab === tab.key ? 0 : -1}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="room-workbench-tab-utility owner-markers">
          {node.runState === undefined ? null : <RunStateLauncher launcher={node.runState} />}
          <button
            className="danger-action action-compact"
            data-command={removal.intent.command.kind}
            disabled={hubTarget.inert}
            onClick={() => executeIntent(removal.intent)}
            type="button"
          >
            Remove Hub
          </button>
        </div>
      </div>
      <section
        aria-labelledby={`${titleId}-tab-${activeTab}`}
        className="hub-workbench-tab-panel"
        id={`${titleId}-tabpanel`}
        role="tabpanel"
      >
        {activeTab === 'exit' ? null : (
          <div className="hub-workbench-view">
            {activeTab === 'overview' ? (
              <section className="hub-board" aria-label="Hub room participation">
                {overviewView === 'map' ? (
                  <HubMapOverview
                    hubIdentity={hubIdentity}
                    interactions={interactions}
                    node={node}
                    resetBoardControl={resetBoardControl}
                    detailsControl={overviewNavigationControl}
                  />
                ) : (
                  <>
                    <header className="hub-board-heading">
                      <div className="hub-board-heading-row">
                        <div className="owner-markers">
                          <h4>Open rooms</h4>
                          <MarkerAssessment marker={node.openSet} />
                        </div>
                        <div className="hub-board-heading-actions">
                          {overviewNavigationControl}
                          {resetBoardControl}
                        </div>
                      </div>
                      <p>Open or close the rooms available on this Hub board.</p>
                    </header>
                    <div
                      {...openSetTarget}
                      aria-label="Hub room set"
                      className="hub-overview-room-grid"
                      ref={(element) => {
                        overviewOpenMembershipRegion.current = element;
                        openSetTarget.ref(element);
                      }}
                      role="group"
                      tabIndex={-1}
                    >
                      {node.slots.map((slot) =>
                        slot.open ? (
                          <OpenHubRoomCard
                            focusedRewardOwnerKey={focusedOwnerKey}
                            interactions={interactions}
                            key={slot.hubSlotKey}
                            onMembershipTransition={continueKeyboardMembershipAfterTransition}
                            slot={slot}
                          />
                        ) : (
                          <ClosedHubRoomOption
                            interactions={interactions}
                            key={slot.hubSlotKey}
                            onMembershipTransition={continueKeyboardMembershipAfterTransition}
                            slot={slot}
                          />
                        ),
                      )}
                    </div>
                  </>
                )}
              </section>
            ) : (
              <>
                <HubMapTimeline
                  hubIdentity={hubIdentity}
                  interactions={interactions}
                  locked={hubTarget.inert}
                  node={node}
                  resetVisitsControl={resetVisitsControl}
                />
                {node.fountain.controlsHost?.kind === 'hub' ? (
                  <HubFountainControls fountain={node.fountain} interactions={interactions} />
                ) : node.fountain.controlsHost?.kind === 'room' ? (
                  <button
                    className="quiet-action action-compact hub-fountain-host-note"
                    onClick={() => dispatch(semanticOwnerFocused(node.fountain.address))}
                    type="button"
                  >
                    Hub fountain controls: before {node.fountain.controlsHost.label} →
                  </button>
                ) : null}
              </>
            )}
          </div>
        )}
        {activeTab === 'exit' ? (
          <section className="hub-board" aria-label="Hub exit">
            <HubCompletionHandoff interaction={handoff} node={node} />
          </section>
        ) : null}
      </section>
    </section>
  );
}

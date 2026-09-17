import { type KeyboardEvent as ReactKeyboardEvent, useLayoutEffect, useRef, useState } from 'react';

import { semanticAddressKey } from '@run-planner/engine/authored-project';
import {
  reconcileHubBoardRanking,
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceAuthoringFrontier,
  type WorkspaceHubDecisionNode,
  type WorkspaceHubTab,
  type WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import { useAppSelector } from '@planner/state/store';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { candidateMayBeAuthored } from '@planner/ui/feedback/candidatePresentation';
import { HubCompletionHandoff } from './HubCompletionHandoff';
import {
  ClosedHubRoomOption,
  MarkerAssessment,
  membershipControlIn,
  type HubMembershipTransition,
} from './HubMembershipBoard';
import { OpenHubRoomCard } from './HubRoomCards';
import { HubVisitTimeline } from './HubVisitTimeline';
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
  const focusedOwner = useAppSelector((state) => state.editorSession.focusedSemanticOwner);
  const handoff =
    frontier?.kind === 'exitDecision' && frontier.owner.source.kind === 'hubDecision'
      ? requireWorkspaceInteraction(interactions.takeoverBatches, frontier.interactionKey)
      : undefined;
  if (handoff !== undefined && handoff.presentation !== 'completedHubHandoff') {
    throw new Error('The completed Hub frontier must expose its fixed Preboss handoff.');
  }
  const titleId = `hub-${domId(node.marker.focusKey)}`;
  // Overview is declaration ordered; it needs only the current authored rank
  // for the room-card marker. Timeline-owned transient tail order stays in
  // HubVisitTimeline.
  const visitOrderInteraction = requireWorkspaceInteraction(
    interactions.hubVisitOrders,
    workspaceInteractionKey(node.owner),
  );
  const resetVisitOrder = visitOrderInteraction.proposalFor([]);
  const resetCandidates = useWorkspaceInteraction(resetVisitOrder);
  const ranking = reconcileHubBoardRanking({
    authoredVisitOrder: visitOrderInteraction.selectedHubSlotKeys,
    declarationOpenSlotKeys: node.slots.filter((slot) => slot.open).map((slot) => slot.hubSlotKey),
    retainedTailSlotKeys: Object.freeze([]),
  });
  const authoredVisitCount = visitOrderInteraction.selectedHubSlotKeys.length;
  const slotsByKey = new Map(node.slots.map((slot) => [slot.hubSlotKey, slot] as const));
  const continueKeyboardMembershipAfterTransition = (transition: HubMembershipTransition): void => {
    if (transition.input !== 'keyboard') return;
    pendingMembershipFocus.current = Object.freeze({ ...transition, beforeSlots: node.slots });
  };
  const removal = requireWorkspaceInteraction(
    interactions.topologyRemovals,
    workspaceInteractionKey(node.owner),
  );
  const focusedOwnerKey = focusedOwner === null ? undefined : semanticAddressKey(focusedOwner);
  const overviewOpenMembershipRegion = useRef<HTMLDivElement>(null);
  const tabList = useRef<HTMLElement>(null);
  const requestedTab = initialTab ?? 'overview';
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
    readonly timeline: 'list' | 'map';
  }>({
    handledFindingNavigationRevision: findingNavigationRevision,
    hubIdentity,
    overview: 'list',
    timeline: 'list',
  });
  if (viewState.hubIdentity !== hubIdentity) {
    setViewState({
      handledFindingNavigationRevision: findingNavigationRevision,
      hubIdentity,
      overview: 'list',
      timeline: 'list',
    });
  } else if (
    findingNavigationRevision !== undefined &&
    viewState.handledFindingNavigationRevision !== findingNavigationRevision
  ) {
    setViewState({
      ...viewState,
      handledFindingNavigationRevision: findingNavigationRevision,
      ...(requestedTab === 'overview' ? { overview: 'list' as const } : {}),
      ...(requestedTab === 'timeline' ? { timeline: 'list' as const } : {}),
    });
  }
  // A finding destination is canonical in List. Its navigation revision is
  // intentionally distinct from ordinary publication, which preserves Map.
  const overviewView = viewState.hubIdentity === hubIdentity ? viewState.overview : 'list';
  const setOverviewView = (overview: 'list' | 'map'): void =>
    setViewState({ ...viewState, overview });
  const timelineView = viewState.hubIdentity === hubIdentity ? viewState.timeline : 'list';
  const setTimelineView = (timeline: 'list' | 'map'): void =>
    setViewState({ ...viewState, timeline });
  const activeTab =
    tabState.hubIdentity === hubIdentity &&
    tabState.requested === requestedTab &&
    tabState.findingNavigationRevision === findingNavigationRevision
      ? tabState.active
      : requestedTab;
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
  const overviewViewSwitcher = (
    <div aria-label="Hub Overview view" className="hub-view-switch" role="group">
      {(['list', 'map'] as const).map((view) => (
        <button
          aria-pressed={overviewView === view}
          className="quiet-action action-compact"
          key={view}
          onClick={() => setOverviewView(view)}
          type="button"
        >
          {view === 'list' ? 'List' : 'Map'}
        </button>
      ))}
    </div>
  );
  const timelineToolbarActions = (
    <div className="hub-timeline-toolbar-actions">
      <button
        aria-busy={resetCandidates.pending || undefined}
        className="danger-action action-compact"
        disabled={
          hubTarget.inert ||
          authoredVisitCount === 0 ||
          resetCandidates.pending ||
          (resetCandidates.result !== undefined &&
            !candidateMayBeAuthored(resetCandidates.result[0]))
        }
        onClick={() => {
          const options = resetCandidates.result ?? resetCandidates.activate();
          if (candidateMayBeAuthored(options?.[0])) executeIntent(resetVisitOrder.intent());
        }}
        onFocus={() => resetCandidates.activate()}
        onPointerDown={() => resetCandidates.activate()}
        type="button"
      >
        Reset visits
      </button>
      <div aria-label="Hub Timeline view" className="hub-view-switch" role="group">
        {(['list', 'map'] as const).map((view) => (
          <button
            aria-pressed={timelineView === view}
            className="quiet-action action-compact"
            key={view}
            onClick={() => setTimelineView(view)}
            type="button"
          >
            {view === 'list' ? 'List' : 'Map'}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <section
      {...hubTargetProps}
      tabIndex={-1}
      className="hub-decision-workbench"
      aria-label="Ephyra Hub"
    >
      <header className="decision-heading hub-decision-heading">
        <div className="owner-markers">
          <h3 id={`${titleId}-title`}>Ephyra Hub</h3>
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
        <div className="hub-board-status">
          <span className="neutral-status">
            {node.openSlotCount.current} open · {node.openSlotCount.min}–{node.openSlotCount.max}{' '}
            required
          </span>
          <span className="neutral-status">
            {authoredVisitCount} of {node.requiredVisitCount} planned
          </span>
        </div>
      </header>
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
                    viewSwitcher={overviewViewSwitcher}
                  />
                ) : (
                  <>
                    <header className="hub-board-heading">
                      <div className="hub-board-heading-row">
                        <div className="owner-markers">
                          <h4>Open rooms</h4>
                          <MarkerAssessment marker={node.openSet} />
                        </div>
                        {overviewViewSwitcher}
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
                            dropAfter={undefined}
                            dropBefore={undefined}
                            focusedRewardOwnerKey={focusedOwnerKey}
                            interactions={interactions}
                            key={slot.hubSlotKey}
                            onMembershipTransition={continueKeyboardMembershipAfterTransition}
                            pointerDragging={false}
                            ranking={ranking}
                            requiredVisitCount={node.requiredVisitCount}
                            showOrder={false}
                            slot={slot}
                            slotsByKey={slotsByKey}
                            visitOrderInteraction={visitOrderInteraction}
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
            ) : timelineView === 'map' ? (
              <HubMapTimeline
                hubIdentity={hubIdentity}
                interactions={interactions}
                node={node}
                toolbarActions={timelineToolbarActions}
              />
            ) : (
              <HubVisitTimeline
                focusedRewardOwnerKey={focusedOwnerKey}
                interactions={interactions}
                node={node}
                toolbarActions={timelineToolbarActions}
              />
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

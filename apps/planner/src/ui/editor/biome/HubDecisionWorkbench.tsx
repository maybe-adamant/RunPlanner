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
import { SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { HubCompletionHandoff } from './HubCompletionHandoff';
import {
  ClosedHubRoomOption,
  MarkerAssessment,
  membershipControlIn,
  type HubMembershipTransition,
} from './HubMembershipBoard';
import { OpenHubRoomCard } from './HubRoomCards';
import { HubVisitTimeline } from './HubVisitTimeline';
import { RunStateLauncher } from './RunStateSheet';

interface HubDecisionWorkbenchProps {
  readonly frontier: WorkspaceAuthoringFrontier | null;
  readonly initialTab?: WorkspaceHubTab;
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
  interactions,
  node,
}: HubDecisionWorkbenchProps) {
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
  const ranking = reconcileHubBoardRanking({
    authoredVisitOrder: visitOrderInteraction.selectedHubSlotKeys,
    declarationOpenSlotKeys: node.slots.filter((slot) => slot.open).map((slot) => slot.hubSlotKey),
    retainedTailSlotKeys: Object.freeze([]),
  });
  const authoredVisitCount = visitOrderInteraction.selectedHubSlotKeys.length;
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
    hubIdentity,
    requested: requestedTab,
  });
  const activeTab =
    tabState.hubIdentity === hubIdentity && tabState.requested === requestedTab
      ? tabState.active
      : requestedTab;
  const setActiveTab = (tab: WorkspaceHubTab): void =>
    setTabState({ active: tab, hubIdentity, requested: requestedTab });
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

  return (
    <section className="hub-decision-workbench" aria-label="Ephyra Hub">
      <header className="decision-heading">
        <div className="owner-markers">
          <h3 id={`${titleId}-title`}>Ephyra Hub</h3>
          <SemanticOwnerMarker address={node.owner} />
          {node.runState === undefined ? null : <RunStateLauncher launcher={node.runState} />}
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
        {activeTab === 'overview' ? (
          <section className="hub-board" aria-label="Hub room participation">
            <div className="hub-overview-heading">
              <div className="owner-markers">
                <h4>Open rooms</h4>
                <SemanticOwnerMarker address={node.openSet.address} />
                <MarkerAssessment marker={node.openSet} />
              </div>
            </div>
            <p className="fixed-room-state">Open or close the rooms available on this Hub board.</p>
            <div
              aria-label="Hub room set"
              className="hub-overview-room-grid"
              ref={overviewOpenMembershipRegion}
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
          </section>
        ) : null}
        {activeTab === 'timeline' ? (
          <HubVisitTimeline
            focusedRewardOwnerKey={focusedOwnerKey}
            interactions={interactions}
            node={node}
          />
        ) : null}
        {activeTab === 'exit' ? (
          <section className="hub-board" aria-label="Hub exit">
            <HubCompletionHandoff interaction={handoff} node={node} />
          </section>
        ) : null}
      </section>
      <div className="workbench-action-row">
        <button
          className="danger-action"
          data-command={removal.intent.command.kind}
          onClick={() => executeIntent(removal.intent)}
          type="button"
        >
          Remove Hub
        </button>
      </div>
    </section>
  );
}

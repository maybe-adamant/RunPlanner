import { type KeyboardEvent as ReactKeyboardEvent, useRef, useState } from 'react';

import { semanticAddressKey } from '@run-planner/engine/authored-project';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceHubDecisionNode,
  type WorkspaceHubTab,
  type WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import { useFindingAnchor } from '@planner/ui/feedback/useFindingTarget';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';
import { HubOverview } from './HubOverview';
import { HubTimeline } from './HubTimeline';
import { RunStateLauncher } from './RunStateSheet';
import { hintProps } from '@planner/ui/controls/hint';

interface HubDecisionWorkbenchProps {
  readonly initialTab?: WorkspaceHubTab;
  /** The Timeline segment an explicit open asked for, applied once per navigation. */
  readonly initialSegment?: number;
  /** Reapply a finding-owned tab request even when the requested tab is unchanged. */
  readonly navigationRevision?: number;
  readonly findingNavigationRevision?: number;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly node: WorkspaceHubDecisionNode;
}

const hubWorkbenchTabs: readonly {
  readonly key: WorkspaceHubTab;
  readonly label: string;
  readonly shown: string;
}[] = Object.freeze([
  Object.freeze({ key: 'overview', label: 'Hub Overview', shown: 'Overview' }),
  Object.freeze({ key: 'timeline', label: 'Hub Timeline', shown: 'Timeline' }),
]);

function domId(value: string): string {
  return value.replaceAll(/[^A-Za-z0-9_-]/g, '-');
}

export function HubDecisionWorkbench({
  initialTab,
  initialSegment,
  findingNavigationRevision,
  navigationRevision,
  interactions,
  node,
}: HubDecisionWorkbenchProps) {
  const findingAnchor = useFindingAnchor();
  const hubTarget = findingAnchor(node.owner);
  const hubTargetProps = {
    'data-selected-finding': hubTarget['data-selected-finding'],
    'data-semantic-owner': hubTarget['data-semantic-owner'],
    id: hubTarget.id,
    ref: hubTarget.ref,
  };
  const executeIntent = useCommandIntent();
  const titleId = `hub-${domId(node.marker.focusKey)}`;
  const actionOrderInteraction = requireWorkspaceInteraction(
    interactions.hubActionOrders,
    workspaceInteractionKey(node.owner),
  );
  const resetBoard = requireWorkspaceInteraction(
    interactions.hubBoardResets,
    workspaceInteractionKey(node.owner),
  );
  const tabList = useRef<HTMLElement>(null);
  const requestedTab = initialTab ?? 'overview';
  const hubIdentity = semanticAddressKey(node.owner);
  const [tabState, setTabState] = useState({
    active: requestedTab,
    findingNavigationRevision,
    navigationRevision,
    hubIdentity,
    requested: requestedTab,
  });
  const findingCleared =
    tabState.findingNavigationRevision !== undefined &&
    findingNavigationRevision === undefined &&
    tabState.navigationRevision === navigationRevision;
  if (
    tabState.hubIdentity !== hubIdentity ||
    tabState.navigationRevision !== navigationRevision ||
    tabState.requested !== requestedTab ||
    tabState.findingNavigationRevision !== findingNavigationRevision
  ) {
    setTabState({
      active:
        tabState.hubIdentity === hubIdentity && findingCleared ? tabState.active : requestedTab,
      findingNavigationRevision,
      navigationRevision,
      hubIdentity,
      requested: requestedTab,
    });
  }
  const activeTab = tabState.active;
  const setActiveTab = (tab: WorkspaceHubTab): void =>
    setTabState({
      active: tab,
      navigationRevision,
      findingNavigationRevision,
      hubIdentity,
      requested: requestedTab,
    });

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
  const resetVisitsControl = (
    <button
      className="danger-action action-compact"
      disabled={
        hubTarget.inert ||
        !actionOrderInteraction.contextReached ||
        actionOrderInteraction.selectedHubSlotKeys.length === 0
      }
      onClick={() => executeIntent(resetBoard.visitsIntent)}
      {...hintProps(
        !hubTarget.inert && !actionOrderInteraction.contextReached
          ? candidateWaitingHint
          : undefined,
      )}
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
      <header className="room-head-card">
        <div className="room-head-identity">
          <h3 className="room-title-name" id={`${titleId}-title`}>
            Ephyra Hub
          </h3>
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
              aria-label={tab.label}
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
              {tab.shown}
            </button>
          ))}
        </nav>
        <div className="room-workbench-tab-utility owner-markers">
          {node.runState === undefined ? null : <RunStateLauncher launcher={node.runState} />}
        </div>
      </div>
      <section
        aria-labelledby={`${titleId}-tab-${activeTab}`}
        className="hub-workbench-tab-panel"
        id={`${titleId}-tabpanel`}
        role="tabpanel"
      >
        <div className="hub-workbench-view">
          {activeTab === 'overview' ? (
            <HubOverview
              hubIdentity={hubIdentity}
              interactions={interactions}
              node={node}
              resetControl={resetBoardControl}
            />
          ) : (
            <HubTimeline
              hubIdentity={hubIdentity}
              {...(initialSegment === undefined || navigationRevision === undefined
                ? {}
                : { requestedSegment: { segment: initialSegment, revision: navigationRevision } })}
              resetControl={resetVisitsControl}
              interactions={interactions}
              locked={hubTarget.inert}
              node={node}
            />
          )}
        </div>
      </section>
    </section>
  );
}

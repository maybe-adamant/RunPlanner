import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import {
  workspaceInteractionKey,
  type WorkspaceDoorContract,
  type WorkspaceInteractionCatalog,
  type WorkspaceLocalVisitDecision,
  type WorkspaceRoomSummary,
  type WorkspaceRoomActions,
  type WorkspaceRoomLifecycleBoundary,
  type WorkspaceRoomTab,
  type WorkspaceRunStateLauncher,
} from '@planner/projections/structured-workspace';
import { SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';
import { RunStateLauncher } from './RunStateSheet';
import { AnomalyClearedControl } from './OccurrenceRoomFeatures';
import { RoomActionsWorkbench } from './OccurrenceRoomActions';
import { DirectRoomWorkbench, IncomingRewardOverview } from './OccurrenceDirectRoomWorkbench';

interface OccurrenceWorkbenchProps {
  readonly incomingDoor?: WorkspaceDoorContract;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly localVisit?: WorkspaceLocalVisitDecision;
  readonly room: WorkspaceRoomSummary;
  readonly runState?: WorkspaceRunStateLauncher;
  readonly initialTab?: WorkspaceRoomTab;
  readonly doors?: ReactNode;
  /** Exact room-owned controls available before an optional lifecycle action exists. */
  readonly renderRoomOverviewContent?: () => ReactNode;
  /** Exact room-owned additions to ordinary lifecycle rows. */
  readonly renderRoomActionRowContent?: (row: WorkspaceRoomActions['rows'][number]) => ReactNode;
  /** Exact room-owned additions to ordinary lifecycle boundaries. */
  readonly renderLifecycleBoundaryContent?: (boundary: WorkspaceRoomLifecycleBoundary) => ReactNode;
  /** Exact room-owned optional interaction shown before its authored action exists. */
  readonly renderOptionalRoomActionContent?: () => ReactNode;
}

/** A room-local editor that consumes the structured workspace only. */
export function OccurrenceWorkbench({
  doors,
  incomingDoor,
  initialTab,
  interactions,
  localVisit,
  room,
  renderRoomActionRowContent,
  renderLifecycleBoundaryContent,
  renderOptionalRoomActionContent,
  renderRoomOverviewContent,
  runState,
}: OccurrenceWorkbenchProps) {
  const requestedTab = initialTab ?? 'overview';
  const roomIdentity = workspaceInteractionKey(room.address);
  const [tabState, setTabState] = useState({
    active: requestedTab,
    roomIdentity,
    requested: requestedTab,
  });
  const activeTab =
    tabState.roomIdentity === roomIdentity && tabState.requested === requestedTab
      ? tabState.active
      : requestedTab;
  const setActiveTab = (tab: WorkspaceRoomTab): void =>
    setTabState({ active: tab, roomIdentity, requested: requestedTab });
  const idPrefix = `occurrence-${room.occurrenceId}`;
  const tabId = (tab: WorkspaceRoomTab): string => `${idPrefix}-tab-${tab}`;
  const panelId = `${idPrefix}-panel`;
  const tabRefs = useRef<Partial<Record<WorkspaceRoomTab, HTMLButtonElement | null>>>({});
  const tabOrder: WorkspaceRoomTab[] = [
    'overview',
    ...(room.workbench.kind === 'ship'
      ? room.workbench.phases.map((_phase, index) =>
          index === 0
            ? ('shipIntroActions' as const)
            : index === 1
              ? ('shipCombat1Actions' as const)
              : ('shipCombat2Actions' as const),
        )
      : ['actions' as const]),
    ...(room.workbench.kind === 'ship' && room.workbench.repairRows.length > 0
      ? (['shipInactiveRepair'] as const)
      : []),
    'doors',
  ];
  const onTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, tab: WorkspaceRoomTab) => {
    const currentIndex = tabOrder.indexOf(tab);
    if (currentIndex < 0) return;
    let nextIndex: number | undefined;
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % tabOrder.length;
        break;
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + tabOrder.length) % tabOrder.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabOrder.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const nextTab = tabOrder[nextIndex];
    if (nextTab === undefined) return;
    setActiveTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  };
  const tabButton = (tab: WorkspaceRoomTab, label: string, key?: string) => (
    <button
      aria-controls={panelId}
      aria-selected={activeTab === tab}
      className="room-workbench-tab"
      id={tabId(tab)}
      key={key ?? tab}
      onClick={() => setActiveTab(tab)}
      onKeyDown={(event) => onTabKeyDown(event, tab)}
      ref={(element) => {
        tabRefs.current[tab] = element;
      }}
      role="tab"
      tabIndex={activeTab === tab ? 0 : -1}
      type="button"
    >
      {label}
    </button>
  );
  const heading = `Entering ${room.label}`;
  const tabRunState = room.runStateByTab[activeTab];

  return (
    <article className="room-card biome-occurrence-workbench">
      <header className="room-card-heading">
        <h3 aria-label={heading}>{heading}</h3>
        <div className="owner-markers">
          <SemanticOwnerMarker address={room.address} />
          {runState === undefined ? null : <RunStateLauncher launcher={runState} />}
        </div>
      </header>
      <nav aria-label="Room workbench" className="room-workbench-tabs" role="tablist">
        {tabButton('overview', 'Room Overview')}
        {room.workbench.kind === 'ship'
          ? room.workbench.phases.map((phase, index) => {
              const tab: WorkspaceRoomTab =
                index === 0
                  ? 'shipIntroActions'
                  : index === 1
                    ? 'shipCombat1Actions'
                    : 'shipCombat2Actions';
              return tabButton(tab, `${phase.label} Timeline`, phase.key);
            })
          : tabButton('actions', 'Room Timeline')}
        {room.workbench.kind === 'ship' && room.workbench.repairRows.length > 0
          ? tabButton('shipInactiveRepair', 'Inactive Actions')
          : null}
        {tabButton('doors', 'Room Doors')}
      </nav>
      <section
        aria-label={activeTab === 'doors' ? 'Room Doors' : 'Room workbench panel'}
        aria-labelledby={tabId(activeTab)}
        className="room-workbench-panel"
        id={panelId}
        role="tabpanel"
      >
        {tabRunState === undefined ? null : (
          <div className="room-tab-utility-bar">
            <RunStateLauncher launcher={tabRunState} />
          </div>
        )}
        {activeTab === 'overview' ? (
          <>
            <IncomingRewardOverview incomingDoor={incomingDoor} />
            <AnomalyClearedControl room={room} />
            <DirectRoomWorkbench
              idPrefix={idPrefix}
              interactions={interactions}
              {...(localVisit === undefined ? {} : { localVisit })}
              room={room}
              {...(renderRoomActionRowContent === undefined ? {} : { renderRoomActionRowContent })}
              {...(renderLifecycleBoundaryContent === undefined
                ? {}
                : { renderLifecycleBoundaryContent })}
              {...(renderRoomOverviewContent === undefined ? {} : { renderRoomOverviewContent })}
              view="overview"
            />
          </>
        ) : activeTab === 'doors' ? (
          (doors ?? <p className="fixed-room-state">No outgoing doors for this room.</p>)
        ) : activeTab === 'shipInactiveRepair' && room.workbench.kind === 'ship' ? (
          <RoomActionsWorkbench
            {...(room.workbench.roomActions === undefined
              ? {}
              : { actions: room.workbench.roomActions })}
            interactions={interactions}
            ship={{
              occurrence: room.address,
              phases: [],
              repairRows: room.workbench.repairRows,
            }}
          />
        ) : room.workbench.kind === 'ship' ? (
          <DirectRoomWorkbench
            idPrefix={idPrefix}
            interactions={interactions}
            room={room}
            {...(renderRoomActionRowContent === undefined ? {} : { renderRoomActionRowContent })}
            {...(renderLifecycleBoundaryContent === undefined
              ? {}
              : { renderLifecycleBoundaryContent })}
            {...(() => {
              const shipPhaseKey =
                activeTab === 'shipIntroActions'
                  ? room.workbench.phases[0]?.key
                  : activeTab === 'shipCombat1Actions'
                    ? room.workbench.phases[1]?.key
                    : room.workbench.phases[2]?.key;
              return shipPhaseKey === undefined ? {} : { shipPhaseKey };
            })()}
            view="actions"
          />
        ) : (
          <DirectRoomWorkbench
            idPrefix={idPrefix}
            interactions={interactions}
            room={room}
            {...(renderRoomActionRowContent === undefined ? {} : { renderRoomActionRowContent })}
            {...(renderLifecycleBoundaryContent === undefined
              ? {}
              : { renderLifecycleBoundaryContent })}
            {...(renderOptionalRoomActionContent === undefined
              ? {}
              : { renderOptionalRoomActionContent })}
            view="actions"
          />
        )}
      </section>
    </article>
  );
}

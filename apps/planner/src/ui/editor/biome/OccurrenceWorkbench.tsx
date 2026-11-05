import { TimelineActionDeleteButton } from './TimelineActionDeleteButton';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceDoorContract,
  type WorkspaceInteractionCatalog,
  type WorkspaceLocalVisitDecision,
  type WorkspacePlanEndRelation,
  type WorkspaceRoomSummary,
  type WorkspaceShipPhasePresentation,
  type WorkspaceRoomActions,
  type WorkspaceRoomLifecycleBoundary,
  type WorkspaceRoomTab,
  type WorkspaceRunStateLauncher,
} from '@planner/projections/structured-workspace';
import { useFindingAnchor, useFindingMark } from '@planner/ui/feedback/useFindingTarget';
import { RoomMapLauncher } from '@planner/ui/room-maps/RoomMapDialog';
import { RunStateLauncher } from './RunStateSheet';
import { RoomActionsWorkbench, type TimelineBoundaryContent } from './OccurrenceRoomActions';
import { DirectRoomWorkbench, IncomingRewardSummary } from './OccurrenceDirectRoomWorkbench';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { roomKindIcon } from './roomIcon';
import { FieldsLayoutWorkbench } from './locals/FieldsWorkbench';
import { SideRoomsWorkbench } from './locals/SideRoomsWorkbench';
import { TimelineLegend } from './TimelineLegend';
import type { TimelineDoors, TimelineDoorsContent } from './TimelineDoors';
import { createRouteAddress } from '@run-planner/engine/authored-project';

interface OccurrenceWorkbenchProps {
  readonly headerActions?: ReactNode;
  /** The door the room was entered through, for its reward on the title line. */
  readonly incomingDoor?: WorkspaceDoorContract;
  /** Entry identity is an Overview-only biome authoring control. */
  readonly entryIdentity?: ReactNode;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly localVisit?: WorkspaceLocalVisitDecision;
  readonly initialSideRoomSlotKey?: string;
  readonly room: WorkspaceRoomSummary;
  readonly runState?: WorkspaceRunStateLauncher;
  readonly initialTab?: WorkspaceRoomTab;
  /** Reapply a finding-owned tab request even when the requested tab is unchanged. */
  readonly navigationRevision?: number;
  readonly findingNavigationRevision?: number;
  /** The room's doors on its Timeline. */
  readonly timelineDoors?: TimelineDoorsContent;
  /** Navigation landed on a door owner, so the Doors open row opens. */
  readonly doorsRequested?: boolean;
  /** The room's place against the plan end; past it, every panel is read-only. */
  readonly planEndRelation?: WorkspacePlanEndRelation;
  /** The action that moves the plan's end here, where no last row holds it. */
  readonly pastEndAction?: ReactNode;
  /** Exact room-owned additions to ordinary lifecycle rows. */
  readonly renderRoomActionRowContent?: (row: WorkspaceRoomActions['rows'][number]) => ReactNode;
  /** Exact room-owned additions to ordinary lifecycle boundaries. */
  readonly renderLifecycleBoundaryContent?: (
    boundary: WorkspaceRoomLifecycleBoundary,
  ) => TimelineBoundaryContent | undefined;
}

/** A room-local editor that consumes the structured workspace only. */
export function OccurrenceWorkbench({
  incomingDoor,
  headerActions,
  doorsRequested = false,
  timelineDoors,
  pastEndAction,
  entryIdentity,
  initialTab,
  findingNavigationRevision,
  navigationRevision,
  interactions,
  localVisit,
  initialSideRoomSlotKey,
  room,
  renderRoomActionRowContent,
  renderLifecycleBoundaryContent,
  runState,
  planEndRelation,
}: OccurrenceWorkbenchProps) {
  const findingAnchor = useFindingAnchor();
  const executeIntent = useCommandIntent();
  const requestedTab = initialTab ?? 'overview';
  const roomIdentity = workspaceInteractionKey(room.address);
  const [tabState, setTabState] = useState({
    active: requestedTab,
    findingNavigationRevision,
    navigationRevision,
    roomIdentity,
    requested: requestedTab,
  });
  const findingCleared =
    tabState.findingNavigationRevision !== undefined &&
    findingNavigationRevision === undefined &&
    tabState.navigationRevision === navigationRevision;
  if (
    tabState.roomIdentity !== roomIdentity ||
    tabState.navigationRevision !== navigationRevision ||
    tabState.requested !== requestedTab ||
    tabState.findingNavigationRevision !== findingNavigationRevision
  ) {
    setTabState({
      active:
        tabState.roomIdentity === roomIdentity && findingCleared ? tabState.active : requestedTab,
      findingNavigationRevision,
      navigationRevision,
      roomIdentity,
      requested: requestedTab,
    });
  }
  const selectedTab = tabState.active;
  // The doors stand open unless collapsed in this room; navigation to a door
  // reopens them, and a finding inside keeps them open.
  const [doorsState, setDoorsState] = useState({
    collapsed: false,
    findingNavigationRevision,
    navigationRevision,
    roomIdentity,
  });
  if (
    doorsState.roomIdentity !== roomIdentity ||
    doorsState.navigationRevision !== navigationRevision ||
    doorsState.findingNavigationRevision !== findingNavigationRevision
  ) {
    setDoorsState({
      collapsed:
        !doorsRequested && doorsState.roomIdentity === roomIdentity && doorsState.collapsed,
      findingNavigationRevision,
      navigationRevision,
      roomIdentity,
    });
  }
  const findingMark = useFindingMark();
  const doorsHoldFindings = (timelineDoors?.findingOwners ?? []).some(
    (owner) => findingMark(owner)['data-has-findings'],
  );
  const doors: TimelineDoors | undefined =
    timelineDoors === undefined
      ? undefined
      : {
          ...timelineDoors,
          noun: 'door' as const,
          detailId: `occurrence-${room.occurrenceId}-doors-detail`,
          expanded: doorsHoldFindings || !doorsState.collapsed,
          ...(doorsHoldFindings
            ? {}
            : {
                onExpandedChange: (expanded: boolean) =>
                  setDoorsState({ ...doorsState, collapsed: !expanded }),
              }),
        };
  const setActiveTab = (tab: WorkspaceRoomTab): void =>
    setTabState({
      active: tab,
      navigationRevision,
      findingNavigationRevision,
      roomIdentity,
      requested: requestedTab,
    });
  const idPrefix = `occurrence-${room.occurrenceId}`;
  const tabId = (tab: WorkspaceRoomTab): string => `${idPrefix}-tab-${tab}`;
  const panelId = `${idPrefix}-panel`;
  const tabRefs = useRef<Partial<Record<WorkspaceRoomTab, HTMLButtonElement | null>>>({});
  const tabOrder: WorkspaceRoomTab[] = [
    'overview',
    ...(localVisit === undefined ? [] : (['sideRooms'] as const)),
    ...(room.workbench.kind === 'fields' ? (['layout'] as const) : []),
    ...(room.workbench.kind === 'ship'
      ? room.workbench.phases.map((phase) => phase.tab)
      : ['actions' as const]),
    ...(room.workbench.kind === 'ship' && room.workbench.repairRows.length > 0
      ? (['shipInactiveRepair'] as const)
      : []),
  ];
  const activeTab = tabOrder.includes(selectedTab) ? selectedTab : 'overview';
  const onTabKeyDown = (event: ReactKeyboardEvent<HTMLElement>, tab: WorkspaceRoomTab) => {
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
  // The tab shows its short name; its accessible name stays the full one.
  const tabButton = (tab: WorkspaceRoomTab, label: string, key?: string, shown?: string) => (
    <button
      {...(shown === undefined ? {} : { 'aria-label': label })}
      aria-controls={panelId}
      aria-selected={activeTab === tab}
      className="room-workbench-tab"
      id={tabId(tab)}
      key={key ?? tab}
      onClick={() => setActiveTab(tab)}
      data-room-tab={tab}
      ref={(element) => {
        tabRefs.current[tab] = element;
      }}
      role="tab"
      tabIndex={activeTab === tab ? 0 : -1}
      type="button"
    >
      {shown ?? label}
    </button>
  );
  const heading = room.label;
  const tabRunState = room.runStateByTab[activeTab];
  const showTimelineLegend =
    activeTab === 'actions' ||
    activeTab === 'shipIntroActions' ||
    activeTab === 'shipCombat1Actions' ||
    activeTab === 'shipCombat2Actions';
  const shipPhaseView = (): {
    readonly kind: 'shipPhase';
    readonly phase: WorkspaceShipPhasePresentation;
    readonly phases: readonly WorkspaceShipPhasePresentation[];
  } => {
    const phase =
      room.workbench.kind === 'ship'
        ? room.workbench.phases.find((candidate) => candidate.tab === activeTab)
        : undefined;
    if (phase === undefined) throw new Error(`No Ship phase for timeline tab ${activeTab}`);
    return {
      kind: 'shipPhase',
      phase,
      phases: room.workbench.kind === 'ship' ? room.workbench.phases : [],
    };
  };
  const renderDirectRoomWorkbench = (
    view:
      | 'overview'
      | 'actions'
      | {
          readonly kind: 'shipPhase';
          readonly phase: WorkspaceShipPhasePresentation;
          /** Every Ship phase, to name the phase a move crosses into. */
          readonly phases: readonly WorkspaceShipPhasePresentation[];
        },
  ): ReactNode => (
    <DirectRoomWorkbench
      {...(view === 'overview' ? {} : { doors })}
      idPrefix={idPrefix}
      interactions={interactions}
      room={room}
      {...(renderRoomActionRowContent === undefined ? {} : { renderRoomActionRowContent })}
      {...(renderLifecycleBoundaryContent === undefined ? {} : { renderLifecycleBoundaryContent })}
      view={view}
    />
  );

  return (
    <article
      className="room-card biome-occurrence-workbench"
      {...findingAnchor(
        room.address,
        // A room past the plan end stays browsable: its panels are read-only on
        // their own, and it keeps the action that moves the end here.
        planEndRelation === 'pastEnd'
          ? { readinessOwner: createRouteAddress(room.address.routeKey) }
          : {},
      )}
      tabIndex={-1}
    >
      <header className="room-head-card">
        <div className="room-head-identity">
          <h3 aria-label={heading} className="room-title-name">
            <ArtworkIcon className="room-title-icon" source={roomKindIcon(room.roomIcon)} />
            {heading}
          </h3>
          <IncomingRewardSummary incomingDoor={incomingDoor} />
          <RoomMapLauncher gameName={room.gameName} hostId={roomIdentity} title={room.label} />
        </div>
      </header>
      <div className="room-workbench-tab-row">
        <nav
          aria-label="Room workbench"
          className="room-workbench-tabs"
          onKeyDown={(event) => {
            const tab = (event.target as HTMLElement).dataset.roomTab as
              WorkspaceRoomTab | undefined;
            if (tab !== undefined) onTabKeyDown(event, tab);
          }}
          role="tablist"
        >
          {tabButton('overview', 'Room Overview', undefined, 'Overview')}
          {localVisit === undefined ? null : tabButton('sideRooms', 'Side Rooms')}
          {room.workbench.kind === 'fields'
            ? tabButton('layout', 'Room Layout', undefined, 'Layout')
            : null}
          {room.workbench.kind === 'ship'
            ? // Each Ship phase is one Timeline tab, named by its phase.
              room.workbench.phases.map((phase) =>
                tabButton(phase.tab, `${phase.label} Timeline`, phase.key, phase.label),
              )
            : tabButton('actions', 'Room Timeline', undefined, 'Timeline')}
          {room.workbench.kind === 'ship' && room.workbench.repairRows.length > 0
            ? tabButton('shipInactiveRepair', 'Inactive Actions')
            : null}
        </nav>
        <div className="room-workbench-tab-utility">
          {headerActions}
          {showTimelineLegend ? <TimelineLegend /> : null}
          {runState === undefined ? null : <RunStateLauncher launcher={runState} />}
          {tabRunState === undefined ? null : <RunStateLauncher launcher={tabRunState} />}
        </div>
      </div>
      <section
        aria-label="Room workbench panel"
        aria-labelledby={tabId(activeTab)}
        className="room-workbench-panel"
        id={panelId}
        role="tabpanel"
      >
        <div
          className="room-workbench-panel-content"
          // Past the plan end the room is read-only but for its plan-end action.
          inert={planEndRelation === 'pastEnd'}
        >
          {activeTab === 'overview' ? (
            <div className="room-overview-workbench">
              {entryIdentity}
              {renderDirectRoomWorkbench('overview')}
            </div>
          ) : activeTab === 'sideRooms' && localVisit !== undefined ? (
            <SideRoomsWorkbench
              interactions={interactions}
              localVisit={localVisit}
              parentGameName={room.gameName}
              {...(initialSideRoomSlotKey === undefined
                ? {}
                : { selectedSlotKey: initialSideRoomSlotKey })}
              title={room.label}
              {...(findingNavigationRevision === undefined ? {} : { findingNavigationRevision })}
            />
          ) : activeTab === 'layout' && room.workbench.kind === 'fields' ? (
            <FieldsLayoutWorkbench
              gameName={room.gameName}
              hostId={roomIdentity}
              interactions={interactions}
              room={room.workbench.fields}
              title={room.label}
            />
          ) : activeTab === 'shipInactiveRepair' && room.workbench.kind === 'ship' ? (
            <RoomActionsWorkbench
              {...(room.workbench.roomActions === undefined
                ? {}
                : { actions: room.workbench.roomActions })}
              interactions={interactions}
              mode={{ kind: 'shipRepairs', rows: room.workbench.repairRows }}
            />
          ) : room.workbench.kind === 'ship' ? (
            renderDirectRoomWorkbench(shipPhaseView())
          ) : (
            renderDirectRoomWorkbench('actions')
          )}
          {showTimelineLegend && room.placementRepairs !== undefined ? (
            <section aria-label="Placement repairs">
              {room.placementRepairs.map((repair) => (
                <div className="room-placement-repair" key={repair.proposalKey}>
                  <span>{repair.label}</span>
                  <TimelineActionDeleteButton
                    enabled
                    explanation="Remove this delivery and its reward details while keeping the source purchase."
                    label={repair.label}
                    onRemove={() =>
                      executeIntent(
                        requireWorkspaceInteraction(
                          interactions.roomActions,
                          workspaceInteractionKey(room.address),
                        ).intentFor(repair.proposalKey),
                      )
                    }
                  />
                </div>
              ))}
            </section>
          ) : null}
        </div>
        {pastEndAction}
      </section>
    </article>
  );
}

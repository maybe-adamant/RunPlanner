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
import { useFindingAnchor } from '@planner/ui/feedback/useFindingTarget';
import { RoomMapLauncher } from '@planner/ui/room-maps/RoomMapDialog';
import { RunStateLauncher } from './RunStateSheet';
import { RoomActionsWorkbench, type TimelineBoundaryContent } from './OccurrenceRoomActions';
import { DirectRoomWorkbench, IncomingRewardSummary } from './OccurrenceDirectRoomWorkbench';
import { FieldsLayoutWorkbench } from './locals/FieldsWorkbench';
import { SideRoomsWorkbench } from './locals/SideRoomsWorkbench';
import { RewardWheelWorkbench } from './locals/RewardWheelWorkbench';
import { TimelineLegend } from './TimelineLegend';
import { planEndLabel } from './planEndCopy';
import { createRouteAddress } from '@run-planner/engine/authored-project';

interface OccurrenceWorkbenchProps {
  readonly headerActions?: ReactNode;
  /** Entry identity is an Overview-only biome authoring control. */
  readonly entryIdentity?: ReactNode;
  readonly incomingDoor?: WorkspaceDoorContract;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly localVisit?: WorkspaceLocalVisitDecision;
  readonly initialSideRoomSlotKey?: string;
  readonly room: WorkspaceRoomSummary;
  readonly runState?: WorkspaceRunStateLauncher;
  readonly initialTab?: WorkspaceRoomTab;
  /** Reapply a finding-owned tab request even when the requested tab is unchanged. */
  readonly navigationRevision?: number;
  readonly findingNavigationRevision?: number;
  readonly doors?: ReactNode;
  /** The room's place against the plan end; past it, every panel but Doors is read-only. */
  readonly planEndRelation?: WorkspacePlanEndRelation;
  /** Exact room-owned additions to ordinary lifecycle rows. */
  readonly renderRoomActionRowContent?: (row: WorkspaceRoomActions['rows'][number]) => ReactNode;
  /** Exact room-owned additions to ordinary lifecycle boundaries. */
  readonly renderLifecycleBoundaryContent?: (
    boundary: WorkspaceRoomLifecycleBoundary,
  ) => TimelineBoundaryContent | undefined;
}

/** A room-local editor that consumes the structured workspace only. */
export function OccurrenceWorkbench({
  headerActions,
  doors,
  entryIdentity,
  incomingDoor,
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
      ? room.workbench.phases.flatMap((phase) =>
          phase.wheelTab === undefined ? [phase.tab] : [phase.tab, phase.wheelTab],
        )
      : ['actions' as const]),
    ...(room.workbench.kind === 'ship' && room.workbench.repairRows.length > 0
      ? (['shipInactiveRepair'] as const)
      : []),
    'doors',
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
  const wheelPhase =
    room.workbench.kind === 'ship'
      ? room.workbench.phases.find((phase) => phase.wheelTab === activeTab)
      : undefined;
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
        // their own, and its Doors keep the action that moves the end here.
        planEndRelation === 'pastEnd'
          ? { readinessOwner: createRouteAddress(room.address.routeKey) }
          : {},
      )}
      tabIndex={-1}
    >
      <header className="room-card-heading">
        <div className="room-heading-identity">
          <h3 aria-label={heading}>{heading}</h3>
          <IncomingRewardSummary incomingDoor={incomingDoor} />
          {planEndRelation === undefined ? null : (
            <span className="plan-end-pill" data-plan-end={planEndRelation}>
              {planEndLabel(planEndRelation)}
            </span>
          )}
        </div>
        <div className="owner-markers">
          {headerActions}
          <RoomMapLauncher gameName={room.gameName} hostId={roomIdentity} title={room.label} />
          {runState === undefined ? null : <RunStateLauncher launcher={runState} />}
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
            ? room.workbench.phases.flatMap((phase) => [
                <span
                  aria-hidden="true"
                  className="room-workbench-tab-group"
                  key={`${phase.key}-group`}
                >
                  <span className="room-workbench-tab-divider" />
                  {`${phase.label}:`}
                </span>,
                tabButton(phase.tab, `${phase.label} Timeline`, phase.key, 'Timeline'),
                ...(phase.wheelTab === undefined
                  ? []
                  : [
                      <span
                        aria-hidden="true"
                        className="room-workbench-tab-dot"
                        key={`${phase.key}-dot`}
                      >
                        ·
                      </span>,
                      tabButton(
                        phase.wheelTab,
                        `${phase.label} Wheels`,
                        `${phase.key}-wheels`,
                        'Wheels',
                      ),
                    ]),
              ])
            : tabButton('actions', 'Room Timeline', undefined, 'Timeline')}
          {room.workbench.kind === 'ship' && room.workbench.repairRows.length > 0 ? (
            <>
              <span aria-hidden="true" className="room-workbench-tab-group">
                <span className="room-workbench-tab-divider" />
              </span>
              {tabButton('shipInactiveRepair', 'Inactive Actions')}
            </>
          ) : null}
          {room.workbench.kind === 'ship' ? (
            <span aria-hidden="true" className="room-workbench-tab-group">
              <span className="room-workbench-tab-divider" />
            </span>
          ) : null}
          {tabButton('doors', 'Room Doors', undefined, 'Doors')}
        </nav>
        {!showTimelineLegend && tabRunState === undefined ? null : (
          <div className="room-workbench-tab-utility">
            {showTimelineLegend ? <TimelineLegend /> : null}
            {tabRunState === undefined ? null : <RunStateLauncher launcher={tabRunState} />}
          </div>
        )}
      </div>
      <section
        aria-label={activeTab === 'doors' ? 'Room Doors' : 'Room workbench panel'}
        aria-labelledby={tabId(activeTab)}
        className="room-workbench-panel"
        id={panelId}
        role="tabpanel"
      >
        <div
          className="room-workbench-panel-content"
          // Past the plan end the room is read-only; its Doors panel keeps the plan-end action.
          inert={planEndRelation === 'pastEnd' && activeTab !== 'doors'}
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
          ) : activeTab === 'doors' ? (
            (doors ?? <p className="fixed-room-state">No outgoing doors for this room.</p>)
          ) : wheelPhase?.wheel !== undefined ? (
            <RewardWheelWorkbench
              interactions={interactions}
              occurrence={room.address}
              {...(wheelPhase.wheelRerolls === undefined
                ? {}
                : { rerolls: wheelPhase.wheelRerolls })}
              wheel={wheelPhase.wheel}
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
      </section>
    </article>
  );
}

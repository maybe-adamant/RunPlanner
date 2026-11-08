import { TimelineActionDeleteButton } from './TimelineActionDeleteButton';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
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
import { useFindingAnchor, useFindingKeys } from '@planner/ui/feedback/useFindingTarget';
import { doorEditorChosen } from '@planner/state/editorSessionSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';
import { RunStateLauncher } from './RunStateSheet';
import { RoomActionsWorkbench, type TimelineBoundaryContent } from './OccurrenceRoomActions';
import { DirectRoomWorkbench, IncomingRewardSummary } from './OccurrenceDirectRoomWorkbench';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { roomKindIcon } from './roomIcon';
import { SideDoorSpawns } from './locals/SideDoorSpawns';
import { TimelineLegend } from './TimelineLegend';
import type { TimelineDoors, TimelineDoorsContent } from './TimelineDoors';
import { doorChipsAt } from './doorSummary';
import { createRouteAddress } from '@run-planner/engine/authored-project';
import { roomMapCalibrations } from '@planner/ui/room-maps/roomMapCalibration';
import { RoomMapColumn, type RoomMapStage } from './room-map/RoomMapColumn';
import { RoomMapHighlightScope } from './room-map/RoomMapHighlightScope';
import { roomMapPlacements } from './room-map/roomMapPlacements';

/**
 * The map's stage for a Timeline row: before Doors open the doors are closed,
 * from it they are open, from the room's last row it is left. Rows outside the
 * Timeline leave the map as it is.
 */
function timelineMapRow(target: Element): HTMLElement | undefined {
  return (
    target.closest<HTMLElement>('.room-action-list[aria-label="Room timeline"] > li') ?? undefined
  );
}

function timelineMapStage(row: Element): RoomMapStage | undefined {
  const list = row.parentElement;
  if (list == null) return undefined;
  const rows = [...list.children];
  const index = rows.indexOf(row);
  const leave = rows.findIndex((item) => item.classList.contains('timeline-leave-row'));
  const open = rows.findIndex((item) =>
    item.matches('[data-doors-open], [data-boundary-kind="cleanup"]'),
  );
  if (leave >= 0 && index >= leave) return 'left';
  if (open >= 0 && index >= open) return 'open';
  return 'closed';
}

/** The room's latest door press (an unlock or a reroll) at or before the row. */
function timelineDoorStep(row: Element, stepKeys: ReadonlySet<string>): string | undefined {
  const rows = [...(row.parentElement?.children ?? [])];
  for (let index = rows.indexOf(row); index >= 0; index -= 1) {
    const key = (rows[index] as HTMLElement).dataset.roomActionKey;
    if (key !== undefined && stepKeys.has(key)) return key;
  }
  return undefined;
}

interface OccurrenceWorkbenchProps {
  readonly headerActions?: ReactNode;
  /** The door the room was entered through, for its reward on the title line. */
  readonly incomingDoor?: WorkspaceDoorContract;
  /** Entry identity is an Overview-only biome authoring control. */
  readonly entryIdentity?: ReactNode;
  readonly interactions: WorkspaceInteractionCatalog;
  /** The main room's side doors, among its Overview spawns. */
  readonly localVisit?: WorkspaceLocalVisitDecision;
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
  /** The room's exit is the authoring frontier: its doors are the next required input. */
  readonly doorsFrontier?: boolean;
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
  doorsFrontier = false,
  timelineDoors,
  pastEndAction,
  entryIdentity,
  initialTab,
  findingNavigationRevision,
  navigationRevision,
  interactions,
  localVisit,
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
  // The door editor stays shut unless it needs attention (a finding inside or
  // on a locked door, or the doors as the next required input) or navigation asks for it. A
  // remembered choice holds until attention it has not seen appears.
  const doorChoice = useAppSelector(
    (state) => state.editorSession.doorEditorChoices?.[roomIdentity],
  );
  const dispatch = useAppDispatch();
  const doorFindingKeys = useFindingKeys(
    timelineDoors?.findingOwners ?? [],
    timelineDoors?.attentionFindings,
  );
  const doorAttention = [...doorFindingKeys, ...(doorsFrontier ? ['frontier'] : [])];
  const currentNavigation = navigationRevision ?? -1;
  const doorsExpanded =
    (doorsRequested &&
      (doorChoice === undefined || doorChoice.navigationRevision !== currentNavigation)) ||
    (doorChoice === undefined
      ? doorAttention.length > 0
      : doorChoice.expanded ||
        doorAttention.some((attention) => !doorChoice.attention.includes(attention)));
  const doors: TimelineDoors | undefined =
    timelineDoors === undefined
      ? undefined
      : {
          ...timelineDoors,
          noun: 'door' as const,
          detailId: `occurrence-${room.occurrenceId}-doors-detail`,
          expanded: doorsExpanded,
          onExpandedChange: (expanded: boolean) =>
            dispatch(
              doorEditorChosen({
                room: roomIdentity,
                choice: {
                  expanded,
                  attention: doorAttention,
                  navigationRevision: currentNavigation,
                },
              }),
            ),
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
  // The Timeline row being worked on sets the map's stage: presentation only, never authored.
  const [mapStage, setMapStage] = useState<{
    readonly roomIdentity: string;
    readonly stage: RoomMapStage;
    /** The door press whose doors the map shows; none shows them as they open. */
    readonly step?: string;
  }>();
  const mapRow = useRef<HTMLElement>(undefined);
  // Leaving the Timeline or the room returns the map to the plan.
  const mapStageShown = activeTab === 'actions' && mapStage?.roomIdentity === roomIdentity;
  if (mapStage !== undefined && !mapStageShown) setMapStage(undefined);
  const shownMapStage = mapStageShown ? mapStage.stage : 'summary';
  const markMapRow = (row: HTMLElement | undefined): void => {
    if (mapRow.current === row) return;
    if (mapRow.current !== undefined) delete mapRow.current.dataset.mapShown;
    if (row !== undefined) row.dataset.mapShown = '';
    mapRow.current = row;
  };
  const workOnTimeline = (event: SyntheticEvent<HTMLElement>): void => {
    const row = timelineMapRow(event.target as Element);
    const stage = row === undefined ? undefined : timelineMapStage(row);
    if (row === undefined || stage === undefined) return;
    markMapRow(row);
    const step = timelineDoorStep(
      row,
      new Set((timelineDoors?.steps ?? []).map((candidate) => candidate.actionKey)),
    );
    if (
      stage !== mapStage?.stage ||
      step !== mapStage.step ||
      mapStage.roomIdentity !== roomIdentity
    )
      setMapStage({ roomIdentity, stage, ...(step === undefined ? {} : { step }) });
  };
  // The doors as they stand at the marked row: the latest press's, else as they open.
  const openChips = timelineDoors?.summary?.chips;
  const stepDoors = mapStageShown
    ? timelineDoors?.steps?.find((candidate) => candidate.actionKey === mapStage.step)?.doors
    : undefined;
  const mapChips =
    openChips === undefined || stepDoors === undefined
      ? openChips
      : doorChipsAt(openChips, stepDoors);
  // The marked row is the one the map reflects; the plan's map marks none.
  const showsMapRow = shownMapStage !== 'summary';
  useEffect(() => {
    if (!showsMapRow && mapRow.current !== undefined) {
      delete mapRow.current.dataset.mapShown;
      mapRow.current = undefined;
    }
  });
  const withRoomMap = (controls: ReactNode): ReactNode =>
    room.map === undefined || roomMapCalibrations[room.gameName] === undefined ? (
      controls
    ) : (
      <RoomMapHighlightScope scope={`${roomIdentity}:${activeTab}`}>
        <div className="room-map-workbench">
          <div className="room-map-columns">
            <div
              className="room-map-controls-column"
              {...(activeTab === 'actions'
                ? { onFocusCapture: workOnTimeline, onPointerDownCapture: workOnTimeline }
                : {})}
            >
              {controls}
            </div>
            <RoomMapColumn
              chips={mapChips}
              flipped={room.layout?.flipped === true}
              gameName={room.gameName}
              map={room.map}
              placements={roomMapPlacements(room)}
              roomIdentity={roomIdentity}
              stage={shownMapStage}
              title={room.label}
            />
          </div>
        </div>
      </RoomMapHighlightScope>
    );
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
      {...(view !== 'overview' || localVisit === undefined
        ? {}
        : {
            spawns: (
              <SideDoorSpawns
                interactions={interactions}
                localVisit={localVisit}
                parentGameName={room.gameName}
                title={room.label}
              />
            ),
          })}
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
            withRoomMap(
              <div className="room-overview-workbench">
                {entryIdentity}
                {renderDirectRoomWorkbench('overview')}
              </div>,
            )
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
            withRoomMap(renderDirectRoomWorkbench('actions'))
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

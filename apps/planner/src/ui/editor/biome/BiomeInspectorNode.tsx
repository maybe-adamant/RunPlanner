import type { ReactNode } from 'react';
import type { SemanticAddress } from '@run-planner/engine/authored-project';
import { useAppDispatch } from '@planner/state/store';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';

import {
  type WorkspaceAuthoringFrontier,
  type WorkspaceDoorNote,
  type WorkspaceHubTab,
  type WorkspaceInteractionCatalog,
  type WorkspaceNode,
  type WorkspaceOccurrenceStageOutgoing,
  type WorkspaceRoomPlanEnd,
  type WorkspaceRoomTab,
} from '@planner/projections/structured-workspace';
import {
  BatchDoorsDetail,
  BatchDoorsRepair,
  BatchExitPicker,
  DoorChips,
  DoorNotes,
  DoorRowsHeader,
} from './DecisionWorkbench';
import { batchDoorChips, batchDoorFindingOwners, batchDoorsStatus } from './doorSummary';
import { HubDecisionWorkbench } from './HubDecisionWorkbench';
import { OccurrenceWorkbench } from './OccurrenceWorkbench';
import { PhantomExitDoor } from './PhantomExitDoor';
import { BossDoorRewardPoolRow } from './OccurrenceDirectRoomWorkbench';
import { useDoorNotes, type DoorNoteMark, type DoorNoteTarget } from './doorNotes';
import {
  inspectorLifecycleBoundaryContent,
  inspectorRoomActionContent,
  StartRoomIdentityEditor,
} from './BiomeInspectorControls';
import { PlanEndAction } from './PlanEndAction';
import { ReadOnlyFindingScope } from '@planner/ui/feedback/useFindingTarget';
import { FixedValueChip } from '@planner/ui/controls/FixedValueChip';
import { DoorsRerollEntry } from './RoomRerolls';
import { roomKindIcon } from './roomIcon';
import { rewardIcon } from '@planner/ui/artwork/rewardIcon';
import { LeaveRow, type TimelineDoorsContent } from './TimelineDoors';
import { BiomeWorkspaceContractError } from './workspaceContract';

type OccurrenceNode = Extract<WorkspaceNode, { readonly kind: 'occurrenceWorkbench' }>;
type BatchNode = Extract<
  WorkspaceNode,
  { readonly kind: 'ordinaryBatch' | 'mixedBatch' | 'takeoverBatch' }
>;

interface BiomeInspectorNodeProps {
  readonly frontier: WorkspaceAuthoringFrontier | null;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly label: string;
  readonly node: WorkspaceNode;
  readonly outgoing?: WorkspaceOccurrenceStageOutgoing;
  readonly outgoingDecision?: BatchNode;
  readonly hubTab?: WorkspaceHubTab;
  readonly roomTab?: WorkspaceRoomTab;
  /** Navigation landed on a door owner, so the room's Doors open row opens. */
  readonly doorsRequested?: boolean;
  readonly sideRoomSlotKey?: string;
  readonly navigationRevision?: number;
  readonly findingNavigationRevision?: number;
  readonly sourceOccurrence?: OccurrenceNode;
  /** The biome lies past the plan end, so its Hub is read-only. */
  readonly pastPlanEnd?: boolean;
  /** Shown at the end of the workbench's title line, such as the plan's next repair. */
  readonly titleAside?: ReactNode;
}

/** The notes beside a room's doors: its batch's, its hidden door's or its boss door's. */
function doorNoteSource(
  node: OccurrenceNode,
  batch: BatchNode | undefined,
  outgoing: WorkspaceOccurrenceStageOutgoing | undefined,
): readonly WorkspaceDoorNote[] {
  if (batch !== undefined) return batch.notes;
  if (outgoing?.kind === 'topologyOwned') return outgoing.notes;
  const store = node.room.bossDoorRewardStore;
  return store === undefined || store.kind === 'editor' ? [] : store.notes;
}

interface RoomDoorsInput {
  readonly batch: BatchNode | undefined;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly markFor: (target: DoorNoteTarget) => DoorNoteMark | undefined;
  readonly node: OccurrenceNode;
  readonly notes: ReactNode;
  readonly outgoing: WorkspaceOccurrenceStageOutgoing | undefined;
  readonly planEnd: WorkspaceRoomPlanEnd | undefined;
}

/**
 * The room's doors on its Timeline, by how it is left: a batch of doors, a
 * fixed room, a Hub or side-room return, or the plan's end. A room left no
 * way (unreached, past the end, no next room) has no last row.
 */
function roomTimelineDoors({
  batch,
  interactions,
  markFor,
  node,
  notes,
  outgoing,
  planEnd,
}: RoomDoorsInput): TimelineDoorsContent | undefined {
  const relation = planEnd?.relation;
  // Past the plan end the doors are dormant; only the action that moves the end stays.
  if (relation === 'pastEnd') return undefined;
  const idPrefix = `occurrence-${node.room.occurrenceId}`;
  const endAction = <PlanEndAction planEnd={planEnd} />;
  const leaveRow = (
    label: string,
    value: ReactNode,
    status?: string,
    anchorOwner?: SemanticAddress,
  ) =>
    relation === 'end' ? (
      // Its exit selection lies past the end; anchoring it would lock Continue planning.
      <LeaveRow actions={endAction} key="leave" label="Plan ends here" />
    ) : (
      <LeaveRow
        actions={endAction}
        {...(anchorOwner === undefined ? {} : { anchorOwner })}
        key="leave"
        label={label}
        status={status}
      >
        {value}
      </LeaveRow>
    );

  // A boss door's pool is authored or reported with the room's doors.
  const store = node.room.bossDoorRewardStore;
  const storeDetail =
    store === undefined
      ? {}
      : {
          ...(store.kind === 'editor' ? { findingOwners: [store.address] } : {}),
          detail: (
            <section aria-label="Door details" className="door-workbench timeline-doors-detail">
              <div className="door-batch">
                <BossDoorRewardPoolRow
                  idPrefix={idPrefix}
                  interactions={interactions}
                  markFor={markFor}
                  store={store}
                />
              </div>
            </section>
          ),
        };

  if (batch !== undefined) {
    return {
      summary: <DoorChips chips={batchDoorChips(batch)} />,
      findingOwners: batchDoorFindingOwners(batch),
      detail: (
        <BatchDoorsDetail
          interactions={interactions}
          markFor={markFor}
          node={batch}
          {...(batch.persistence === 'authored' || batch.repairIntent !== undefined
            ? { repair: <BatchDoorsRepair interactions={interactions} node={batch} /> }
            : {})}
        />
      ),
      leave: leaveRow(
        'Leave room',
        <BatchExitPicker interactions={interactions} node={batch} />,
        batchDoorsStatus(batch),
        batch.selection.address,
      ),
      notes,
      ...(batch.rerolls === undefined
        ? {}
        : {
            rerolls: batch.rerolls,
            chips: batchDoorChips(batch),
            object: (
              <DoorsRerollEntry interactions={interactions} key="doors" rerolls={batch.rerolls} />
            ),
          }),
    };
  }
  switch (outgoing?.kind) {
    case undefined:
      return undefined;
    case 'blockedOrUnentered':
    case 'terminal':
      // No way on is planned from here; a boss door's pool and the plan's end still are.
      return store === undefined && relation === undefined
        ? undefined
        : {
            ...storeDetail,
            ...(relation === 'end' ? { leave: leaveRow('Leave room', null) } : {}),
            notes,
          };
    case 'authoredDecision':
      throw new BiomeWorkspaceContractError(
        `${outgoing.decisionNodeKey} authored outgoing decision was not joined to its node.`,
      );
    case 'frontier':
      throw new BiomeWorkspaceContractError('An exit frontier must carry its provisional doors.');
    case 'planEnd':
      return { leave: leaveRow('Leave room', null) };
    case 'topologyOwned': {
      const phantom = node.room.phantomExit;
      return {
        ...(phantom === undefined
          ? {}
          : {
              summary: (
                <DoorChips
                  chips={[
                    {
                      key: 'hidden',
                      label: 'Hidden door',
                      ...(phantom.room.icon === undefined ? {} : { roomIcon: phantom.room.icon }),
                      rewards:
                        phantom.reward.rewardType === undefined
                          ? []
                          : [rewardIcon(phantom.reward.rewardType)],
                    },
                  ]}
                />
              ),
              findingOwners: [phantom.address],
              detail: (
                <section aria-label="Door details" className="door-workbench timeline-doors-detail">
                  <div className="door-rows">
                    <DoorRowsHeader />
                    <PhantomExitDoor
                      control={phantom}
                      idPrefix={idPrefix}
                      interactions={interactions}
                      mark={markFor('hiddenDoor')}
                    />
                  </div>
                </section>
              ),
            }),
        // The Hub decides where the room leads; only the plan's end gets a last row.
        ...(relation === 'end' ? { leave: leaveRow('Leave room', null) } : {}),
        notes,
      };
    }
    case 'fixedRoom': {
      const destination = outgoing.destination;
      const value =
        destination.kind === 'complete' ? (
          <span>{destination.message}</span>
        ) : (
          <FixedValueChip
            icon={
              destination.kind === 'room' && destination.roomIcon !== undefined
                ? roomKindIcon(destination.roomIcon)
                : undefined
            }
            label={destination.label}
          />
        );
      return {
        ...(destination.kind === 'room' && destination.roomIcon !== undefined
          ? {
              summary: (
                <DoorChips
                  chips={[
                    {
                      key: 'fixed',
                      label: destination.label,
                      roomIcon: destination.roomIcon,
                      rewards: [],
                    },
                  ]}
                />
              ),
            }
          : {}),
        ...storeDetail,
        leave: leaveRow('Leave room', value),
        notes,
      };
    }
  }
}

function OccurrenceInspector({
  defaultToDoors = false,
  doorsRequested = false,
  interactions,
  node,
  outgoing,
  outgoingDecision,
  findingNavigationRevision,
  navigationRevision,
  roomTab,
  sideRoomSlotKey,
  titleAside,
}: Pick<
  BiomeInspectorNodeProps,
  | 'titleAside'
  | 'doorsRequested'
  | 'interactions'
  | 'outgoing'
  | 'outgoingDecision'
  | 'navigationRevision'
  | 'findingNavigationRevision'
  | 'roomTab'
  | 'sideRoomSlotKey'
> & {
  readonly defaultToDoors?: boolean;
  readonly node: OccurrenceNode;
}) {
  const dispatch = useAppDispatch();
  const planEnd = node.planEnd;
  const batch =
    outgoingDecision ??
    (outgoing?.kind === 'frontier' ? outgoing.frontier.provisionalBatch : undefined);
  const doorNotes = useDoorNotes(doorNoteSource(node, batch, outgoing));
  const doors = roomTimelineDoors({
    batch,
    interactions,
    markFor: doorNotes.markFor,
    node,
    notes: <DoorNotes items={doorNotes.items} />,
    outgoing,
    planEnd,
  });
  return (
    <OccurrenceWorkbench
      {...(planEnd?.relation === undefined ? {} : { planEndRelation: planEnd.relation })}
      headerActions={
        <>
          {node.hubTimeline === undefined ? null : (
            <button
              type="button"
              className="primary-action action-compact"
              onClick={() => dispatch(semanticOwnerFocused(node.hubTimeline!.address))}
            >
              ← Hub Timeline
            </button>
          )}
        </>
      }
      entryIdentity={<StartRoomIdentityEditor interactions={interactions} node={node} />}
      {...(node.incomingDoor === undefined ? {} : { incomingDoor: node.incomingDoor })}
      titleAside={titleAside}
      interactions={interactions}
      {...(node.localVisit === undefined ? {} : { localVisit: node.localVisit })}
      room={node.room}
      renderRoomActionRowContent={(row) => inspectorRoomActionContent(node.room, interactions, row)}
      renderLifecycleBoundaryContent={(boundary) =>
        inspectorLifecycleBoundaryContent(node.room, interactions, boundary)
      }
      {...(node.runState === undefined ? {} : { runState: node.runState })}
      {...(navigationRevision === undefined ? {} : { navigationRevision })}
      {...(findingNavigationRevision === undefined ? {} : { findingNavigationRevision })}
      initialTab={roomTab ?? (defaultToDoors ? node.room.doorsTab : 'overview')}
      doorsRequested={doorsRequested || (roomTab === undefined && defaultToDoors)}
      {...(sideRoomSlotKey === undefined ? {} : { initialSideRoomSlotKey: sideRoomSlotKey })}
      {...(doors === undefined ? {} : { timelineDoors: doors })}
      // A room with no last row keeps the action that moves the plan's end to it.
      {...(planEnd?.relation === 'pastEnd' ||
      (planEnd !== undefined && planEnd.relation === undefined && doors?.leave === undefined)
        ? {
            pastEndAction: (
              <div className="workbench-action-row">
                <span className="workbench-action-end">
                  <PlanEndAction planEnd={planEnd} />
                </span>
              </div>
            ),
          }
        : {})}
    />
  );
}

/** Closed projected-node dispatch for the focused inspector; it never reads authored topology. */
export function BiomeInspectorNode(props: BiomeInspectorNodeProps) {
  const { node } = props;
  switch (node.kind) {
    case 'occurrenceWorkbench':
      return <OccurrenceInspector {...props} node={node} />;
    case 'ordinaryBatch':
    case 'mixedBatch':
    case 'takeoverBatch':
      return props.sourceOccurrence === undefined ? (
        <BatchDoorsDetail interactions={props.interactions} markFor={() => undefined} node={node} />
      ) : (
        <OccurrenceInspector {...props} defaultToDoors node={props.sourceOccurrence} />
      );
    case 'hubDecision': {
      const hub = (
        <HubDecisionWorkbench
          {...(props.hubTab === undefined ? {} : { initialTab: props.hubTab })}
          {...(props.navigationRevision === undefined
            ? {}
            : { navigationRevision: props.navigationRevision })}
          {...(props.findingNavigationRevision === undefined
            ? {}
            : { findingNavigationRevision: props.findingNavigationRevision })}
          interactions={props.interactions}
          node={node}
          titleAside={props.titleAside}
        />
      );
      return props.pastPlanEnd === true ? <ReadOnlyFindingScope>{hub}</ReadOnlyFindingScope> : hub;
    }
  }
}

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
import { BatchDoorsDetail, BatchDoorsRepair, DoorNotes, DoorRowsHeader } from './DecisionWorkbench';
import { DoorRows } from './DoorRows';
import {
  batchDoorChips,
  batchDoorFindingOwners,
  batchDoorPressIcon,
  batchDoorsStatus,
  hubReturnChip,
} from './doorSummary';
import { HubDecisionWorkbench } from './HubDecisionWorkbench';
import { OccurrenceWorkbench } from './OccurrenceWorkbench';
import { PhantomExitDoor } from './PhantomExitDoor';
import { BossDoorRewardPoolRow } from './OccurrenceDirectRoomWorkbench';
import { useDoorNotes, type DoorNoteMark, type DoorNoteTarget } from './doorNotes';

/** The hidden door's chip on the Doors open row. */
const hiddenDoorChip = 'hidden';
import {
  inspectorLifecycleBoundaryContent,
  inspectorRoomActionContent,
  StartRoomIdentityEditor,
} from './BiomeInspectorControls';
import { PlanEndAction } from './PlanEndAction';
import { ReadOnlyFindingScope } from '@planner/ui/feedback/useFindingTarget';
import { DoorsRerollEntry } from './RoomRerolls';
import { rewardIcon } from '@planner/ui/artwork/rewardIcon';
import { BatchExitPicker, LeavePicker } from './LeavePicker';
import { HubRoomLeave, SideRoomLeave, SideVisitLeaves } from './SideVisitLeaves';
import { LeaveRow, type TimelineDoorsContent } from './TimelineDoors';
import { BiomeWorkspaceContractError } from './workspaceContract';

type OccurrenceNode = Extract<WorkspaceNode, { readonly kind: 'occurrenceWorkbench' }>;
type BatchNode = Extract<
  WorkspaceNode,
  { readonly kind: 'ordinaryBatch' | 'mixedBatch' | 'takeoverBatch' }
>;

interface BiomeInspectorNodeProps {
  /** The biome's own settings, on its entry room's Overview above every section. */
  readonly biomeSettings?: ReactNode;
  readonly frontier: WorkspaceAuthoringFrontier | null;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly label: string;
  readonly node: WorkspaceNode;
  readonly outgoing?: WorkspaceOccurrenceStageOutgoing;
  readonly outgoingDecision?: BatchNode;
  readonly hubTab?: WorkspaceHubTab;
  /** The Hub Timeline segment an explicit open asked for. */
  readonly hubSegment?: number;
  readonly roomTab?: WorkspaceRoomTab;
  /** Navigation landed on a door owner, so the room's Doors open row opens. */
  readonly doorsRequested?: boolean;
  readonly navigationRevision?: number;
  readonly findingNavigationRevision?: number;
  readonly sourceOccurrence?: OccurrenceNode;
  /** The biome lies past the plan end, so its Hub is read-only. */
  readonly pastPlanEnd?: boolean;
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
  readonly activeNote: DoorNoteTarget | undefined;
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
 * fixed room, a Hub room's ways back, or the plan's end. A room left no
 * way (unreached, past the end, no next room) has no last row.
 */
/**
 * How a Hub room is left: a side room back to its main room; a main room
 * through each side visit, then back to the Hub.
 */
function hubRoomLeaves(
  node: OccurrenceNode,
  hubReturn: NonNullable<OccurrenceNode['hubReturn']>,
  interactions: WorkspaceInteractionCatalog,
  idPrefix: string,
  planEnd: WorkspaceRoomPlanEnd | undefined,
): ReactNode {
  if (hubReturn.kind === 'room')
    return (
      <SideRoomLeave id={`${idPrefix}-leave`} key="leave" mainRoom={hubReturn} planEnd={planEnd} />
    );
  return node.localVisit === undefined ? (
    <HubRoomLeave
      hub={hubReturn.hub}
      id={`${idPrefix}-leave`}
      key="leave"
      planEnd={planEnd}
      visitIndex={hubReturn.visitIndex}
    />
  ) : (
    <SideVisitLeaves
      hub={hubReturn.hub}
      idPrefix={idPrefix}
      interactions={interactions}
      key="leave"
      localVisit={node.localVisit}
      planEnd={planEnd}
      visitIndex={hubReturn.visitIndex}
    />
  );
}

function roomTimelineDoors({
  activeNote,
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
  // The hidden door has a chip; a note on the doors as a whole has no row.
  const noteHighlight =
    activeNote === undefined
      ? {}
      : {
          activeNote: {
            ...(activeNote === 'hiddenDoor' ? { chip: hiddenDoorChip } : {}),
            ownRow: activeNote !== 'batch',
          },
        };
  const idPrefix = `occurrence-${node.room.occurrenceId}`;
  const ended = relation === 'end';
  const leaveRow = (value: ReactNode, status?: string, anchorOwner?: SemanticAddress) => (
    <LeaveRow
      // Its exit selection lies past the end; anchoring it would lock continuing the plan.
      {...(anchorOwner === undefined || ended ? {} : { anchorOwner })}
      key="leave"
      label="Leave room"
      status={ended ? undefined : status}
    >
      {value}
    </LeaveRow>
  );
  // A room with no way out of its own to pick: ending the plan, and continuing it from there.
  const endOnly = () =>
    leaveRow(
      <LeavePicker chosenKey={undefined} id={`${idPrefix}-leave`} options={[]} planEnd={planEnd} />,
    );

  // A boss door's pool is authored or reported with the room's doors.
  const store = node.room.bossDoorRewardStore;
  const storeDetail =
    store === undefined
      ? {}
      : {
          ...(store.kind === 'editor' ? { findingOwners: [store.address] } : {}),
          ...noteHighlight,
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

  // A lock host's Doors object also presses its locked doors; the room cannot be left through one still locked.
  const lockedDoors = node.room.lockedDoors;
  const unlocks = {
    lockedAtLeave: lockedDoors?.lockedAtLeave ?? [],
    options:
      lockedDoors?.unlocks === undefined || lockedDoors.unlocks.options.length === 0
        ? undefined
        : lockedDoors.unlocks,
  };
  // A locked door's findings, on its press or on the exit picked through it, need the doors.
  const unlockOwners = (node.room.roomActions?.rows ?? []).flatMap((row) =>
    row.reference.kind === 'unlockExit' ? [row.address] : [],
  );
  // Every locked door is still locked as the doors open: its press follows them.
  const lockedAsOpened = (lockedDoors?.doors ?? []).flatMap((door) =>
    door.locked ? [door.exitKey] : [],
  );
  if (batch !== undefined) {
    return {
      ...noteHighlight,
      summary: { chips: batchDoorChips(batch, lockedAsOpened) },
      findingOwners: [...batchDoorFindingOwners(batch), ...unlockOwners],
      ...(lockedDoors === undefined
        ? {}
        : {
            attentionFindings: [{ owner: batch.selection.address, code: 'lockedExitSelected' }],
          }),
      detail: (
        <BatchDoorsDetail
          interactions={interactions}
          lockedDoors={lockedDoors}
          markFor={markFor}
          node={batch}
          {...(batch.persistence === 'authored' || batch.repairIntent !== undefined
            ? { repair: <BatchDoorsRepair interactions={interactions} node={batch} /> }
            : {})}
        />
      ),
      leave: leaveRow(
        <BatchExitPicker
          interactions={interactions}
          lockedAtLeave={unlocks.lockedAtLeave}
          node={batch}
          planEnd={planEnd}
        />,
        batchDoorsStatus(batch),
        batch.selection.address,
      ),
      notes,
      ...(batch.rerolls === undefined ? {} : { rerolls: batch.rerolls }),
      ...(batch.doorSteps === undefined ? {} : { steps: batch.doorSteps }),
      ...(batch.rerolls === undefined && unlocks.options === undefined
        ? {}
        : {
            chips: batchDoorChips(batch),
            object: (
              <DoorsRerollEntry
                interactions={interactions}
                key="doors"
                pressIcon={batchDoorPressIcon(batch)}
                {...(batch.rerolls === undefined ? {} : { rerolls: batch.rerolls })}
                {...(unlocks.options === undefined ? {} : { unlocks: unlocks.options })}
              />
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
            ...(ended ? { leave: endOnly() } : {}),
            notes,
          };
    case 'authoredDecision':
      throw new BiomeWorkspaceContractError(
        `${outgoing.decisionNodeKey} authored outgoing decision was not joined to its node.`,
      );
    case 'frontier':
      throw new BiomeWorkspaceContractError('An exit frontier must carry its provisional doors.');
    case 'planEnd':
      return { leave: endOnly() };
    case 'topologyOwned': {
      const phantom = node.room.phantomExit;
      return {
        ...(phantom === undefined
          ? {}
          : {
              ...noteHighlight,
              summary: {
                chips: [
                  {
                    key: hiddenDoorChip,
                    label: 'Hidden door',
                    ...(phantom.room.icon === undefined ? {} : { roomIcon: phantom.room.icon }),
                    rewards:
                      phantom.reward.rewardType === undefined
                        ? []
                        : [rewardIcon(phantom.reward.rewardType)],
                  },
                ],
              },
              findingOwners: [phantom.address],
              detail: (
                <section aria-label="Door details" className="door-workbench timeline-doors-detail">
                  <DoorRows>
                    <DoorRowsHeader />
                    <PhantomExitDoor
                      control={phantom}
                      idPrefix={idPrefix}
                      interactions={interactions}
                      mark={markFor('hiddenDoor')}
                    />
                  </DoorRows>
                </section>
              ),
            }),
        // The Hub decides where the room leads; its last rows pick the way back there.
        ...(node.hubReturn === undefined
          ? ended
            ? { leave: endOnly() }
            : {}
          : { leave: hubRoomLeaves(node, node.hubReturn, interactions, idPrefix, planEnd) }),
        notes,
      };
    }
    case 'fixedRoom': {
      const destination = outgoing.destination;
      const chip =
        destination.kind === 'room' && destination.roomIcon !== undefined
          ? {
              key: 'fixed',
              doorIndex: 1,
              label: destination.label,
              roomIcon: destination.roomIcon,
              rewards: [],
            }
          : undefined;
      // The one way out, with nothing else to pick but the plan's end.
      const way = {
        key: 'fixed',
        label: destination.kind === 'complete' ? destination.message : destination.label,
        ...(chip === undefined ? {} : { chip }),
      };
      return {
        ...(chip === undefined ? {} : { summary: { chips: [chip] } }),
        ...storeDetail,
        leave: leaveRow(
          <LeavePicker
            chosenKey={way.key}
            id={`${idPrefix}-leave`}
            options={[way]}
            planEnd={planEnd}
          />,
        ),
        notes,
      };
    }
  }
}

function OccurrenceInspector({
  biomeSettings,
  defaultToDoors = false,
  doorsRequested = false,
  interactions,
  node,
  outgoing,
  outgoingDecision,
  findingNavigationRevision,
  navigationRevision,
  roomTab,
}: Pick<
  BiomeInspectorNodeProps,
  | 'biomeSettings'
  | 'doorsRequested'
  | 'interactions'
  | 'outgoing'
  | 'outgoingDecision'
  | 'navigationRevision'
  | 'findingNavigationRevision'
  | 'roomTab'
> & {
  readonly defaultToDoors?: boolean;
  readonly node: OccurrenceNode;
}) {
  const dispatch = useAppDispatch();
  const planEnd = node.planEnd;
  const batch =
    outgoingDecision ??
    (outgoing?.kind === 'frontier' ? outgoing.frontier.provisionalBatch : undefined);
  // A note opens its doors the way navigation does: through the owner they repair.
  const doorNotes = useDoorNotes(doorNoteSource(node, batch, outgoing), (target) => {
    const owner =
      outgoingDecision !== undefined
        ? outgoingDecision.owner
        : target === 'hiddenDoor'
          ? node.room.phantomExit?.address
          : undefined;
    if (owner !== undefined) return { kind: 'owner', owner };
    // A reported boss pool has no owner of its own: its note opens the fixed exit's doors.
    return (target === 'pool' || target === 'effective') && outgoing?.kind === 'fixedRoom'
      ? { kind: 'doors', room: node.room.address }
      : undefined;
  });
  const doors = roomTimelineDoors({
    activeNote: doorNotes.active,
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
      entryIdentity={
        <>
          {biomeSettings}
          <StartRoomIdentityEditor interactions={interactions} node={node} />
        </>
      }
      {...(node.incomingDoor === undefined ? {} : { incomingDoor: node.incomingDoor })}
      interactions={interactions}
      {...(node.localVisit === undefined ? {} : { localVisit: node.localVisit })}
      {...(node.hubReturn?.kind === 'hub'
        ? { hubReturnChip: { ...hubReturnChip(node.hubReturn.hub), picked: true } }
        : {})}
      room={node.room}
      renderRoomActionRowContent={(row) => inspectorRoomActionContent(node.room, interactions, row)}
      renderLifecycleBoundaryContent={(boundary) =>
        inspectorLifecycleBoundaryContent(node.room, interactions, boundary)
      }
      {...(node.runState === undefined ? {} : { runState: node.runState })}
      {...(navigationRevision === undefined ? {} : { navigationRevision })}
      {...(findingNavigationRevision === undefined ? {} : { findingNavigationRevision })}
      initialTab={roomTab ?? (defaultToDoors ? node.room.doorsTab : 'overview')}
      // A selected decision is its doors: selecting it asks for them.
      doorsRequested={doorsRequested || defaultToDoors}
      doorsFrontier={outgoing?.kind === 'frontier'}
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
          {...(props.hubSegment === undefined ? {} : { initialSegment: props.hubSegment })}
          {...(props.navigationRevision === undefined
            ? {}
            : { navigationRevision: props.navigationRevision })}
          {...(props.findingNavigationRevision === undefined
            ? {}
            : { findingNavigationRevision: props.findingNavigationRevision })}
          interactions={props.interactions}
          node={node}
        />
      );
      return props.pastPlanEnd === true ? <ReadOnlyFindingScope>{hub}</ReadOnlyFindingScope> : hub;
    }
  }
}

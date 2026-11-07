import type { ReactNode } from 'react';
import type { SemanticAddress } from '@run-planner/engine/authored-project';
import { useAppDispatch } from '@planner/state/store';
import { semanticOwnerFocused, semanticOwnerOpened } from '@planner/state/editorSessionSlice';
import { IconActionButton } from '@planner/ui/controls/IconActionButton';

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
import {
  batchDoorChips,
  batchDoorFindingOwners,
  batchDoorPressIcon,
  batchDoorsStatus,
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
import { FixedValueChip } from '@planner/ui/controls/FixedValueChip';
import { DoorsRerollEntry } from './RoomRerolls';
import { rewardIcon } from '@planner/ui/artwork/rewardIcon';
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
  readonly sideRoomSlotKey?: string;
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

/** Opens where a Hub room returns: the Hub at the next visit, or the side room's main room. */
function ReturnButton({ target }: { readonly target: NonNullable<OccurrenceNode['hubReturn']> }) {
  const dispatch = useAppDispatch();
  return target.kind === 'hub' ? (
    <IconActionButton
      hint="Open Hub Timeline"
      icon="openInEditor"
      label="Open Hub Timeline"
      onClick={() =>
        dispatch(
          semanticOwnerOpened({
            owner: target.hub,
            presentation: { kind: 'hubSegment', segment: target.visitIndex + 1 },
          }),
        )
      }
    />
  ) : (
    <IconActionButton
      hint={`Open ${target.label}`}
      icon="openInEditor"
      label={`Open ${target.label}`}
      onClick={() =>
        dispatch(
          semanticOwnerOpened({ owner: target.room, presentation: { kind: 'roomTimeline' } }),
        )
      }
    />
  );
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
 * fixed room, a Hub or side-room return, or the plan's end. A room left no
 * way (unreached, past the end, no next room) has no last row.
 */
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
        'Leave room',
        <BatchExitPicker
          interactions={interactions}
          lockedAtLeave={unlocks.lockedAtLeave}
          node={batch}
        />,
        batchDoorsStatus(batch),
        batch.selection.address,
      ),
      notes,
      ...(batch.rerolls === undefined ? {} : { rerolls: batch.rerolls }),
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
        // The Hub decides where the room leads; its last row returns there.
        ...(relation === 'end'
          ? { leave: leaveRow('Leave room', null) }
          : node.hubReturn === undefined
            ? {}
            : {
                leave: leaveRow(
                  node.hubReturn.kind === 'hub'
                    ? 'Return to Hub'
                    : `Return to ${node.hubReturn.label}`,
                  <ReturnButton target={node.hubReturn} />,
                ),
              }),
        notes,
      };
    }
    case 'fixedRoom': {
      const destination = outgoing.destination;
      const chip =
        destination.kind === 'room' && destination.roomIcon !== undefined
          ? {
              key: 'fixed',
              label: destination.label,
              roomIcon: destination.roomIcon,
              rewards: [],
            }
          : undefined;
      // The one way out is its door chip, with nothing to pick.
      const value =
        destination.kind === 'complete' ? (
          <span>{destination.message}</span>
        ) : chip === undefined ? (
          <FixedValueChip label={destination.label} />
        ) : (
          <span className="timeline-leave-door">
            <DoorChips chips={[chip]} label="Exit door" />
          </span>
        );
      return {
        ...(chip === undefined ? {} : { summary: { chips: [chip] } }),
        ...storeDetail,
        leave: leaveRow('Leave room', value),
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
  sideRoomSlotKey,
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

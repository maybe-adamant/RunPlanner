import type { ReactNode } from 'react';
import type { SemanticAddress } from '@run-planner/engine/authored-project';

import {
  type WorkspaceAuthoringFrontier,
  type WorkspaceDoorNote,
  type WorkspaceHubTab,
  type WorkspaceInteractionCatalog,
  type WorkspaceNode,
  type WorkspaceOccurrenceStageOutgoing,
  type WorkspaceRoomIcon,
  type WorkspaceRoomPlanEnd,
  type WorkspaceRoomTab,
} from '@planner/projections/structured-workspace';
import { BatchDoorsDetail, BatchDoorsRepair, DoorRowsHeader } from './DecisionWorkbench';
import { DoorRows } from './DoorRows';
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
import { doorNotesByTarget, type DoorNoteFor } from './doorNotes';

/** The hidden door's chip on the Doors open row. */
const hiddenDoorChip = 'hidden';
import {
  inspectorLifecycleBoundaryContent,
  inspectorRoomActionContent,
  StartRoomIdentityEditor,
} from './BiomeInspectorControls';
import { ReadOnlyFindingScope } from '@planner/ui/feedback/useFindingTarget';
import { DoorsRerollEntry } from './RoomRerolls';
import { rewardIcon } from '@planner/ui/artwork/rewardIcon';
import { BatchExitPicker, LeavePicker, type LeaveOption } from './LeavePicker';
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

/** The notes on a room's doors: its batch's, its hidden door's or its boss door's. */
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
  readonly noteFor: DoorNoteFor;
  readonly node: OccurrenceNode;
  readonly outgoing: WorkspaceOccurrenceStageOutgoing | undefined;
  readonly planEnd: WorkspaceRoomPlanEnd | undefined;
}

/** A room the plan ends in before its doors are planned continues the plan through them. */
const unplannedDoors: LeaveOption = { key: 'doors', label: 'Doors', unplanned: true };

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

/**
 * The room's doors on its Timeline, by how it is left: a batch of doors, a
 * fixed room, a Hub room's ways back, or the plan's end. A room with no way
 * out to pick (unreached, past the end, no next room) keeps a last row that
 * ends the plan there.
 */
function roomTimelineDoors({
  batch,
  interactions,
  noteFor,
  node,
  outgoing,
  planEnd,
}: RoomDoorsInput): TimelineDoorsContent | undefined {
  const relation = planEnd?.relation;
  const idPrefix = `occurrence-${node.room.occurrenceId}`;
  // A room with no way out of its own to pick: ending the plan here.
  const endPicker = (ways: readonly LeaveOption[] = [], unreached = false) =>
    planEnd === undefined ? undefined : (
      <LeaveRow key="leave" label="Leave room">
        <LeavePicker
          chosenKey={undefined}
          id={`${idPrefix}-leave`}
          options={ways}
          planEnd={planEnd}
          unreached={unreached}
        />
      </LeaveRow>
    );
  // The last row alone, where the room shows no doors.
  const endOnlyRow = (unreached = false): TimelineDoorsContent | undefined => {
    const leave = endPicker([], unreached);
    return leave === undefined ? undefined : { leave, doorsOpenRow: false };
  };
  // Past the plan end the doors are dormant; only the row that moves the end here stays.
  if (relation === 'pastEnd') return endOnlyRow();
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
                  noteFor={noteFor}
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
    const batchNote = noteFor('batch');
    return {
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
          noteFor={noteFor}
          node={batch}
          {...(batch.persistence === 'authored'
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
      ...(batchNote === undefined ? {} : { note: batchNote }),
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
      return endOnlyRow();
    case 'blockedOrUnentered':
    case 'terminal': {
      // No way on is planned from here; a boss door's pool and the plan's end still are.
      const unreached = outgoing.kind === 'blockedOrUnentered' && outgoing.unentered;
      if (store === undefined) return endOnlyRow(unreached);
      const leave = endPicker([], unreached);
      return { ...storeDetail, ...(leave === undefined ? {} : { leave }) };
    }
    case 'authoredDecision':
      throw new BiomeWorkspaceContractError(
        `${outgoing.decisionNodeKey} authored outgoing decision was not joined to its node.`,
      );
    case 'frontier':
      throw new BiomeWorkspaceContractError('An exit frontier must carry its provisional doors.');
    case 'planEnd': {
      const leave = endPicker([unplannedDoors]);
      return leave === undefined ? {} : { leave };
    }
    case 'topologyOwned': {
      const phantom = node.room.phantomExit;
      return {
        ...(phantom === undefined
          ? {}
          : {
              summary: {
                chips: [
                  {
                    key: hiddenDoorChip,
                    // The door the room is left back through, its entry's.
                    doorIndex: 1,
                    hidden: true,
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
                      note={noteFor('hiddenDoor')}
                    />
                  </DoorRows>
                </section>
              ),
            }),
        // The Hub decides where the room leads; its last rows pick the way back there.
        ...(node.hubReturn !== undefined
          ? { leave: hubRoomLeaves(node, node.hubReturn, interactions, idPrefix, planEnd) }
          : outgoing.hubEntry !== undefined
            ? {
                leave: (
                  <HubRoomLeave
                    hub={outgoing.hubEntry}
                    id={`${idPrefix}-leave`}
                    key="leave"
                    planEnd={planEnd}
                    visitIndex={0}
                  />
                ),
              }
            : (() => {
                const leave = endPicker();
                return leave === undefined ? {} : { leave };
              })()),
      };
    }
    case 'fixedRoom': {
      const destination = outgoing.destination;
      // A Postboss leads into the next biome, shown by that biome's icon.
      const roomIcon: WorkspaceRoomIcon | undefined =
        destination.kind === 'room'
          ? destination.roomIcon
          : destination.kind === 'biome'
            ? { kind: 'nextBiome', biomeKey: destination.biomeKey }
            : undefined;
      const chip =
        destination.kind !== 'complete' && roomIcon !== undefined
          ? {
              key: 'fixed',
              doorIndex: 1,
              label: destination.label,
              roomIcon,
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
  const planEnd = node.planEnd;
  const batch =
    outgoingDecision ??
    (outgoing?.kind === 'frontier' ? outgoing.frontier.provisionalBatch : undefined);
  const roomDoors = roomTimelineDoors({
    batch,
    interactions,
    noteFor: doorNotesByTarget(doorNoteSource(node, batch, outgoing)),
    node,
    outgoing,
    planEnd,
  });
  const doors =
    roomDoors === undefined || planEnd?.relation !== 'end'
      ? roomDoors
      : { ...roomDoors, endsPlan: true as const };
  return (
    <OccurrenceWorkbench
      {...(planEnd?.relation === undefined ? {} : { planEndRelation: planEnd.relation })}
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
      {...(doors === undefined ? {} : { timelineDoors: doors })}
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
        <BatchDoorsDetail interactions={props.interactions} noteFor={() => undefined} node={node} />
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

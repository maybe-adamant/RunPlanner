import type { ReactNode } from 'react';
import { useAppDispatch } from '@planner/state/store';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';

import {
  type WorkspaceBossDoorRewardStoreControl,
  type WorkspaceAuthoringFrontier,
  type WorkspaceHubTab,
  type WorkspaceInteractionCatalog,
  type WorkspaceNode,
  type WorkspaceOccurrenceStageOutgoing,
  type WorkspaceMarker,
  type WorkspacePhantomExitControl,
  type WorkspaceRoomPlanEnd,
  type WorkspaceRoomTab,
} from '@planner/projections/structured-workspace';
import {
  AuthoringFrontier,
  BatchWorkbench,
  DoorActionRow,
  DoorNotes,
  DoorRowsHeader,
  FixedExitRow,
  SelectedContinuationAction,
} from './DecisionWorkbench';
import { HubDecisionWorkbench } from './HubDecisionWorkbench';
import { OccurrenceWorkbench } from './OccurrenceWorkbench';
import { PhantomExitDoor } from './PhantomExitDoor';
import { BossDoorRewardPoolRow } from './OccurrenceDirectRoomWorkbench';
import { useDoorNotes } from './doorNotes';
import {
  inspectorLifecycleBoundaryContent,
  inspectorRoomActionContent,
  StartRoomIdentityEditor,
} from './BiomeInspectorControls';
import { BiomeWorkspaceContractError } from './workspaceContract';
import { PlanEndAction } from './PlanEndAction';
import { ReadOnlyFindingScope, useAuthoringLocked } from '@planner/ui/feedback/useFindingTarget';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';

interface BiomeInspectorNodeProps {
  readonly frontier: WorkspaceAuthoringFrontier | null;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly label: string;
  readonly node: WorkspaceNode;
  readonly outgoing?: WorkspaceOccurrenceStageOutgoing;
  readonly outgoingDecision?: Extract<
    WorkspaceNode,
    { readonly kind: 'ordinaryBatch' | 'mixedBatch' | 'takeoverBatch' }
  >;
  readonly hubTab?: WorkspaceHubTab;
  readonly roomTab?: WorkspaceRoomTab;
  readonly sideRoomSlotKey?: string;
  readonly navigationRevision?: number;
  readonly findingNavigationRevision?: number;
  readonly sourceOccurrence?: Extract<WorkspaceNode, { readonly kind: 'occurrenceWorkbench' }>;
  /** The biome lies past the plan end, so its Hub is read-only. */
  readonly pastPlanEnd?: boolean;
}

/** The footer the end room and the rooms past it keep outside their read-only doors. */
function PlanEndRow({ planEnd }: { readonly planEnd: WorkspaceRoomPlanEnd }) {
  return (
    <div className="workbench-action-row">
      <span className="workbench-action-end">
        <PlanEndAction planEnd={planEnd} />
      </span>
    </div>
  );
}

/** Opens a fixed exit's room once its context is reached. */
function FixedExitContinuation({
  continuation,
}: {
  readonly continuation: { readonly marker: WorkspaceMarker };
}) {
  const locked = useAuthoringLocked(continuation.marker.address);
  return (
    <SelectedContinuationAction
      continuation={locked ? undefined : continuation}
      disabledHint={candidateWaitingHint}
    />
  );
}

function OccurrenceOutgoing({
  bossDoorRewardStore,
  idPrefix,
  interactions,
  outgoing,
  phantomExit,
  planEnd,
}: {
  /** A fixed boss door authors or reports its pool alongside its destination. */
  readonly bossDoorRewardStore?: WorkspaceBossDoorRewardStoreControl;
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly outgoing: WorkspaceOccurrenceStageOutgoing;
  /** The room's only door it authors itself; the Hub or its side visits own the rest. */
  readonly phantomExit?: WorkspacePhantomExitControl;
  /** The room's plan-end action, beside its way on. */
  readonly planEnd?: WorkspaceRoomPlanEnd | undefined;
}): ReactNode {
  const notes = useDoorNotes(
    outgoing.kind === 'topologyOwned'
      ? outgoing.notes
      : bossDoorRewardStore === undefined || bossDoorRewardStore.kind === 'editor'
        ? []
        : bossDoorRewardStore.notes,
  );
  // The Hub or a side-room visit decides where such a room leads; its notes
  // say where, beside its hidden return door when it has one.
  if (outgoing.kind === 'topologyOwned')
    return (
      <section aria-label="Outgoing doors" className="door-workbench outgoing-occurrence-state">
        <div className="door-body">
          <div className="door-batch" />
          <DoorNotes items={notes.items} />
          {phantomExit === undefined ? null : (
            <div className="door-rows">
              <DoorRowsHeader />
              <PhantomExitDoor
                control={phantomExit}
                idPrefix={idPrefix}
                interactions={interactions}
                mark={notes.markFor('hiddenDoor')}
              />
            </div>
          )}
        </div>
        <DoorActionRow planEnd={planEnd} />
      </section>
    );
  switch (outgoing.kind) {
    case 'authoredDecision':
      throw new BiomeWorkspaceContractError(
        `${outgoing.decisionNodeKey} authored outgoing decision was not joined to its node.`,
      );
    case 'frontier':
      return (
        <section aria-label="Outgoing doors" className="outgoing-occurrence-state">
          <AuthoringFrontier
            frontier={outgoing.frontier}
            interactions={interactions}
            planEnd={planEnd}
          />
        </section>
      );
    case 'planEnd':
      return (
        <section aria-label="Outgoing doors" className="outgoing-occurrence-state">
          <DoorActionRow planEnd={planEnd} />
        </section>
      );
    case 'fixedRoom': {
      const destination = outgoing.destination;
      if (destination.kind === 'complete')
        return (
          <section aria-label="Outgoing doors" className="outgoing-occurrence-state">
            <p className="fixed-room-state">{destination.message}</p>
            <DoorActionRow planEnd={planEnd} />
          </section>
        );
      return (
        <section aria-label="Outgoing doors" className="door-workbench outgoing-occurrence-state">
          <div className="door-body">
            <div className="door-batch">
              {bossDoorRewardStore === undefined ? null : (
                <BossDoorRewardPoolRow
                  idPrefix={idPrefix}
                  interactions={interactions}
                  markFor={notes.markFor}
                  store={bossDoorRewardStore}
                />
              )}
            </div>
            <DoorNotes items={notes.items} />
            <div className="door-rows">
              <DoorRowsHeader />
              <FixedExitRow
                gameName={destination.kind === 'room' ? destination.gameName : undefined}
                hostId={outgoing.marker.focusKey}
                label={destination.label}
                roomIcon={destination.kind === 'room' ? destination.roomIcon : undefined}
              />
            </div>
          </div>
          <DoorActionRow
            {...(destination.kind === 'room' && destination.continuation !== undefined
              ? {
                  continuation: <FixedExitContinuation continuation={destination.continuation} />,
                }
              : {})}
            planEnd={planEnd}
          />
        </section>
      );
    }
    case 'blockedOrUnentered':
    case 'terminal':
      return (
        <section aria-label="Outgoing doors" className="outgoing-occurrence-state">
          {bossDoorRewardStore === undefined ? null : (
            <BossDoorRewardPoolRow
              idPrefix={idPrefix}
              interactions={interactions}
              markFor={notes.markFor}
              store={bossDoorRewardStore}
            />
          )}
          <DoorNotes items={notes.items} />
          <p className="fixed-room-state">
            {outgoing.kind === 'blockedOrUnentered' ? outgoing.message : outgoing.label}
          </p>
          <DoorActionRow planEnd={planEnd} />
        </section>
      );
  }
}

function OccurrenceInspector({
  defaultToDoors = false,
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
  | 'interactions'
  | 'node'
  | 'outgoing'
  | 'outgoingDecision'
  | 'navigationRevision'
  | 'findingNavigationRevision'
  | 'roomTab'
  | 'sideRoomSlotKey'
> & {
  readonly defaultToDoors?: boolean;
  readonly node: Extract<WorkspaceNode, { readonly kind: 'occurrenceWorkbench' }>;
}) {
  const dispatch = useAppDispatch();
  const planEnd = node.planEnd;
  // From the end room on the doors are read-only and drop their footer; the
  // plan-end action sits outside them, so the end can be removed or moved later.
  const pastEnd = planEnd?.relation === 'pastEnd';
  const doors =
    outgoingDecision === undefined ? (
      outgoing === undefined ? undefined : (
        <OccurrenceOutgoing
          {...(node.room.bossDoorRewardStore === undefined
            ? {}
            : { bossDoorRewardStore: node.room.bossDoorRewardStore })}
          idPrefix={`occurrence-${node.room.occurrenceId}`}
          interactions={interactions}
          outgoing={outgoing}
          {...(node.room.phantomExit === undefined ? {} : { phantomExit: node.room.phantomExit })}
          planEnd={planEnd}
        />
      )
    ) : (
      <BatchWorkbench
        interactions={interactions}
        label="Outgoing doors"
        node={outgoingDecision}
        planEnd={planEnd}
      />
    );
  return (
    <>
      <OccurrenceWorkbench
        {...(planEnd?.relation === undefined ? {} : { planEndRelation: planEnd.relation })}
        headerActions={
          node.hubTimeline === undefined ? undefined : (
            <button
              type="button"
              className="primary-action action-compact"
              onClick={() => dispatch(semanticOwnerFocused(node.hubTimeline!.address))}
            >
              ← Hub Timeline
            </button>
          )
        }
        entryIdentity={<StartRoomIdentityEditor interactions={interactions} node={node} />}
        {...(node.incomingDoor === undefined ? {} : { incomingDoor: node.incomingDoor })}
        interactions={interactions}
        {...(node.localVisit === undefined ? {} : { localVisit: node.localVisit })}
        room={node.room}
        renderRoomActionRowContent={(row) =>
          inspectorRoomActionContent(node.room, interactions, row)
        }
        renderLifecycleBoundaryContent={(boundary) =>
          inspectorLifecycleBoundaryContent(node.room, interactions, boundary)
        }
        {...(node.runState === undefined ? {} : { runState: node.runState })}
        {...(navigationRevision === undefined ? {} : { navigationRevision })}
        {...(findingNavigationRevision === undefined ? {} : { findingNavigationRevision })}
        initialTab={roomTab ?? (defaultToDoors ? 'doors' : 'overview')}
        {...(sideRoomSlotKey === undefined ? {} : { initialSideRoomSlotKey: sideRoomSlotKey })}
        doors={
          planEnd?.relation === undefined ? (
            doors
          ) : (
            <>
              {pastEnd ? (
                <div className="past-plan-end-content" inert>
                  {doors}
                </div>
              ) : (
                doors
              )}
              <PlanEndRow planEnd={planEnd} />
            </>
          )
        }
      />
    </>
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
        <BatchWorkbench interactions={props.interactions} label={props.label} node={node} />
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
        />
      );
      return props.pastPlanEnd === true ? <ReadOnlyFindingScope>{hub}</ReadOnlyFindingScope> : hub;
    }
  }
}

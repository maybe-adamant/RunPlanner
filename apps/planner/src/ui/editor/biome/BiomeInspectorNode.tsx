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
  type WorkspacePhantomExitControl,
  type WorkspaceRoomPlanEnd,
  type WorkspaceRoomTab,
} from '@planner/projections/structured-workspace';
import {
  AuthoringFrontier,
  BatchWorkbench,
  DoorNotes,
  DoorRowsHeader,
  FixedExitRow,
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
import { ReadOnlyFindingScope } from '@planner/ui/feedback/useFindingTarget';

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

/** The way a room's plan-end action sits under doors that have no footer of their own. */
function PlanEndRow({ planEnd }: { readonly planEnd: WorkspaceRoomPlanEnd | undefined }) {
  return planEnd === undefined ? null : (
    <div className="workbench-action-row">
      <PlanEndAction planEnd={planEnd} />
    </div>
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
        <PlanEndRow planEnd={planEnd} />
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
          <PlanEndRow planEnd={planEnd} />
        </section>
      );
    case 'fixedRoom': {
      const destination = outgoing.destination;
      if (destination.kind === 'complete')
        return (
          <section aria-label="Outgoing doors" className="outgoing-occurrence-state">
            <p className="fixed-room-state">{destination.message}</p>
            <PlanEndRow planEnd={planEnd} />
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
          <PlanEndRow planEnd={planEnd} />
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
          <PlanEndRow planEnd={planEnd} />
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
  // From the end room on the doors are read-only, so the plan-end action sits
  // outside them: the end can still be removed, or moved to a later room.
  const pastEnd = planEnd?.relation === 'pastEnd';
  const doorsPlanEnd = planEnd?.relation === undefined ? planEnd : undefined;
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
          planEnd={doorsPlanEnd}
        />
      )
    ) : (
      <BatchWorkbench
        interactions={interactions}
        label="Outgoing doors"
        node={outgoingDecision}
        planEnd={doorsPlanEnd}
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
          doorsPlanEnd !== undefined || planEnd === undefined ? (
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

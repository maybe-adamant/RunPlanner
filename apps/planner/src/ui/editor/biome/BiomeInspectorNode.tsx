import type { ReactNode } from 'react';
import { useAppDispatch } from '@planner/state/store';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';

import {
  requireWorkspaceInteraction,
  type WorkspaceBossDoorRewardStoreControl,
  type WorkspaceAuthoringFrontier,
  type WorkspaceHubTab,
  type WorkspaceInteractionCatalog,
  type WorkspaceNode,
  type WorkspaceOccurrenceStageOutgoing,
  type WorkspaceRoomTab,
} from '@planner/projections/structured-workspace';
import { AuthoringFrontier, BatchWorkbench, TopologyRemovalAction } from './DecisionWorkbench';
import { HubDecisionWorkbench } from './HubDecisionWorkbench';
import { HubFountainControls } from './HubFountainControls';
import { OccurrenceWorkbench } from './OccurrenceWorkbench';
import { BossDoorRewardPoolRow } from './OccurrenceDirectRoomWorkbench';
import { RoomMapLauncher } from '@planner/ui/room-maps/RoomMapDialog';
import {
  inspectorLifecycleBoundaryContent,
  inspectorRoomActionContent,
  inspectorRoomActionTrailingContent,
  inspectorOptionalRoomActionContent,
  StartRoomIdentityEditor,
} from './BiomeInspectorControls';
import { BiomeWorkspaceContractError } from './workspaceContract';

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
  readonly findingNavigationRevision?: number;
  readonly sourceOccurrence?: Extract<WorkspaceNode, { readonly kind: 'occurrenceWorkbench' }>;
}

function OccurrenceOutgoing({
  bossDoorRewardStore,
  idPrefix,
  interactions,
  outgoing,
}: {
  /** A fixed boss door authors or reports its pool alongside its destination. */
  readonly bossDoorRewardStore?: WorkspaceBossDoorRewardStoreControl;
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly outgoing: WorkspaceOccurrenceStageOutgoing;
}): ReactNode {
  switch (outgoing.kind) {
    case 'authoredDecision':
      throw new BiomeWorkspaceContractError(
        `${outgoing.decisionNodeKey} authored outgoing decision was not joined to its node.`,
      );
    case 'frontier':
      return (
        <section aria-label="Outgoing doors" className="outgoing-occurrence-state">
          <AuthoringFrontier frontier={outgoing.frontier} interactions={interactions} />
        </section>
      );
    case 'fixedRoom': {
      const destination = outgoing.destination;
      if (destination.kind === 'complete')
        return (
          <section aria-label="Outgoing doors" className="outgoing-occurrence-state">
            <h3>Outgoing doors</h3>
            <p className="fixed-room-state">{destination.message}</p>
          </section>
        );
      return (
        <section aria-label="Outgoing doors" className="decision-card outgoing-occurrence-state">
          <header className="decision-heading">
            <div>
              <p className="card-kicker">Outgoing doors</p>
              <h3>Door offer</h3>
            </div>
          </header>
          <div className="exit-list">
            <article aria-label={`${destination.label} room offer`} className="exit-row">
              <div className="exit-marker" aria-hidden="true" />
              <div className="exit-content">
                <div className="exit-heading">
                  <div>
                    <p className="card-kicker">Door 1</p>
                    <h4>{destination.label}</h4>
                  </div>
                  <div className="owner-markers">
                    <span className="neutral-status">Fixed</span>
                    {destination.kind === 'room' && destination.gameName !== undefined ? (
                      <RoomMapLauncher
                        gameName={destination.gameName}
                        hostId={outgoing.marker.focusKey}
                        title={destination.label}
                      />
                    ) : null}
                  </div>
                </div>
                {bossDoorRewardStore === undefined ? null : (
                  <div className="door-reward-slot">
                    <BossDoorRewardPoolRow
                      idPrefix={idPrefix}
                      interactions={interactions}
                      store={bossDoorRewardStore}
                    />
                  </div>
                )}
              </div>
            </article>
          </div>
        </section>
      );
    }
    case 'blockedOrUnentered':
    case 'topologyOwned':
    case 'terminal':
      return (
        <section aria-label="Outgoing doors" className="outgoing-occurrence-state">
          <div className="owner-markers">
            <h3>Outgoing doors</h3>
          </div>
          {bossDoorRewardStore === undefined ? null : (
            <BossDoorRewardPoolRow
              idPrefix={idPrefix}
              interactions={interactions}
              store={bossDoorRewardStore}
            />
          )}
          <p className="fixed-room-state">
            {outgoing.kind === 'blockedOrUnentered' ? outgoing.message : outgoing.label}
          </p>
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
  roomTab,
  sideRoomSlotKey,
}: Pick<
  BiomeInspectorNodeProps,
  | 'interactions'
  | 'node'
  | 'outgoing'
  | 'outgoingDecision'
  | 'findingNavigationRevision'
  | 'roomTab'
  | 'sideRoomSlotKey'
> & {
  readonly defaultToDoors?: boolean;
  readonly node: Extract<WorkspaceNode, { readonly kind: 'occurrenceWorkbench' }>;
}) {
  const sourceRemovalAnchor = node.sourceDecisionRemoval;
  const dispatch = useAppDispatch();
  const sourceRemoval =
    sourceRemovalAnchor === undefined
      ? undefined
      : requireWorkspaceInteraction(
          interactions.topologyRemovals,
          sourceRemovalAnchor.interactionKey,
        );
  return (
    <>
      <OccurrenceWorkbench
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
        renderRoomActionRowTrailingContent={(row) =>
          inspectorRoomActionTrailingContent(node.room, interactions, row)
        }
        renderLifecycleBoundaryContent={(boundary) =>
          inspectorLifecycleBoundaryContent(node.room, interactions, boundary)
        }
        renderOptionalRoomActionContent={() =>
          inspectorOptionalRoomActionContent(node.room, interactions)
        }
        {...(node.runState === undefined ? {} : { runState: node.runState })}
        {...(findingNavigationRevision === undefined ? {} : { findingNavigationRevision })}
        initialTab={roomTab ?? (defaultToDoors ? 'doors' : 'overview')}
        {...(sideRoomSlotKey === undefined ? {} : { initialSideRoomSlotKey: sideRoomSlotKey })}
        doors={
          outgoingDecision === undefined ? (
            outgoing === undefined ? undefined : (
              <OccurrenceOutgoing
                {...(node.room.bossDoorRewardStore === undefined
                  ? {}
                  : { bossDoorRewardStore: node.room.bossDoorRewardStore })}
                idPrefix={`occurrence-${node.room.occurrenceId}`}
                interactions={interactions}
                outgoing={outgoing}
              />
            )
          ) : (
            <BatchWorkbench
              interactions={interactions}
              label="Outgoing doors"
              node={outgoingDecision}
            />
          )
        }
      />
      {sourceRemovalAnchor === undefined || sourceRemoval === undefined ? null : (
        <TopologyRemovalAction interaction={sourceRemoval} label={sourceRemovalAnchor.label} />
      )}
      {node.hubFountain === undefined ? null : (
        <HubFountainControls fountain={node.hubFountain} interactions={interactions} />
      )}
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
    case 'hubDecision':
      return (
        <HubDecisionWorkbench
          frontier={props.frontier}
          {...(props.hubTab === undefined ? {} : { initialTab: props.hubTab })}
          {...(props.findingNavigationRevision === undefined
            ? {}
            : { findingNavigationRevision: props.findingNavigationRevision })}
          interactions={props.interactions}
          node={node}
        />
      );
  }
}

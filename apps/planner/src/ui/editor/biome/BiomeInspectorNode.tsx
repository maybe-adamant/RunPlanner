import type { ReactNode } from 'react';

import {
  requireWorkspaceInteraction,
  type WorkspaceAuthoringFrontier,
  type WorkspaceHubTab,
  type WorkspaceInteractionCatalog,
  type WorkspaceNode,
  type WorkspaceOccurrenceStageOutgoing,
  type WorkspaceRoomTab,
} from '@planner/projections/structured-workspace';
import { AuthoringFrontier, BatchWorkbench, TopologyRemovalAction } from './DecisionWorkbench';
import { SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';
import { HubDecisionWorkbench } from './HubDecisionWorkbench';
import { OccurrenceWorkbench } from './OccurrenceWorkbench';
import {
  inspectorLifecycleBoundaryContent,
  inspectorRoomActionContent,
  InspectorRoomOverviewContent,
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
  readonly sourceOccurrence?: Extract<WorkspaceNode, { readonly kind: 'occurrenceWorkbench' }>;
}

function OccurrenceOutgoing({
  interactions,
  outgoing,
}: {
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
    case 'blockedOrUnentered':
    case 'topologyOwned':
    case 'terminal':
    case 'fixedAutomatic':
      return (
        <section aria-label="Outgoing doors" className="outgoing-occurrence-state">
          <div className="owner-markers">
            <h3>Outgoing doors</h3>
            <SemanticOwnerMarker address={outgoing.marker.address} />
          </div>
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
  roomTab,
}: Pick<
  BiomeInspectorNodeProps,
  'interactions' | 'node' | 'outgoing' | 'outgoingDecision' | 'roomTab'
> & {
  readonly defaultToDoors?: boolean;
  readonly node: Extract<WorkspaceNode, { readonly kind: 'occurrenceWorkbench' }>;
}) {
  const sourceRemovalAnchor = node.sourceDecisionRemoval;
  const sourceRemoval =
    sourceRemovalAnchor === undefined
      ? undefined
      : requireWorkspaceInteraction(
          interactions.topologyRemovals,
          sourceRemovalAnchor.interactionKey,
        );
  return (
    <>
      <StartRoomIdentityEditor interactions={interactions} node={node} />
      <OccurrenceWorkbench
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
        renderOptionalRoomActionContent={() =>
          inspectorOptionalRoomActionContent(node.room, interactions)
        }
        renderRoomOverviewContent={() => (
          <InspectorRoomOverviewContent interactions={interactions} room={node.room} />
        )}
        {...(node.runState === undefined ? {} : { runState: node.runState })}
        initialTab={roomTab ?? (defaultToDoors ? 'doors' : 'overview')}
        doors={
          outgoingDecision === undefined ? (
            outgoing === undefined ? undefined : (
              <OccurrenceOutgoing interactions={interactions} outgoing={outgoing} />
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
          interactions={props.interactions}
          node={node}
        />
      );
  }
}

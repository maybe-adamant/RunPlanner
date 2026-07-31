import { semanticAddressKey, type SemanticAddress } from '@run-planner/engine/authored-project';
import type { ReactNode } from 'react';

import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type StructuredWorkspaceProjection,
  type WorkspaceBiome,
  type WorkspaceCompletionNode,
  type WorkspaceInteractionCatalog,
  type WorkspaceMarker,
  type WorkspaceNode,
  type WorkspaceOccurrenceWorkbenchNode,
  type WorkspaceRailEntry,
  type WorkspaceRoomSummary,
  type WorkspaceAuthoringFrontier,
} from '../../../projections/structured-workspace';
import { semanticOwnerFocused } from '../../../state/editorSessionSlice';
import { useAppDispatch, useAppSelector } from '../../../state/store';
import { FindingCount, SemanticOwnerMarker } from '../../feedback/EvaluationFeedback';
import {
  AuthoringFrontier,
  BatchWorkbench,
  LinkedExitWorkbench,
  TopologyRemovalAction,
} from './DecisionWorkbench';
import { BiomeFieldControls } from './BiomeFieldControls';
import { HubDecisionWorkbench } from './HubDecisionWorkbench';
import { OccurrenceWorkbench } from './OccurrenceWorkbench';

interface BiomeWorkspaceProps {
  readonly biome: WorkspaceBiome;
  readonly focusByOwner: StructuredWorkspaceProjection['focusByOwner'];
  readonly interactions: WorkspaceInteractionCatalog;
}

type InspectorSubject =
  | { readonly kind: 'frontier'; readonly marker: WorkspaceMarker }
  | { readonly kind: 'node'; readonly node: WorkspaceNode };

function markerMatches(marker: WorkspaceMarker, addressKey: string): boolean {
  return marker.focusKey === addressKey;
}

function roomOwnsAddress(room: WorkspaceRoomSummary, addressKey: string): boolean {
  if (markerMatches(room.marker, addressKey)) return true;
  if (room.rewardControls.some((control) => markerMatches(control.marker, addressKey))) return true;
  switch (room.roomLocal.kind) {
    case 'none':
    case 'incomingReward':
    case 'fields':
      return false;
    case 'ephyra':
      return (
        markerMatches(room.roomLocal.sideRooms.marker, addressKey) ||
        room.roomLocal.sideRooms.slots.some((side) => markerMatches(side.marker, addressKey))
      );
    case 'fixed':
      return markerMatches(room.roomLocal.marker, addressKey);
    case 'ship':
      return room.roomLocal.wheels.some(
        (wheel) =>
          markerMatches(wheel.marker, addressKey) ||
          wheel.offers.some((offer) => markerMatches(offer.control.marker, addressKey)),
      );
    case 'shop':
      return room.roomLocal.offers.some((offer) =>
        markerMatches(offer.purchase.marker, addressKey),
      );
  }
}

/** A Hub rail parent owns board controls, while visit and local-room focus stays nested. */
function hubGroupOwnsAddress(
  hub: Extract<WorkspaceNode, { readonly kind: 'hubDecision' }>,
  addressKey: string,
): boolean {
  return (
    markerMatches(hub.marker, addressKey) ||
    markerMatches(hub.openSet, addressKey) ||
    hub.slots.some((slot) => markerMatches(slot.marker, addressKey))
  );
}

/** A nested visit excludes the Hub slot marker carried for direct inspection. */
function hubVisitOwnsAddress(
  visit: Extract<WorkspaceRailEntry, { readonly kind: 'hubGroup' }>['visits'][number],
  addressKey: string,
): boolean {
  return (
    markerMatches(visit.visitMarker, addressKey) ||
    markerMatches(visit.node.marker, addressKey) ||
    visit.node.localDetailMarkers.some((marker) => markerMatches(marker, addressKey))
  );
}

function nodeOwnsAddress(node: WorkspaceNode, addressKey: string): boolean {
  if (markerMatches(node.marker, addressKey)) return true;
  switch (node.kind) {
    case 'occurrenceWorkbench':
      return (
        (node.railMarker !== undefined && markerMatches(node.railMarker, addressKey)) ||
        roomOwnsAddress(node.room, addressKey)
      );
    case 'linkedExit':
      return (
        markerMatches(node.target.marker, addressKey) ||
        roomOwnsAddress(node.target.room, addressKey)
      );
    case 'ordinaryBatch':
    case 'mixedBatch':
    case 'takeoverBatch':
      return (
        markerMatches(node.selection, addressKey) ||
        (node.rewardStore !== undefined && markerMatches(node.rewardStore, addressKey)) ||
        node.targets.some(
          (target) =>
            markerMatches(target.marker, addressKey) || roomOwnsAddress(target.room, addressKey),
        ) ||
        node.missingTargets.some((target) => markerMatches(target.marker, addressKey))
      );
    case 'completion':
      return false;
    case 'hubDecision':
      return (
        markerMatches(node.openSet, addressKey) ||
        node.slots.some(
          (slot) =>
            markerMatches(slot.marker, addressKey) ||
            (slot.room !== undefined && roomOwnsAddress(slot.room, addressKey)),
        ) ||
        node.visits.some(
          (visit) =>
            markerMatches(visit.marker, addressKey) ||
            (visit.room !== undefined && roomOwnsAddress(visit.room, addressKey)),
        )
      );
  }
}

function nodeForAddress(
  nodes: readonly WorkspaceNode[],
  addressKey: string,
): WorkspaceNode | undefined {
  const hub = nodes.find(
    (node): node is Extract<WorkspaceNode, { readonly kind: 'hubDecision' }> =>
      node.kind === 'hubDecision' && nodeOwnsAddress(node, addressKey),
  );
  if (hub !== undefined) {
    const visit = hub.visits.find((candidate) => markerMatches(candidate.marker, addressKey));
    const room =
      visit?.room ??
      hub.slots.find((slot) => slot.room !== undefined && roomOwnsAddress(slot.room, addressKey))
        ?.room ??
      hub.visits.find(
        (candidate) => candidate.room !== undefined && roomOwnsAddress(candidate.room, addressKey),
      )?.room;
    if (room !== undefined) {
      const occurrence = nodes.find(
        (node): node is WorkspaceOccurrenceWorkbenchNode =>
          node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === room.occurrenceId,
      );
      if (occurrence !== undefined) return occurrence;
    }
    return hub;
  }
  const fixedHubStage = nodes.find(
    (node): node is WorkspaceOccurrenceWorkbenchNode =>
      node.kind === 'occurrenceWorkbench' &&
      node.sourceDecisionRemoval !== undefined &&
      nodeOwnsAddress(node, addressKey),
  );
  if (fixedHubStage !== undefined) return fixedHubStage;
  const decision = nodes.find(
    (
      node,
    ): node is Extract<
      WorkspaceNode,
      { readonly kind: 'ordinaryBatch' | 'mixedBatch' | 'takeoverBatch' }
    > =>
      (node.kind === 'ordinaryBatch' ||
        node.kind === 'mixedBatch' ||
        node.kind === 'takeoverBatch') &&
      nodeOwnsAddress(node, addressKey),
  );
  if (decision !== undefined) return decision;
  const linked = nodes.find(
    (node): node is Extract<WorkspaceNode, { readonly kind: 'linkedExit' }> =>
      node.kind === 'linkedExit' && nodeOwnsAddress(node, addressKey),
  );
  if (linked !== undefined) return linked;
  const occurrence = nodes.find(
    (node): node is WorkspaceOccurrenceWorkbenchNode =>
      node.kind === 'occurrenceWorkbench' && nodeOwnsAddress(node, addressKey),
  );
  if (occurrence !== undefined) return occurrence;
  return nodes.find((node) => nodeOwnsAddress(node, addressKey));
}

function fallbackSubject(biome: WorkspaceBiome): InspectorSubject | undefined {
  const incompleteDecision = biome.nodes
    .filter(
      (
        node,
      ): node is Extract<
        WorkspaceNode,
        { readonly kind: 'ordinaryBatch' | 'mixedBatch' | 'takeoverBatch' }
      > =>
        (node.kind === 'ordinaryBatch' ||
          node.kind === 'mixedBatch' ||
          node.kind === 'takeoverBatch') &&
        node.source.kind !== 'hubDecision' &&
        (node.topologyState === 'partial' ||
          node.missingTargets.length > 0 ||
          (node.targets.length > 0 && !node.targets.some((target) => target.selected))),
    )
    .at(-1);
  // An untouched workspace should lead with the next truthful authoring
  // frontier. Commands explicitly focus their created occurrence or decision,
  // so revealing this frontier never steals focus after an edit.
  if (biome.frontier?.kind === 'start' || biome.frontier?.kind === 'exitDecision') {
    if (biome.frontier.kind === 'exitDecision') {
      const frontierOwner = biome.frontier.owner;
      const frontierDecision = biome.nodes.find(
        (
          node,
        ): node is Extract<
          WorkspaceNode,
          { readonly kind: 'ordinaryBatch' | 'mixedBatch' | 'takeoverBatch' }
        > =>
          (node.kind === 'ordinaryBatch' ||
            node.kind === 'mixedBatch' ||
            node.kind === 'takeoverBatch') &&
          node.source.kind !== 'hubDecision' &&
          semanticAddressKey(node.owner) === semanticAddressKey(frontierOwner),
      );
      if (frontierDecision !== undefined) return { kind: 'node', node: frontierDecision };
    }
    if (
      biome.frontier.kind === 'exitDecision' &&
      biome.frontier.owner.source.kind === 'hubDecision'
    ) {
      const hub = biome.nodes.find(
        (node): node is Extract<WorkspaceNode, { readonly kind: 'hubDecision' }> =>
          node.kind === 'hubDecision',
      );
      if (hub !== undefined) return { kind: 'node', node: hub };
    }
    return { kind: 'frontier', marker: biome.frontier.marker };
  }
  if (
    biome.frontier?.kind === 'hubDecision' ||
    biome.frontier?.kind === 'hubVisit' ||
    biome.frontier?.kind === 'hubOpenSet'
  ) {
    const hub = biome.nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'hubDecision' }> =>
        node.kind === 'hubDecision',
    );
    if (hub !== undefined) return { kind: 'node', node: hub };
  }
  if (incompleteDecision !== undefined) return { kind: 'node', node: incompleteDecision };
  const activeDetails = biome.nodes
    .filter(
      (node): node is WorkspaceOccurrenceWorkbenchNode =>
        node.kind === 'occurrenceWorkbench' && node.room.detailsActive,
    )
    .at(-1);
  if (activeDetails !== undefined) {
    if (activeDetails.sourceDecisionRemoval !== undefined) {
      return { kind: 'node', node: activeDetails };
    }
    const decision = biome.nodes.find(
      (
        node,
      ): node is Extract<
        WorkspaceNode,
        { readonly kind: 'ordinaryBatch' | 'mixedBatch' | 'takeoverBatch' }
      > =>
        (node.kind === 'ordinaryBatch' ||
          node.kind === 'mixedBatch' ||
          node.kind === 'takeoverBatch') &&
        node.targets.some((target) => target.room.occurrenceId === activeDetails.room.occurrenceId),
    );
    if (decision !== undefined) return { kind: 'node', node: decision };
    const hub = biome.nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'hubDecision' }> =>
        node.kind === 'hubDecision' &&
        node.slots.some((slot) => slot.room?.occurrenceId === activeDetails.room.occurrenceId),
    );
    if (hub !== undefined) return { kind: 'node', node: hub };
    return { kind: 'node', node: activeDetails };
  }
  const entry = biome.entry;
  if (entry !== undefined) return { kind: 'node', node: entry };
  const first = biome.nodes[0];
  return first === undefined ? undefined : { kind: 'node', node: first };
}

function ownsBiome(address: SemanticAddress, biome: WorkspaceBiome): boolean {
  if (!('biomeKey' in address) || !('routeKey' in address)) return false;
  const biomeAddress = biome.marker.address;
  return (
    biomeAddress.kind === 'biome' &&
    address.routeKey === biomeAddress.routeKey &&
    address.biomeKey === biomeAddress.biomeKey
  );
}

function assessmentLabel(marker: WorkspaceMarker): string {
  if (marker.findingCount > 0)
    return `${marker.findingCount} finding${marker.findingCount === 1 ? '' : 's'}`;
  switch (marker.assessment) {
    case 'assessed':
      return 'Assessed';
    case 'blocked':
      return 'Blocked';
    case 'unassessed':
      return 'Unassessed';
  }
}

function nodeLabel(node: WorkspaceNode): string {
  switch (node.kind) {
    case 'occurrenceWorkbench':
      return node.room.label;
    case 'linkedExit':
      return `Linked exit · ${node.target.room.label}`;
    case 'ordinaryBatch':
      return 'Normal exits';
    case 'mixedBatch':
      return 'Mixed normal exits';
    case 'takeoverBatch':
      return 'Preboss batch';
    case 'completion':
      return node.label;
    case 'hubDecision':
      return 'Ephyra Hub';
  }
}

function nodeKicker(node: WorkspaceNode): string {
  switch (node.kind) {
    case 'occurrenceWorkbench':
      return 'Biome stage';
    case 'linkedExit':
      return 'Biome stage';
    case 'ordinaryBatch':
    case 'mixedBatch':
      return 'Decision point';
    case 'takeoverBatch':
      return 'Biome stage';
    case 'completion':
      return node.role === 'postboss' ? 'Postboss' : 'Boss';
    case 'hubDecision':
      return 'Hub decision';
  }
}

function railMarker(node: WorkspaceNode): WorkspaceMarker {
  return node.kind === 'occurrenceWorkbench' ? (node.railMarker ?? node.room.marker) : node.marker;
}

function FocusButton({
  children,
  marker,
  presentationMarker = marker,
  selected,
}: {
  readonly children: ReactNode;
  readonly marker: WorkspaceMarker;
  /** May retain a distinct staged-owner assessment while focus stays on a room. */
  readonly presentationMarker?: WorkspaceMarker;
  readonly selected: boolean;
}) {
  const dispatch = useAppDispatch();
  return (
    <button
      aria-pressed={selected}
      className="biome-rail-node"
      data-assessment={presentationMarker.assessment}
      data-findings={presentationMarker.findingCount > 0}
      data-selected={selected}
      data-workspace-node={marker.focusKey}
      onClick={() => dispatch(semanticOwnerFocused(marker.address))}
      type="button"
    >
      {children}
    </button>
  );
}

function RailNode({
  entry,
  selectedAddressKey,
}: {
  readonly entry: Extract<WorkspaceRailEntry, { readonly kind: 'node' }>;
  readonly selectedAddressKey: string | undefined;
}) {
  const { marker, node } = entry;
  const selected = selectedAddressKey !== undefined && nodeOwnsAddress(node, selectedAddressKey);
  return (
    <div className="biome-rail-stop" data-kind={node.kind}>
      <FocusButton marker={marker} selected={selected}>
        <span className="biome-rail-kicker">{nodeKicker(node)}</span>
        <strong>{entry.label}</strong>
        {entry.summary === undefined ? null : (
          <span className="biome-rail-summary">{entry.summary}</span>
        )}
        <span className="biome-rail-status">
          {assessmentLabel(marker)}
          <FindingCount count={marker.findingCount} label="findings" />
        </span>
      </FocusButton>
    </div>
  );
}

function RailFrontier({
  frontier,
  selectedAddressKey,
}: {
  readonly frontier: Extract<
    WorkspaceAuthoringFrontier,
    { readonly kind: 'start' | 'exitDecision' }
  >;
  readonly selectedAddressKey: string | undefined;
}) {
  return (
    <div className="biome-rail-stop biome-frontier-stop">
      <FocusButton
        marker={frontier.marker}
        selected={selectedAddressKey === frontier.marker.focusKey}
      >
        <span className="biome-rail-kicker">Coverage frontier</span>
        <strong>
          {frontier.kind === 'start' ? 'Start biome here' : 'Continue authoring here'}
        </strong>
        <span className="biome-rail-status">{assessmentLabel(frontier.marker)}</span>
      </FocusButton>
    </div>
  );
}

function HubRailVisit({
  selectedAddressKey,
  visit,
}: {
  readonly selectedAddressKey: string | undefined;
  readonly visit: Extract<WorkspaceRailEntry, { readonly kind: 'hubGroup' }>['visits'][number];
}) {
  const selected =
    selectedAddressKey !== undefined && hubVisitOwnsAddress(visit, selectedAddressKey);
  return (
    <li className="biome-hub-rail-visit">
      <FocusButton marker={visit.marker} presentationMarker={visit.visitMarker} selected={selected}>
        <span className="biome-rail-kicker">Hub visit</span>
        <strong>{visit.label}</strong>
        <span className="biome-rail-status">
          {assessmentLabel(visit.visitMarker)}
          <FindingCount count={visit.visitMarker.findingCount} label="findings" />
        </span>
      </FocusButton>
    </li>
  );
}

function HubRailGroup({
  entry,
  selectedAddressKey,
}: {
  readonly entry: Extract<WorkspaceRailEntry, { readonly kind: 'hubGroup' }>;
  readonly selectedAddressKey: string | undefined;
}) {
  const selected =
    selectedAddressKey !== undefined && hubGroupOwnsAddress(entry.node, selectedAddressKey);
  return (
    <div className="biome-rail-stop biome-hub-rail-group" data-kind="hubDecision">
      <FocusButton marker={entry.marker} selected={selected}>
        <span className="biome-rail-kicker">Persistent board</span>
        <strong>Hub</strong>
        <span className="biome-rail-summary">
          {entry.visits.length} of {entry.node.requiredVisitCount} visits
        </span>
        <span className="biome-rail-status">
          {assessmentLabel(entry.marker)}
          <FindingCount count={entry.marker.findingCount} label="findings" />
        </span>
      </FocusButton>
      {entry.visits.length === 0 ? null : (
        <ol aria-label="Hub visits" className="biome-hub-rail-visits">
          {entry.visits.map((visit) => (
            <HubRailVisit key={visit.key} selectedAddressKey={selectedAddressKey} visit={visit} />
          ))}
        </ol>
      )}
    </div>
  );
}

function RailEntry({
  entry,
  selectedAddressKey,
}: {
  readonly entry: WorkspaceRailEntry;
  readonly selectedAddressKey: string | undefined;
}) {
  switch (entry.kind) {
    case 'node':
      return <RailNode entry={entry} selectedAddressKey={selectedAddressKey} />;
    case 'hubGroup':
      return <HubRailGroup entry={entry} selectedAddressKey={selectedAddressKey} />;
    case 'frontier':
      return <RailFrontier frontier={entry.frontier} selectedAddressKey={selectedAddressKey} />;
  }
}

function CompletionWorkbench({ node }: { readonly node: WorkspaceCompletionNode }) {
  return (
    <article className="biome-completion-workbench">
      <p className="card-kicker">{node.role === 'postboss' ? 'Postboss' : 'Boss'}</p>
      <h3>{node.label}</h3>
      <SemanticOwnerMarker address={node.marker.address} />
      <p>
        This completion room is derived from the biome layout and is not an authored occurrence.
      </p>
    </article>
  );
}

function InspectorNode({
  frontier,
  interactions,
  label,
  nextFrontier,
  node,
}: {
  readonly frontier: WorkspaceAuthoringFrontier | null;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly label: string;
  readonly nextFrontier?: Extract<WorkspaceAuthoringFrontier, { readonly kind: 'exitDecision' }>;
  readonly node: WorkspaceNode;
}) {
  switch (node.kind) {
    case 'occurrenceWorkbench': {
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
          <OccurrenceWorkbench
            interactions={interactions}
            {...(nextFrontier === undefined ? {} : { nextFrontier: nextFrontier.marker })}
            presentation={node.inspectorPresentation}
            room={node.room}
          />
          {sourceRemovalAnchor === undefined || sourceRemoval === undefined ? null : (
            <TopologyRemovalAction interaction={sourceRemoval} label={sourceRemovalAnchor.label} />
          )}
        </>
      );
    }
    case 'linkedExit':
      return <LinkedExitWorkbench interactions={interactions} node={node} />;
    case 'ordinaryBatch':
    case 'mixedBatch':
    case 'takeoverBatch':
      return (
        <BatchWorkbench
          interactions={interactions}
          label={label}
          {...(nextFrontier === undefined ? {} : { nextFrontier: nextFrontier.marker })}
          node={node}
        />
      );
    case 'completion':
      return <CompletionWorkbench node={node} />;
    case 'hubDecision':
      return <HubDecisionWorkbench frontier={frontier} interactions={interactions} node={node} />;
  }
}

function CompletionOutline({
  completion,
}: {
  readonly completion: WorkspaceBiome['completionOutline'];
}) {
  if (completion.length === 0) return null;
  return (
    <section aria-label="Biome completion" className="biome-completion-outline">
      <p className="card-kicker">Completion</p>
      <ol>
        {completion.map((node) => {
          const roleLabel = node.role === 'postboss' ? 'Postboss' : 'Boss';
          return (
            <li key={node.key}>
              <span>{roleLabel}</span>
              {node.label === roleLabel ? null : <strong>{node.label}</strong>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function structureLabelForNode(biome: WorkspaceBiome, node: WorkspaceNode): string {
  for (const entry of biome.rail) {
    if (entry.kind === 'node' && entry.node.key === node.key) return entry.label;
    if (entry.kind === 'hubGroup' && entry.node.key === node.key) return 'Hub';
  }
  return nodeLabel(node);
}

/**
 * Projection-driven workbench for every biome.  It intentionally has
 * no catalog or authored-plan prop: structural facts and room-local state come
 * exclusively from the Slice 3a workspace envelope and semantic interactions.
 */
export function BiomeWorkspace({ biome, focusByOwner, interactions }: BiomeWorkspaceProps) {
  const focusedOwner = useAppSelector((state) => state.editorSession.focusedSemanticOwner);
  const explicitDestination =
    focusedOwner !== null && ownsBiome(focusedOwner, biome)
      ? focusByOwner.get(semanticAddressKey(focusedOwner))
      : undefined;
  const explicitAddress =
    focusedOwner !== null && ownsBiome(focusedOwner, biome)
      ? (explicitDestination?.focusAddress ?? focusedOwner)
      : undefined;
  const explicitKey =
    explicitAddress === undefined ? undefined : semanticAddressKey(explicitAddress);
  const completedHubHandoffNode =
    explicitKey === undefined ||
    biome.frontier?.kind !== 'exitDecision' ||
    biome.frontier.owner.source.kind !== 'hubDecision' ||
    !markerMatches(biome.frontier.marker, explicitKey)
      ? undefined
      : biome.nodes.find(
          (node): node is Extract<WorkspaceNode, { readonly kind: 'hubDecision' }> =>
            node.kind === 'hubDecision',
        );
  const explicitNode =
    explicitKey === undefined
      ? undefined
      : (biome.nodes.find((node) => node.key === explicitDestination?.nodeKey) ??
        nodeForAddress(biome.nodes, explicitKey) ??
        completedHubHandoffNode);
  const explicitFrontier =
    explicitKey === undefined ||
    biome.frontier === null ||
    (biome.frontier.kind !== 'start' && biome.frontier.kind !== 'exitDecision') ||
    (biome.frontier.kind === 'exitDecision' &&
      biome.frontier.owner.source.kind === 'hubDecision') ||
    !markerMatches(biome.frontier.marker, explicitKey)
      ? undefined
      : ({ kind: 'frontier', marker: biome.frontier.marker } as const);
  const fallback = fallbackSubject(biome);
  const subject: InspectorSubject | undefined =
    explicitNode === undefined
      ? (explicitFrontier ?? fallback)
      : { kind: 'node', node: explicitNode };
  const selectedAddressKey =
    explicitKey ??
    (subject?.kind === 'frontier'
      ? subject.marker.focusKey
      : subject?.kind === 'node'
        ? railMarker(subject.node).focusKey
        : undefined);
  const inspectorTitle =
    subject?.kind === 'frontier'
      ? 'Active frontier'
      : subject?.kind === 'node'
        ? structureLabelForNode(biome, subject.node)
        : biome.label;
  const exitFrontier =
    biome.frontier?.kind === 'exitDecision' && biome.frontier.owner.source.kind !== 'hubDecision'
      ? biome.frontier
      : undefined;
  const nearbyFrontier =
    subject?.kind === 'node' &&
    exitFrontier?.predecessorNodeKey !== undefined &&
    subject.node.key === exitFrontier.predecessorNodeKey
      ? exitFrontier
      : undefined;
  const clearTopology =
    biome.entry === undefined
      ? undefined
      : requireWorkspaceInteraction(
          interactions.topologyRemovals,
          workspaceInteractionKey(biome.marker.address),
        );

  return (
    <div className="biome-workspace">
      <section
        aria-label={`${biome.label} structure`}
        className="biome-structure-region"
        data-source={biome.source}
        data-status={biome.status}
      >
        <header className="biome-structure-heading">
          <div>
            <p className="eyebrow">Biome structure</p>
            <h2>{biome.label}</h2>
          </div>
          <span className="neutral-status">{biome.source}</span>
        </header>
        {clearTopology === undefined ? null : (
          <TopologyRemovalAction interaction={clearTopology} label={`Clear ${biome.label}`} />
        )}
        <div className="biome-rail">
          {biome.rail.map((entry) => (
            <RailEntry entry={entry} key={entry.key} selectedAddressKey={selectedAddressKey} />
          ))}
        </div>
        <CompletionOutline completion={biome.completionOutline} />
      </section>
      <aside aria-label="Focused inspector" className="biome-inspector">
        <header className="biome-inspector-heading">
          <p className="eyebrow">Focused inspector</p>
          <h2>{inspectorTitle}</h2>
        </header>
        {biome.entry === undefined ? null : <BiomeFieldControls fields={biome.fields} />}
        {subject === undefined ? (
          <p className="fixed-room-state">No authored structure is available yet.</p>
        ) : subject.kind === 'frontier' ? (
          biome.frontier?.kind === 'start' || biome.frontier?.kind === 'exitDecision' ? (
            <AuthoringFrontier frontier={biome.frontier} interactions={interactions} />
          ) : null
        ) : (
          <InspectorNode
            frontier={biome.frontier}
            interactions={interactions}
            label={inspectorTitle}
            {...(nearbyFrontier === undefined ? {} : { nextFrontier: nearbyFrontier })}
            node={subject.node}
          />
        )}
      </aside>
    </div>
  );
}

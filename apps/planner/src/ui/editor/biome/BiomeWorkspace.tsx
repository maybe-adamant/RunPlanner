import { semanticAddressKey, type SemanticAddress } from '@run-planner/engine/authored-project';
import type { ReactNode } from 'react';

import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type StructuredWorkspaceProjection,
  type WorkspaceBiome,
  type WorkspaceCompletionNode,
  type WorkspaceDefaultInspectorDestination,
  type WorkspaceInspectorDestination,
  type WorkspaceInteractionCatalog,
  type WorkspaceMarker,
  type WorkspaceNode,
  type WorkspaceRailEntry,
  type WorkspaceRailReward,
  type WorkspaceRailSelectedTarget,
  type WorkspaceAuthoringFrontier,
} from '@planner/projections/structured-workspace';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';
import { FindingCount, SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';
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

function ownsBiome(address: SemanticAddress, biome: WorkspaceBiome): boolean {
  if (!('biomeKey' in address) || !('routeKey' in address)) return false;
  return address.routeKey === biome.owner.routeKey && address.biomeKey === biome.owner.biomeKey;
}

/** React resolves projected keys only; containment and fallback policy stay in projection. */
function resolveInspectorSubject(
  biome: WorkspaceBiome,
  destination:
    | WorkspaceDefaultInspectorDestination
    | WorkspaceInspectorDestination['inspectorSubject']
    | undefined,
): InspectorSubject | undefined {
  if (destination === undefined) return undefined;
  switch (destination.kind) {
    case 'node': {
      const node = biome.nodes.find((candidate) => candidate.key === destination.nodeKey);
      return node === undefined ? undefined : { kind: 'node', node };
    }
    case 'frontier': {
      const frontier = biome.frontier;
      if (
        (frontier?.kind !== 'start' && frontier?.kind !== 'exitDecision') ||
        frontier.marker.focusKey !== destination.frontierFocusKey
      ) {
        return undefined;
      }
      return { kind: 'frontier', marker: frontier.marker };
    }
  }
}

function assessmentLabel(marker: WorkspaceMarker): string {
  if (marker.findingCount > 0)
    return `${marker.findingCount} finding${marker.findingCount === 1 ? '' : 's'}`;
  switch (marker.assessment) {
    case 'assessed':
      return 'Evaluated';
    case 'blocked':
      return 'Blocked';
    case 'unassessed':
      return 'Not evaluated';
  }
}

function nodeLabel(node: WorkspaceNode): string {
  switch (node.kind) {
    case 'occurrenceWorkbench':
      return node.room.label;
    case 'linkedExit':
      return `Fixed next room · ${node.target.room.label}`;
    case 'ordinaryBatch':
      return 'Doors';
    case 'mixedBatch':
      return 'Doors';
    case 'takeoverBatch':
      return 'Preboss doors';
    case 'completion':
      return node.label;
    case 'hubDecision':
      return 'Hub';
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
      return 'Door choice';
    case 'takeoverBatch':
      return 'Biome stage';
    case 'completion':
      return node.role === 'postboss' ? 'Postboss' : 'Boss';
    case 'hubDecision':
      return 'Hub';
  }
}

function FocusButton({
  accessibleLabel,
  children,
  marker,
  presentationMarker = marker,
  selected,
}: {
  readonly accessibleLabel?: string;
  readonly children: ReactNode;
  readonly marker: WorkspaceMarker;
  /** May retain a distinct staged-owner assessment while focus stays on a room. */
  readonly presentationMarker?: WorkspaceMarker;
  readonly selected: boolean;
}) {
  const dispatch = useAppDispatch();
  return (
    <button
      aria-label={accessibleLabel}
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

/** Keeps the current text fallback isolated from a future compact reward token. */
function RailReward({ reward }: { readonly reward: WorkspaceRailReward }) {
  return <span className="biome-rail-reward">{reward.label}</span>;
}

function RailSelectedTarget({
  selectedTarget,
}: {
  readonly selectedTarget: WorkspaceRailSelectedTarget;
}) {
  return (
    <span className="biome-rail-selection">
      {selectedTarget.roomLabel}
      {selectedTarget.reward === undefined ? null : (
        <>
          {' · '}
          <RailReward reward={selectedTarget.reward} />
        </>
      )}
    </span>
  );
}

function RailNode({
  entry,
  selectedRailKey,
}: {
  readonly entry: Extract<WorkspaceRailEntry, { readonly kind: 'node' }>;
  readonly selectedRailKey: string | undefined;
}) {
  const { marker, node } = entry;
  const selected = selectedRailKey === marker.focusKey;
  return (
    <div className="biome-rail-stop" data-kind={node.kind}>
      <FocusButton marker={marker} selected={selected}>
        <span className="biome-rail-kicker">{nodeKicker(node)}</span>
        <strong>{entry.label}</strong>
        {entry.selectedTarget === undefined ? null : (
          <RailSelectedTarget selectedTarget={entry.selectedTarget} />
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
  interactions,
  selectedRailKey,
}: {
  readonly frontier: Extract<
    WorkspaceAuthoringFrontier,
    { readonly kind: 'start' | 'exitDecision' }
  >;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly selectedRailKey: string | undefined;
}) {
  const start =
    frontier.kind !== 'start'
      ? undefined
      : requireWorkspaceInteraction(interactions.starts, frontier.interactionKey);
  const label =
    frontier.kind === 'start'
      ? start?.kind === 'fixed'
        ? `Start with ${start.fixedLabel}`
        : 'Choose the first room'
      : 'Continue route';
  return (
    <div className="biome-rail-stop biome-frontier-stop">
      <FocusButton marker={frontier.marker} selected={selectedRailKey === frontier.marker.focusKey}>
        <span className="biome-rail-kicker">Next step</span>
        <strong>{label}</strong>
        <span className="biome-rail-status">{assessmentLabel(frontier.marker)}</span>
      </FocusButton>
    </div>
  );
}

function HubRailVisit({
  selectedRailKey,
  visit,
}: {
  readonly selectedRailKey: string | undefined;
  readonly visit: Extract<WorkspaceRailEntry, { readonly kind: 'hubGroup' }>['visits'][number];
}) {
  const selected = selectedRailKey === visit.marker.focusKey;
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
  selectedRailKey,
}: {
  readonly entry: Extract<WorkspaceRailEntry, { readonly kind: 'hubGroup' }>;
  readonly selectedRailKey: string | undefined;
}) {
  const selected = selectedRailKey === entry.marker.focusKey;
  const assessment = assessmentLabel(entry.marker);
  return (
    <div className="biome-rail-stop biome-hub-rail-group" data-kind="hubDecision">
      <FocusButton
        accessibleLabel={`Hub, ${entry.visits.length} of ${entry.node.requiredVisitCount} visits, ${assessment}`}
        marker={entry.marker}
        selected={selected}
      >
        <strong>Hub</strong>
        <span className="biome-rail-summary">
          {entry.visits.length} of {entry.node.requiredVisitCount} visits
        </span>
        <span className="biome-rail-status">
          {assessment}
          <FindingCount count={entry.marker.findingCount} label="findings" />
        </span>
      </FocusButton>
      {entry.visits.length === 0 ? null : (
        <ol aria-label="Hub visits" className="biome-hub-rail-visits">
          {entry.visits.map((visit) => (
            <HubRailVisit key={visit.key} selectedRailKey={selectedRailKey} visit={visit} />
          ))}
        </ol>
      )}
    </div>
  );
}

function RailEntry({
  entry,
  interactions,
  selectedRailKey,
}: {
  readonly entry: WorkspaceRailEntry;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly selectedRailKey: string | undefined;
}) {
  switch (entry.kind) {
    case 'node':
      return <RailNode entry={entry} selectedRailKey={selectedRailKey} />;
    case 'hubGroup':
      return <HubRailGroup entry={entry} selectedRailKey={selectedRailKey} />;
    case 'frontier':
      return (
        <RailFrontier
          frontier={entry.frontier}
          interactions={interactions}
          selectedRailKey={selectedRailKey}
        />
      );
  }
}

function CompletionWorkbench({ node }: { readonly node: WorkspaceCompletionNode }) {
  return (
    <article className="biome-completion-workbench">
      <p className="card-kicker">{node.role === 'postboss' ? 'Postboss' : 'Boss'}</p>
      <h3>{node.label}</h3>
      <SemanticOwnerMarker address={node.marker.address} />
      <p>This room is added automatically after the biome.</p>
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
  const scopedFocusedOwner =
    focusedOwner !== null && ownsBiome(focusedOwner, biome) ? focusedOwner : undefined;
  const explicitDestination =
    scopedFocusedOwner === undefined
      ? undefined
      : focusByOwner.get(semanticAddressKey(scopedFocusedOwner));
  const defaultSubject = resolveInspectorSubject(
    biome,
    biome.defaultInspectorDestination ?? undefined,
  );
  const subject =
    scopedFocusedOwner === undefined
      ? defaultSubject
      : (resolveInspectorSubject(biome, explicitDestination?.inspectorSubject) ?? defaultSubject);
  // An explicit semantic owner intentionally suppresses default rail selection
  // when it resolves through a coarse fallback or is stale after a removal.
  const selectedRailKey =
    scopedFocusedOwner === undefined
      ? biome.defaultInspectorDestination?.selectedRailKey
      : explicitDestination?.selectedRailKey;
  const inspectorTitle =
    subject?.kind === 'frontier'
      ? 'Next step'
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
          workspaceInteractionKey(biome.owner),
        );

  return (
    <div className="biome-workspace">
      <section
        aria-label={`${biome.label} route structure`}
        className="biome-structure-region"
        data-source={biome.source}
        data-status={biome.status}
      >
        <header className="biome-structure-heading">
          <div>
            <p className="eyebrow">Route structure</p>
            <h2>{biome.label}</h2>
          </div>
        </header>
        {clearTopology === undefined ? null : (
          <TopologyRemovalAction interaction={clearTopology} label={`Clear ${biome.label}`} />
        )}
        <div className="biome-rail">
          {biome.rail.map((entry) => (
            <RailEntry
              entry={entry}
              interactions={interactions}
              key={entry.key}
              selectedRailKey={selectedRailKey}
            />
          ))}
        </div>
        <CompletionOutline completion={biome.completionOutline} />
      </section>
      <aside aria-label="Details" className="biome-inspector">
        <header className="biome-inspector-heading">
          <p className="eyebrow">Details</p>
          <h2>{inspectorTitle}</h2>
        </header>
        {biome.entry === undefined ? null : <BiomeFieldControls fields={biome.fields} />}
        {subject === undefined ? (
          <p className="fixed-room-state">Choose the first room to start this biome.</p>
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

import { semanticAddressKey, type SemanticAddress } from '@run-planner/engine/authored-project';
import { type ReactNode } from 'react';

import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type StructuredWorkspaceProjection,
  type WorkspaceBiome,
  type WorkspaceDefaultInspectorDestination,
  type WorkspaceInspectorDestination,
  type WorkspaceInteractionCatalog,
  type WorkspaceAuthoringFrontier,
  type WorkspaceMarker,
  type WorkspaceNode,
  type WorkspaceRailEntry,
  type WorkspaceRailReward,
  type WorkspaceRailSelectedTarget,
} from '@planner/projections/structured-workspace';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';
import { FindingCount } from '@planner/ui/feedback/EvaluationFeedback';
import { AuthoringFrontier, TopologyRemovalAction } from './DecisionWorkbench';
import { BiomeFieldControls } from './BiomeFieldControls';
import { RunStateSheet } from './RunStateSheet';
import { EchoKeepsakeReplayControl } from './BiomeInspectorControls';
import { BiomeInspectorNode } from './BiomeInspectorNode';

interface BiomeWorkspaceProps {
  readonly biome: WorkspaceBiome;
  readonly focusByOwner: StructuredWorkspaceProjection['focusByOwner'];
  readonly interactions: WorkspaceInteractionCatalog;
  readonly runStateLaunchers: StructuredWorkspaceProjection['runStateLaunchers'];
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
    case 'ordinaryBatch':
      return 'Doors';
    case 'mixedBatch':
      return 'Doors';
    case 'takeoverBatch':
      return 'Preboss doors';
    case 'hubDecision':
      return 'Hub';
  }
}

function structureLabelForNode(biome: WorkspaceBiome, node: WorkspaceNode): string {
  for (const entry of biome.rail) {
    if (entry.kind === 'node' && entry.node.key === node.key) return entry.label;
    if (entry.kind === 'hubGroup' && entry.node.key === node.key) return 'Hub';
  }
  return nodeLabel(node);
}

function FocusButton({
  accessibleLabel,
  children,
  marker,
  focusMarker = marker,
  presentationMarker = marker,
  selected,
}: {
  readonly accessibleLabel?: string;
  readonly children: ReactNode;
  /** Exact navigation owner when presentation remains attached to another semantic stage. */
  readonly focusMarker?: WorkspaceMarker;
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
      onClick={() => dispatch(semanticOwnerFocused(focusMarker.address))}
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

function RailMainReward({ reward }: { readonly reward: WorkspaceRailReward }) {
  return (
    <span className="biome-rail-selection">
      <span className="visually-hidden">Main reward: </span>
      <RailReward reward={reward} />
    </span>
  );
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
      <FocusButton focusMarker={entry.focusMarker ?? marker} marker={marker} selected={selected}>
        <span className="biome-rail-heading">
          <strong>{entry.label}</strong>
          <span className="biome-rail-status">
            {assessmentLabel(marker)}
            <FindingCount count={marker.findingCount} label="findings" />
          </span>
        </span>
        {entry.selectedTarget === undefined ? null : (
          <RailSelectedTarget selectedTarget={entry.selectedTarget} />
        )}
        {entry.mainReward === undefined ? null : <RailMainReward reward={entry.mainReward} />}
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
        <span className="biome-rail-heading">
          <strong>{visit.label}</strong>
          <span className="biome-rail-status">
            {assessmentLabel(visit.visitMarker)}
            <FindingCount count={visit.visitMarker.findingCount} label="findings" />
          </span>
        </span>
        {visit.mainReward === undefined ? null : <RailMainReward reward={visit.mainReward} />}
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
        <span className="biome-rail-heading">
          <strong>Hub</strong>
          <span className="biome-rail-status">
            {assessment}
            <FindingCount count={entry.marker.findingCount} label="findings" />
          </span>
        </span>
        <span className="biome-rail-summary">
          {entry.visits.length} of {entry.node.requiredVisitCount} visits
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

function CompletionOutline({
  completion,
  selectedNodeKey,
}: {
  readonly completion: WorkspaceBiome['completionOutline'];
  readonly selectedNodeKey?: string;
}) {
  const dispatch = useAppDispatch();
  if (completion.length === 0) return null;
  return (
    <section aria-label="Biome completion" className="biome-completion-outline">
      <p className="card-kicker">Completion</p>
      <ol>
        {completion.map((node) => {
          const roleLabel = node.room.kind === 'PostBoss' ? 'Postboss' : 'Boss';
          const focusOwner =
            node.room.judgment?.marker.address ??
            node.room.figurine?.marker.address ??
            node.room.keepsakeSelection?.marker.address ??
            node.marker.address;
          return (
            <li key={node.key}>
              <button
                aria-label={`Open ${roleLabel} completion`}
                aria-pressed={selectedNodeKey === node.key}
                className="biome-completion-node"
                data-assessment={node.marker.assessment}
                data-findings={node.marker.findingCount > 0}
                onClick={() => dispatch(semanticOwnerFocused(focusOwner))}
                type="button"
              >
                <span>{roleLabel}</span>
                {node.room.label === roleLabel ? null : <strong>{node.room.label}</strong>}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * Projection-driven workbench for every biome.  It intentionally has
 * no catalog or authored-plan prop: structural facts and room-local state come
 * exclusively from the Slice 3a workspace envelope and semantic interactions.
 */
export function BiomeWorkspace({
  biome,
  focusByOwner,
  interactions,
  runStateLaunchers,
}: BiomeWorkspaceProps) {
  const runStateTarget = useAppSelector((state) => state.editorSession.runStateTarget);
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
  const clearTopology =
    biome.entry === undefined
      ? undefined
      : requireWorkspaceInteraction(
          interactions.topologyRemovals,
          workspaceInteractionKey(biome.owner),
        );
  const runState =
    runStateTarget === null || runStateTarget === undefined
      ? undefined
      : runStateLaunchers.get(semanticAddressKey(runStateTarget));
  const selectedNodeKey = subject?.kind === 'node' ? subject.node.key : undefined;
  const selectedStage = biome.occurrenceStages.find((stage) => {
    if (stage.sourceOccurrenceNodeKey === selectedNodeKey) return true;
    if (
      stage.outgoing.kind === 'authoredDecision' &&
      stage.outgoing.decisionNodeKey === selectedNodeKey
    ) {
      return true;
    }
    return (
      subject?.kind === 'frontier' &&
      stage.outgoing.kind === 'frontier' &&
      stage.outgoing.frontier.marker.focusKey === subject.marker.focusKey
    );
  });
  const sourceOccurrenceCandidate =
    selectedStage === undefined
      ? undefined
      : biome.nodes.find((node) => node.key === selectedStage.sourceOccurrenceNodeKey);
  const sourceOccurrence =
    sourceOccurrenceCandidate?.kind === 'occurrenceWorkbench'
      ? sourceOccurrenceCandidate
      : undefined;
  const selectedOutgoing = selectedStage?.outgoing;
  const outgoingDecisionCandidate =
    selectedOutgoing?.kind !== 'authoredDecision'
      ? undefined
      : biome.nodes.find((node) => node.key === selectedOutgoing.decisionNodeKey);
  const outgoingDecision =
    outgoingDecisionCandidate?.kind === 'ordinaryBatch' ||
    outgoingDecisionCandidate?.kind === 'mixedBatch' ||
    outgoingDecisionCandidate?.kind === 'takeoverBatch'
      ? outgoingDecisionCandidate
      : undefined;
  const rendersOccurrenceWorkbench =
    sourceOccurrence !== undefined ||
    (subject?.kind === 'node' && subject.node.kind === 'occurrenceWorkbench');

  return (
    <div className="biome-workspace">
      {runState === undefined ? null : <RunStateSheet launcher={runState} />}
      <section
        aria-label={`${biome.label} route structure`}
        className="biome-structure-region"
        data-source={biome.source}
        data-status={biome.status}
      >
        <header className="biome-structure-heading">
          <div className="biome-structure-title">
            <p className="eyebrow">Route structure</p>
            <div className="biome-structure-title-row">
              <h2>{biome.label}</h2>
              {clearTopology === undefined ? null : (
                <TopologyRemovalAction
                  accessibleLabel={`Clear ${biome.label}`}
                  compact
                  interaction={clearTopology}
                  label="Clear biome"
                />
              )}
            </div>
          </div>
        </header>
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
        <CompletionOutline
          completion={biome.completionOutline}
          {...(subject?.kind === 'node' && subject.node.kind === 'occurrenceWorkbench'
            ? { selectedNodeKey: subject.node.key }
            : {})}
        />
      </section>
      <aside aria-label="Details" className="biome-inspector">
        {rendersOccurrenceWorkbench ? null : (
          <header className="biome-inspector-heading">
            <p className="eyebrow">Details</p>
            <h2>{inspectorTitle}</h2>
          </header>
        )}
        {biome.entry === undefined ? null : <BiomeFieldControls fields={biome.fields} />}
        <EchoKeepsakeReplayControl biome={biome} interactions={interactions} />
        {subject === undefined ? (
          <p className="fixed-room-state">Choose the first room to start this biome.</p>
        ) : subject.kind === 'frontier' && sourceOccurrence === undefined ? (
          biome.frontier?.kind === 'start' || biome.frontier?.kind === 'exitDecision' ? (
            <AuthoringFrontier frontier={biome.frontier} interactions={interactions} />
          ) : null
        ) : (
          <BiomeInspectorNode
            frontier={biome.frontier}
            interactions={interactions}
            label={inspectorTitle}
            node={subject.kind === 'node' ? subject.node : sourceOccurrence!}
            {...(selectedStage === undefined ? {} : { outgoing: selectedStage.outgoing })}
            {...(outgoingDecision === undefined ? {} : { outgoingDecision })}
            {...(sourceOccurrence === undefined ? {} : { sourceOccurrence })}
            {...(explicitDestination?.hubTab === undefined
              ? {}
              : { hubTab: explicitDestination.hubTab })}
            {...(explicitDestination?.roomTab === undefined
              ? {}
              : { roomTab: explicitDestination.roomTab })}
          />
        )}
      </aside>
    </div>
  );
}

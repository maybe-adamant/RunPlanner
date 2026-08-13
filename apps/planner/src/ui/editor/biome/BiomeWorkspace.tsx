import {
  semanticAddressKey,
  type ProjectCommand,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import { useState, type ReactNode } from 'react';

import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type StructuredWorkspaceProjection,
  type WorkspaceBiome,
  type WorkspaceCompletionNode,
  type WorkspaceCommandIntent,
  type WorkspaceDefaultInspectorDestination,
  type WorkspaceInspectorDestination,
  type WorkspaceInteractionCatalog,
  type WorkspaceKeepsakeSelectionInteraction,
  type WorkspaceKeepsakeEquipResultInteraction,
  type WorkspaceMarker,
  type WorkspaceNode,
  type WorkspaceRailEntry,
  type WorkspaceRailReward,
  type WorkspaceRailSelectedTarget,
  type WorkspaceAuthoringFrontier,
} from '@planner/projections/structured-workspace';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';
import { FindingCount, SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';
import { AuthoringFrontier, BatchWorkbench, TopologyRemovalAction } from './DecisionWorkbench';
import { BiomeFieldControls } from './BiomeFieldControls';
import { HubDecisionWorkbench } from './HubDecisionWorkbench';
import { OccurrenceWorkbench } from './OccurrenceWorkbench';
import { RunStateSheet } from './RunStateSheet';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import {
  candidateMayBeAuthored,
  candidateSelectState,
} from '@planner/ui/feedback/candidatePresentation';

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
      <FocusButton marker={marker} selected={selected}>
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

function PostbossKeepsakeControl({
  interaction,
  value,
}: {
  readonly interaction: WorkspaceKeepsakeSelectionInteraction;
  readonly value: Extract<WorkspaceCompletionNode['keepsakeSelection'], object>['value'];
}) {
  const dispatch = useAppDispatch();
  const candidates = useWorkspaceInteraction(interaction);
  return (
    <label className="field-control" htmlFor={`postboss-keepsake-${interaction.key}`}>
      <span className="field-label-with-marker">
        Keepsake <SemanticOwnerMarker address={interaction.owner} />
      </span>
      <select
        aria-busy={candidates.pending || undefined}
        id={`postboss-keepsake-${interaction.key}`}
        onFocus={candidates.activate}
        onPointerDown={candidates.activate}
        onChange={(event) => {
          const key = event.target.value;
          if (key === '') {
            if (interaction.retainIntent !== undefined)
              dispatch(authoredProjectCommandDispatched(interaction.retainIntent().command));
            return;
          }
          const option = candidates.result?.find((candidate) => candidate.value === key);
          if (candidateMayBeAuthored(option))
            dispatch(authoredProjectCommandDispatched(interaction.replaceIntent(key).command));
        }}
        value={value.kind === 'replace' ? value.keepsakeKey : ''}
      >
        <option value="">Retain current keepsake</option>
        {interaction.choices.map((choice) => {
          const option = candidates.result?.find((candidate) => candidate.value === choice.value);
          return (
            <option
              key={choice.value}
              value={choice.value}
              disabled={option !== undefined && !candidateMayBeAuthored(option)}
              {...candidateSelectState(option)}
            >
              {choice.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function CompletionWorkbench({
  interactions,
  node,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly node: WorkspaceCompletionNode;
}) {
  const dispatch = useAppDispatch();
  const control =
    node.judgment === undefined
      ? undefined
      : interactions.bossCompletionArcana.get(workspaceInteractionKey(node.judgment.address));
  const keepsake =
    node.keepsakeSelection === undefined
      ? undefined
      : interactions.keepsakeSelections.get(
          workspaceInteractionKey(node.keepsakeSelection.address),
        );
  const pom =
    node.keepsakeSelection === undefined
      ? undefined
      : [...interactions.keepsakeEquipResults.values()].find(
          (interaction) =>
            semanticAddressKey(interaction.owner.selection) ===
            semanticAddressKey(node.keepsakeSelection!.address),
        );
  return (
    <article className="biome-completion-workbench">
      <p className="card-kicker">{node.role === 'postboss' ? 'Postboss' : 'Boss'}</p>
      <h3>{node.label}</h3>
      <SemanticOwnerMarker address={node.marker.address} />
      <p>This room is added automatically after the biome.</p>
      {control === undefined || node.judgment === undefined ? null : (
        <fieldset className="completion-judgment-control">
          <legend>
            Judgment — choose {node.judgment.requiredCount} inactive Arcana cards
            <SemanticOwnerMarker address={control.owner} />
          </legend>
          {control.choices
            .filter(
              (choice) =>
                node.judgment!.inactiveArcanaKeys.includes(choice.value) ||
                control.value.includes(choice.value),
            )
            .map((choice) => {
              const checked = control.value.includes(choice.value);
              return (
                <label key={choice.value}>
                  <input
                    checked={checked}
                    onChange={() => {
                      const next = checked
                        ? control.value.filter((key) => key !== choice.value)
                        : [...control.value, choice.value];
                      dispatch(authoredProjectCommandDispatched(control.intentFor(next).command));
                    }}
                    type="checkbox"
                  />
                  {choice.label}
                </label>
              );
            })}
        </fieldset>
      )}
      {keepsake === undefined || node.keepsakeSelection === undefined ? null : (
        <PostbossKeepsakeControl interaction={keepsake} value={node.keepsakeSelection.value} />
      )}
      {pom === undefined ? null : <JeweledPomResultControl interaction={pom} />}
    </article>
  );
}

function JeweledPomResultControl({
  interaction,
}: {
  readonly interaction: WorkspaceKeepsakeEquipResultInteraction;
}) {
  const dispatch = useAppDispatch();
  const candidates = useWorkspaceInteraction(interaction);
  const selected = interaction.value;
  const [missingDeathDefianceDraft, setMissingDeathDefianceDraft] = useState(false);
  const deathDefianceConditionMet =
    selected === undefined
      ? missingDeathDefianceDraft
      : selected.deathDefianceConditionMet === true;
  const candidateFor = (traitKey: string) =>
    interaction
      .load({
        traitKey,
        ...(deathDefianceConditionMet ? { deathDefianceConditionMet: true } : {}),
      })
      .find((candidate) => candidate.value === traitKey);
  return (
    <fieldset className="field-control">
      <legend>Jeweled Pom result</legend>
      <select
        aria-label="Jeweled Pom result"
        id={`jeweled-pom-${interaction.key}`}
        value={interaction.value?.traitKey ?? ''}
        onFocus={candidates.activate}
        onPointerDown={candidates.activate}
        onChange={(event) => {
          const traitKey = event.target.value;
          if (traitKey === '') return;
          const option = candidateFor(traitKey);
          if (candidateMayBeAuthored(option))
            dispatch(
              authoredProjectCommandDispatched(
                interaction.intentFor({
                  ...(interaction.value ?? {}),
                  traitKey,
                  ...(deathDefianceConditionMet ? { deathDefianceConditionMet: true } : {}),
                }).command,
              ),
            );
        }}
      >
        <option value="">Choose Hades trait</option>
        {interaction.choices.map((choice) => {
          const option = candidateFor(choice.value);
          return (
            <option
              key={choice.value}
              value={choice.value}
              disabled={option !== undefined && !candidateMayBeAuthored(option)}
              {...candidateSelectState(option)}
            >
              {choice.label}
            </option>
          );
        })}
      </select>
      {interaction.supportsDeathDefianceCondition ? (
        <label>
          <input
            checked={deathDefianceConditionMet}
            type="checkbox"
            onChange={(event) => {
              if (selected === undefined) {
                setMissingDeathDefianceDraft(event.target.checked);
                return;
              }
              dispatch(
                authoredProjectCommandDispatched(
                  interaction.intentFor({
                    traitKey: selected.traitKey,
                    ...(selected.rarity === undefined ? {} : { rarity: selected.rarity }),
                    deathDefianceConditionMet: event.target.checked,
                  }).command,
                ),
              );
            }}
          />
          Death Defiance condition met
        </label>
      ) : null}
    </fieldset>
  );
}

function InspectorNode({
  frontier,
  interactions,
  label,
  nextDecisionIntent,
  node,
}: {
  readonly frontier: WorkspaceAuthoringFrontier | null;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly label: string;
  readonly nextDecisionIntent?: WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'CreateBatch' }>
  >;
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
            {...(nextDecisionIntent === undefined ? {} : { nextDecisionIntent })}
            presentation={node.inspectorPresentation}
            room={node.room}
            {...(node.runState === undefined ? {} : { runState: node.runState })}
          />
          {sourceRemovalAnchor === undefined || sourceRemoval === undefined ? null : (
            <TopologyRemovalAction interaction={sourceRemoval} label={sourceRemovalAnchor.label} />
          )}
        </>
      );
    }
    case 'ordinaryBatch':
    case 'mixedBatch':
    case 'takeoverBatch':
      return (
        <BatchWorkbench
          interactions={interactions}
          label={label}
          {...(nextDecisionIntent === undefined ? {} : { nextDecisionIntent })}
          node={node}
        />
      );
    case 'completion':
      return <CompletionWorkbench interactions={interactions} node={node} />;
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

/**
 * Projection-driven workbench for every biome.  It intentionally has
 * no catalog or authored-plan prop: structural facts and room-local state come
 * exclusively from the Slice 3a workspace envelope and semantic interactions.
 */
export function BiomeWorkspace({ biome, focusByOwner, interactions }: BiomeWorkspaceProps) {
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
  const nextDecisionIntent =
    nearbyFrontier === undefined
      ? undefined
      : (() => {
          const structural = interactions.structural.get(nearbyFrontier.interactionKey);
          return structural?.action === 'createBatch' ? structural.intent : undefined;
        })();
  const clearTopology =
    biome.entry === undefined
      ? undefined
      : requireWorkspaceInteraction(
          interactions.topologyRemovals,
          workspaceInteractionKey(biome.owner),
        );
  const runStateNode =
    runStateTarget === null || runStateTarget === undefined
      ? undefined
      : biome.nodes.find(
          (node) =>
            'runState' in node &&
            node.runState !== undefined &&
            semanticAddressKey(node.runState.owner) === semanticAddressKey(runStateTarget),
        );
  const runState =
    runStateNode !== undefined && 'runState' in runStateNode ? runStateNode.runState : undefined;

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
            {...(nextDecisionIntent === undefined ? {} : { nextDecisionIntent })}
            node={subject.node}
          />
        )}
      </aside>
    </div>
  );
}

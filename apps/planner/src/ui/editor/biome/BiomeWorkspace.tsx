import { semanticAddressKey, type SemanticAddress } from '@run-planner/engine/authored-project';
import { useState, type ReactNode } from 'react';

import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type StructuredWorkspaceProjection,
  type WorkspaceBiome,
  type WorkspaceCompletionNode,
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
  type WorkspaceHubTab,
  type WorkspaceOccurrenceStageOutgoing,
  type WorkspaceRoomTab,
} from '@planner/projections/structured-workspace';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';
import { FindingCount, SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';
import { AuthoringFrontier, BatchWorkbench, TopologyRemovalAction } from './DecisionWorkbench';
import { BiomeFieldControls } from './BiomeFieldControls';
import { HubDecisionWorkbench } from './HubDecisionWorkbench';
import { OccurrenceWorkbench, RoomActionsWorkbench } from './OccurrenceWorkbench';
import { RoomSelector } from './RoomSelector';
import { RunStateSheet } from './RunStateSheet';
import { RewardControlEditor } from '../rewards/RewardControlEditor';
import { BiomeWorkspaceContractError } from './workspaceContract';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import {
  candidateMayBeAuthored,
  candidateSelectState,
} from '@planner/ui/feedback/candidatePresentation';

interface BiomeWorkspaceProps {
  readonly biome: WorkspaceBiome;
  readonly focusByOwner: StructuredWorkspaceProjection['focusByOwner'];
  readonly interactions: WorkspaceInteractionCatalog;
  readonly runStateLaunchers: StructuredWorkspaceProjection['runStateLaunchers'];
}

type JeweledPomInteraction = Extract<
  WorkspaceKeepsakeEquipResultInteraction,
  { readonly owner: { readonly resultKind: 'jeweledPom' } }
>;

function jeweledPomLoadable(
  load: JeweledPomInteraction['load'],
  value: NonNullable<JeweledPomInteraction['value']>,
): { readonly load: () => ReturnType<JeweledPomInteraction['load']> } {
  return Object.freeze({ load: () => load(value) });
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
    <div className="completion-keepsake-control">
      <select
        aria-label="Keepsake"
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
      <SemanticOwnerMarker address={interaction.owner} />
    </div>
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
  const [judgmentOpen, setJudgmentOpen] = useState(false);
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
  const equipResult =
    node.keepsakeSelection?.equipResult === undefined
      ? undefined
      : interactions.keepsakeEquipResults.get(
          workspaceInteractionKey(node.keepsakeSelection.equipResult.address),
        );
  const fixedEffectRanks = new Map(
    (node.timeline ?? [])
      .filter((entry) => entry.kind === 'fixedEffect')
      .map((entry, index) => [entry.effect, index + 1] as const),
  );
  const renderEquipResult = () =>
    equipResult === undefined ? null : equipResult.owner.resultKind === 'jeweledPom' ? (
      <JeweledPomResultControl
        interaction={
          equipResult as Extract<
            WorkspaceKeepsakeEquipResultInteraction,
            { readonly owner: { readonly resultKind: 'jeweledPom' } }
          >
        }
      />
    ) : (
      <ExperimentalHammerResultControl
        interaction={
          equipResult as Extract<
            WorkspaceKeepsakeEquipResultInteraction,
            { readonly owner: { readonly resultKind: 'experimentalHammer' } }
          >
        }
      />
    );
  return (
    <article className="biome-completion-workbench">
      <p className="card-kicker">{node.role === 'postboss' ? 'Postboss' : 'Boss'}</p>
      <h3>{node.label}</h3>
      <SemanticOwnerMarker address={node.marker.address} />
      {node.role === 'postboss' && node.roomActions !== undefined ? (
        <>
          <RoomActionsWorkbench
            actions={node.roomActions}
            interactions={interactions}
            renderRowContent={(row) =>
              row.reference.kind !== 'interactKeepsakeRack' ||
              keepsake === undefined ||
              node.keepsakeSelection === undefined ? null : (
                <div className="completion-keepsake-action">
                  <PostbossKeepsakeControl
                    interaction={keepsake}
                    value={node.keepsakeSelection.value}
                  />
                  {renderEquipResult()}
                </div>
              )
            }
          >
            {keepsake === undefined ||
            node.keepsakeSelection === undefined ||
            node.keepsakeSelection.value.kind !== 'retain' ? null : (
              <section aria-label="Choose keepsake" className="completion-keepsake-action">
                <strong>Choose keepsake</strong>
                <PostbossKeepsakeControl
                  interaction={keepsake}
                  value={node.keepsakeSelection.value}
                />
                {renderEquipResult()}
              </section>
            )}
          </RoomActionsWorkbench>
        </>
      ) : node.timeline === undefined ? null : (
        <section aria-label="Room Timeline" className="room-actions-workbench">
          <header className="local-reward-heading">
            <h4>Room Timeline</h4>
          </header>
          <ol aria-label="Room timeline" className="room-action-list">
            {node.timeline.map((entry) => {
              if (entry.kind === 'boundary') {
                const label =
                  entry.boundary.kind === 'roomEntered'
                    ? 'Room entered'
                    : entry.boundary.kind === 'encounterStart'
                      ? 'Start encounter'
                      : entry.boundary.kind === 'encounterEnd'
                        ? 'End encounter'
                        : 'Cleanup · Doors open';
                return (
                  <li
                    aria-label={label}
                    className="room-action-lifecycle-boundary"
                    data-lifecycle-boundary={entry.boundary.key}
                    key={entry.boundary.key}
                  >
                    <span aria-hidden="true" className="hub-roster-rank">
                      ·
                    </span>
                    <strong>{label}</strong>
                  </li>
                );
              }
              const rank = fixedEffectRanks.get(entry.effect);
              if (entry.effect === 'judgment') {
                return control === undefined || node.judgment === undefined ? null : (
                  <li
                    aria-label={`Judgment — choose ${node.judgment.requiredCount} inactive Arcana cards`}
                    className="hub-open-room-card room-action-row completion-timeline-effect-row"
                    key={entry.effect}
                  >
                    <div className="owner-markers room-action-identity">
                      <span aria-hidden="true" className="hub-roster-rank">
                        {rank}
                      </span>
                      <button
                        className="completion-timeline-effect"
                        onClick={() => setJudgmentOpen(true)}
                        type="button"
                      >
                        Judgment — choose {node.judgment.requiredCount} inactive Arcana cards
                        <SemanticOwnerMarker address={control.owner} />
                      </button>
                    </div>
                  </li>
                );
              }
              return null;
            })}
          </ol>
        </section>
      )}
      {judgmentOpen && control !== undefined && node.judgment !== undefined ? (
        <div aria-label="Judgment editor" className="completion-judgment-popup" role="dialog">
          <div className="completion-judgment-popup-header">
            <h4>Judgment — choose {node.judgment.requiredCount} inactive Arcana cards</h4>
            <button
              aria-label="Close Judgment editor"
              onClick={() => setJudgmentOpen(false)}
              type="button"
            >
              Close
            </button>
          </div>
          <div className="completion-judgment-options">
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
          </div>
        </div>
      ) : null}
    </article>
  );
}

function ExperimentalHammerResultControl({
  interaction,
}: {
  readonly interaction: Extract<
    WorkspaceKeepsakeEquipResultInteraction,
    { readonly owner: { readonly resultKind: 'experimentalHammer' } }
  >;
}) {
  const dispatch = useAppDispatch();
  const candidates = useWorkspaceInteraction(interaction);
  const candidateFor = (traitKey: string) =>
    candidates.result?.find((candidate) => candidate.value === traitKey);
  return (
    <fieldset className="field-control">
      <legend>Experimental Hammer result</legend>
      <select
        aria-label="Experimental Hammer result"
        value={
          interaction.value === undefined
            ? ''
            : interaction.value.kind === 'selected'
              ? interaction.value.traitKey
              : '__exhausted'
        }
        onFocus={candidates.activate}
        onPointerDown={candidates.activate}
        onChange={(event) => {
          const selected = event.target.value;
          const option = candidateFor(selected);
          if (selected !== '' && candidateMayBeAuthored(option))
            dispatch(
              authoredProjectCommandDispatched(
                interaction.intentFor(
                  selected === '__exhausted'
                    ? { kind: 'exhausted' }
                    : { kind: 'selected', traitKey: selected },
                ).command,
              ),
            );
        }}
      >
        <option value="">Choose compatible Hammer</option>
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
    </fieldset>
  );
}

function JeweledPomResultControl({
  interaction,
}: {
  readonly interaction: Extract<
    WorkspaceKeepsakeEquipResultInteraction,
    { readonly owner: { readonly resultKind: 'jeweledPom' } }
  >;
}) {
  const dispatch = useAppDispatch();
  const selected = interaction.value;
  const [missingDeathDefianceDraft, setMissingDeathDefianceDraft] = useState(false);
  const deathDefianceConditionMet =
    selected === undefined
      ? missingDeathDefianceDraft
      : selected.deathDefianceConditionMet === true;
  const revision = `${selected?.traitKey ?? ''}:${deathDefianceConditionMet ? 'dd' : 'no-dd'}`;
  const [candidateInput, setCandidateInput] = useState(() => ({
    interaction,
    revision,
    loadable: jeweledPomLoadable(interaction.load, {
      traitKey: selected?.traitKey ?? '',
      ...(deathDefianceConditionMet ? { deathDefianceConditionMet: true } : {}),
    }),
  }));
  if (candidateInput.interaction !== interaction || candidateInput.revision !== revision) {
    setCandidateInput({
      interaction,
      revision,
      loadable: jeweledPomLoadable(interaction.load, {
        traitKey: selected?.traitKey ?? '',
        ...(deathDefianceConditionMet ? { deathDefianceConditionMet: true } : {}),
      }),
    });
  }
  const candidates = useWorkspaceInteraction(candidateInput.loadable);
  const candidateFor = (traitKey: string) =>
    candidates.result?.find((candidate) => candidate.value === traitKey);
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
  node,
  outgoing,
  outgoingDecision,
  hubTab,
  roomTab,
  sourceOccurrence,
}: {
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
  readonly sourceOccurrence?: Extract<WorkspaceNode, { readonly kind: 'occurrenceWorkbench' }>;
  readonly roomTab?: WorkspaceRoomTab;
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
          <StartRoomIdentityEditor interactions={interactions} node={node} />
          <OccurrenceWorkbench
            {...(node.incomingDoor === undefined ? {} : { incomingDoor: node.incomingDoor })}
            interactions={interactions}
            {...(node.localVisit === undefined ? {} : { localVisit: node.localVisit })}
            room={node.room}
            {...(node.runState === undefined ? {} : { runState: node.runState })}
            {...(roomTab === undefined ? {} : { initialTab: roomTab })}
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
    case 'ordinaryBatch':
    case 'mixedBatch':
    case 'takeoverBatch':
      return (
        <>
          {sourceOccurrence === undefined ? null : (
            <>
              <StartRoomIdentityEditor interactions={interactions} node={sourceOccurrence} />
              <OccurrenceWorkbench
                {...(sourceOccurrence.incomingDoor === undefined
                  ? {}
                  : { incomingDoor: sourceOccurrence.incomingDoor })}
                interactions={interactions}
                {...(sourceOccurrence.localVisit === undefined
                  ? {}
                  : { localVisit: sourceOccurrence.localVisit })}
                room={sourceOccurrence.room}
                {...(sourceOccurrence.runState === undefined
                  ? {}
                  : { runState: sourceOccurrence.runState })}
                initialTab={roomTab ?? 'doors'}
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
            </>
          )}
          {sourceOccurrence === undefined ? (
            <BatchWorkbench interactions={interactions} label={label} node={node} />
          ) : null}
        </>
      );
    case 'completion':
      return <CompletionWorkbench interactions={interactions} node={node} />;
    case 'hubDecision':
      return (
        <HubDecisionWorkbench
          frontier={frontier}
          {...(hubTab === undefined ? {} : { initialTab: hubTab })}
          interactions={interactions}
          node={node}
        />
      );
  }
}

/** Start identity is structural authoring beside, never inside, the entered-room workbench. */
function StartRoomIdentityEditor({
  interactions,
  node,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly node: Extract<WorkspaceNode, { readonly kind: 'occurrenceWorkbench' }>;
}) {
  const dispatch = useAppDispatch();
  const picker = node.room.roomPicker;
  const startPicker = picker?.kind === 'startRoomPicker' ? picker : undefined;
  if (startPicker === undefined && node.room.entryReward === undefined) return null;
  const interaction =
    startPicker === undefined
      ? undefined
      : requireWorkspaceInteraction(
          interactions.rooms,
          workspaceInteractionKey(startPicker.address),
        );
  if (interaction !== undefined && interaction.kind !== 'startRoom') {
    throw new BiomeWorkspaceContractError(`${interaction.key} is not a start-room interaction.`);
  }
  return (
    <section
      aria-label={startPicker === undefined ? 'Entry reward' : 'Start room identity'}
      className="start-room-identity"
    >
      {startPicker === undefined || interaction === undefined ? null : (
        <>
          <div className="owner-markers">
            <h3>Room identity</h3>
            <SemanticOwnerMarker address={node.room.address} />
          </div>
          <RoomSelector
            idPrefix={`start-${node.room.occurrenceId}`}
            interaction={interaction}
            label="Start room"
            onSelect={(gameName) => {
              dispatch(
                authoredProjectCommandDispatched({
                  kind: 'ReplaceOccurrenceRoom',
                  occurrence: node.room.address,
                  gameName,
                }),
              );
              dispatch(semanticOwnerFocused(node.room.address));
            }}
          />
        </>
      )}
      {node.room.entryReward === undefined ? null : (
        <div aria-label="Entry reward" className="start-room-entry-reward">
          <RewardControlEditor
            control={node.room.entryReward}
            idPrefix={`start-${node.room.occurrenceId}-entry-reward`}
            interactions={interactions}
            label="Reward"
            showAcquisitionChildren={false}
          />
        </div>
      )}
    </section>
  );
}

function OccurrenceOutgoing({
  interactions,
  outgoing,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly outgoing: WorkspaceOccurrenceStageOutgoing;
}) {
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
          const roleLabel = node.role === 'postboss' ? 'Postboss' : 'Boss';
          return (
            <li key={node.key}>
              <button
                aria-label={`Open ${roleLabel} completion`}
                aria-pressed={selectedNodeKey === node.key}
                className="biome-completion-node"
                data-assessment={node.marker.assessment}
                data-findings={node.marker.findingCount > 0}
                onClick={() => dispatch(semanticOwnerFocused(node.marker.address))}
                type="button"
              >
                <span>{roleLabel}</span>
                {node.label === roleLabel ? null : <strong>{node.label}</strong>}
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
          {...(subject?.kind === 'node' && subject.node.kind === 'completion'
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
        {biome.echoKeepsakeReplay === undefined ? null : (
          <ExperimentalHammerResultControl
            interaction={
              requireWorkspaceInteraction(
                interactions.keepsakeEquipResults,
                semanticAddressKey(biome.echoKeepsakeReplay.address),
              ) as Extract<
                WorkspaceKeepsakeEquipResultInteraction,
                { readonly owner: { readonly resultKind: 'experimentalHammer' } }
              >
            }
          />
        )}
        {subject === undefined ? (
          <p className="fixed-room-state">Choose the first room to start this biome.</p>
        ) : subject.kind === 'frontier' && sourceOccurrence === undefined ? (
          biome.frontier?.kind === 'start' || biome.frontier?.kind === 'exitDecision' ? (
            <AuthoringFrontier frontier={biome.frontier} interactions={interactions} />
          ) : null
        ) : (
          <InspectorNode
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

import { useMemo } from 'react';
import type { HubVisitAddress } from '@run-planner/engine/authored-project';

import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceAuthoringFrontier,
  type WorkspaceCompletedHubHandoffInteraction,
  type WorkspaceHubDecisionNode,
  type WorkspaceHubSlot,
  type WorkspaceHubSlotInteraction,
  type WorkspaceHubVisit,
  type WorkspaceInteractionCatalog,
  type WorkspaceMarker,
} from '../../../projections/structuredWorkspace';
import { semanticOwnerFocused } from '../../../state/editorSessionSlice';
import { authoredProjectCommandDispatched } from '../../../state/projectWorkspaceSlice';
import { useAppDispatch } from '../../../state/store';
import { allocateOccurrenceId } from '../../../workspace/occurrenceIds';
import { candidateSupport } from '../../../projections/candidateProjection';
import { FindingCount, SemanticOwnerMarker } from '../../feedback/EvaluationFeedback';
import { candidateMayBeAuthored } from '../../feedback/candidatePresentation';
import { useWorkspaceInteraction } from '../../controls/useWorkspaceInteraction';
import { CandidateSelect } from './CandidateSelect';
import { RewardControlEditor } from './OccurrenceWorkbench';

interface HubDecisionWorkbenchProps {
  readonly frontier: WorkspaceAuthoringFrontier | null;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly node: WorkspaceHubDecisionNode;
}

function hubVisitAddress(visit: WorkspaceHubVisit): HubVisitAddress {
  if (visit.marker.address.kind !== 'hubVisit') {
    throw new Error('A Hub visit row must retain its Hub-visit semantic owner.');
  }
  return visit.marker.address;
}

function domId(value: string): string {
  return value.replaceAll(/[^A-Za-z0-9_-]/g, '-');
}

function assessmentLabel(marker: WorkspaceMarker): string {
  switch (marker.assessment) {
    case 'assessed':
      return 'Assessed';
    case 'blocked':
      return 'Blocked';
    case 'unassessed':
      return 'Unassessed';
  }
}

function MarkerAssessment({ marker }: { readonly marker: WorkspaceMarker }) {
  return (
    <span className="hub-owner-assessment" data-assessment={marker.assessment}>
      {assessmentLabel(marker)}
      <FindingCount count={marker.findingCount} label="findings" />
    </span>
  );
}

function HubSlotMembership({
  interaction,
  slot,
}: {
  readonly interaction: WorkspaceHubSlotInteraction;
  readonly slot: WorkspaceHubSlot;
}) {
  const dispatch = useAppDispatch();
  const proposedOccurrenceId = useMemo(() => allocateOccurrenceId(), []);
  const candidateInteraction = useMemo(
    () => interaction.bind(proposedOccurrenceId),
    [interaction, proposedOccurrenceId],
  );
  const candidates = useWorkspaceInteraction(candidateInteraction);
  const proposedOpen = !slot.open;
  const candidate = candidates.result?.find((option) => option.value === proposedOpen);
  const structurallyDisabled = slot.open ? !slot.canClose : !slot.canOpen;
  const disabled =
    structurallyDisabled || (candidate !== undefined && !candidateMayBeAuthored(candidate));
  const close = slot.canClose ? interaction.close : undefined;
  if (slot.canClose && close === undefined) {
    throw new Error('A closable Hub slot must retain its CloseHubSlot interaction.');
  }

  return (
    <div className="hub-membership-action">
      <label
        className="hub-membership-control"
        data-candidate-support={candidateSupport(candidate)}
      >
        <input
          aria-busy={candidates.pending || undefined}
          aria-label={`${slot.label} open`}
          checked={slot.open}
          disabled={disabled}
          onChange={(event) => {
            const open = event.target.checked;
            const options = candidates.result ?? candidates.activate();
            const option = options?.find((candidate) => candidate.value === open);
            if (!candidateMayBeAuthored(option)) {
              return;
            }
            const command = open
              ? {
                  kind: 'OpenHubSlot' as const,
                  occurrenceId: proposedOccurrenceId,
                  slot: interaction.owner,
                }
              : close!.command;
            dispatch(semanticOwnerFocused(interaction.owner));
            dispatch(authoredProjectCommandDispatched(command));
          }}
          onFocus={candidates.activate}
          onPointerDown={candidates.activate}
          type="checkbox"
        />
        Open
      </label>
    </div>
  );
}

function HubSlotCard({
  authoring,
  interactions,
  slot,
}: {
  readonly authoring: WorkspaceHubDecisionNode['authoring'];
  readonly interactions: WorkspaceInteractionCatalog;
  readonly slot: WorkspaceHubSlot;
}) {
  const dispatch = useAppDispatch();
  const interaction =
    authoring === 'authored'
      ? requireWorkspaceInteraction(
          interactions.hubSlots,
          workspaceInteractionKey(slot.marker.address),
        )
      : undefined;
  const rewardState = slot.room?.roomLocal;
  const editableControl =
    rewardState?.kind === 'incomingReward'
      ? rewardState.control
      : rewardState?.kind === 'ephyra'
        ? rewardState.incomingReward
        : rewardState?.kind === 'fixed'
          ? rewardState.control
          : undefined;

  return (
    <article
      aria-label={`${slot.label} Hub slot`}
      className="hub-slot-card"
      data-open={slot.open}
      data-visited={slot.visited}
    >
      <div className="hub-slot-heading">
        <div>
          <p className="card-kicker">Door {slot.physicalDoorId}</p>
          <div className="owner-markers">
            <h3>{slot.label}</h3>
            <SemanticOwnerMarker address={slot.marker.address} />
          </div>
        </div>
        {interaction === undefined ? (
          <span className="neutral-status">Create board first</span>
        ) : (
          <HubSlotMembership interaction={interaction} slot={slot} />
        )}
      </div>
      <div className="hub-slot-meta">
        <span className="room-kind">{slot.roomKind}</span>
        {slot.visited ? <span className="neutral-status">Visited</span> : null}
        <MarkerAssessment marker={slot.marker} />
      </div>
      {!slot.open || slot.room === undefined ? null : (
        <button
          aria-label={`Inspect ${slot.label}`}
          className="semantic-focus-link"
          onClick={() => dispatch(semanticOwnerFocused(slot.room!.marker.address))}
          type="button"
        >
          Inspect room
        </button>
      )}
      {!slot.open ? <p className="fixed-room-state">Closed board slot.</p> : null}
      {!slot.open || slot.room?.rewardSummary === undefined ? null : (
        <p className="biome-room-summary">{slot.room.rewardSummary}</p>
      )}
      {!slot.open || editableControl === undefined ? null : (
        <div className="room-state-with-marker">
          <SemanticOwnerMarker address={editableControl.marker.address} />
          <RewardControlEditor
            control={editableControl}
            idPrefix={`hub-${slot.hubSlotKey}`}
            interactions={interactions}
          />
        </div>
      )}
      {!slot.open || rewardState?.kind !== 'fixed' || rewardState.control !== undefined ? null : (
        <p className="fixed-room-state">Fixed reward: {rewardState.summary}</p>
      )}
    </article>
  );
}

function HubVisitRow({
  interactions,
  visit,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly visit: WorkspaceHubVisit;
}) {
  const dispatch = useAppDispatch();
  const canChoose = visit.authoring === 'authored' || visit.authoring === 'next';
  const interaction = canChoose
    ? requireWorkspaceInteraction(
        interactions.hubVisits,
        workspaceInteractionKey(visit.marker.address),
      )
    : undefined;
  const label =
    visit.authoring === 'locked'
      ? 'Complete prior visit'
      : visit.authoring === 'next'
        ? 'Choose next room'
        : 'Visited room';

  return (
    <li className="hub-visit-row" data-authoring={visit.authoring}>
      <div className="hub-visit-index">{visit.visitIndex}</div>
      <div className="hub-visit-content">
        <div className="owner-markers">
          <button
            className="semantic-focus-link"
            onClick={() =>
              dispatch(semanticOwnerFocused(visit.room?.marker.address ?? visit.marker.address))
            }
            type="button"
          >
            {visit.room?.label ?? label}
          </button>
          <SemanticOwnerMarker address={visit.marker.address} />
          <MarkerAssessment marker={visit.marker} />
        </div>
        {interaction === undefined ? (
          <p className="fixed-room-state">{label}</p>
        ) : (
          <CandidateSelect
            id={`hub-visit-${domId(visit.marker.focusKey)}`}
            interaction={interaction}
            label={`Visit ${visit.visitIndex} room`}
            onReplace={(hubSlotKey) =>
              dispatch(
                authoredProjectCommandDispatched(
                  visit.authoring === 'next'
                    ? { kind: 'AppendHubVisit', hubSlotKey, visit: hubVisitAddress(visit) }
                    : { kind: 'ReplaceHubVisit', hubSlotKey, visit: hubVisitAddress(visit) },
                ),
              )
            }
            {...(visit.authoring === 'next' ? { placeholder: 'Choose next room' } : {})}
          />
        )}
      </div>
      {visit.authoring !== 'authored' ? null : (
        <button
          aria-label={`Remove visits from Visit ${visit.visitIndex}`}
          className="danger-action"
          onClick={() => {
            dispatch(
              authoredProjectCommandDispatched({
                kind: 'RemoveHubVisitsFrom',
                visit: hubVisitAddress(visit),
              }),
            );
          }}
          type="button"
        >
          Remove From Here
        </button>
      )}
    </li>
  );
}

function CompletedHubHandoff({
  interaction,
}: {
  readonly interaction: WorkspaceCompletedHubHandoffInteraction;
}) {
  const dispatch = useAppDispatch();
  return (
    <section className="takeover-action" data-presentation={interaction.presentation}>
      <div className="owner-markers">
        <h4>Continue to Preboss</h4>
        <SemanticOwnerMarker address={interaction.owner} />
      </div>
      <p className="fixed-room-state">All required Hub visits are complete.</p>
      <button
        className="primary-action"
        onClick={() => {
          dispatch(semanticOwnerFocused(interaction.owner));
          dispatch(authoredProjectCommandDispatched(interaction.execute()));
        }}
        type="button"
      >
        {interaction.label}
      </button>
    </section>
  );
}

/**
 * N-specific composition over the workspace contract.  It consumes only
 * projected board/visit facts and semantic capabilities; no catalog, topology
 * or simulator product is re-read in the React layer.
 */
export function HubDecisionWorkbench({ frontier, interactions, node }: HubDecisionWorkbenchProps) {
  const dispatch = useAppDispatch();
  const creation =
    frontier?.kind === 'hubDecision'
      ? requireWorkspaceInteraction(interactions.structural, frontier.interactionKey)
      : undefined;
  const handoff =
    frontier?.kind === 'exitDecision' && frontier.owner.source.kind === 'hubDecision'
      ? requireWorkspaceInteraction(interactions.takeoverBatches, frontier.interactionKey)
      : undefined;
  if (creation !== undefined && creation.action !== 'createHubDecision') {
    throw new Error('The Hub creation frontier must expose a CreateHubDecision interaction.');
  }
  if (handoff !== undefined && handoff.presentation !== 'completedHubHandoff') {
    throw new Error('The completed Hub frontier must expose its fixed Preboss handoff.');
  }
  const titleId = `hub-${domId(node.marker.focusKey)}`;

  return (
    <section className="hub-decision-workbench" aria-label="Ephyra Hub decision">
      <section className="hub-board" aria-labelledby={`${titleId}-board-title`}>
        <header className="decision-heading">
          <div>
            <div className="owner-markers">
              <p className="card-kicker">Persistent offer board</p>
              <SemanticOwnerMarker address={node.owner} />
              <SemanticOwnerMarker address={node.openSet.address} />
            </div>
            <h3 id={`${titleId}-board-title`}>Open Ephyra rooms</h3>
          </div>
          <div className="hub-board-status">
            <span className="neutral-status">
              {node.openSlotCount.current} / {node.openSlotCount.min}–{node.openSlotCount.max}
            </span>
            <MarkerAssessment marker={node.openSet} />
          </div>
        </header>
        {creation === undefined ? null : (
          <div className="hub-board-action">
            <button
              className="primary-action"
              onClick={() => {
                dispatch(semanticOwnerFocused(creation.owner));
                dispatch(
                  authoredProjectCommandDispatched({
                    kind: 'CreateHubDecision',
                    hub: creation.owner,
                  }),
                );
              }}
              type="button"
            >
              Create Hub board
            </button>
          </div>
        )}
        <div className="hub-slot-grid">
          {node.slots.map((slot) => (
            <HubSlotCard
              authoring={node.authoring}
              interactions={interactions}
              key={slot.hubSlotKey}
              slot={slot}
            />
          ))}
        </div>
      </section>
      <section className="hub-visit-timeline" aria-labelledby={`${titleId}-visits-title`}>
        <header className="decision-heading">
          <div>
            <p className="card-kicker">Player traversal</p>
            <h3 id={`${titleId}-visits-title`}>Pylon visit order</h3>
          </div>
          <span className="neutral-status">
            {node.visits.filter((visit) => visit.authoring === 'authored').length} /{' '}
            {node.requiredVisitCount}
          </span>
        </header>
        <ol className="hub-visit-list">
          {node.visits.map((visit) => (
            <HubVisitRow interactions={interactions} key={visit.visitIndex} visit={visit} />
          ))}
        </ol>
      </section>
      {handoff === undefined ? null : <CompletedHubHandoff interaction={handoff} />}
    </section>
  );
}

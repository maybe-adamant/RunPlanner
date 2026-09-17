import { useState } from 'react';
import {
  candidateSupport,
  presentCandidateLabel,
} from '@planner/projections/candidates/candidateProjection';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceLocalVisitDecision,
} from '@planner/projections/structured-workspace';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { candidateMayBeAuthored } from '@planner/ui/feedback/candidatePresentation';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { RoomMapLauncher } from '@planner/ui/room-maps/RoomMapDialog';
import { DoorRewardEditor } from '../DoorRewardEditor';

function LocalVisitGenerationCheckbox({
  interactions,
  slot,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly slot: WorkspaceLocalVisitDecision['slots'][number];
}) {
  const findingTarget = useFindingTarget();
  const executeIntent = useCommandIntent();
  const interaction = requireWorkspaceInteraction(
    interactions.localVisitGenerations,
    workspaceInteractionKey(slot.address),
  );
  const candidates = useWorkspaceInteraction(interaction);
  const nextGeneration = slot.generation === 'generated' ? 'notGenerated' : 'generated';
  const candidate = candidates.result?.find((option) => option.value === slot.generation);
  const disabled = interaction.disabledReason !== undefined;
  const [hintOpen, setHintOpen] = useState(false);
  const hintId = `local-${slot.marker.focusKey}-generation-hint`;
  const target = findingTarget(slot.address, `local-${slot.marker.focusKey}-generation`);
  return (
    <div
      aria-describedby={disabled ? hintId : undefined}
      aria-disabled={disabled || undefined}
      aria-label={`${slot.label} generation control`}
      className="ephyra-side-generation-control"
      inert={target.inert}
      onBlur={(event) => {
        if (!event.currentTarget.matches(':hover')) setHintOpen(false);
      }}
      onFocus={() => setHintOpen(true)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && hintOpen) {
          setHintOpen(false);
          event.stopPropagation();
        }
      }}
      onMouseEnter={() => setHintOpen(true)}
      onMouseLeave={(event) => {
        if (!event.currentTarget.contains(document.activeElement)) setHintOpen(false);
      }}
      role="group"
      tabIndex={disabled ? 0 : undefined}
    >
      <label>
        <input
          {...target}
          aria-busy={candidates.pending || undefined}
          aria-describedby={disabled ? hintId : undefined}
          aria-label={`${slot.label} generation`}
          checked={slot.generation === 'generated'}
          data-candidate-support={candidateSupport(candidate)}
          disabled={disabled}
          onChange={() => {
            if (!disabled) executeIntent(interaction.intentFor(nextGeneration));
          }}
          onFocus={candidates.activate}
          onPointerDown={candidates.activate}
          type="checkbox"
        />
        <span aria-hidden="true" className="ephyra-side-compact-label">
          Generated
        </span>
      </label>
      {disabled ? (
        <span className="ephyra-side-generation-hint" hidden={!hintOpen} id={hintId} role="tooltip">
          {interaction.disabledReason}
        </span>
      ) : null}
    </div>
  );
}

function LocalVisitOrderSelect({
  interactions,
  slot,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly slot: WorkspaceLocalVisitDecision['slots'][number];
}) {
  const executeIntent = useCommandIntent();
  const interaction = requireWorkspaceInteraction(
    interactions.localVisitOrders,
    slot.order.interactionKey,
  );
  const candidates = useWorkspaceInteraction(interaction);
  const selectedIndex = slot.order.options.findIndex(
    (option) => option.key === slot.order.selectedKey,
  );
  if (selectedIndex < 0) throw new Error(`${slot.label} has no selected local-visit position`);
  const selectedCandidate = candidates.result?.[selectedIndex];
  const replace = (key: string): void => {
    const optionIndex = slot.order.options.findIndex((option) => option.key === key);
    const option = slot.order.options[optionIndex];
    const candidateResults = candidates.result ?? candidates.activate();
    const candidate = candidateResults?.[optionIndex];
    if (option === undefined || !candidateMayBeAuthored(candidate)) return;
    executeIntent(interaction.intentFor(option.proposedOccurrenceIds));
  };
  return (
    <label className="field-control ephyra-side-entry-order">
      <span className="visually-hidden">{slot.label} visit order</span>
      <span aria-hidden="true" className="ephyra-side-compact-label">
        Visit
      </span>
      <select
        aria-busy={candidates.pending || undefined}
        data-candidate-support={candidateSupport(selectedCandidate)}
        disabled={slot.generation !== 'generated'}
        onChange={(event) => replace(event.target.value)}
        onFocus={candidates.activate}
        onPointerDown={candidates.activate}
        value={slot.order.selectedKey}
      >
        {slot.order.options.map((option, index) => {
          const candidate = candidates.result?.[index];
          const disabled = candidate !== undefined && !candidateMayBeAuthored(candidate);
          return (
            <option
              data-candidate-support={candidateSupport(candidate)}
              disabled={disabled}
              key={option.key}
              value={option.key}
            >
              {presentCandidateLabel(option.label, candidate)}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function LocalVisitSlotRow({
  interactions,
  slot,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly slot: WorkspaceLocalVisitDecision['slots'][number];
}) {
  return (
    <tr className="ephyra-side-grid-row">
      <td className="ephyra-side-priority">
        <span className="ephyra-side-compact-label">Priority</span>
        <span>{slot.availabilityRank}</span>
      </td>
      <th className="ephyra-side-room" scope="row">
        <div className="ephyra-side-room-identity">
          <span>{slot.label}</span>
          <RoomMapLauncher
            gameName={slot.gameName}
            hostId={slot.marker.focusKey}
            label="Map"
            title={slot.label}
          />
        </div>
      </th>
      <td className="ephyra-side-generation">
        <LocalVisitGenerationCheckbox interactions={interactions} slot={slot} />
      </td>
      <td className="ephyra-side-reward-cell">
        <span aria-hidden="true" className="ephyra-side-compact-label">
          Reward
        </span>
        {slot.generation !== 'generated' ? (
          <span className="ephyra-side-unavailable">Not generated</span>
        ) : (
          <DoorRewardEditor
            door={slot.door}
            idPrefix={`local-door-${slot.marker.focusKey}`}
            interactions={interactions}
          />
        )}
      </td>
      <td className="ephyra-side-visit-order">
        <LocalVisitOrderSelect interactions={interactions} slot={slot} />
      </td>
    </tr>
  );
}

export function LocalVisitWorkbench({
  interactions,
  localVisit,
  nested = false,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly localVisit: WorkspaceLocalVisitDecision;
  readonly nested?: boolean;
}) {
  const findingTarget = useFindingTarget();
  return (
    <section
      {...findingTarget(localVisit.address)}
      tabIndex={-1}
      aria-label="Ephyra side rooms"
      className="ephyra-side-editor"
    >
      {nested ? (
        <span className="neutral-status">
          {localVisit.visitOrder.length} visited · {localVisit.slots.length} possible
        </span>
      ) : (
        <h4 className="room-feature-category-heading">
          <span>Side Rooms</span>
          <span className="room-feature-heading-note">
            {localVisit.visitOrder.length} visited · {localVisit.slots.length} possible
          </span>
        </h4>
      )}
      <table {...findingTarget(localVisit.order)} tabIndex={-1} className="ephyra-side-grid">
        <caption className="visually-hidden">Ephyra side-room generation and visit order</caption>
        <thead>
          <tr>
            <th scope="col">Priority</th>
            <th scope="col">Room</th>
            <th scope="col">Generated</th>
            <th scope="col">Reward</th>
            <th scope="col">Visit</th>
          </tr>
        </thead>
        <tbody>
          {localVisit.slots.map((slot) => (
            <LocalVisitSlotRow interactions={interactions} key={slot.key} slot={slot} />
          ))}
        </tbody>
      </table>
    </section>
  );
}

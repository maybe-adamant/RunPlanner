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
import { CandidateSelect } from '../CandidateSelect';
import { DoorRewardEditor } from '../DoorRewardEditor';
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
      <select
        aria-busy={candidates.pending || undefined}
        data-candidate-support={candidateSupport(selectedCandidate)}
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
  const executeIntent = useCommandIntent();
  const generation = requireWorkspaceInteraction(
    interactions.localVisitGenerations,
    workspaceInteractionKey(slot.address),
  );
  return (
    <tr className="ephyra-side-grid-row">
      <td className="ephyra-side-priority">{slot.availabilityRank}</td>
      <th scope="row">
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
      <td>
        <CandidateSelect
          id={`local-${slot.marker.focusKey}-generation`}
          interaction={generation}
          label={`${slot.label} generation`}
          onReplace={(value) => executeIntent(generation.intentFor(value))}
        />
      </td>
      <td className="ephyra-side-visit-order">
        <LocalVisitOrderSelect interactions={interactions} slot={slot} />
      </td>
      <td className="ephyra-side-reward-cell">
        {slot.generation !== 'generated' ? null : (
          <DoorRewardEditor
            door={slot.door}
            idPrefix={`local-door-${slot.marker.focusKey}`}
            interactions={interactions}
          />
        )}
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
      <div className="ephyra-side-grid-scroll">
        <table {...findingTarget(localVisit.order)} tabIndex={-1} className="ephyra-side-grid">
          <caption className="visually-hidden">Ephyra side-room generation and visit order</caption>
          <thead>
            <tr>
              <th scope="col">Priority</th>
              <th scope="col">Room</th>
              <th scope="col">Generated</th>
              <th scope="col">Visit order</th>
              <th scope="col">Door reward</th>
            </tr>
          </thead>
          <tbody>
            {localVisit.slots.map((slot) => (
              <LocalVisitSlotRow interactions={interactions} key={slot.key} slot={slot} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

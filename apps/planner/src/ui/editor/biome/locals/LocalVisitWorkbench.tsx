import { useRef } from 'react';
import { candidateSupport } from '@planner/projections/candidates/candidateProjection';
import { formatFindingSentence, presentFinding } from '@planner/projections/evaluationProjection';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceLocalVisitDecision,
} from '@planner/projections/structured-workspace';
import { useFindingAnchor, useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import {
  candidateMayBeAuthored,
  candidateWaitingHint,
  candidateWaits,
} from '@planner/ui/feedback/candidatePresentation';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import {
  ephyraSideRoomAnnotationsFor,
  ephyraSideRoomMapPosition,
} from '@planner/ui/room-maps/EphyraSideRoomAnnotations';
import { RoomMapViewport } from '@planner/ui/room-maps/RoomMapViewport';
import { roomMapAssetFor } from '@planner/ui/room-maps/roomMapAssets';
import { DoorRewardEditor } from '../DoorRewardEditor';
import { hintProps } from '@planner/ui/controls/hint';
import { TimelineReorderHandle, TimelineReorderStatus } from '../TimelineReorderHandle';
import { useTimelineReorder, type TimelineReorderSession } from '../useTimelineReorder';

type LocalSlot = WorkspaceLocalVisitDecision['slots'][number];
type GeneratedLocalSlot = Extract<LocalSlot, { readonly generation: 'generated' }>;

function GenerationControl({
  controlRef,
  interactions,
  slot,
}: {
  readonly controlRef: (element: HTMLInputElement | null) => void;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly slot: LocalSlot;
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
  const next = candidates.result?.find((option) => option.value === nextGeneration);
  const waiting = !interaction.contextReached || candidateWaits(next);
  const disabled = interaction.disabledReason !== undefined;
  const target = findingTarget(slot.address, `local-${slot.marker.focusKey}-generation`);
  const description = [target['aria-description'], interaction.disabledReason]
    .filter((entry) => entry !== undefined)
    .join(' ');
  return (
    <div
      aria-disabled={disabled || undefined}
      aria-label={`${slot.label} generation control`}
      className="ephyra-side-generation-control"
      inert={target.inert}
      role="group"
    >
      <label>
        <input
          {...target}
          aria-busy={candidates.pending || undefined}
          aria-label={`${slot.label} generation`}
          checked={slot.generation === 'generated'}
          data-candidate-support={candidateSupport(candidate)}
          disabled={disabled || waiting}
          onChange={() => {
            if (disabled) return;
            // Context-invalid generation remains visible so its exact finding can be repaired.
            const proposed = (candidates.result ?? candidates.activate())?.find(
              (option) => option.value === nextGeneration,
            );
            if (!candidateWaits(proposed)) executeIntent(interaction.intentFor(nextGeneration));
          }}
          onFocus={candidates.activate}
          onPointerDown={candidates.activate}
          ref={controlRef}
          {...hintProps(
            interaction.disabledReason ?? (waiting ? candidateWaitingHint : undefined),
            description === '' ? undefined : description,
          )}
          type="checkbox"
        />
        <span>Generated</span>
      </label>
    </div>
  );
}

function useLocalVisitOrderInteraction(interactions: WorkspaceInteractionCatalog, slot: LocalSlot) {
  const executeIntent = useCommandIntent();
  const interaction = requireWorkspaceInteraction(
    interactions.localVisitOrders,
    slot.order.interactionKey,
  );
  const candidates = useWorkspaceInteraction(interaction);
  return { candidates, executeIntent, interaction };
}

function orderOption(slot: LocalSlot, key: string) {
  const index = slot.order.options.findIndex((option) => option.key === key);
  const option = slot.order.options[index];
  if (option === undefined) throw new Error(`${slot.label} has no ${key} local-visit proposal`);
  return { index, option };
}

function orderActionState(
  interaction: ReturnType<typeof useLocalVisitOrderInteraction>['interaction'],
  candidate:
    | NonNullable<ReturnType<typeof useLocalVisitOrderInteraction>['candidates']['result']>[number]
    | undefined,
) {
  const waiting = !interaction.contextReached || candidateWaits(candidate);
  const rejection =
    candidate?.evaluation.kind === 'sideRoomEntryOrder' &&
    !candidate.evaluation.result.selectedPossible
      ? candidate.evaluation.result.findings
          .map((finding) => formatFindingSentence(presentFinding(finding)))
          .join(' ')
      : undefined;
  return {
    disabled: waiting || (candidate !== undefined && !candidateMayBeAuthored(candidate)),
    rejection,
    waiting,
  };
}

function VisitControl({
  interactions,
  localVisit,
  slot,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly localVisit: WorkspaceLocalVisitDecision;
  readonly slot: LocalSlot;
}) {
  const { candidates, executeIntent, interaction } = useLocalVisitOrderInteraction(
    interactions,
    slot,
  );
  const optionKey = slot.entered ? 'notEntered' : `position:${localVisit.visitOrder.length + 1}`;
  const { index, option } = orderOption(slot, optionKey);
  const candidate = candidates.result?.[index];
  const state = orderActionState(interaction, candidate);
  const unavailable = slot.generation !== 'generated';
  return (
    <div className="ephyra-side-visit-control">
      <label>
        <input
          aria-busy={candidates.pending || undefined}
          aria-label={`${slot.label} visit`}
          checked={slot.entered}
          data-candidate-support={candidateSupport(candidate)}
          disabled={unavailable || state.disabled}
          onChange={() => {
            if (unavailable) return;
            const assessed = (candidates.result ?? candidates.activate())?.[index];
            if (candidateMayBeAuthored(assessed))
              executeIntent(interaction.intentFor(option.proposedOccurrenceIds));
          }}
          onFocus={candidates.activate}
          onPointerDown={candidates.activate}
          {...hintProps(
            unavailable
              ? 'Generate this door before adding it to the visit order.'
              : (state.rejection ?? (state.waiting ? candidateWaitingHint : undefined)),
            state.rejection,
          )}
          type="checkbox"
        />
        <span>Visited</span>
      </label>
    </div>
  );
}

/** The side room's drag handle: it moves through the projected visit positions. */
function VisitOrderHandle({
  interactions,
  reorder,
  slot,
  visited,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly reorder: TimelineReorderSession;
  readonly slot: GeneratedLocalSlot;
  readonly visited: readonly GeneratedLocalSlot[];
}) {
  const { candidates, executeIntent, interaction } = useLocalVisitOrderInteraction(
    interactions,
    slot,
  );
  const current = slot.enteredOrdinal ?? 0;
  const positions = slot.order.options.flatMap((option, index) => {
    const position = option.position;
    if (position === null || position === current) return [];
    const other = visited[position - 1];
    if (other === undefined) return [];
    const state = orderActionState(interaction, candidates.result?.[index]);
    const reason =
      state.rejection ??
      (candidates.result !== undefined && state.disabled ? 'Move unavailable.' : undefined);
    return [
      {
        at: position,
        move: option.key,
        label: `${position < current ? 'Before' : 'After'} ${other.label}`,
        anchor: other.key,
        edge: position < current ? ('before' as const) : ('after' as const),
        ...(reason === undefined ? {} : { unavailable: reason }),
      },
    ];
  });
  const own = {
    at: current,
    move: undefined,
    label: slot.label,
    anchor: slot.key,
    edge: 'self' as const,
  };
  return (
    <span onFocus={candidates.activate} onPointerDown={candidates.activate}>
      <TimelineReorderHandle
        {...(interaction.contextReached ? {} : { disabledHint: candidateWaitingHint })}
        item={{
          key: slot.key,
          label: slot.label,
          positions: [own, ...positions]
            .sort((left, right) => left.at - right.at)
            .map((position) => ({
              move: position.move,
              label: position.label,
              anchor: position.anchor,
              edge: position.edge,
              ...('unavailable' in position && position.unavailable !== undefined
                ? { unavailable: position.unavailable }
                : {}),
            })),
          onMove: (key) => {
            const { index, option } = orderOption(slot, key);
            const assessed = (candidates.result ?? candidates.activate())?.[index];
            if (candidateMayBeAuthored(assessed))
              executeIntent(interaction.intentFor(option.proposedOccurrenceIds));
          },
        }}
        session={reorder}
      />
    </span>
  );
}

function SideRoomMarker({
  annotation,
  slot,
}: {
  readonly annotation: ReturnType<typeof ephyraSideRoomAnnotationsFor>[number];
  readonly slot: LocalSlot;
}) {
  const state =
    slot.generation !== 'generated'
      ? 'Not generated'
      : slot.entered
        ? `Visited ${slot.enteredOrdinal}`
        : 'Generated, not visited';
  const label = `${slot.label}: ${state}`;
  return (
    <div
      aria-label={label}
      className="ephyra-side-map-marker"
      data-generation={slot.generation}
      data-side-room-slot={slot.key}
      data-visited={slot.entered || undefined}
      style={ephyraSideRoomMapPosition(annotation)}
      {...hintProps(slot.label, undefined, label)}
    >
      <span aria-hidden="true" className="ephyra-side-map-visit-badge">
        {slot.enteredOrdinal === null
          ? slot.generation === 'generated'
            ? 'Not visited'
            : 'Not generated'
          : `Visit ${slot.enteredOrdinal}`}
      </span>
    </div>
  );
}

function VisitOrderRow({
  interactions,
  reorder,
  slot,
  visited,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly reorder: TimelineReorderSession;
  readonly slot: GeneratedLocalSlot;
  readonly visited: readonly GeneratedLocalSlot[];
}) {
  return (
    <li data-reorder-anchor={slot.key} data-side-visit-key={slot.key}>
      <div className="ephyra-side-visit-heading">
        <VisitOrderHandle
          interactions={interactions}
          reorder={reorder}
          slot={slot}
          visited={visited}
        />
        <span className="ephyra-side-visit-ordinal">{`Visit ${slot.enteredOrdinal}`}</span>
        <strong>{slot.label}</strong>
      </div>
    </li>
  );
}

function VisitOrder({
  interactions,
  localVisit,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly localVisit: WorkspaceLocalVisitDecision;
}) {
  const findingAnchor = useFindingAnchor();
  const reorder = useTimelineReorder();
  const { attachRoot } = reorder;
  const slotsByOccurrenceId = new Map(
    localVisit.slots.map((slot) => [slot.occurrenceId, slot] as const),
  );
  const visited: GeneratedLocalSlot[] = localVisit.visitOrder.map((occurrenceId) => {
    const slot = slotsByOccurrenceId.get(occurrenceId);
    if (slot === undefined || slot.generation !== 'generated')
      throw new Error('Local visit order has an unknown or ungenerated side-room occurrence');
    return slot;
  });
  return (
    <div {...findingAnchor(localVisit.order)} className="ephyra-side-controls" tabIndex={-1}>
      <div className="ephyra-side-visit-section">
        <div className="ephyra-side-visit-section-heading">
          <h5>Visit order</h5>
        </div>
        {visited.length === 0 ? (
          <p className="ephyra-side-empty">No side rooms are visited.</p>
        ) : null}
        <ol aria-label="Visited side rooms" className="ephyra-side-visit-list" ref={attachRoot}>
          {visited.map((slot) => (
            <VisitOrderRow
              interactions={interactions}
              key={slot.key}
              reorder={reorder}
              slot={slot}
              visited={visited}
            />
          ))}
        </ol>
        <TimelineReorderStatus session={reorder} />
      </div>
    </div>
  );
}

/** Parent-owned Ephyra traversal editor with an illustrative parent-room map. */
export function LocalVisitWorkbench({
  findingNavigationRevision,
  interactions,
  localVisit,
  parentGameName,
  selectedSlotKey,
  title,
}: {
  readonly findingNavigationRevision?: number;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly localVisit: WorkspaceLocalVisitDecision;
  readonly parentGameName: string;
  readonly selectedSlotKey?: string;
  readonly title: string;
}) {
  const findingAnchor = useFindingAnchor();
  const lastFocusRequest = useRef<number | undefined>(undefined);
  const focusGeneration = (element: HTMLInputElement | null, slotKey: string) => {
    if (
      element !== null &&
      selectedSlotKey === slotKey &&
      findingNavigationRevision !== undefined &&
      findingNavigationRevision !== lastFocusRequest.current
    ) {
      element.focus();
      lastFocusRequest.current = findingNavigationRevision;
    }
  };
  return (
    <section
      {...findingAnchor(localVisit.address)}
      aria-label="Side Rooms"
      className="ephyra-side-editor"
      tabIndex={-1}
    >
      <header className="ephyra-side-heading">
        <h4>Side Rooms</h4>
        <p>
          {localVisit.visitOrder.length} visited · {localVisit.slots.length} possible
        </p>
      </header>
      <div className="ephyra-side-reference-layout">
        <div className="ephyra-side-controls">
          <ol aria-label="Side-room doors by generation priority" className="ephyra-side-door-list">
            {localVisit.slots.map((slot) => (
              <li key={slot.key}>
                <div className="ephyra-side-door-heading">
                  <strong>{slot.label}</strong>
                  <span aria-hidden="true">·</span>
                  <span className="ephyra-side-priority">Priority {slot.availabilityRank}</span>
                </div>
                <div className="ephyra-side-door-toggles">
                  <GenerationControl
                    controlRef={(element) => focusGeneration(element, slot.key)}
                    interactions={interactions}
                    slot={slot}
                  />
                  <VisitControl interactions={interactions} localVisit={localVisit} slot={slot} />
                </div>
                {slot.generation !== 'generated' ? (
                  <div className="field-control field-control-inline control-placeholder">
                    <span>Reward</span>
                    <span className="fixed-room-state">Generate this door to set its reward.</span>
                  </div>
                ) : (
                  <DoorRewardEditor
                    door={slot.door}
                    idPrefix={`local-door-${slot.marker.focusKey}`}
                    interactions={interactions}
                  />
                )}
              </li>
            ))}
          </ol>
          <VisitOrder interactions={interactions} localVisit={localVisit} />
        </div>
        <aside aria-label={`${title} side-room map`} className="ephyra-side-map-reference">
          <RoomMapViewport
            asset={roomMapAssetFor(parentGameName)}
            overlay={
              <div aria-label="Side-room map status" className="ephyra-side-map-marker-layer">
                {ephyraSideRoomAnnotationsFor(parentGameName).map((annotation) => {
                  const slot = localVisit.slots.find(
                    (candidate) => candidate.key === annotation.slotKey,
                  );
                  if (slot === undefined)
                    throw new Error(
                      `${parentGameName} map annotation ${annotation.slotKey} has no local slot`,
                    );
                  return (
                    <SideRoomMarker annotation={annotation} key={annotation.slotKey} slot={slot} />
                  );
                })}
              </div>
            }
            title={title}
            controlsPlacement="collapsible-overlay"
          />
        </aside>
      </div>
    </section>
  );
}

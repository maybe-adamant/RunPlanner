import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { candidateSupport } from '@planner/projections/candidates/candidateProjection';
import {
  formatFindingExplanation,
  presentFinding,
} from '@planner/projections/evaluationProjection';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceLocalVisitDecision,
  type WorkspaceLocalVisitOrderInteraction,
} from '@planner/projections/structured-workspace';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import {
  candidateMayBeAuthored,
  candidateWaitingTitle,
  candidateWaits,
} from '@planner/ui/feedback/candidatePresentation';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import {
  useWorkspaceInteraction,
  useWorkspaceInteractionController,
} from '@planner/ui/controls/useWorkspaceInteraction';
import {
  ephyraSideRoomAnnotationsFor,
  ephyraSideRoomMapPosition,
} from '@planner/ui/room-maps/EphyraSideRoomAnnotations';
import { RoomMapViewport } from '@planner/ui/room-maps/RoomMapViewport';
import { roomMapAssetFor } from '@planner/ui/room-maps/roomMapAssets';
import { DoorRewardEditor } from '../DoorRewardEditor';

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
      <label title={interaction.disabledReason}>
        <input
          {...target}
          aria-busy={candidates.pending || undefined}
          aria-description={description === '' ? undefined : description}
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
          title={interaction.disabledReason ?? (waiting ? candidateWaitingTitle : undefined)}
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
          .map((finding) => formatFindingExplanation(presentFinding(finding)))
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
  const rejectionId = `${slot.key}-visit-rejection`;
  const unavailable = slot.generation !== 'generated';
  return (
    <div className="ephyra-side-visit-control">
      <label>
        <input
          aria-busy={candidates.pending || undefined}
          aria-describedby={state.rejection === undefined ? undefined : rejectionId}
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
          title={
            unavailable
              ? 'Generate this door before adding it to the visit order.'
              : (state.rejection ?? (state.waiting ? candidateWaitingTitle : undefined))
          }
          type="checkbox"
        />
        <span>Visited</span>
      </label>
      {state.rejection === undefined ? null : (
        <span className="ephyra-side-order-rejection" id={rejectionId}>
          {state.rejection}
        </span>
      )}
    </div>
  );
}

function VisitArrowControls({
  interactions,
  slot,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly slot: LocalSlot;
}) {
  const { candidates, executeIntent, interaction } = useLocalVisitOrderInteraction(
    interactions,
    slot,
  );
  const position = slot.enteredOrdinal;
  return (
    <>
      {([-1, 1] as const).map((offset) => {
        const option = slot.order.options.find(
          (option) => option.position === (position ?? 0) + offset,
        );
        const index = option === undefined ? -1 : orderOption(slot, option.key).index;
        const candidate = candidates.result?.[index];
        const state = orderActionState(interaction, candidate);
        return (
          <button
            key={offset}
            aria-label={`Move ${slot.label} ${offset < 0 ? 'up' : 'down'}`}
            className="quiet-action action-compact"
            disabled={option === undefined || state.disabled}
            onFocus={candidates.activate}
            onPointerDown={candidates.activate}
            onClick={() => {
              if (option === undefined) return;
              const assessed = (candidates.result ?? candidates.activate())?.[index];
              if (candidateMayBeAuthored(assessed))
                executeIntent(interaction.intentFor(option.proposedOccurrenceIds));
            }}
            title={
              state.rejection ??
              (option !== undefined && state.waiting ? candidateWaitingTitle : undefined)
            }
            type="button"
          >
            {offset < 0 ? '↑' : '↓'}
          </button>
        );
      })}
    </>
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
  return (
    <div
      aria-label={`${slot.label}: ${state}`}
      className="ephyra-side-map-marker"
      data-generation={slot.generation}
      data-side-room-slot={slot.key}
      data-visited={slot.entered || undefined}
      style={ephyraSideRoomMapPosition(annotation)}
      title={`${slot.label}: ${state}`}
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
  onDragStart,
  slot,
  dragging,
  dropSide,
  dropState,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly onDragStart: (event: ReactPointerEvent<HTMLSpanElement>, slotKey: string) => void;
  readonly slot: GeneratedLocalSlot;
  readonly dragging: boolean;
  readonly dropSide: 'before' | 'after' | undefined;
  readonly dropState: 'available' | 'unavailable' | undefined;
}) {
  return (
    <li
      data-dragging={dragging || undefined}
      data-side-visit-key={slot.key}
      data-drop-before={dropSide === 'before' ? dropState : undefined}
      data-drop-after={dropSide === 'after' ? dropState : undefined}
    >
      <div className="ephyra-side-visit-heading">
        <span
          aria-label={`Drag ${slot.label}`}
          className="hub-roster-drag-handle"
          data-dragging={dragging || undefined}
          onPointerDown={(event) => onDragStart(event, slot.key)}
        >
          ⠿
        </span>
        <span className="ephyra-side-visit-ordinal">{`Visit ${slot.enteredOrdinal}`}</span>
        <strong>{slot.label}</strong>
      </div>
      <div className="ephyra-side-visit-actions">
        <VisitArrowControls interactions={interactions} slot={slot} />
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
  const findingTarget = useFindingTarget();
  const executeIntent = useCommandIntent();
  const board = useRef<HTMLOListElement>(null);
  const pendingDrag = useRef<
    | {
        slotKey: string;
        pointerId: number;
        handle: HTMLSpanElement;
        x: number;
        y: number;
      }
    | undefined
  >(undefined);
  const activeDrag = useRef<
    { slotKey: string; x: number; y: number; targetKey: string | undefined } | undefined
  >(undefined);
  const [drag, setDrag] = useState<typeof activeDrag.current>(undefined);
  const [dragFeedback, setDragFeedback] = useState<string | undefined>(undefined);
  const dragCandidates =
    useWorkspaceInteractionController<ReturnType<WorkspaceLocalVisitOrderInteraction['load']>>();
  const slotsByOccurrenceId = new Map(
    localVisit.slots.map((slot) => [slot.occurrenceId, slot] as const),
  );
  const visited: GeneratedLocalSlot[] = localVisit.visitOrder.map((occurrenceId) => {
    const slot = slotsByOccurrenceId.get(occurrenceId);
    if (slot === undefined || slot.generation !== 'generated')
      throw new Error('Local visit order has an unknown or ungenerated side-room occurrence');
    return slot;
  });
  const proposalForMove = (slotKey: string, position: number) => {
    const slot = localVisit.slots.find((candidate) => candidate.key === slotKey);
    if (slot === undefined || slot.generation !== 'generated' || !slot.entered) return;
    const option = slot.order.options.find((candidate) => candidate.position === position);
    if (option === undefined || option.key === slot.order.selectedKey) return;
    const interaction = requireWorkspaceInteraction(
      interactions.localVisitOrders,
      slot.order.interactionKey,
    );
    const { index } = orderOption(slot, option.key);
    return { interaction, option, index };
  };
  const moveDraggedTo = (slotKey: string, position: number) => {
    const proposal = proposalForMove(slotKey, position);
    if (proposal === undefined) return;
    const { interaction, option, index } = proposal;
    const options =
      dragCandidates.observe(interaction).result ?? dragCandidates.activate(interaction);
    const selected = options?.[index];
    const state = orderActionState(interaction, selected);
    if (!candidateMayBeAuthored(selected)) {
      setDragFeedback(
        state.rejection ?? (state.waiting ? candidateWaitingTitle : 'Move unavailable.'),
      );
      return;
    }
    setDragFeedback(undefined);
    executeIntent(interaction.intentFor(option.proposedOccurrenceIds));
  };
  const startDrag = (event: ReactPointerEvent<HTMLSpanElement>, slotKey: string) => {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pendingDrag.current = {
      slotKey,
      pointerId: event.pointerId,
      handle: event.currentTarget,
      x: event.clientX,
      y: event.clientY,
    };
    setDragFeedback(undefined);
    const slot = localVisit.slots.find((candidate) => candidate.key === slotKey);
    if (slot === undefined) return;
    dragCandidates.activate(
      requireWorkspaceInteraction(interactions.localVisitOrders, slot.order.interactionKey),
    );
  };
  const clearDrag = (pointerId: number) => {
    const pending = pendingDrag.current;
    if (pending?.pointerId !== pointerId) return;
    pendingDrag.current = undefined;
    activeDrag.current = undefined;
    setDrag(undefined);
    if (pending.handle.hasPointerCapture?.(pointerId))
      pending.handle.releasePointerCapture(pointerId);
  };
  const targetAt = (x: number, y: number) => {
    const row = document.elementFromPoint?.(x, y)?.closest<HTMLElement>('[data-side-visit-key]');
    return row !== null && row !== undefined && board.current?.contains(row)
      ? row.dataset.sideVisitKey
      : undefined;
  };
  const updateDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const pending = pendingDrag.current;
    if (pending?.pointerId !== event.pointerId) return;
    if (
      activeDrag.current === undefined &&
      Math.hypot(event.clientX - pending.x, event.clientY - pending.y) < 6
    )
      return;
    const next = {
      slotKey: pending.slotKey,
      x: event.clientX,
      y: event.clientY,
      targetKey: targetAt(event.clientX, event.clientY),
    };
    activeDrag.current = next;
    setDrag(next);
  };
  const completeDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (pendingDrag.current?.pointerId !== event.pointerId) return;
    const active = activeDrag.current;
    const target = targetAt(event.clientX, event.clientY);
    clearDrag(event.pointerId);
    if (active === undefined || target === undefined || target === active.slotKey) return;
    const index = visited.findIndex((slot) => slot.key === target);
    if (index >= 0) moveDraggedTo(active.slotKey, index + 1);
  };
  const sourceIndex = visited.findIndex((slot) => slot.key === drag?.slotKey);
  const targetIndex = visited.findIndex((slot) => slot.key === drag?.targetKey);
  const hoveredProposal =
    drag === undefined || sourceIndex < 0 || targetIndex < 0
      ? undefined
      : proposalForMove(drag.slotKey, targetIndex + 1);
  const hoveredCandidate =
    hoveredProposal === undefined
      ? undefined
      : dragCandidates.observe(hoveredProposal.interaction).result?.[hoveredProposal.index];
  const hoveredState =
    hoveredProposal === undefined
      ? undefined
      : orderActionState(hoveredProposal.interaction, hoveredCandidate);
  return (
    <div {...findingTarget(localVisit.order)} className="ephyra-side-controls" tabIndex={-1}>
      <div className="ephyra-side-visit-section">
        <div className="ephyra-side-visit-section-heading">
          <h5>Visit order</h5>
        </div>
        {visited.length === 0 ? (
          <p className="ephyra-side-empty">No side rooms are visited.</p>
        ) : null}
        <ol
          aria-label="Visited side rooms"
          className="ephyra-side-visit-list"
          ref={board}
          onPointerMove={updateDrag}
          onPointerUp={completeDrag}
          onPointerCancel={(event) => clearDrag(event.pointerId)}
          onLostPointerCapture={(event) => clearDrag(event.pointerId)}
        >
          {visited.map((slot, index) => (
            <VisitOrderRow
              interactions={interactions}
              key={slot.key}
              onDragStart={startDrag}
              dragging={drag?.slotKey === slot.key}
              dropState={
                hoveredState === undefined
                  ? undefined
                  : candidateMayBeAuthored(hoveredCandidate)
                    ? 'available'
                    : 'unavailable'
              }
              dropSide={
                hoveredProposal !== undefined && targetIndex === index
                  ? sourceIndex < index
                    ? 'after'
                    : 'before'
                  : undefined
              }
              slot={slot}
            />
          ))}
        </ol>
        {drag === undefined ? null : (
          <div
            aria-hidden="true"
            className="room-action-drag-preview"
            style={{
              transform: `translate3d(calc(${drag.x + 14}px / var(--app-scale, 1)), calc(${drag.y + 14}px / var(--app-scale, 1)), 0)`,
            }}
          >
            <div className="room-action-drag-header">
              <span>⠿</span>
              <strong>{visited.find((slot) => slot.key === drag.slotKey)?.label}</strong>
            </div>
            {hoveredState === undefined ? null : (
              <span className="room-action-drag-feedback">
                {hoveredCandidate === undefined
                  ? 'Checking move…'
                  : hoveredState.disabled
                    ? `Unavailable: ${hoveredState.rejection ?? (hoveredState.waiting ? candidateWaitingTitle : 'Move unavailable.')}`
                    : 'Drop here'}
              </span>
            )}
          </div>
        )}
        {dragFeedback === undefined ? null : (
          <div className="room-action-placement-notice" role="status">
            <span>{dragFeedback}</span>
            <button
              className="quiet-action action-compact"
              type="button"
              onClick={() => setDragFeedback(undefined)}
            >
              Dismiss
            </button>
          </div>
        )}
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
  const findingTarget = useFindingTarget();
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
      {...findingTarget(localVisit.address)}
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

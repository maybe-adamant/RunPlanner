import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  candidateSupport,
  presentCandidateLabel,
} from '@planner/projections/candidates/candidateProjection';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceLocalVisitDecision,
  type WorkspaceSideRoomsTab,
} from '@planner/projections/structured-workspace';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import {
  candidateMayBeAuthored,
  candidateWaitingTitle,
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

type LocalSlot = WorkspaceLocalVisitDecision['slots'][number];

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
      onFocus={() => {
        setHintOpen(true);
      }}
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
          title={waiting ? candidateWaitingTitle : undefined}
          type="checkbox"
        />
        <span>Generated</span>
      </label>
      {disabled ? (
        <span className="ephyra-side-generation-hint" hidden={!hintOpen} id={hintId} role="tooltip">
          {interaction.disabledReason}
        </span>
      ) : null}
    </div>
  );
}

function VisitOrderControl({
  controlRef,
  interactions,
  slot,
}: {
  readonly controlRef: (element: HTMLSelectElement | null) => void;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly slot: LocalSlot;
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
  const waiting =
    !interaction.contextReached ||
    (candidates.result !== undefined &&
      candidates.result.length > 0 &&
      candidates.result.every(candidateWaits));
  return (
    <label className="field-control ephyra-side-entry-order">
      <span>Visit position</span>
      <select
        aria-busy={candidates.pending || undefined}
        aria-label={`${slot.label} visit order`}
        data-candidate-support={candidateSupport(selectedCandidate)}
        disabled={slot.generation !== 'generated' || waiting}
        onChange={(event) => {
          const index = slot.order.options.findIndex((option) => option.key === event.target.value);
          const option = slot.order.options[index];
          const candidate = (candidates.result ?? candidates.activate())?.[index];
          if (option !== undefined && candidateMayBeAuthored(candidate))
            executeIntent(interaction.intentFor(option.proposedOccurrenceIds));
        }}
        onFocus={() => {
          candidates.activate();
        }}
        onPointerDown={() => {
          candidates.activate();
        }}
        ref={controlRef}
        title={waiting ? candidateWaitingTitle : undefined}
        value={slot.order.selectedKey}
      >
        {slot.order.options.map((option, index) => {
          const candidate = candidates.result?.[index];
          return (
            <option
              data-candidate-support={candidateSupport(candidate)}
              disabled={candidate !== undefined && !candidateMayBeAuthored(candidate)}
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

function SideRoomMarker({
  annotation,
  slot,
  view,
}: {
  readonly annotation: ReturnType<typeof ephyraSideRoomAnnotationsFor>[number];
  readonly slot: LocalSlot;
  readonly view: WorkspaceSideRoomsTab;
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
        {view === 'visits'
          ? slot.enteredOrdinal === null
            ? 'Not visited'
            : `Visit ${slot.enteredOrdinal}`
          : slot.generation === 'generated'
            ? 'Generated'
            : 'Not generated'}
      </span>
    </div>
  );
}

function Doors({
  interactions,
  localVisit,
  registerGenerationControl,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly localVisit: WorkspaceLocalVisitDecision;
  readonly registerGenerationControl: (slotKey: string, element: HTMLInputElement | null) => void;
}) {
  return (
    <div className="ephyra-side-controls">
      <p className="ephyra-side-order-note">Doors are checked in generation priority order.</p>
      <ol aria-label="Side-room doors by generation priority" className="ephyra-side-door-list">
        {localVisit.slots.map((slot) => (
          <li key={slot.key}>
            <div className="ephyra-side-door-heading">
              <strong>{slot.label}</strong>
              <GenerationControl
                controlRef={(element) => registerGenerationControl(slot.key, element)}
                interactions={interactions}
                slot={slot}
              />
            </div>
            <span className="ephyra-side-priority">Priority {slot.availabilityRank}</span>
            {slot.generation !== 'generated' ? (
              <p className="ephyra-side-unavailable">No reward until this door is generated.</p>
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
    </div>
  );
}

function Visits({
  interactions,
  localVisit,
  registerOrderControl,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly localVisit: WorkspaceLocalVisitDecision;
  readonly registerOrderControl: (slotKey: string, element: HTMLSelectElement | null) => void;
}) {
  const findingTarget = useFindingTarget();
  const positions = new Map(
    localVisit.visitOrder.map((occurrenceId, index) => [occurrenceId, index]),
  );
  const slots = [...localVisit.slots].sort(
    (left, right) =>
      (positions.get(left.occurrenceId) ?? Number.MAX_SAFE_INTEGER) -
        (positions.get(right.occurrenceId) ?? Number.MAX_SAFE_INTEGER) ||
      left.availabilityRank - right.availabilityRank,
  );
  return (
    <div {...findingTarget(localVisit.order)} className="ephyra-side-controls" tabIndex={-1}>
      <p className="ephyra-side-order-note">Visit positions use authored traversal order.</p>
      <ol aria-label="Side-room visits" className="ephyra-side-visit-list">
        {slots.map((slot) => (
          <li key={slot.key}>
            <div className="ephyra-side-visit-heading">
              <span>
                {slot.enteredOrdinal === null ? 'Not visited' : `Visit ${slot.enteredOrdinal}`}
              </span>
              <strong>{slot.label}</strong>
              {slot.generation === 'generated' ? (
                <span>
                  {slot.door.offerRewardSurface.rewards
                    .map((reward) => reward.summary)
                    .join(', ') || 'No reward'}
                </span>
              ) : null}
            </div>
            <VisitOrderControl
              controlRef={(element) => registerOrderControl(slot.key, element)}
              interactions={interactions}
              slot={slot}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Parent-owned Ephyra traversal editor with an illustrative parent-room map. */
export function LocalVisitWorkbench({
  findingNavigationRevision,
  interactions,
  localVisit,
  onSessionChange,
  parentGameName,
  selectedSlotKey,
  title,
  view,
}: {
  readonly findingNavigationRevision?: number;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly localVisit: WorkspaceLocalVisitDecision;
  readonly onSessionChange: (session: {
    readonly slotKey: string | undefined;
    readonly view: WorkspaceSideRoomsTab;
  }) => void;
  readonly parentGameName: string;
  readonly selectedSlotKey: string | undefined;
  readonly title: string;
  readonly view: WorkspaceSideRoomsTab;
}) {
  const findingTarget = useFindingTarget();
  const generationRefs = useRef(new Map<string, HTMLInputElement | null>());
  const orderRefs = useRef(new Map<string, HTMLSelectElement | null>());
  const lastFocusRequest = useRef<number | undefined>(undefined);
  const tabRefs = useRef<Partial<Record<WorkspaceSideRoomsTab, HTMLButtonElement | null>>>({});
  useEffect(() => {
    if (selectedSlotKey === undefined) return;
    const focusRequest = findingNavigationRevision;
    if (focusRequest === undefined || focusRequest === lastFocusRequest.current) return;
    const control =
      view === 'doors'
        ? generationRefs.current.get(selectedSlotKey)
        : orderRefs.current.get(selectedSlotKey);
    if (control === undefined || control === null) return;
    control.focus();
    lastFocusRequest.current = focusRequest;
  }, [findingNavigationRevision, selectedSlotKey, view]);
  const tabId = (view: WorkspaceSideRoomsTab) =>
    `side-rooms-${localVisit.address.sourceOccurrenceId}-${view}`;
  const panelId = `side-rooms-${localVisit.address.sourceOccurrenceId}-panel`;
  const moveTab = (event: KeyboardEvent<HTMLButtonElement>, view: WorkspaceSideRoomsTab) => {
    const tabs: readonly WorkspaceSideRoomsTab[] = ['doors', 'visits'];
    const index = tabs.indexOf(view);
    const next =
      event.key === 'ArrowRight'
        ? tabs[(index + 1) % tabs.length]
        : event.key === 'ArrowLeft'
          ? tabs[(index + tabs.length - 1) % tabs.length]
          : event.key === 'Home'
            ? tabs[0]
            : event.key === 'End'
              ? tabs[tabs.length - 1]
              : undefined;
    if (next === undefined) return;
    event.preventDefault();
    onSessionChange({ slotKey: selectedSlotKey, view: next });
    tabRefs.current[next]?.focus();
  };
  return (
    <section
      {...findingTarget(localVisit.address)}
      aria-label="Side Rooms"
      className="ephyra-side-editor"
      tabIndex={-1}
    >
      <header className="ephyra-side-heading">
        <div>
          <h4>Side Rooms</h4>
          <p>
            {localVisit.visitOrder.length} visited · {localVisit.slots.length} possible
          </p>
        </div>
        <nav aria-label="Side Rooms views" className="ephyra-side-tabs" role="tablist">
          {(['doors', 'visits'] as const).map((sideRoomsView) => (
            <button
              aria-controls={panelId}
              aria-selected={view === sideRoomsView}
              className="room-workbench-tab"
              id={tabId(sideRoomsView)}
              key={sideRoomsView}
              onClick={() => {
                onSessionChange({ slotKey: selectedSlotKey, view: sideRoomsView });
              }}
              onKeyDown={(event) => moveTab(event, sideRoomsView)}
              ref={(element) => {
                tabRefs.current[sideRoomsView] = element;
              }}
              role="tab"
              tabIndex={view === sideRoomsView ? 0 : -1}
              type="button"
            >
              {sideRoomsView === 'doors' ? 'Doors' : 'Visits'}
            </button>
          ))}
        </nav>
      </header>
      <div
        aria-labelledby={tabId(view)}
        className="ephyra-side-reference-layout"
        id={panelId}
        role="tabpanel"
      >
        {view === 'doors' ? (
          <Doors
            interactions={interactions}
            localVisit={localVisit}
            registerGenerationControl={(slotKey, element) => {
              generationRefs.current.set(slotKey, element);
            }}
          />
        ) : (
          <Visits
            interactions={interactions}
            localVisit={localVisit}
            registerOrderControl={(slotKey, element) => {
              orderRefs.current.set(slotKey, element);
            }}
          />
        )}
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
                    <SideRoomMarker
                      annotation={annotation}
                      key={annotation.slotKey}
                      slot={slot}
                      view={view}
                    />
                  );
                })}
              </div>
            }
            title={title}
            toolbarTitle="Parent room map"
          />
        </aside>
      </div>
    </section>
  );
}

import { candidateSupport } from '@planner/projections/candidates/candidateProjection';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceLocalVisitDecision,
} from '@planner/projections/structured-workspace';
import { useFindingAnchor, useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { candidateWaitingHint, candidateWaits } from '@planner/ui/feedback/candidatePresentation';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { hintProps } from '@planner/ui/controls/hint';
import { FixedValueChip } from '@planner/ui/controls/FixedValueChip';
import {
  ephyraSideRoomAnnotationsFor,
  ephyraSideRoomMapPosition,
} from '@planner/ui/room-maps/EphyraSideRoomAnnotations';
import { RoomMapLauncher } from '@planner/ui/room-maps/RoomMapDialog';
import { roomKindIcon } from '../roomIcon';
import { DoorRewardEditor, DoorRewardHiddenTag, RerolledRewardRepairs } from '../DoorRewardEditor';
import { DoorRow, DoorRowsHeader } from '../DecisionWorkbench';

type LocalSlot = WorkspaceLocalVisitDecision['slots'][number];

/** Whether the side door opens: the game spawns it or leaves it shut. */
function OpenControl({
  interactions,
  slot,
}: {
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
  const target = findingTarget(slot.address);
  const description = [target['aria-description'], interaction.disabledReason]
    .filter((entry) => entry !== undefined)
    .join(' ');
  return (
    <input
      {...target}
      aria-busy={candidates.pending || undefined}
      aria-label={`Open ${slot.label}`}
      checked={slot.generation === 'generated'}
      data-candidate-support={candidateSupport(candidate)}
      disabled={disabled || waiting}
      onChange={() => {
        if (disabled) return;
        // A context-invalid opening stays visible so its exact finding can be repaired.
        const proposed = (candidates.result ?? candidates.activate())?.find(
          (option) => option.value === nextGeneration,
        );
        if (!candidateWaits(proposed)) executeIntent(interaction.intentFor(nextGeneration));
      }}
      onFocus={candidates.activate}
      onPointerDown={candidates.activate}
      {...hintProps(
        interaction.disabledReason ?? (waiting ? candidateWaitingHint : undefined),
        description === '' ? undefined : description,
      )}
      type="checkbox"
    />
  );
}

/** The doors table names a side room by its number alone, as SR 10. */
function sideRoomShortLabel(label: string): string {
  return label.replace(/^Side Room /, 'SR ');
}

function SideDoorRow({
  interactions,
  slot,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly slot: LocalSlot;
}) {
  const generated = slot.generation === 'generated';
  return (
    <DoorRow
      ariaLabel={`${slot.label} door`}
      identity={
        <span className="door-row-number">
          <span className="visually-hidden">Priority </span>
          {slot.availabilityRank}
        </span>
      }
      map={{ gameName: slot.gameName, hostId: slot.marker.focusKey, title: slot.label }}
      reward={
        generated ? (
          <DoorRewardEditor
            door={slot.door}
            idPrefix={`local-door-${slot.marker.focusKey}`}
            interactions={interactions}
            layout="row"
          />
        ) : (
          <span className="door-row-waiting">Door closed</span>
        )
      }
      room={
        <>
          <span aria-hidden="true">
            <FixedValueChip
              icon={roomKindIcon(slot.roomIcon)}
              label={sideRoomShortLabel(slot.label)}
            />
          </span>
          <span className="visually-hidden">{slot.label}</span>
        </>
      }
      secondary={
        generated ? (
          <>
            <RerolledRewardRepairs
              rewards={slot.door.offerRewardSurface.rewards}
              target={slot.label}
            />
            <DoorRewardHiddenTag door={slot.door} />
          </>
        ) : null
      }
      selection={<OpenControl interactions={interactions} slot={slot} />}
      state={{ available: generated, picked: slot.entered }}
    />
  );
}

/** Each side door's state as a label over its painted circle on the main room's map. */
function SideDoorMapMarkers({
  localVisit,
  parentGameName,
}: {
  readonly localVisit: WorkspaceLocalVisitDecision;
  readonly parentGameName: string;
}) {
  return (
    <div aria-label="Side-room map status" className="ephyra-side-map-marker-layer">
      {ephyraSideRoomAnnotationsFor(parentGameName).map((annotation) => {
        const slot = localVisit.slots.find((candidate) => candidate.key === annotation.slotKey);
        if (slot === undefined)
          throw new Error(
            `${parentGameName} map annotation ${annotation.slotKey} has no side slot`,
          );
        const state =
          slot.generation !== 'generated'
            ? 'Closed'
            : slot.enteredOrdinal === null
              ? 'Not visited'
              : `Visit ${slot.enteredOrdinal}`;
        return (
          <div
            aria-label={`${slot.label}: ${state}`}
            className="ephyra-side-map-marker"
            data-generation={slot.generation}
            data-side-room-slot={slot.key}
            data-visited={slot.entered || undefined}
            key={annotation.slotKey}
            style={ephyraSideRoomMapPosition(annotation)}
          >
            <span aria-hidden="true" className="ephyra-side-map-visit-badge">
              {state}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The main room's side doors as Overview spawns: which open, the side room
 * behind each and its reward, by the game's generation priority. Visits are
 * picked on the room's Timeline.
 */
export function SideDoorSpawns({
  interactions,
  localVisit,
  parentGameName,
  title,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly localVisit: WorkspaceLocalVisitDecision;
  readonly parentGameName: string;
  readonly title: string;
}) {
  const findingAnchor = useFindingAnchor();
  return (
    <section
      {...findingAnchor(localVisit.address)}
      aria-label="Side doors"
      className="door-workbench"
      tabIndex={-1}
    >
      <div
        aria-label="Side doors by generation priority"
        className="door-rows side-door-spawns"
        role="group"
      >
        <DoorRowsHeader
          action={
            <RoomMapLauncher
              gameName={parentGameName}
              hostId={localVisit.marker.focusKey}
              overlay={
                <SideDoorMapMarkers localVisit={localVisit} parentGameName={parentGameName} />
              }
              title={title}
            />
          }
          identity="Priority"
          select="Open"
        />
        {localVisit.slots.map((slot) => (
          <SideDoorRow interactions={interactions} key={slot.key} slot={slot} />
        ))}
      </div>
    </section>
  );
}

import { candidateSupport } from '@planner/projections/candidates/candidateProjection';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceLocalVisitDecision,
  type WorkspaceRoomMap,
} from '@planner/projections/structured-workspace';
import { useFindingAnchor, useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { candidateWaitingHint, candidateWaits } from '@planner/ui/feedback/candidatePresentation';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { hintProps } from '@planner/ui/controls/hint';
import { FixedValueChip } from '@planner/ui/controls/FixedValueChip';
import { RoomMapLauncher } from '@planner/ui/room-maps/RoomMapDialog';
import { roomMapCalibrations } from '@planner/ui/room-maps/roomMapCalibration';
import { roomObjectIcon } from '@planner/ui/artwork/roomArtwork';
import { roomKindIcon } from '../roomIcon';
import { DoorRewardEditor, DoorRewardHiddenTag, RerolledRewardRepairs } from '../DoorRewardEditor';
import { DoorRow, DoorRowsHeader } from '../DecisionWorkbench';
import { DoorRows } from '../DoorRows';
import { RoomFeatureMapLegend, RoomFeatureMapPoints } from '../room-map/RoomMapPoints';
import { OverviewRow } from '../RoomOverviewSections';
import { sideDoorMapDoors } from './sideDoorMapDoors';

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
      map={{
        gameName: slot.gameName,
        hostId: slot.marker.focusKey,
        title: slot.label,
        ...(slot.generation === 'generated' ? { points: slot.room.map } : {}),
      }}
      mapLink={{ kind: 'sideDoor', slotKey: slot.key }}
      reward={
        generated ? (
          <DoorRewardEditor
            door={slot.door}
            idPrefix={`local-door-${slot.marker.focusKey}`}
            interactions={interactions}
            layout="row"
          />
        ) : (
          <img
            alt="Door closed"
            className="door-lock-indicator"
            data-hint="Door closed"
            src={roomObjectIcon('doorLock')}
          />
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

/**
 * The main room's side doors as Overview spawns: which open, the side room
 * behind each and its reward, by the game's generation priority. Visits are
 * picked on the room's Timeline.
 */
export function SideDoorSpawns({
  flipped,
  interactions,
  localVisit,
  map,
  parentGameName,
  title,
}: {
  /** The main room shows flipped. */
  readonly flipped: boolean;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly localVisit: WorkspaceLocalVisitDecision;
  /** The main room's map points. */
  readonly map: WorkspaceRoomMap | undefined;
  readonly parentGameName: string;
  readonly title: string;
}) {
  const findingAnchor = useFindingAnchor();
  const mapped = map !== undefined && roomMapCalibrations[parentGameName] !== undefined;
  return (
    <OverviewRow label="Side rooms">
      <section
        {...findingAnchor(localVisit.address)}
        aria-label="Side doors"
        className="door-workbench side-door-spawns-workbench"
        tabIndex={-1}
      >
        <DoorRows
          ariaLabel="Side doors by generation priority"
          className="side-door-spawns"
          role="group"
        >
          <DoorRowsHeader
            action={
              <RoomMapLauncher
                gameName={parentGameName}
                hostId={localVisit.marker.focusKey}
                {...(mapped
                  ? {
                      legend: <RoomFeatureMapLegend gameName={parentGameName} map={map} />,
                      mirrored: flipped,
                      overlay: (
                        <RoomFeatureMapPoints
                          flipped={flipped}
                          gameName={parentGameName}
                          map={map}
                          sideDoors={sideDoorMapDoors(localVisit)}
                          title={title}
                        />
                      ),
                    }
                  : {})}
                title={title}
              />
            }
            identity="Priority"
            select="Open"
          />
          {localVisit.slots.map((slot) => (
            <SideDoorRow interactions={interactions} key={slot.key} slot={slot} />
          ))}
        </DoorRows>
      </section>
    </OverviewRow>
  );
}

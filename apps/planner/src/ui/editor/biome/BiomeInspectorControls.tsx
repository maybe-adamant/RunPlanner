import { ArcanaActivationEditor } from './ArcanaActivationEditor';
/* The inspector-node adapter deliberately exports these projected render products. */
/* eslint-disable react-refresh/only-export-components */
import { semanticAddressKey } from '@run-planner/engine/authored-project';
import { useCallback, useEffect, type ReactNode } from 'react';

import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceFigurineArcanaInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceJudgmentArcanaInteraction,
  type WorkspaceNode,
  type WorkspaceRoomLifecycleBoundary,
  type WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';
import {
  arcanaActivationDialogClosed,
  arcanaActivationDialogOpened,
  semanticOwnerFocused,
  type ArcanaActivationAddress,
} from '@planner/state/editorSessionSlice';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { RoomSelector } from './RoomSelector';
import { TimelineRow } from './TimelineRow';
import type { TimelineBoundaryContent } from './OccurrenceRoomActions';
import { BiomeWorkspaceContractError } from './workspaceContract';
import { KeepsakeEquipResultPicker, KeepsakeSelectionLauncher } from '../KeepsakePickers';
import { ArtworkChip } from '../rewards/TimelineChip';
import { keepsakeArtwork } from '@planner/ui/controls/keepsakes/keepsakeArtwork';
import { arcanaArtwork } from '@planner/ui/controls/arcana-fear/arcanaArtwork';
import { ActionIcon } from '@planner/ui/controls/ActionIcon';
import { hintProps } from '@planner/ui/controls/hint';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';

/** A Postboss rack row: "and swap" the keepsake held going in for the picked one, or "and equip" it. */
function KeepsakeRackTimelineContent({
  interactions,
  selection,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly selection: NonNullable<WorkspaceRoomSummary['keepsakeSelection']>;
}) {
  const interaction = interactions.keepsakeSelections.get(
    workspaceInteractionKey(selection.address),
  );
  const equipResult =
    selection.equipResult === undefined
      ? undefined
      : interactions.keepsakeEquipResults.get(
          workspaceInteractionKey(selection.equipResult.address),
        );
  if (interaction === undefined) return null;
  const held = selection.heldKeepsake;
  return (
    <div className="room-keepsake-action room-keepsake-chips">
      {held === undefined ? (
        <strong>and equip</strong>
      ) : (
        <>
          <strong>and swap</strong>
          <ArtworkChip icon={keepsakeArtwork[held.key]} label={held.label} />
          <span aria-hidden="true" className="row-reward-arrow">
            →
          </span>
        </>
      )}
      <div className="room-keepsake-control" data-label-hidden>
        <KeepsakeSelectionLauncher
          chip
          equipResults={equipResult === undefined ? [] : [equipResult]}
          {...(held === undefined ? {} : { held })}
          id={`postboss-keepsake-${interaction.key}`}
          interaction={interaction}
          label="Choose Keepsake"
        />
      </div>
      {equipResult === undefined ? null : (
        <KeepsakeEquipResultPicker
          chip
          id={`postboss-keepsake-${interaction.key}-${equipResult.owner.resultKind}`}
          interaction={equipResult}
        />
      )}
    </div>
  );
}

/**
 * The Arcana cards a Judgment or Crystal Figurine activates, as chips in draw
 * order with dashed slots for those still to choose, then the pencil that edits them.
 */
function ArcanaActivationChips({
  control,
  launcher,
  name,
  onEdit,
  rarity,
  requiredCount,
}: {
  readonly control: WorkspaceJudgmentArcanaInteraction | WorkspaceFigurineArcanaInteraction;
  readonly launcher: ReturnType<ReturnType<typeof useFindingTarget>>;
  readonly name: string;
  readonly onEdit: () => void;
  /** The rarity the activated cards take, ringed on their chips. */
  readonly rarity?: string;
  readonly requiredCount: number;
}) {
  const open = Math.max(0, requiredCount - control.value.length);
  return (
    <span className="timeline-chip-group">
      {control.value.map((key, index) => {
        const label = control.choices.find((choice) => choice.value === key)?.label ?? key;
        return (
          <span
            {...hintProps(label, undefined, label)}
            aria-label={label}
            className="timeline-chip"
            data-chip-state="shown"
            data-rarity={rarity}
            key={`${key}-${index}`}
            role="img"
          >
            <ArtworkIcon className="artwork-label-icon" source={arcanaArtwork[key]} />
          </span>
        );
      })}
      {Array.from({ length: open }, (_, index) => (
        <span
          aria-hidden="true"
          className="timeline-chip"
          data-chip-state="unset"
          key={`open-${index}`}
        />
      ))}
      <button
        {...launcher}
        aria-label={`Edit ${name}`}
        className="timeline-chip-edit"
        onClick={onEdit}
        type="button"
      >
        <ActionIcon name="edit" />
      </button>
    </span>
  );
}

/** The Redux-held open state of one Judgment or Crystal Figurine dialog. */
function useArcanaActivationDialog(owner: ArcanaActivationAddress) {
  const dispatch = useAppDispatch();
  const ownerKey = semanticAddressKey(owner);
  const open = useAppSelector((state) => {
    const target = state.editorSession.arcanaActivationDialogTarget ?? null;
    return target !== null && semanticAddressKey(target) === ownerKey;
  });
  const close = useCallback(() => dispatch(arcanaActivationDialogClosed()), [dispatch]);
  const show = useCallback(() => dispatch(arcanaActivationDialogOpened(owner)), [dispatch, owner]);
  return { close, open, show };
}

function JudgmentArcanaControl({
  interactions,
  judgment,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly judgment: NonNullable<WorkspaceRoomSummary['judgment']>;
}) {
  const findingTarget = useFindingTarget();
  const { close, open, show } = useArcanaActivationDialog(judgment.address);
  const control = interactions.judgmentArcana.get(workspaceInteractionKey(judgment.address));
  // The system closes a dialog whose owner is no longer projected.
  useEffect(() => {
    if (open && control === undefined) close();
  }, [close, control, open]);
  if (control === undefined) return null;
  const launcher = findingTarget(control.owner);
  return (
    <TimelineRow
      aria-label={`Judgment — choose ${judgment.requiredCount} inactive Arcana cards`}
      editors={
        <>
          <ArcanaActivationChips
            control={control}
            launcher={launcher}
            name="Judgment"
            onEdit={show}
            requiredCount={judgment.requiredCount}
          />
          {open ? (
            <ArcanaActivationEditor
              control={control}
              title="Judgment editor"
              requiredCount={judgment.requiredCount}
              onClose={close}
              returnFocusId={launcher.id}
            />
          ) : null}
        </>
      }
      kind="effect"
      label={<strong>Judgment</strong>}
    />
  );
}

function FigurineArcanaControl({
  interactions,
  figurine,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly figurine: NonNullable<WorkspaceRoomSummary['figurine']>;
}) {
  const findingTarget = useFindingTarget();
  const { close, open, show } = useArcanaActivationDialog(figurine.address);
  const control = interactions.figurineArcana.get(workspaceInteractionKey(figurine.address));
  // The system closes a dialog whose owner is no longer projected.
  useEffect(() => {
    if (open && control === undefined) close();
  }, [close, control, open]);
  if (control === undefined) return null;
  const launcher = findingTarget(control.owner);
  return (
    <TimelineRow
      aria-label={`Crystal Figurine — choose ${figurine.requiredCount} inactive Arcana cards`}
      editors={
        <>
          <ArcanaActivationChips
            control={control}
            launcher={launcher}
            name="Crystal Figurine"
            onEdit={show}
            rarity={figurine.rarity}
            requiredCount={figurine.requiredCount}
          />
          {open ? (
            <ArcanaActivationEditor
              title="Crystal Figurine editor"
              control={control}
              requiredCount={figurine.requiredCount}
              onClose={close}
              returnFocusId={launcher.id}
            />
          ) : null}
        </>
      }
      kind="effect"
      label={<strong>Crystal Figurine</strong>}
    />
  );
}

export function inspectorRoomActionContent(
  room: WorkspaceRoomSummary,
  interactions: WorkspaceInteractionCatalog,
  row: NonNullable<WorkspaceRoomSummary['roomActions']>['rows'][number],
): ReactNode {
  // A press is edited on its own row, which the Timeline renders itself.
  if (row.reference.kind === 'reroll') return null;
  return row.reference.kind !== 'interactKeepsakeRack' ||
    room.keepsakeSelection === undefined ? null : (
    <KeepsakeRackTimelineContent interactions={interactions} selection={room.keepsakeSelection} />
  );
}

export function inspectorLifecycleBoundaryContent(
  room: WorkspaceRoomSummary,
  interactions: WorkspaceInteractionCatalog,
  boundary: WorkspaceRoomLifecycleBoundary,
): TimelineBoundaryContent | undefined {
  if (boundary.kind !== 'bossDefeated') return undefined;
  return {
    rows: (
      <>
        {room.judgment === undefined ? null : (
          <JudgmentArcanaControl interactions={interactions} judgment={room.judgment} />
        )}
        {room.figurine === undefined ? null : (
          <FigurineArcanaControl interactions={interactions} figurine={room.figurine} />
        )}
      </>
    ),
  };
}
export function EchoKeepsakeReplayControl({
  interactions,
  biome,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly biome: {
    readonly echoKeepsakeReplay?: {
      readonly address: import('@run-planner/engine/authored-project').SemanticAddress;
    };
  };
}) {
  if (biome.echoKeepsakeReplay === undefined) return null;
  const interaction = requireWorkspaceInteraction(
    interactions.keepsakeEquipResults,
    workspaceInteractionKey(biome.echoKeepsakeReplay.address),
  );
  return (
    <KeepsakeEquipResultPicker
      id={`${interaction.owner.resultKind}-${interaction.key}`}
      interaction={interaction}
    />
  );
}
export function StartRoomIdentityEditor({
  interactions,
  node,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly node: Extract<WorkspaceNode, { readonly kind: 'occurrenceWorkbench' }>;
}) {
  const dispatch = useAppDispatch();
  const findingTarget = useFindingTarget();
  if (node.isEntry !== true) return null;
  const picker = node.room.roomPicker;
  const startPicker = picker?.kind === 'startRoomPicker' ? picker : undefined;
  const interaction =
    startPicker === undefined
      ? undefined
      : requireWorkspaceInteraction(
          interactions.rooms,
          workspaceInteractionKey(startPicker.address),
        );
  if (startPicker === undefined || interaction === undefined) return null;
  if (interaction.kind !== 'startRoom')
    throw new BiomeWorkspaceContractError(`${interaction.key} is not a start-room interaction.`);
  return (
    <section aria-label="Start room configuration" className="start-room-identity">
      <div className="owner-markers">
        <h3>Starting room</h3>
      </div>
      <RoomSelector
        findingTarget={findingTarget(interaction.owner, `start-${node.room.occurrenceId}-room`)}
        idPrefix={`start-${node.room.occurrenceId}`}
        interaction={interaction}
        label="Room"
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
    </section>
  );
}

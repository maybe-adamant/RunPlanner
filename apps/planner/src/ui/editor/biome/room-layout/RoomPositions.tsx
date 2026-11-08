import { useRef, type ReactNode } from 'react';
import { OverviewRow } from '../RoomOverviewSections';
import {
  requireWorkspaceInteraction,
  type WorkspaceFieldsSpatialControl,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomAnchorObject,
  type WorkspaceRoomEntryPair,
  type WorkspaceRoomLayout,
  type WorkspaceRoomObjectSlots,
  type WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';
import { declaredChoicesPicker } from '@planner/projections/contextual/contextualPicker';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandIntent, useCommandsIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { useFindingTarget, type FindingTargetProps } from '@planner/ui/feedback/useFindingTarget';
import { heldObjectIcon, heldObjectShortName } from '../room-features/roomObjectFace';
import { useRoomMapHighlightActions, type RoomMapHighlight } from '../room-map/roomMapHighlight';
import { fieldsSlotBadge, fieldsSlotIcon } from './fieldsSlotFace';

/** An unset position: the game places it. */
const unset = '?';

/** Marks an entry whose pair mirrors the room. */
const mirrored = '⇋';

interface PositionChoice<T> {
  readonly key: string;
  readonly label: string;
  readonly value: T;
  readonly preview?: RoomMapHighlight | undefined;
  readonly disabled?: boolean;
  readonly explanation?: string;
}

/**
 * A position picker: its current value leads the list, each choice previews
 * its point on the map, and closing the list releases the preview.
 */
function PositionPicker<T>({
  ariaLabel,
  choices,
  current,
  disabledHint,
  findingTarget,
  id,
  invalid,
  onOpen,
  onSelect,
  openPreview,
}: {
  readonly ariaLabel: string;
  readonly choices: readonly PositionChoice<T>[];
  readonly current: string;
  readonly disabledHint?: string | undefined;
  readonly findingTarget?: FindingTargetProps | undefined;
  readonly id: string;
  readonly invalid?: boolean;
  readonly onOpen?: () => void;
  readonly onSelect: (value: T) => void;
  /** What the map shows while the list is open and no choice is highlighted. */
  readonly openPreview?: RoomMapHighlight | undefined;
}) {
  const mapPreview = useRoomMapHighlightActions();
  const shownRef = useRef<RoomMapHighlight | undefined>(undefined);
  const show = (highlight: RoomMapHighlight | undefined): void => {
    if (highlight === undefined) return;
    shownRef.current = highlight;
    mapPreview?.show(highlight);
  };
  const byKey = new Map(choices.map((choice) => [choice.key, choice]));
  return (
    <ContextualPicker<string>
      ariaLabel={ariaLabel}
      {...(disabledHint === undefined ? {} : { disabledHint })}
      {...(findingTarget === undefined ? {} : { findingTarget })}
      id={id}
      invalid={invalid === true}
      label=""
      layout="inline"
      locked={disabledHint === undefined && choices.length === 0}
      model={declaredChoicesPicker(
        [
          { key: 'current', value: 'current', label: current },
          ...choices.map((choice) => ({
            key: choice.key,
            value: choice.key,
            label: choice.label,
            ...(choice.disabled === true ? { disabled: true } : {}),
            ...(choice.explanation === undefined ? {} : { explanation: choice.explanation }),
          })),
        ],
        'current',
      )}
      onActiveChange={(item) =>
        show(item === undefined ? openPreview : (byKey.get(item.value)?.preview ?? openPreview))
      }
      onOpenChange={(open) => {
        if (open) {
          onOpen?.();
          show(openPreview);
          return;
        }
        const shown = shownRef.current;
        shownRef.current = undefined;
        if (shown !== undefined) mapPreview?.release(shown);
      }}
      onSelect={(key) => {
        const choice = byKey.get(key);
        if (choice !== undefined) onSelect(choice.value);
      }}
      placeholder={current}
      searchable={false}
      triggerLabel={current}
      triggerSize="content"
    />
  );
}

/**
 * The room's Positions rows: its entry with orientation, each present
 * object's anchor, each Fields slot's point, and the Chaos gate's point.
 */
export function RoomPositions({
  chaosGate,
  interactions,
  room,
}: {
  /** The Chaos gate's own position row, where the room has a gate. */
  readonly chaosGate?: ReactNode;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly room: WorkspaceRoomSummary;
}) {
  const fields = room.roomLocal.kind === 'fields' ? room.roomLocal : undefined;
  const objects = room.objectSlots?.objects.filter((object) => object.present) ?? [];
  if (
    room.layout === undefined &&
    objects.length === 0 &&
    (fields?.spatial.length ?? 0) === 0 &&
    chaosGate == null
  )
    return null;
  return (
    <div className="room-layout-controls">
      {room.layout === undefined ? null : (
        <EntryRow interactions={interactions} layout={room.layout} />
      )}
      {room.objectSlots === undefined
        ? null
        : objects.map((object) => (
            <ObjectAnchorRow
              interactions={interactions}
              key={object.object}
              object={object}
              objectSlots={room.objectSlots!}
            />
          ))}
      {fields === undefined
        ? null
        : fields.spatial.map((control) => (
            <FieldsSlotRow
              control={control}
              fields={fields}
              interactions={interactions}
              key={control.interactionKey}
            />
          ))}
      {chaosGate}
    </div>
  );
}

function entryName(layout: WorkspaceRoomLayout, pair: WorkspaceRoomEntryPair): string {
  const number = layout.entries.find((entry) => entry.pointId === pair.pointId)?.number;
  const name = number === undefined ? 'Entry' : `E${number}`;
  return pair.flipped ? `${name} ${mirrored}` : name;
}

const settledBy = { fixed: 'Fixed', door: 'Decided by the door' } as const;

/** The room's entry with the way it faces: shown where it is settled, picked where the game picks. */
function EntryRow({
  interactions,
  layout,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly layout: WorkspaceRoomLayout;
}) {
  const findingTarget = useFindingTarget();
  const executeIntent = useCommandsIntent();
  const interaction = requireWorkspaceInteraction(interactions.roomChoices, layout.interactionKey);
  const state = layout.state;
  const id = semanticOwnerControlElementId(layout.address);
  const target = findingTarget(layout.address, id, layout.address, undefined, [layout.flipAddress]);
  const pairPreview = (pair: WorkspaceRoomEntryPair): RoomMapHighlight => ({
    kind: 'entry',
    pointId: pair.pointId,
    flipped: pair.flipped,
  });
  const picking: RoomMapHighlight = { kind: 'entry' };
  const rowPreview: RoomMapHighlight =
    layout.entryId === undefined
      ? picking
      : {
          kind: 'entry',
          pointId: layout.entryId,
          ...(layout.flipped === undefined ? {} : { flipped: layout.flipped }),
        };
  const row = (content: ReactNode) => (
    <OverviewRow label="Entry" preview={rowPreview}>
      {content}
    </OverviewRow>
  );
  switch (state.kind) {
    case 'unknown':
      return row(<span className="room-layout-value">{unset}</span>);
    case 'unreached':
      return row(
        <PositionPicker<string>
          ariaLabel="Entry"
          choices={[]}
          current={unset}
          disabledHint={candidateWaitingHint}
          id={id}
          onSelect={() => undefined}
        />,
      );
    case 'settled':
      if (state.stale === undefined)
        return row(
          <span className="room-layout-value" {...target}>
            {entryName(layout, state.value)}
            <span className="room-layout-detail"> · {settledBy[state.by]}</span>
          </span>,
        );
      return row(
        <PositionPicker<string>
          ariaLabel="Entry"
          choices={[
            {
              key: state.stale.clearKey,
              label: `${entryName(layout, state.value)} · ${settledBy[state.by]}`,
              value: state.stale.clearKey,
              preview: pairPreview(state.value),
            },
          ]}
          current={entryName(layout, state.value)}
          findingTarget={target}
          id={id}
          invalid
          onSelect={(key) => executeIntent(interaction.intentFor(key))}
          openPreview={picking}
        />,
      );
    case 'choice': {
      const stale = state.stale;
      const current =
        stale !== undefined
          ? stale.pointId === undefined
            ? unset
            : entryName(layout, { pointId: stale.pointId, flipped: stale.flipped === true })
          : state.value === undefined
            ? unset
            : entryName(layout, state.value);
      return row(
        <PositionPicker<string>
          ariaLabel="Entry"
          choices={state.choices.map((choice) => ({
            key: choice.key,
            label: choice.pair === null ? unset : entryName(layout, choice.pair),
            value: choice.key,
            preview: choice.pair === null ? picking : pairPreview(choice.pair),
          }))}
          current={current}
          findingTarget={target}
          id={id}
          invalid={stale !== undefined}
          onSelect={(key) => executeIntent(interaction.intentFor(key))}
          openPreview={picking}
        />,
      );
    }
  }
}

/** A present object's anchor: picked among the free anchors, `?` leaving it to the game. */
function ObjectAnchorRow({
  interactions,
  object,
  objectSlots,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly object: WorkspaceRoomAnchorObject;
  readonly objectSlots: WorkspaceRoomObjectSlots;
}) {
  const findingTarget = useFindingTarget();
  const executeIntent = useCommandsIntent();
  const interaction = requireWorkspaceInteraction(
    interactions.roomChoices,
    objectSlots.interactionKey,
  );
  const anchor = object.anchor;
  if (anchor === undefined) return null;
  const nameOf = (anchorId: number | null | undefined): string => {
    if (anchorId === null || anchorId === undefined) return unset;
    const number = objectSlots.anchors.find((candidate) => candidate.anchorId === anchorId)?.number;
    return number === undefined ? unset : `A${number}`;
  };
  const at = anchor.pinned ?? anchor.anchorId;
  const label = heldObjectShortName(object.object);
  const id = semanticOwnerControlElementId(object.anchorAddress);
  const target = findingTarget(object.anchorAddress, id);
  const preview =
    at === undefined ? undefined : ({ kind: 'anchor', anchorId: at } satisfies RoomMapHighlight);
  return (
    <OverviewRow icon={heldObjectIcon(object)} label={label} preview={preview}>
      {anchor.pinned !== undefined ? (
        <span className="room-layout-value" {...target}>
          {nameOf(anchor.pinned)}
          <span className="room-layout-detail"> · Fixed</span>
        </span>
      ) : (
        <PositionPicker<string>
          ariaLabel={`${label} spot`}
          choices={anchor.choices.map((choice) => ({
            key: choice.key,
            label: nameOf(choice.anchorId),
            value: choice.key,
            ...(choice.anchorId === null
              ? {}
              : { preview: { kind: 'anchor' as const, anchorId: choice.anchorId } }),
          }))}
          current={nameOf(anchor.anchorId)}
          findingTarget={target}
          id={id}
          onSelect={(key) => executeIntent(interaction.intentFor(key))}
          openPreview={preview}
        />
      )}
    </OverviewRow>
  );
}

/**
 * A Fields slot's point: picked among the points the engine leaves it, `?`
 * leaving it to the game. A point a sibling holds is not offered.
 */
function FieldsSlotRow({
  control,
  fields,
  interactions,
}: {
  readonly control: WorkspaceFieldsSpatialControl;
  readonly fields: Extract<WorkspaceRoomSummary['roomLocal'], { readonly kind: 'fields' }>;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const findingTarget = useFindingTarget();
  const executeIntent = useCommandIntent();
  const interaction = requireWorkspaceInteraction(
    interactions.fieldsSpatialPoints,
    control.interactionKey,
  );
  const candidates = useWorkspaceInteraction(interaction);
  const assessed = candidates.result;
  const id = semanticOwnerControlElementId(control.address);
  const nameOf = (pointId: number | null): string =>
    interaction.choices.find((choice) => choice.value === pointId)?.label ?? unset;
  const preview = (pointId: number | null): RoomMapHighlight | undefined =>
    pointId === null ? undefined : { kind: 'fieldsPoint', pointId };
  const choices = interaction.choices.flatMap((choice) => {
    if (choice.value === interaction.selected) return [];
    const option = assessed?.find((candidate) => candidate.value === choice.value);
    const result =
      option?.evaluation.kind === 'fieldsSpatialPoint' ? option.evaluation.result : undefined;
    // A point a sibling holds stays off the list; one the slot cannot take is listed, disabled.
    if (result !== undefined && result.assignable && !result.selectedPossible) return [];
    return [
      {
        key: String(choice.value),
        label: choice.label,
        value: choice.value,
        preview: preview(choice.value),
        ...(result === undefined || result.assignable
          ? {}
          : { disabled: true, explanation: `${control.label} can’t stand here.` }),
      },
    ];
  });
  return (
    <OverviewRow
      icon={fieldsSlotIcon(fields, control.target)}
      // A slot's short mark, as the map wears it: C1, O2; the Nemesis by name.
      label={fieldsSlotBadge(fields, control.target) ?? control.label}
      preview={preview(control.pointId)}
    >
      <PositionPicker<number | null>
        ariaLabel={`${control.label} point`}
        choices={choices}
        current={nameOf(control.pointId)}
        {...(interaction.contextReached ? {} : { disabledHint: candidateWaitingHint })}
        findingTarget={findingTarget(control.address, id)}
        id={id}
        onOpen={() => candidates.activate()}
        onSelect={(pointId) => executeIntent(interaction.intentFor(pointId))}
        openPreview={preview(control.pointId)}
      />
    </OverviewRow>
  );
}

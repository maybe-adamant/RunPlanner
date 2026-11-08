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
import type { ArtworkSource } from '@planner/ui/artwork/ArtworkIcon';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandIntent, useCommandsIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { useFindingTarget, type FindingTargetProps } from '@planner/ui/feedback/useFindingTarget';
import { heldObjectIcon, heldObjectShortName } from '../room-features/roomObjectFace';
import {
  useRoomMapHighlightActions,
  useRoomMapLinks,
  type RoomMapHighlight,
  type RoomMapPointMark,
} from '../room-map/roomMapHighlight';
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
  choiceLabel,
  choices,
  current,
  currentOption,
  disabledHint,
  findingTarget,
  id,
  invalid,
  onOpen,
  onSelect,
  openPreview,
  triggerBadge,
  triggerIcon,
}: {
  readonly ariaLabel: string;
  /** What the open list picks, where the trigger's name also speaks its value. */
  readonly choiceLabel?: string | undefined;
  readonly choices: readonly PositionChoice<T>[];
  readonly current: string;
  /** The current value as the open list spells it; the trigger's own text by default. */
  readonly currentOption?: string | undefined;
  readonly disabledHint?: string | undefined;
  readonly findingTarget?: FindingTargetProps | undefined;
  readonly id: string;
  readonly invalid?: boolean;
  readonly onOpen?: () => void;
  readonly onSelect: (value: T) => void;
  /** What the map shows while the list is open and no choice is highlighted. */
  readonly openPreview?: RoomMapHighlight | undefined;
  /** The thing it places, before its value. */
  readonly triggerIcon?: ArtworkSource | undefined;
  /** The placed thing's slot number, on its icon's corner. */
  readonly triggerBadge?: string | undefined;
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
      {...(choiceLabel === undefined ? {} : { choiceLabel })}
      {...(disabledHint === undefined ? {} : { disabledHint })}
      {...(findingTarget === undefined ? {} : { findingTarget })}
      id={id}
      invalid={invalid === true}
      label=""
      layout="inline"
      locked={disabledHint === undefined && choices.length === 0}
      model={declaredChoicesPicker(
        [
          { key: 'current', value: 'current', label: currentOption ?? current },
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
      {...(triggerBadge === undefined ? {} : { triggerBadge })}
      triggerIcon={triggerIcon}
      triggerLabel={current}
      triggerSize="content"
    />
  );
}

/**
 * The room's Layout rows: its entry with orientation, the present objects'
 * anchors, the Fields slots' points, and the Chaos gate's point.
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
  const objectSlots = room.objectSlots;
  const objects =
    objectSlots?.objects.filter((object) => object.present && object.anchor !== undefined) ?? [];
  const cages = fields?.spatial.filter((control) => control.target.kind === 'cage') ?? [];
  const rewards = fields?.spatial.filter((control) => control.target.kind !== 'cage') ?? [];
  if (
    room.layout === undefined &&
    objects.length === 0 &&
    cages.length === 0 &&
    rewards.length === 0 &&
    chaosGate == null
  )
    return null;
  const fieldsRow = (label: string, controls: readonly WorkspaceFieldsSpatialControl[]) =>
    fields === undefined || controls.length === 0 ? null : (
      <OverviewRow label={label}>
        <div className="room-layout-chips">
          {controls.map((control) => (
            <FieldsSlotChip
              control={control}
              fields={fields}
              interactions={interactions}
              key={control.interactionKey}
            />
          ))}
        </div>
      </OverviewRow>
    );
  return (
    <div className="room-layout-controls">
      {room.layout === undefined ? null : (
        <EntryRow interactions={interactions} layout={room.layout} />
      )}
      {objectSlots === undefined || objects.length === 0 ? null : (
        <OverviewRow label="Anchors">
          <div className="room-layout-chips">
            {objects.map((object) => (
              <ObjectAnchorChip
                interactions={interactions}
                key={object.object}
                object={object}
                objectSlots={objectSlots}
              />
            ))}
          </div>
        </OverviewRow>
      )}
      {fieldsRow('Cages', cages)}
      {fieldsRow('Rewards', rewards)}
      {chaosGate}
    </div>
  );
}

function entryNumber(layout: WorkspaceRoomLayout, pair: WorkspaceRoomEntryPair): string {
  const number = layout.entries.find((entry) => entry.pointId === pair.pointId)?.number;
  return number === undefined ? 'Entry' : `E${number}`;
}

/** The compact entry the closed control shows: `E1 ⇋`. */
function entryName(layout: WorkspaceRoomLayout, pair: WorkspaceRoomEntryPair): string {
  const name = entryNumber(layout, pair);
  return pair.flipped ? `${name} ${mirrored}` : name;
}

/** The entry as the open list spells it: `E1 · Flipped (⇋)`. */
function entryOption(layout: WorkspaceRoomLayout, pair: WorkspaceRoomEntryPair): string {
  const name = entryNumber(layout, pair);
  return pair.flipped ? `${name} · Flipped (${mirrored})` : name;
}

const settledHint = { fixed: 'The room has one entry', door: 'Decided by the door' } as const;

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
    case 'settled': {
      if (state.stale === undefined)
        return row(
          <PositionPicker<string>
            ariaLabel="Entry"
            choices={[]}
            current={entryName(layout, state.value)}
            disabledHint={settledHint[state.by]}
            findingTarget={target}
            id={id}
            onSelect={() => undefined}
          />,
        );
      // The control shows what the plan holds; clearing it takes the settled pair.
      const held: WorkspaceRoomEntryPair = {
        pointId: state.stale.pointId ?? state.value.pointId,
        flipped: state.stale.flipped ?? state.value.flipped,
      };
      return row(
        <PositionPicker<string>
          ariaLabel="Entry"
          choices={[
            {
              key: state.stale.clearKey,
              label: entryOption(layout, state.value),
              value: state.stale.clearKey,
              preview: pairPreview(state.value),
            },
          ]}
          current={entryName(layout, held)}
          currentOption={entryOption(layout, held)}
          findingTarget={target}
          id={id}
          invalid
          onSelect={(key) => executeIntent(interaction.intentFor(key))}
          openPreview={picking}
        />,
      );
    }
    case 'choice': {
      const stale = state.stale;
      const shown: WorkspaceRoomEntryPair | undefined =
        stale !== undefined
          ? stale.pointId === undefined
            ? undefined
            : { pointId: stale.pointId, flipped: stale.flipped === true }
          : state.value;
      return row(
        <PositionPicker<string>
          ariaLabel="Entry"
          choices={state.choices.map((choice) => ({
            key: choice.key,
            label: choice.pair === null ? unset : entryOption(layout, choice.pair),
            value: choice.key,
            preview: choice.pair === null ? picking : pairPreview(choice.pair),
          }))}
          current={shown === undefined ? unset : entryName(layout, shown)}
          currentOption={shown === undefined ? unset : entryOption(layout, shown)}
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

/** A chip whose hover previews its point on the map. */
function LayoutChip({
  children,
  preview,
}: {
  readonly children: ReactNode;
  readonly preview: RoomMapHighlight | undefined;
}) {
  const mapLinks = useRoomMapLinks();
  return (
    <span className="room-layout-chip" {...mapLinks(preview)}>
      {children}
    </span>
  );
}

/**
 * A present object's anchor chip: picked among the free anchors, `?` leaving
 * it to the game. The Well's pin and a last free anchor are shown, not picked.
 */
function ObjectAnchorChip({
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
  const at = anchor.pinned ?? anchor.derivedAnchorId ?? anchor.anchorId;
  const label = heldObjectShortName(object.object);
  const id = semanticOwnerControlElementId(object.anchorAddress);
  const target = findingTarget(object.anchorAddress, id);
  const preview =
    at === undefined ? undefined : ({ kind: 'anchor', anchorId: at } satisfies RoomMapHighlight);
  const shownHint =
    anchor.pinned !== undefined
      ? 'Always stands here'
      : anchor.derivedAnchorId !== undefined
        ? 'Last free spot'
        : undefined;
  return (
    <LayoutChip preview={preview}>
      <PositionPicker<string>
        ariaLabel={`${label} spot`}
        choices={
          shownHint !== undefined
            ? []
            : anchor.choices.map((choice) => ({
                key: choice.key,
                label: nameOf(choice.anchorId),
                value: choice.key,
                ...(choice.anchorId === null
                  ? {}
                  : { preview: { kind: 'anchor' as const, anchorId: choice.anchorId } }),
              }))
        }
        current={nameOf(at)}
        disabledHint={shownHint}
        findingTarget={target}
        id={id}
        onSelect={(key) => executeIntent(interaction.intentFor(key))}
        openPreview={preview}
        triggerIcon={heldObjectIcon(object)}
      />
    </LayoutChip>
  );
}

/**
 * A Fields slot's point chip: its reward's icon wearing the slot's number,
 * then its point, picked among the points the engine leaves it, `?` leaving
 * it to the game. A point a sibling holds is not offered. While the chip is
 * hovered or its list is open, the map numbers the free points of its family.
 */
function FieldsSlotChip({
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
  // Points the slot's siblings stand on; the map shows their occupants instead.
  const held = new Set(
    fields.spatial.flatMap((sibling) =>
      sibling.interactionKey === control.interactionKey || sibling.pointId === null
        ? []
        : [sibling.pointId],
    ),
  );
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
        ...(result === undefined || result.assignable
          ? {}
          : { disabled: true, explanation: `${control.label} can’t stand here.` }),
      },
    ];
  });
  const marks: readonly RoomMapPointMark[] = choices.flatMap((choice) =>
    choice.value === null || held.has(choice.value)
      ? []
      : [
          {
            pointId: choice.value,
            mark: choice.label,
            ...(choice.disabled === true ? { disabled: true } : {}),
          },
        ],
  );
  const preview = (pointId: number | null): RoomMapHighlight => ({
    kind: 'fieldsPoint',
    ...(pointId === null ? {} : { pointId }),
    marks,
  });
  const point = nameOf(control.pointId);
  const icon = fieldsSlotIcon(fields, control.target);
  const badge = fieldsSlotBadge(fields, control.target);
  return (
    <LayoutChip preview={preview(control.pointId)}>
      <PositionPicker<number | null>
        ariaLabel={`${control.label}, point ${point}`}
        choiceLabel={`${control.label} point`}
        choices={choices.map((choice) => ({ ...choice, preview: preview(choice.value) }))}
        current={icon === undefined ? `${control.label} ${point}` : point}
        currentOption={point}
        {...(interaction.contextReached ? {} : { disabledHint: candidateWaitingHint })}
        findingTarget={findingTarget(control.address, id)}
        id={id}
        onOpen={() => candidates.activate()}
        onSelect={(pointId) => executeIntent(interaction.intentFor(pointId))}
        openPreview={preview(control.pointId)}
        triggerBadge={icon === undefined ? undefined : badge}
        triggerIcon={icon}
      />
    </LayoutChip>
  );
}

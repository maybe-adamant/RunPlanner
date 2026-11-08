import { useState, type ReactNode } from 'react';
import {
  requireWorkspaceInteraction,
  type WorkspaceFieldsSpotLine,
  type WorkspaceFieldsSpotOccupant,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomLayout,
  type WorkspaceRoomLayoutControl,
  type WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';
import { declaredChoicesPicker } from '@planner/projections/contextual/contextualPicker';
import { ArtworkIcon, type ArtworkSource } from '@planner/ui/artwork/ArtworkIcon';
import type { CandidateOptionProjection } from '@planner/projections/candidates/candidateProjection';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { useCommandsIntent } from '@planner/ui/controls/useCommandIntent';
import {
  candidateMayBeAuthored,
  candidateWaitingHint,
  candidateWaits,
} from '@planner/ui/feedback/candidatePresentation';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import {
  useRoomMapHighlightActions,
  useRoomMapLinks,
  type RoomMapHighlight,
} from '../room-map/roomMapHighlight';
import { fieldsOccupantIcon } from './fieldsOccupantIcon';
import { PlacementSpot } from './PlacementSpot';

const flipName = (flipped: boolean): string => (flipped ? 'Flipped' : 'Unflipped');

const settledName = { fixed: 'Fixed', derived: 'Decided by the door' } as const;

const gameDecides = 'Game decides';

/**
 * The room's layout rows: its orientation and entry as the engine settles
 * them, a picker where the game rolls, and the Fields points as spot lines.
 */
export function RoomLayoutControls({
  interactions,
  room,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly room: WorkspaceRoomSummary;
}) {
  const layout = room.layout;
  const spotLines = room.roomLocal.kind === 'fields' ? room.roomLocal.spotLines : [];
  if (layout === undefined && spotLines.length === 0) return null;
  return (
    <div className="room-layout-controls">
      {layout === undefined ? null : (
        <>
          <LayoutRow
            control={layout.flip}
            interactions={interactions}
            label="Orientation"
            layout={layout}
            name={flipName}
            preview={(flipped) => ({ kind: 'flip', flipped })}
            previewOwner={{ kind: 'flip' }}
          />
          <LayoutRow
            control={layout.entry}
            interactions={interactions}
            label="Entry"
            layout={layout}
            name={(pointId) => entryName(layout, pointId)}
            preview={(pointId, flipped) => ({ kind: 'entry', pointId, flipped })}
            previewOwner={{ kind: 'entry' }}
            previewSettled
          />
        </>
      )}
      {spotLines.map((line) => (
        <FieldsSpotLineRow interactions={interactions} key={line.kind} line={line} room={room} />
      ))}
    </div>
  );
}

function entryName(layout: WorkspaceRoomLayout, pointId: number): string {
  const number = layout.entries.find((entry) => entry.pointId === pointId)?.number;
  return number === undefined ? 'Entry' : `E${number}`;
}

/** One layout fact: shown where the game settles it, picked where it rolls. */
function LayoutRow<T extends boolean | number>({
  control,
  interactions,
  label,
  layout,
  name,
  preview,
  previewOwner,
  previewSettled = false,
}: {
  readonly control: WorkspaceRoomLayoutControl<T>;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly label: string;
  readonly layout: WorkspaceRoomLayout;
  readonly name: (value: T) => string;
  /** The map preview of one value, with the flip choosing it sets. */
  readonly preview: (value: T, flipped?: boolean) => RoomMapHighlight;
  /** The preview's owner, which closing the list releases. */
  readonly previewOwner: RoomMapHighlight;
  /** Hovering the row previews its settled value. */
  readonly previewSettled?: boolean;
}) {
  const findingTarget = useFindingTarget();
  const executeIntent = useCommandsIntent();
  const mapPreview = useRoomMapHighlightActions();
  const mapLinks = useRoomMapLinks();
  const interaction = requireWorkspaceInteraction(interactions.roomChoices, layout.interactionKey);
  const state = control.state;
  const id = semanticOwnerControlElementId(control.address);
  const settledValue =
    state.kind === 'fixed' || state.kind === 'derived' || state.kind === 'choice'
      ? state.value
      : undefined;
  const settledPreview =
    previewSettled && settledValue !== undefined ? preview(settledValue) : undefined;
  const row = (content: ReactNode) => (
    <div className="room-layout-row" {...mapLinks(settledPreview)}>
      <span className="room-layout-label">{label}</span>
      {content}
    </div>
  );
  if (state.kind === 'unknown')
    return row(<span className="room-layout-value">{gameDecides}</span>);
  if (state.kind === 'unreached')
    return row(
      <ContextualPicker<string>
        ariaLabel={label}
        disabledHint={candidateWaitingHint}
        id={id}
        label=""
        layout="inline"
        model={declaredChoicesPicker<string>([], undefined)}
        onSelect={() => undefined}
        placeholder={gameDecides}
        searchable={false}
        triggerLabel={gameDecides}
        triggerSize="content"
      />,
    );
  const choices =
    state.kind === 'choice'
      ? // The current value leads the list once; a held stale value keeps every choice.
        state.choices
          .filter(
            (choice) => state.stale !== undefined || (choice.value ?? undefined) !== state.value,
          )
          .map((choice) => ({
            key: choice.key,
            label:
              choice.value === null
                ? gameDecides
                : choice.flipped === undefined
                  ? name(choice.value)
                  : `${name(choice.value)} · ${flipName(choice.flipped)}`,
            preview: choice.value === null ? undefined : preview(choice.value, choice.flipped),
          }))
      : state.stale === undefined
        ? []
        : [
            {
              key: state.stale.clearKey,
              label: `${name(state.value)} · ${settledName[state.kind]}`,
              preview: preview(state.value),
            },
          ];
  const current =
    state.kind === 'choice'
      ? state.stale !== undefined
        ? name(state.stale)
        : state.value === undefined
          ? gameDecides
          : name(state.value)
      : state.stale !== undefined
        ? name(state.stale.value)
        : undefined;
  if (current === undefined && (state.kind === 'fixed' || state.kind === 'derived'))
    return row(
      <span className="room-layout-value">
        {name(state.value)}
        <span className="room-layout-detail"> · {settledName[state.kind]}</span>
      </span>,
    );
  const byKey = new Map(choices.map((choice) => [choice.key, choice]));
  return row(
    <ContextualPicker<string>
      ariaLabel={label}
      findingTarget={findingTarget(control.address, id)}
      id={id}
      invalid={state.stale !== undefined}
      label=""
      layout="inline"
      model={declaredChoicesPicker(
        [
          { key: 'current', value: 'current', label: current ?? gameDecides },
          ...choices.map((choice) => ({ key: choice.key, value: choice.key, label: choice.label })),
        ],
        'current',
      )}
      onActiveChange={(item) => {
        const shown = item === undefined ? undefined : byKey.get(item.value)?.preview;
        if (shown !== undefined) mapPreview?.show(shown);
      }}
      onOpenChange={(open) => {
        if (!open) mapPreview?.release(previewOwner);
      }}
      onSelect={(key) => {
        if (key !== 'current') executeIntent(interaction.intentFor(key));
      }}
      placeholder={gameDecides}
      searchable={false}
      triggerLabel={current ?? gameDecides}
      triggerSize="content"
    />,
  );
}

/** A Fields point family as one spot line: the slot on each point, then the slots the game places. */
function FieldsSpotLineRow({
  interactions,
  line,
  room,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly line: WorkspaceFieldsSpotLine;
  readonly room: WorkspaceRoomSummary;
}) {
  const executeIntent = useCommandsIntent();
  const findingTarget = useFindingTarget();
  const interaction = requireWorkspaceInteraction(interactions.roomChoices, line.interactionKey);
  const fields = room.roomLocal.kind === 'fields' ? room.roomLocal : undefined;
  const occupants = [
    ...line.spots.flatMap((spot) => (spot.occupant === undefined ? [] : [spot.occupant])),
    ...line.unplaced,
  ];
  const spatialOf = (occupant: WorkspaceFieldsSpotOccupant) =>
    requireWorkspaceInteraction(interactions.fieldsSpatialPoints, occupant.interactionKey);
  const reached = occupants.every((occupant) => spatialOf(occupant).contextReached);
  // Opening a spot assesses each slot's points with the engine; a point a slot cannot take stays listed, disabled.
  const controller =
    useWorkspaceInteractionController<readonly CandidateOptionProjection<number | null>[]>();
  const [assessed, setAssessed] = useState<
    ReadonlyMap<object, readonly CandidateOptionProjection<number | null>[] | undefined>
  >(new Map());
  const assess = () =>
    setAssessed(
      new Map(
        occupants.map((occupant) => {
          const interaction = spatialOf(occupant);
          return [interaction, controller.activate(interaction)] as const;
        }),
      ),
    );
  const refusal = (occupant: WorkspaceFieldsSpotOccupant, pointId: number): string | undefined => {
    const assessment = assessed.get(spatialOf(occupant));
    if (assessment === undefined) return undefined;
    const option = assessment.find((candidate) => candidate.value === pointId);
    if (candidateMayBeAuthored(option)) return undefined;
    return candidateWaits(option) ? candidateWaitingHint : `${occupant.label} can’t stand here.`;
  };
  const icon = (occupant: WorkspaceFieldsSpotOccupant): ArtworkSource | undefined =>
    fields === undefined ? undefined : fieldsOccupantIcon(fields, occupant);
  const pointName = line.kind === 'cage' ? 'Cage point' : 'Pickup point';
  return (
    <div className="room-layout-row">
      <span className="room-layout-label">{line.kind === 'cage' ? 'Cages' : 'Pickups'}</span>
      <span className="room-object-spots">
        {line.spots.map((spot) => (
          <PlacementSpot
            ariaLabel={`${pointName} ${spot.number}`}
            badge={spot.occupant?.badge}
            current={
              spot.occupant === undefined
                ? { label: 'Empty' }
                : { label: spot.occupant.label, icon: icon(spot.occupant) }
            }
            {...(reached ? {} : { disabledHint: candidateWaitingHint })}
            {...(spot.occupant === undefined
              ? {}
              : {
                  findingTarget: findingTarget(
                    spot.occupant.address,
                    `${semanticOwnerControlElementId(spot.occupant.address)}-spot`,
                  ),
                })}
            id={`${line.interactionKey}-${spot.pointId}`}
            items={spot.choices.map((choice) => {
              const refused =
                choice.occupant === null ? undefined : refusal(choice.occupant, spot.pointId);
              return {
                key: choice.key,
                label: choice.occupant === null ? 'Game places it' : choice.occupant.label,
                icon: choice.occupant === null ? undefined : icon(choice.occupant),
                ...(refused === undefined ? {} : { disabled: true, explanation: refused }),
              };
            })}
            key={spot.pointId}
            onOpen={assess}
            onSelect={(key) => executeIntent(interaction.intentFor(key))}
            preview={{ kind: 'fieldsPoint', pointId: spot.pointId }}
          />
        ))}
        {line.unplaced.length === 0 ? null : (
          <span className="room-object-unplaced" aria-label="Placed by the game" role="group">
            <span aria-hidden="true" className="room-object-unplaced-label">
              Game places
            </span>
            {line.unplaced.map((occupant) => (
              <span
                {...findingTarget(
                  occupant.address,
                  `${semanticOwnerControlElementId(occupant.address)}-spot`,
                )}
                aria-label={`${occupant.label}, placed by the game`}
                className="room-object-fixed"
                key={occupant.key}
                role="img"
              >
                <ArtworkIcon className="artwork-label-icon" source={icon(occupant)} />
                <span aria-hidden="true" className="timeline-chip-badge">
                  {occupant.badge}
                </span>
              </span>
            ))}
          </span>
        )}
      </span>
    </div>
  );
}

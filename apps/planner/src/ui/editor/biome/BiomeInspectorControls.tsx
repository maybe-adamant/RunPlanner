/* The inspector-node adapter deliberately exports these projected render products. */
/* eslint-disable react-refresh/only-export-components */
import { Fragment, useState, type ReactNode } from 'react';

import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceKeepsakeSelectionInteraction,
  type WorkspaceNode,
  type WorkspaceRoomLifecycleBoundary,
  type WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch } from '@planner/state/store';
import { SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { RoomSelector } from './RoomSelector';
import { RewardControlEditor } from '../rewards/RewardControlEditor';
import { BiomeWorkspaceContractError } from './workspaceContract';
import { KeepsakeEquipResultPicker, KeepsakeSelectionPicker } from '../KeepsakePickers';

function PostbossKeepsakeControl({
  interaction,
}: {
  readonly interaction: WorkspaceKeepsakeSelectionInteraction;
}) {
  const dispatch = useAppDispatch();
  return (
    <div className="room-keepsake-control">
      <KeepsakeSelectionPicker
        id={`postboss-keepsake-${interaction.key}`}
        interaction={interaction}
        label="Keepsake"
      />
      {interaction.removeIntent === undefined ? null : (
        <button
          className="danger-action action-compact"
          onClick={() =>
            dispatch(authoredProjectCommandDispatched(interaction.removeIntent!().command))
          }
          type="button"
        >
          Delete keepsake change
        </button>
      )}
      <SemanticOwnerMarker address={interaction.owner} />
    </div>
  );
}

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
  return (
    <div className="room-keepsake-action">
      <PostbossKeepsakeControl interaction={interaction} />
      {equipResult === undefined ? null : (
        <KeepsakeEquipResultPicker
          id={`${equipResult.owner.resultKind}-${equipResult.key}`}
          interaction={equipResult}
        />
      )}
    </div>
  );
}

function JudgmentArcanaControl({
  interactions,
  judgment,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly judgment: NonNullable<WorkspaceRoomSummary['judgment']>;
}) {
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const control = interactions.judgmentArcana.get(workspaceInteractionKey(judgment.address));
  if (control === undefined) return null;
  return (
    <li
      aria-label={`Judgment — choose ${judgment.requiredCount} inactive Arcana cards`}
      className="room-action-row room-timeline-effect-row"
    >
      <button className="room-timeline-effect" onClick={() => setOpen(true)} type="button">
        Judgment — choose {judgment.requiredCount} inactive Arcana cards
        <SemanticOwnerMarker address={control.owner} />
      </button>
      {open ? (
        <div aria-label="Judgment editor" className="room-judgment-popup" role="dialog">
          <div className="room-judgment-popup-header">
            <h4>Judgment — choose {judgment.requiredCount} inactive Arcana cards</h4>
            <button
              aria-label="Close Judgment editor"
              className="quiet-action"
              onClick={() => setOpen(false)}
              type="button"
            >
              Close
            </button>
          </div>
          <div className="room-judgment-options">
            {control.choices
              .filter(
                (choice) =>
                  judgment.inactiveArcanaKeys.includes(choice.value) ||
                  control.value.includes(choice.value),
              )
              .map((choice) => {
                const checked = control.value.includes(choice.value);
                return (
                  <label key={choice.value}>
                    <input
                      checked={checked}
                      onChange={() =>
                        dispatch(
                          authoredProjectCommandDispatched(
                            control.intentFor(
                              checked
                                ? control.value.filter((key) => key !== choice.value)
                                : [...control.value, choice.value],
                            ).command,
                          ),
                        )
                      }
                      type="checkbox"
                    />
                    {choice.label}
                  </label>
                );
              })}
          </div>
        </div>
      ) : null}
    </li>
  );
}

function FigurineArcanaControl({
  interactions,
  figurine,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly figurine: NonNullable<WorkspaceRoomSummary['figurine']>;
}) {
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const control = interactions.figurineArcana.get(workspaceInteractionKey(figurine.address));
  if (control === undefined) return null;
  return (
    <li
      aria-label={`Crystal Figurine — choose ${figurine.requiredCount} inactive Arcana cards`}
      className="room-action-row room-timeline-effect-row"
    >
      <button className="room-timeline-effect" onClick={() => setOpen(true)} type="button">
        Crystal Figurine — choose {figurine.requiredCount} inactive Arcana cards ({figurine.rarity})
        <SemanticOwnerMarker address={control.owner} />
      </button>
      {open ? (
        <div aria-label="Crystal Figurine editor" className="room-figurine-popup" role="dialog">
          <div className="room-judgment-popup-header">
            <h4>
              Crystal Figurine — choose {figurine.requiredCount} inactive Arcana cards (
              {figurine.rarity})
            </h4>
            <button
              aria-label="Close Crystal Figurine editor"
              className="quiet-action"
              onClick={() => setOpen(false)}
              type="button"
            >
              Close
            </button>
          </div>
          <div className="room-judgment-options">
            {control.choices
              .filter(
                (choice) =>
                  figurine.inactiveArcanaKeys.includes(choice.value) ||
                  control.value.includes(choice.value),
              )
              .map((choice) => {
                const checked = control.value.includes(choice.value);
                return (
                  <label key={choice.value}>
                    <input
                      checked={checked}
                      onChange={() =>
                        dispatch(
                          authoredProjectCommandDispatched(
                            control.intentFor(
                              checked
                                ? control.value.filter((key) => key !== choice.value)
                                : [...control.value, choice.value],
                            ).command,
                          ),
                        )
                      }
                      type="checkbox"
                    />
                    {choice.label}
                  </label>
                );
              })}
          </div>
        </div>
      ) : null}
    </li>
  );
}

function resourceFamilyLabel(
  family: import('@run-planner/engine/catalog-schema').ResourceFamily,
): string {
  switch (family) {
    case 'Pickaxe':
      return 'Mining';
    case 'Exorcism':
      return 'Spirit';
    case 'Shovel':
      return 'Seed';
    case 'Fishing':
      return 'Fishing';
  }
}

function RoomResourceControls({
  interactions,
  room,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly room: WorkspaceRoomSummary;
}): ReactNode {
  const dispatchIntent = useCommandIntent();
  if (room.resources === undefined || room.resources.length === 0) return null;
  return (
    <section aria-label="Resources" className="room-keepsake-rack">
      <h4>Resources</h4>
      {room.resources.map((resource) => (
        <Fragment key={resource.family}>
          <button
            className={
              resource.action === 'remove'
                ? 'danger-action action-compact'
                : 'secondary-action action-compact'
            }
            disabled={!resource.legal && resource.action !== 'remove'}
            onClick={() =>
              dispatchIntent(
                requireWorkspaceInteraction(
                  interactions.resourcePlacements,
                  resource.interactionKey,
                ).intent,
              )
            }
            type="button"
          >
            {resource.action === 'remove'
              ? `Remove ${resourceFamilyLabel(resource.family)}`
              : `${resource.action === 'move' ? 'Move' : 'Add'} ${resourceFamilyLabel(resource.family)}`}
          </button>
          {!resource.legal ? <span role="status">Repair required</span> : null}
        </Fragment>
      ))}
    </section>
  );
}

export function inspectorRoomActionContent(
  room: WorkspaceRoomSummary,
  interactions: WorkspaceInteractionCatalog,
  row: NonNullable<WorkspaceRoomSummary['roomActions']>['rows'][number],
): ReactNode {
  return row.reference.kind !== 'interactKeepsakeRack' ||
    room.keepsakeSelection === undefined ? null : (
    <KeepsakeRackTimelineContent interactions={interactions} selection={room.keepsakeSelection} />
  );
}
export function inspectorOptionalRoomActionContent(
  room: WorkspaceRoomSummary,
  interactions: WorkspaceInteractionCatalog,
): ReactNode {
  const selection = room.keepsakeSelection;
  if (selection === undefined || selection.selectedKeepsakeKey !== undefined) return null;
  const interaction = interactions.keepsakeSelections.get(
    workspaceInteractionKey(selection.address),
  );
  if (interaction === undefined) return null;
  return (
    <li aria-label="Keepsake Rack" className="hub-open-room-card room-action-row">
      <div className="owner-markers room-action-identity">
        <span aria-hidden="true" className="hub-roster-rank">
          —
        </span>
        <strong>Keepsake Rack</strong>
        <SemanticOwnerMarker address={selection.address} />
      </div>
      <div className="hub-rank-actions room-action-controls">
        <PostbossKeepsakeControl interaction={interaction} />
      </div>
    </li>
  );
}
export function inspectorLifecycleBoundaryContent(
  room: WorkspaceRoomSummary,
  interactions: WorkspaceInteractionCatalog,
  boundary: WorkspaceRoomLifecycleBoundary,
): ReactNode {
  if (boundary.kind !== 'bossDefeated') return null;
  return (
    <>
      {room.judgment === undefined ? null : (
        <JudgmentArcanaControl interactions={interactions} judgment={room.judgment} />
      )}
      {room.figurine === undefined ? null : (
        <FigurineArcanaControl interactions={interactions} figurine={room.figurine} />
      )}
    </>
  );
}
export function InspectorRoomOverviewContent({
  room,
  interactions,
}: {
  readonly room: WorkspaceRoomSummary;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  return <RoomResourceControls interactions={interactions} room={room} />;
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
  const picker = node.room.roomPicker;
  const startPicker = picker?.kind === 'startRoomPicker' ? picker : undefined;
  if (startPicker === undefined && node.room.entryReward === undefined) return null;
  const interaction =
    startPicker === undefined
      ? undefined
      : requireWorkspaceInteraction(
          interactions.rooms,
          workspaceInteractionKey(startPicker.address),
        );
  if (interaction !== undefined && interaction.kind !== 'startRoom')
    throw new BiomeWorkspaceContractError(`${interaction.key} is not a start-room interaction.`);
  return (
    <section
      aria-label={startPicker === undefined ? 'Entry reward' : 'Start room identity'}
      className="start-room-identity"
    >
      {startPicker === undefined || interaction === undefined ? null : (
        <>
          <div className="owner-markers">
            <h3>Room identity</h3>
            <SemanticOwnerMarker address={node.room.address} />
          </div>
          <RoomSelector
            idPrefix={`start-${node.room.occurrenceId}`}
            interaction={interaction}
            label="Start room"
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
        </>
      )}
      {node.room.entryReward === undefined ? null : (
        <div aria-label="Entry reward" className="start-room-entry-reward">
          <RewardControlEditor
            control={node.room.entryReward}
            idPrefix={`start-${node.room.occurrenceId}-entry-reward`}
            interactions={interactions}
            label="Reward"
            showAcquisitionChildren={false}
          />
        </div>
      )}
    </section>
  );
}

/* The inspector-node adapter deliberately exports these projected render products. */
/* eslint-disable react-refresh/only-export-components */
import { Fragment, useState, type ReactNode } from 'react';

import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceKeepsakeEquipResultInteraction,
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
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import {
  candidateMayBeAuthored,
  candidateSelectState,
} from '@planner/ui/feedback/candidatePresentation';
import { RoomSelector } from './RoomSelector';
import { RewardControlEditor } from '../rewards/RewardControlEditor';
import { BiomeWorkspaceContractError } from './workspaceContract';

type JeweledPomInteraction = Extract<
  WorkspaceKeepsakeEquipResultInteraction,
  { readonly owner: { readonly resultKind: 'jeweledPom' } }
>;

type TranscendentEmbryoInteraction = Extract<
  WorkspaceKeepsakeEquipResultInteraction,
  { readonly owner: { readonly resultKind: 'transcendentEmbryo' } }
>;

function jeweledPomLoadable(
  load: JeweledPomInteraction['load'],
  value: NonNullable<JeweledPomInteraction['value']>,
) {
  return Object.freeze({ load: () => load(value) });
}

function ExperimentalHammerResultControl({
  interaction,
}: {
  readonly interaction: Extract<
    WorkspaceKeepsakeEquipResultInteraction,
    { readonly owner: { readonly resultKind: 'experimentalHammer' } }
  >;
}) {
  const dispatch = useAppDispatch();
  const candidates = useWorkspaceInteraction(interaction);
  const candidateFor = (traitKey: string) =>
    candidates.result?.find((candidate) => candidate.value === traitKey);
  return (
    <fieldset className="field-control">
      <legend>Experimental Hammer result</legend>
      <select
        aria-label="Experimental Hammer result"
        value={
          interaction.value === undefined
            ? ''
            : interaction.value.kind === 'selected'
              ? interaction.value.traitKey
              : '__exhausted'
        }
        onFocus={candidates.activate}
        onPointerDown={candidates.activate}
        onChange={(event) => {
          const selected = event.target.value;
          const option = candidateFor(selected);
          if (selected !== '' && candidateMayBeAuthored(option))
            dispatch(
              authoredProjectCommandDispatched(
                interaction.intentFor(
                  selected === '__exhausted'
                    ? { kind: 'exhausted' }
                    : { kind: 'selected', traitKey: selected },
                ).command,
              ),
            );
        }}
      >
        <option value="">Choose compatible Hammer</option>
        {interaction.choices.map((choice) => {
          const option = candidateFor(choice.value);
          return (
            <option
              key={choice.value}
              value={choice.value}
              disabled={option !== undefined && !candidateMayBeAuthored(option)}
              {...candidateSelectState(option)}
            >
              {choice.label}
            </option>
          );
        })}
      </select>
    </fieldset>
  );
}

function JeweledPomResultControl({ interaction }: { readonly interaction: JeweledPomInteraction }) {
  const dispatch = useAppDispatch();
  const selected = interaction.value;
  const revision = selected?.traitKey ?? '';
  const [candidateInput, setCandidateInput] = useState(() => ({
    interaction,
    revision,
    loadable: jeweledPomLoadable(interaction.load, { traitKey: selected?.traitKey ?? '' }),
  }));
  if (candidateInput.interaction !== interaction || candidateInput.revision !== revision)
    setCandidateInput({
      interaction,
      revision,
      loadable: jeweledPomLoadable(interaction.load, { traitKey: selected?.traitKey ?? '' }),
    });
  const candidates = useWorkspaceInteraction(candidateInput.loadable);
  const candidateFor = (traitKey: string) =>
    candidates.result?.find((candidate) => candidate.value === traitKey);
  return (
    <fieldset className="field-control">
      <legend>Jeweled Pom result</legend>
      <select
        aria-label="Jeweled Pom result"
        id={`jeweled-pom-${interaction.key}`}
        value={interaction.value?.traitKey ?? ''}
        onFocus={candidates.activate}
        onPointerDown={candidates.activate}
        onChange={(event) => {
          const traitKey = event.target.value;
          const option = candidateFor(traitKey);
          if (traitKey !== '' && candidateMayBeAuthored(option))
            dispatch(
              authoredProjectCommandDispatched(
                interaction.intentFor({ ...(interaction.value ?? {}), traitKey }).command,
              ),
            );
        }}
      >
        <option value="">Choose Hades trait</option>
        {interaction.choices.map((choice) => {
          const option = candidateFor(choice.value);
          return (
            <option
              key={choice.value}
              value={choice.value}
              disabled={option !== undefined && !candidateMayBeAuthored(option)}
              {...candidateSelectState(option)}
            >
              {choice.label}
            </option>
          );
        })}
      </select>
    </fieldset>
  );
}

function TranscendentEmbryoResultControl({
  interaction,
}: {
  readonly interaction: TranscendentEmbryoInteraction;
}) {
  const dispatch = useAppDispatch();
  const candidates = useWorkspaceInteraction(interaction);
  const candidateFor = (blessingKey: string) =>
    candidates.result?.find((candidate) => candidate.value === blessingKey);
  const summary = candidateFor(interaction.value?.blessingKey ?? '')?.transcendentEmbryoSummary;
  return (
    <fieldset className="field-control">
      <legend>Transcendent Embryo result</legend>
      <select
        aria-label="Transcendent Embryo result"
        value={interaction.value?.blessingKey ?? ''}
        onFocus={candidates.activate}
        onPointerDown={candidates.activate}
        onChange={(event) => {
          const blessingKey = event.target.value;
          const option = candidateFor(blessingKey);
          if (blessingKey !== '' && candidateMayBeAuthored(option))
            dispatch(
              authoredProjectCommandDispatched(interaction.intentFor({ blessingKey }).command),
            );
        }}
      >
        <option value="">Choose Chaos blessing</option>
        {interaction.choices.map((choice) => {
          const option = candidateFor(choice.value);
          return (
            <option
              key={choice.value}
              value={choice.value}
              disabled={option !== undefined && !candidateMayBeAuthored(option)}
              {...candidateSelectState(option)}
            >
              {choice.label}
            </option>
          );
        })}
      </select>
      {summary === undefined ? null : (
        <p className="field-description">
          {summary.rarity} ·{' '}
          {summary.operands.map((operand) => `${operand.label}: ${operand.value}`).join(', ') ||
            'No numeric operands'}
        </p>
      )}
    </fieldset>
  );
}

function PostbossKeepsakeControl({
  interaction,
  value,
}: {
  readonly interaction: WorkspaceKeepsakeSelectionInteraction;
  readonly value: NonNullable<WorkspaceRoomSummary['keepsakeSelection']>['value'];
}) {
  const dispatch = useAppDispatch();
  const candidates = useWorkspaceInteraction(interaction);
  return (
    <div className="room-keepsake-control">
      <select
        aria-label="Keepsake"
        aria-busy={candidates.pending || undefined}
        id={`postboss-keepsake-${interaction.key}`}
        onFocus={candidates.activate}
        onPointerDown={candidates.activate}
        onChange={(event) => {
          const key = event.target.value;
          if (key === '') {
            if (interaction.retainIntent !== undefined)
              dispatch(authoredProjectCommandDispatched(interaction.retainIntent().command));
            return;
          }
          const option = candidates.result?.find((candidate) => candidate.value === key);
          if (candidateMayBeAuthored(option))
            dispatch(authoredProjectCommandDispatched(interaction.replaceIntent(key).command));
        }}
        value={value.kind === 'replace' ? value.keepsakeKey : ''}
      >
        <option value="">Retain current keepsake</option>
        {interaction.choices.map((choice) => {
          const option = candidates.result?.find((candidate) => candidate.value === choice.value);
          return (
            <option
              key={choice.value}
              value={choice.value}
              disabled={option !== undefined && !candidateMayBeAuthored(option)}
              {...candidateSelectState(option)}
            >
              {choice.label}
            </option>
          );
        })}
      </select>
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
      <PostbossKeepsakeControl interaction={interaction} value={selection.value} />
      {equipResult === undefined ? null : equipResult.owner.resultKind === 'jeweledPom' ? (
        <JeweledPomResultControl interaction={equipResult as JeweledPomInteraction} />
      ) : equipResult.owner.resultKind === 'experimentalHammer' ? (
        <ExperimentalHammerResultControl
          interaction={
            equipResult as Extract<
              WorkspaceKeepsakeEquipResultInteraction,
              { readonly owner: { readonly resultKind: 'experimentalHammer' } }
            >
          }
        />
      ) : (
        <TranscendentEmbryoResultControl
          interaction={equipResult as TranscendentEmbryoInteraction}
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
            <button aria-label="Close Judgment editor" onClick={() => setOpen(false)} type="button">
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
  const hasTimelineAction = room.roomActions?.rows.some(
    (row) => row.reference.kind === 'interactKeepsakeRack',
  );
  return (
    <>
      <RoomResourceControls interactions={interactions} room={room} />
      {room.keepsakeSelection === undefined || hasTimelineAction ? null : (
        <section aria-label="Keepsake Rack" className="room-keepsake-rack">
          <h4>Keepsake Rack</h4>
          <KeepsakeRackTimelineContent
            interactions={interactions}
            selection={room.keepsakeSelection}
          />
        </section>
      )}
    </>
  );
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
  return interaction.owner.resultKind === 'transcendentEmbryo' ? (
    <TranscendentEmbryoResultControl interaction={interaction as TranscendentEmbryoInteraction} />
  ) : (
    <ExperimentalHammerResultControl
      interaction={
        interaction as Extract<
          WorkspaceKeepsakeEquipResultInteraction,
          { readonly owner: { readonly resultKind: 'experimentalHammer' } }
        >
      }
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

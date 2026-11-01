import type {
  ExitSelectionAddress,
  SemanticAddress,
  TargetAddress,
} from '@run-planner/engine/authored-project';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceAuthoringFrontier,
  type WorkspaceBatchRepairIntent,
  type WorkspaceEffectiveRewardPool,
  type WorkspaceInteractionCatalog,
  type WorkspaceMarker,
  type WorkspaceMissingPhysicalTarget,
  type WorkspacePhysicalTarget,
  type WorkspaceTakeoverBatchNode,
  type WorkspaceOrdinaryBatchNode,
  type WorkspaceMixedBatchNode,
  type WorkspaceRoomIcon,
  type WorkspaceTopologyRemovalInteraction,
} from '@planner/projections/structured-workspace';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { useAppDispatch } from '@planner/state/store';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import {
  useFindingAnchor,
  useFindingMark,
  useFindingTarget,
  type FindingAnchorProps,
} from '@planner/ui/feedback/useFindingTarget';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { declaredChoicesPicker } from '@planner/projections/contextual/contextualPicker';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { RoomMapLauncher } from '@planner/ui/room-maps/RoomMapDialog';
import { CandidatePicker } from './CandidatePicker';
import { AnomalyRoomControl, RevertAnomalyAction } from './room-features/AnomalyControls';
import { RoomSelector } from './RoomSelector';
import { roomKindIcon } from './roomIcon';
import { RunStateLauncher } from './RunStateSheet';
import { DoorRewardEditor, DoorRewardHiddenTag, RerolledRewardRepairs } from './DoorRewardEditor';
import { FixedValueChip } from '@planner/ui/controls/FixedValueChip';
import { rewardIcon } from '@planner/ui/artwork/rewardIcon';
import { RoomRerolls } from './RoomRerolls';
import { BiomeWorkspaceContractError } from './workspaceContract';
import { BiomeEntryPicker } from './BiomeEntryPicker';
import {
  useDoorNotes,
  type DoorNoteItem,
  type DoorNoteMark,
  type DoorNoteTarget,
} from './doorNotes';
import { hintProps } from '@planner/ui/controls/hint';

type BatchNode = WorkspaceOrdinaryBatchNode | WorkspaceMixedBatchNode | WorkspaceTakeoverBatchNode;

function exitSelectionAddress(marker: WorkspaceMarker): ExitSelectionAddress {
  if (marker.address.kind !== 'exitSelection') {
    throw new BiomeWorkspaceContractError('A batch selection must own an exit-selection address.');
  }
  return marker.address;
}

function targetAddress(marker: WorkspaceMarker): TargetAddress {
  if (marker.address.kind !== 'target') {
    throw new BiomeWorkspaceContractError('An Anomaly takeover must own a normal target address.');
  }
  return marker.address;
}

function TargetRoomSelector({
  ariaLabel,
  idPrefix,
  interactionKey,
  interactions,
  label,
  placeholder,
}: {
  readonly ariaLabel?: string;
  readonly idPrefix: string;
  readonly interactionKey: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly label: string;
  readonly placeholder?: string;
}) {
  const interaction = requireWorkspaceInteraction(interactions.rooms, interactionKey);
  const findingTarget = useFindingTarget();
  const executeIntent = useCommandIntent();
  if (interaction.kind !== 'targetRoom' && interaction.kind !== 'decisionEntryRoom') {
    throw new BiomeWorkspaceContractError(`${interactionKey} is not a target-room interaction.`);
  }
  return (
    <RoomSelector
      findingTarget={findingTarget(
        interaction.owner,
        `${idPrefix}-room`,
        interaction.kind === 'decisionEntryRoom' ? interaction.readinessOwner : interaction.owner,
      )}
      {...(ariaLabel === undefined ? {} : { ariaLabel })}
      idPrefix={idPrefix}
      interaction={interaction}
      label={label}
      onSelect={(gameName) => executeIntent(interaction.intentFor(gameName))}
      {...(placeholder === undefined ? {} : { placeholder })}
    />
  );
}

/**
 * One exit as a row of the shared door grid: selection, door number or exit
 * art, room, reward, map and a secondary action. A cell the exit lacks stays
 * empty so every row keeps the grid's columns.
 */
export function DoorRow({
  anchor,
  ariaLabel,
  identity,
  map,
  reward,
  room,
  secondary,
  selection,
  state,
}: {
  readonly anchor?: FindingAnchorProps;
  readonly ariaLabel: string;
  readonly identity: ReactNode;
  readonly map?: { readonly gameName: string; readonly hostId: string; readonly title: string };
  readonly reward?: ReactNode;
  readonly room: ReactNode;
  readonly secondary?: ReactNode;
  /** The selection radio; absent when the exit is not individually selectable. */
  readonly selection?: ReactNode;
  readonly state: {
    readonly available: boolean;
    readonly missing?: boolean;
    readonly picked?: boolean;
    readonly retained?: boolean;
  };
}) {
  return (
    <article
      aria-label={ariaLabel}
      className="door-row"
      data-available={state.available}
      {...(state.missing === undefined ? {} : { 'data-missing': state.missing })}
      {...(state.picked === undefined ? {} : { 'data-picked': state.picked })}
      {...(state.retained === undefined ? {} : { 'data-retained': state.retained })}
      {...anchor}
      tabIndex={-1}
    >
      <span className="door-row-select">{selection}</span>
      <span className="door-row-identity">{identity}</span>
      <span className="door-row-room">{room}</span>
      <span className="door-row-reward">{reward}</span>
      <span className="door-row-secondary">{secondary}</span>
      <span className="door-row-map">
        {map === undefined ? null : (
          <RoomMapLauncher gameName={map.gameName} hostId={map.hostId} title={map.title} />
        )}
      </span>
    </article>
  );
}

/** A lone exit the declaration fixes: Door 1 and its room as a plain value, with no selection. */
export function FixedExitRow({
  available = true,
  gameName,
  hostId,
  label,
  roomIcon,
}: {
  /** False while the exit cannot be taken yet. */
  readonly available?: boolean;
  readonly gameName?: string | undefined;
  readonly hostId: string;
  readonly label: string;
  readonly roomIcon?: WorkspaceRoomIcon | undefined;
}) {
  return (
    <DoorRow
      ariaLabel={`${label} room offer`}
      identity={<DoorNumber index={1} />}
      {...(gameName === undefined ? {} : { map: { gameName, hostId, title: label } })}
      room={
        <FixedValueChip
          icon={roomIcon === undefined ? undefined : roomKindIcon(roomIcon)}
          label={label}
        />
      }
      state={{ available }}
    />
  );
}

/** The doors table's column names; each row names its own cells for assistive technology. */
export function DoorRowsHeader({
  identity = 'Door',
  room = 'Room',
  select,
}: {
  readonly identity?: string;
  /** Empty where the rows have no room column, such as a reward wheel's offers. */
  readonly room?: string;
  /** Names the selection column where it is not a pick between exits. */
  readonly select?: ReactNode;
} = {}) {
  return (
    <div aria-hidden="true" className="door-rows-header">
      <span>{select}</span>
      <span>{identity}</span>
      <span>{room}</span>
      <span>Reward</span>
      <span />
      <span />
    </div>
  );
}

/** A physical door's number, with its Olympus exit type where it has one. */
export function DoorNumber({
  index,
  exitTypeLabel,
}: {
  readonly index: number;
  readonly exitTypeLabel?: string | undefined;
}) {
  return (
    <span className="door-row-number">
      {`Door ${index}`}
      {exitTypeLabel === undefined ? null : (
        <span className="door-row-sublabel">
          <span className="visually-hidden"> · </span>
          {exitTypeLabel}
        </span>
      )}
    </span>
  );
}

/** A message standing where a picker will appear once its prerequisite is chosen. */
function DoorRowWaiting({ children }: { readonly children: string }) {
  return (
    <span aria-live="polite" className="door-row-waiting">
      {children}
    </span>
  );
}

/** The repair's projected effect names and styles it; a projected mark owner carries the batch's mark. */
function ExactRepairAction({
  intent,
  onFocusedUse,
}: {
  readonly intent: WorkspaceBatchRepairIntent | undefined;
  /** The repair removes its own button, so a focused use hands focus on. */
  readonly onFocusedUse: () => void;
}) {
  const findingTarget = useFindingTarget();
  const executeIntent = useCommandIntent();
  if (intent === undefined) return null;
  const adds = intent.effect === 'addMissing';
  return (
    <button
      {...(intent.markOwner === undefined ? {} : findingTarget(intent.markOwner))}
      className={adds ? 'secondary-action' : 'danger-action'}
      data-command={intent.command.kind}
      onClick={(event) => {
        if (document.activeElement === event.currentTarget) onFocusedUse();
        executeIntent(intent);
      }}
      type="button"
    >
      {adds ? 'Add missing Preboss doors' : 'Remove unavailable doors'}
    </button>
  );
}

/**
 * The interaction supplies one complete removal intent. This renderer keeps
 * danger presentation while deriving no descendant scope or focus policy.
 */
export function TopologyRemovalAction({
  accessibleLabel,
  compact = false,
  interaction,
  label,
}: {
  readonly accessibleLabel?: string;
  readonly compact?: boolean;
  readonly interaction: WorkspaceTopologyRemovalInteraction | undefined;
  readonly label: string;
}) {
  const executeIntent = useCommandIntent();
  return (
    <div
      className="topology-removal-action"
      {...(interaction === undefined ? {} : { 'data-command': interaction.intent.command.kind })}
    >
      <button
        aria-label={accessibleLabel}
        className={`danger-action${compact ? ' action-compact' : ''}`}
        disabled={interaction === undefined}
        onClick={() => interaction === undefined || executeIntent(interaction.intent)}
        type="button"
      >
        {label}
      </button>
    </div>
  );
}

function TargetRow({
  interactions,
  node,
  target,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly node: BatchNode;
  readonly target: WorkspacePhysicalTarget;
}) {
  const findingAnchor = useFindingAnchor();
  const findingMark = useFindingMark();
  const dispatch = useAppDispatch();
  const selectionInteraction =
    node.targets.length === 1 && node.zagreusContract === undefined && node.chaos === undefined
      ? undefined
      : requireWorkspaceInteraction(
          interactions.exitSelections,
          workspaceInteractionKey(node.selection.address),
        );
  const selectionChoice = selectionInteraction?.targets.find(
    (choice) => choice.value === target.exitKey,
  );
  const selection = exitSelectionAddress(node.selection);
  const door = target.door;
  const authorsRoom =
    node.targetInteraction === 'replaceable' &&
    door.room.roomPicker !== undefined &&
    door.room.anomaly === undefined;
  const replaceWithAnomaly =
    !target.selected || target.anomalyTakeover === undefined ? null : (
      <button
        aria-label={`Replace Door ${target.index} with Anomaly`}
        className="quiet-action action-compact"
        data-command="SwitchTargetToAnomaly"
        onClick={() =>
          dispatch(
            authoredProjectCommandDispatched({
              kind: 'SwitchTargetToAnomaly',
              target: targetAddress(target.marker),
            }),
          )
        }
        type="button"
      >
        {target.anomalyTakeover.label}
      </button>
    );
  return (
    <DoorRow
      {...(authorsRoom ? {} : { anchor: findingAnchor(target.marker.address) })}
      ariaLabel={`${door.room.label} room offer`}
      identity={<DoorNumber exitTypeLabel={target.exitTypeLabel} index={target.index} />}
      map={{ gameName: door.room.gameName, hostId: target.marker.focusKey, title: door.room.label }}
      reward={
        <DoorRewardEditor
          door={door}
          focusOwner={target.marker.address}
          idPrefix={`door-${target.marker.focusKey}`}
          interactions={interactions}
          layout="row"
        />
      }
      room={
        authorsRoom && door.room.roomPicker !== undefined ? (
          <TargetRoomSelector
            ariaLabel={`Door ${target.index} room`}
            idPrefix={`target-${target.marker.focusKey}`}
            interactionKey={workspaceInteractionKey(door.room.roomPicker.address)}
            interactions={interactions}
            label=""
          />
        ) : door.room.anomaly !== undefined ? (
          <AnomalyRoomControl ariaLabel={`Door ${target.index} room`} room={door.room} />
        ) : (
          <FixedValueChip icon={roomKindIcon(door.room.roomIcon)} label={door.room.label} />
        )
      }
      secondary={
        <>
          <RerolledRewardRepairs
            rewards={door.offerRewardSurface.rewards}
            target={`Door ${target.index}`}
          />
          <DoorRewardHiddenTag door={door} />
          {replaceWithAnomaly}
          {door.room.anomaly === undefined ? null : (
            <RevertAnomalyAction doorIndex={target.index} room={door.room} />
          )}
        </>
      }
      {...(selectionChoice === undefined
        ? {}
        : {
            selection: (
              <input
                {...(target.physicalState === 'unavailable'
                  ? hintProps('This saved room is no longer offered here.')
                  : findingMark(selection))}
                aria-label={`Pick ${door.room.label} from Door ${target.index}`}
                checked={selectionInteraction?.selectedExitKey === target.exitKey}
                disabled={target.physicalState === 'unavailable'}
                name={`selection-${node.key}`}
                onChange={() =>
                  dispatch(
                    authoredProjectCommandDispatched({
                      kind: 'SetExitSelection',
                      selection,
                      value: { kind: 'normal', exitKey: target.exitKey },
                    }),
                  )
                }
                type="radio"
              />
            ),
          })}
      state={{
        available: target.physicalState === 'available',
        picked: target.selected,
        retained: target.retained,
      }}
    />
  );
}

/** What a door without a room waits on before its room can be chosen. */
const missingTargetWaits = {
  awaitingPriorExit: "Select the earlier door's room first",
  awaitingBatchRewardStore: 'Select the reward pool first',
  awaitingFieldsCageOutcome: 'Select the Fields door roll first',
} as const;

function MissingTargetRow({
  interactions,
  target,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly target: WorkspaceMissingPhysicalTarget;
}) {
  const findingAnchor = useFindingAnchor();
  const interaction = interactions.rooms.get(target.marker.focusKey);
  const canEnterDecision = interaction?.kind === 'decisionEntryRoom';
  const canAuthorRoom = target.authoring.kind === 'ready' || canEnterDecision;
  return (
    <DoorRow
      {...(canAuthorRoom ? {} : { anchor: findingAnchor(target.marker.address) })}
      ariaLabel={`Door ${target.index} unspecified room offer`}
      identity={<DoorNumber exitTypeLabel={target.exitTypeLabel} index={target.index} />}
      room={
        canAuthorRoom ? (
          <TargetRoomSelector
            ariaLabel={`Door ${target.index} room`}
            idPrefix={`target-${target.marker.focusKey}`}
            interactionKey={target.marker.focusKey}
            interactions={interactions}
            label=""
            placeholder="Choose room"
          />
        ) : (
          <DoorRowWaiting>{missingTargetWaits[target.authoring.kind]}</DoorRowWaiting>
        )
      }
      state={{ available: true, missing: true }}
    />
  );
}

/**
 * An authored additional exit beside the normal doors. Presence lives on the
 * source room; the row owns selection, the destination room, and its fixed reward.
 */
function AdditionalExitRow({
  control,
  interactions,
  selection,
  selectionName,
}: {
  readonly control: NonNullable<BatchNode['chaos'] | BatchNode['zagreusContract']>;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly selection: SemanticAddress;
  readonly selectionName: string;
}) {
  const executeIntent = useCommandIntent();
  const findingMark = useFindingMark();
  const key = workspaceInteractionKey(control.owner);
  const chaos =
    'kind' in control ? requireWorkspaceInteraction(interactions.chaosExits, key) : undefined;
  const selectIntent =
    chaos?.selectIntent ??
    requireWorkspaceInteraction(interactions.zagreusContracts, key).selectIntent;
  const room = control.door.room;
  const art = roomKindIcon(room.roomIcon);
  return (
    <DoorRow
      ariaLabel={`${control.exitTypeLabel} exit`}
      identity={
        <span className="door-row-number">{chaos === undefined ? 'Contract' : 'Chaos Gate'}</span>
      }
      map={{ gameName: room.gameName, hostId: key, title: room.label }}
      reward={
        <span className="door-row-rewards">
          <span className="row-reward-value">
            <FixedValueChip
              icon={rewardIcon(control.fixedRewardType)}
              label={control.fixedRewardLabel}
            />
          </span>
        </span>
      }
      room={
        'kind' in control && chaos !== undefined ? (
          <ContextualPicker
            ariaLabel={`${control.exitTypeLabel} room`}
            id={`chaos-room-${room.occurrenceId}`}
            itemIcon={() => art}
            label=""
            layout="inline"
            model={declaredChoicesPicker(
              control.mapChoices.map((choice) => ({ ...choice, key: choice.value })),
              room.gameName,
            )}
            onSelect={(gameName) => executeIntent(chaos.mapIntent(gameName))}
            placeholder="Choose a room"
            triggerIcon={art}
            triggerSize="content"
          />
        ) : (
          <FixedValueChip icon={art} label={room.label} />
        )
      }
      selection={
        <input
          {...findingMark(selection)}
          aria-label={`Take ${control.exitTypeLabel}`}
          checked={control.selected}
          name={selectionName}
          onChange={() => executeIntent(selectIntent)}
          type="radio"
        />
      }
      state={{ available: true, picked: control.selected }}
    />
  );
}

/** Only a partial selection needs explaining; an empty one is obvious. */
function batchContinuationHint(node: BatchNode): string | undefined {
  const doorSelected =
    node.targets.some((target) => target.selected) ||
    node.zagreusContract?.selected === true ||
    node.chaos?.selected === true;
  return doorSelected ? 'Fill the remaining doors to continue.' : undefined;
}

/** Moves to the occurrence a decision continues into; disabled while none is selected. */
export function SelectedContinuationAction({
  continuation,
  disabledHint,
}: {
  readonly continuation: { readonly marker: WorkspaceMarker } | undefined;
  readonly disabledHint?: string | undefined;
}) {
  const dispatch = useAppDispatch();
  return (
    <button
      className="primary-action"
      disabled={continuation === undefined}
      onClick={() => {
        if (continuation !== undefined) {
          dispatch(semanticOwnerFocused(continuation.marker.address));
        }
      }}
      {...hintProps(continuation === undefined ? disabledHint : undefined)}
      type="button"
    >
      Open next room
    </button>
  );
}

/**
 * A value a note explains: its footnote symbol follows it, it is named by its
 * label and value and described by the note, and hovering or focusing either
 * highlights both.
 */
export function NoteMarked({
  children,
  labelledBy,
  mark,
}: {
  readonly children: ReactNode;
  /** The ids of the value's label and of its text, which together name it. */
  readonly labelledBy: string;
  readonly mark: DoorNoteMark | undefined;
}) {
  if (mark === undefined) return children;
  return (
    <span
      aria-describedby={mark.noteId}
      aria-labelledby={labelledBy}
      className="door-note-marked"
      data-note-active={mark.active || undefined}
      onBlur={() => mark.setActive(false)}
      onFocus={() => mark.setActive(true)}
      onMouseEnter={() => mark.setActive(true)}
      onMouseLeave={() => mark.setActive(false)}
      role="group"
      tabIndex={0}
    >
      {children}
      <sup aria-hidden="true" className="door-note-symbol">
        {mark.symbol}
      </sup>
    </span>
  );
}

/** The pool line: the batch's pool, then what the selected exit counts where that differs. */
export function RewardPoolLine({
  effective,
  effectiveMark,
  fixedLabel,
  label,
  picker,
  poolMark,
}: {
  readonly effective?: WorkspaceEffectiveRewardPool | undefined;
  readonly effectiveMark?: DoorNoteMark | undefined;
  /** A pool decided elsewhere, shown as a plain value. */
  readonly fixedLabel?: string | undefined;
  readonly label: string;
  readonly picker?: ReactNode;
  readonly poolMark?: DoorNoteMark | undefined;
}) {
  const labelId = useId();
  const valueId = useId();
  const effectiveLabelId = useId();
  const effectiveValueId = useId();
  return (
    <div className="door-pool-line">
      {picker ?? (
        <span aria-labelledby={labelId} className="door-pool-value" role="group">
          <span className="door-pool-label" id={labelId}>
            {label}
          </span>
          {fixedLabel === undefined ? null : (
            <NoteMarked labelledBy={`${labelId} ${valueId}`} mark={poolMark}>
              <FixedValueChip label={fixedLabel} textId={valueId} />
            </NoteMarked>
          )}
        </span>
      )}
      {effective === undefined ? null : (
        <span className="door-pool-effective">
          <span aria-hidden="true" className="row-reward-arrow">
            →
          </span>
          <span className="visually-hidden" id={effectiveLabelId}>
            Effective Pool
          </span>
          <NoteMarked labelledBy={`${effectiveLabelId} ${effectiveValueId}`} mark={effectiveMark}>
            <span aria-labelledby={effectiveLabelId} role="status">
              <span id={effectiveValueId}>{effective.label}</span>
            </span>
          </NoteMarked>
        </span>
      )}
    </div>
  );
}

/** The doors tab's side column of batch facts; absent when there are none. */
export function DoorNotes({ items }: { readonly items: readonly DoorNoteItem[] }) {
  const titleId = useId();
  if (items.length === 0) return null;
  return (
    <aside aria-labelledby={titleId} className="door-notes">
      <h4 className="door-notes-title" id={titleId}>
        Notes
      </h4>
      <ul>
        {items.map(({ key, mark, text }) =>
          mark === undefined ? (
            <li key={key}>{text}</li>
          ) : (
            <li
              aria-labelledby={mark.noteId}
              data-note-active={mark.active || undefined}
              key={key}
              onBlur={() => mark.setActive(false)}
              onFocus={() => mark.setActive(true)}
              onMouseEnter={() => mark.setActive(true)}
              onMouseLeave={() => mark.setActive(false)}
              tabIndex={0}
            >
              <span aria-hidden="true" className="door-note-symbol">
                {mark.symbol}
              </span>
              <span id={mark.noteId}>{text}</span>
            </li>
          ),
        )}
      </ul>
    </aside>
  );
}

function BatchSettings({
  interactions,
  markFor,
  node,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly markFor: (target: DoorNoteTarget) => DoorNoteMark | undefined;
  readonly node: BatchNode;
}) {
  const executeIntent = useCommandIntent();
  const store =
    node.rewardStore === undefined
      ? undefined
      : requireWorkspaceInteraction(
          interactions.batchRewardStores,
          workspaceInteractionKey(node.rewardStore.address),
        );
  const fields =
    node.fieldsCageOutcome === undefined
      ? undefined
      : requireWorkspaceInteraction(
          interactions.fieldsCageOutcomes,
          workspaceInteractionKey(node.fieldsCageOutcome.address),
        );
  return (
    <>
      {node.rewardPool === undefined ? null : (
        <RewardPoolLine
          effective={node.rewardPool.effective}
          effectiveMark={markFor('effective')}
          fixedLabel={node.rewardPool.inherited?.label}
          poolMark={markFor('pool')}
          label={node.rewardStoreLabel ?? 'Reward Pool'}
          picker={
            store === undefined ? undefined : (
              <CandidatePicker
                id={`${node.key}-reward-store`}
                interaction={store}
                label={node.rewardStoreLabel ?? 'Reward Pool'}
                onReplace={(storeKey) => executeIntent(store.intentFor(storeKey))}
                placeholder="Select pool"
              />
            )
          }
        />
      )}
      {fields === undefined && node.fields === undefined ? null : (
        <div className="fields-batch-editor">
          {fields === undefined ? null : (
            <CandidatePicker
              id={`${node.key}-fields-roll`}
              interaction={fields}
              label="Fields door roll"
              onReplace={(cageOutcome) => executeIntent(fields.intentFor(cageOutcome))}
              placeholder="Select roll"
            />
          )}
          {node.fields === undefined ? null : (
            <>
              <dl className="fields-batch-summary">
                <div>
                  <dt>Cages per combat room</dt>
                  <dd>{node.fields.doorCageRewardCount}</dd>
                </div>
                <div>
                  <dt>Prior Max outcomes</dt>
                  <dd>
                    {node.fields.priorMaxOutcomes === undefined
                      ? 'Unavailable'
                      : `${node.fields.priorMaxOutcomes.fieldsMaxDoorsRolled} / ${node.fields.priorMaxOutcomes.maxDoorCageCeiling}`}
                  </dd>
                </div>
              </dl>
            </>
          )}
        </div>
      )}
    </>
  );
}

/** Renders an ordinary, bounded Hub-entry, mixed, or atomic takeover decision from its projection. */
export function BatchWorkbench({
  interactions,
  label,
  node,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly label: string;
  readonly node: BatchNode;
}) {
  const findingAnchor = useFindingAnchor();
  const notes = useDoorNotes(node.notes);
  const removal =
    node.persistence === 'authored' && node.source.kind === 'occurrence'
      ? requireWorkspaceInteraction(
          interactions.topologyRemovals,
          workspaceInteractionKey(node.owner),
        )
      : undefined;
  const doorsId = semanticOwnerControlElementId(exitSelectionAddress(node.selection));
  const refocusDoors = useRef(false);
  useEffect(() => {
    if (!refocusDoors.current || node.repairIntent !== undefined) return;
    refocusDoors.current = false;
    document.getElementById(doorsId)?.focus();
  });
  return (
    <section
      aria-label={`${label} room offers`}
      className="biome-batch-workbench door-workbench"
      data-batch-kind={node.kind}
      data-topology-state={node.topologyState}
      {...(node.repairIntent?.markOwner === undefined ? findingAnchor(node.owner) : {})}
      tabIndex={-1}
    >
      {node.runState === undefined ? null : (
        <div className="owner-markers door-workbench-markers">
          <RunStateLauncher launcher={node.runState} />
        </div>
      )}
      <div className="door-body">
        <div className="door-batch">
          <BatchSettings interactions={interactions} markFor={notes.markFor} node={node} />
        </div>
        <DoorNotes items={notes.items} />
        <div
          aria-label="Doors"
          className="door-rows"
          {...findingAnchor(exitSelectionAddress(node.selection), {
            // Navigation lands on the first door that can still be picked.
            focusTarget: (list) =>
              list.querySelector<HTMLElement>('input[type="radio"]:not(:disabled)'),
          })}
          tabIndex={-1}
          // The rows stay named articles; their radios group natively by name.
          role="group"
        >
          <DoorRowsHeader />
          {node.targets.map((target) => (
            <TargetRow
              interactions={interactions}
              key={target.exitKey}
              node={node}
              target={target}
            />
          ))}
          {node.kind === 'takeoverBatch'
            ? null
            : node.missingTargets.map((target) => (
                <MissingTargetRow
                  interactions={interactions}
                  key={target.exitKey}
                  target={target}
                />
              ))}
          {[node.zagreusContract, node.chaos].map((control) =>
            control === undefined ? null : (
              <AdditionalExitRow
                control={control}
                interactions={interactions}
                key={workspaceInteractionKey(control.owner)}
                selection={exitSelectionAddress(node.selection)}
                selectionName={`selection-${node.key}`}
              />
            ),
          )}
        </div>
        {node.rerolls === undefined ? null : (
          <RoomRerolls interactions={interactions} rerolls={node.rerolls} />
        )}
      </div>
      <div className="workbench-action-row">
        <ExactRepairAction
          intent={node.repairIntent}
          onFocusedUse={() => {
            refocusDoors.current = true;
          }}
        />
        <SelectedContinuationAction
          continuation={node.selectedContinuation}
          disabledHint={batchContinuationHint(node)}
        />
        <TopologyRemovalAction interaction={removal} label="Remove these doors" />
      </div>
    </section>
  );
}

function StartFrontier({
  interaction,
  interactions,
}: {
  readonly interaction: Extract<WorkspaceAuthoringFrontier, { readonly kind: 'start' }>;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const start = requireWorkspaceInteraction(interactions.starts, interaction.interactionKey);
  return (
    <section className="frontier-actions biome-start-frontier">
      <BiomeEntryPicker interaction={start} />
    </section>
  );
}

function ExitFrontier({
  interactions,
  frontier,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly frontier: Extract<WorkspaceAuthoringFrontier, { readonly kind: 'exitDecision' }>;
}) {
  if (frontier.provisionalBatch === undefined) {
    throw new BiomeWorkspaceContractError(
      'An ordinary exit frontier must provide its provisional door workbench.',
    );
  }
  return (
    <BatchWorkbench interactions={interactions} label="Doors" node={frontier.provisionalBatch} />
  );
}

export function AuthoringFrontier({
  frontier,
  interactions,
}: {
  readonly frontier: WorkspaceAuthoringFrontier;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  switch (frontier.kind) {
    case 'start':
      return <StartFrontier interaction={frontier} interactions={interactions} />;
    case 'exitDecision':
      return <ExitFrontier frontier={frontier} interactions={interactions} />;
    case 'hubVisit':
    case 'hubOpenSet':
      throw new BiomeWorkspaceContractError(
        'Hub structural frontiers must be rendered by HubDecisionWorkbench.',
      );
  }
}

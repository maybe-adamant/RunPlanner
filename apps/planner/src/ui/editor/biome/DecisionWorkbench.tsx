import type { TargetAddress } from '@run-planner/engine/authored-project';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceAuthoringFrontier,
  type WorkspaceEffectiveRewardPool,
  type WorkspaceInteractionCatalog,
  type WorkspaceLockedDoors,
  type WorkspaceMarker,
  type WorkspaceMissingPhysicalTarget,
  type WorkspacePhysicalTarget,
  type WorkspaceTakeoverBatchNode,
  type WorkspaceOrdinaryBatchNode,
  type WorkspaceMixedBatchNode,
  type WorkspaceRoomIcon,
  type WorkspaceRoomMap,
  type WorkspaceRoomPlanEnd,
  type WorkspaceTopologyRemovalInteraction,
} from '@planner/projections/structured-workspace';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch } from '@planner/state/store';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import {
  useAuthoringLocked,
  useFindingAnchor,
  useFindingTarget,
  type FindingAnchorProps,
  type FindingMarkProps,
} from '@planner/ui/feedback/useFindingTarget';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { declaredChoicesPicker } from '@planner/projections/contextual/contextualPicker';
import { useId, type ReactNode } from 'react';
import { RoomMapLauncher } from '@planner/ui/room-maps/RoomMapDialog';
import { RoomFeatureMapLegend, RoomFeatureMapPoints } from './room-map/RoomMapPoints';
import { useRoomMapLinks, type RoomMapHighlight } from './room-map/roomMapHighlight';
import { roomMapCalibrations } from '@planner/ui/room-maps/roomMapCalibration';
import { CandidatePicker } from './CandidatePicker';
import { AnomalyRoomControl, RevertAnomalyAction } from './room-features/AnomalyControls';
import { RoomSelector } from './RoomSelector';
import { roomKindIcon } from './roomIcon';
import {
  DoorRewardEditor,
  DoorRewardHiddenTag,
  FixedRewardChip,
  RerolledRewardRepairs,
} from './DoorRewardEditor';
import { FixedValueChip } from '@planner/ui/controls/FixedValueChip';
import { rewardIcon } from '@planner/ui/artwork/rewardIcon';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { roomObjectIcon } from '@planner/ui/artwork/roomArtwork';
import { BiomeWorkspaceContractError } from './workspaceContract';
import { BiomeEntryPicker } from './BiomeEntryPicker';
import { doorChipMapLink, type DoorChip } from './doorSummary';
import { DoorRows } from './DoorRows';
import type { DoorNoteFor } from './doorNotes';
import { hintProps } from '@planner/ui/controls/hint';
import { IconToggle } from '@planner/ui/controls/IconToggle';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';

type BatchNode = WorkspaceOrdinaryBatchNode | WorkspaceMixedBatchNode | WorkspaceTakeoverBatchNode;

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
  mapLink,
  reward,
  room,
  secondary,
  selection,
  state,
}: {
  readonly anchor?: FindingAnchorProps;
  readonly ariaLabel: string;
  readonly identity: ReactNode;
  readonly map?: {
    readonly gameName: string;
    readonly hostId: string;
    readonly title: string;
    /** The room's map points, shown alone on its map. */
    readonly points?: WorkspaceRoomMap | undefined;
  };
  /** The exit's point on its own room's map, previewed while the row is hovered or focused. */
  readonly mapLink?: RoomMapHighlight;
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
  const mapLinks = useRoomMapLinks();
  return (
    <article
      {...mapLinks(mapLink)}
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
          <RoomMapLauncher
            gameName={map.gameName}
            hostId={map.hostId}
            {...(map.points === undefined || roomMapCalibrations[map.gameName] === undefined
              ? {}
              : {
                  legend: <RoomFeatureMapLegend gameName={map.gameName} map={map.points} />,
                  overlay: (
                    <RoomFeatureMapPoints
                      gameName={map.gameName}
                      map={map.points}
                      title={map.title}
                    />
                  ),
                })}
            title={map.title}
          />
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
  action,
  identity = 'Door',
  room = 'Room',
  select,
}: {
  /** One quiet action at the header's end, such as resetting the doors. */
  readonly action?: ReactNode;
  readonly identity?: string;
  /** Empty where the rows have no room column, such as a reward wheel's offers. */
  readonly room?: string;
  /** Names the selection column where it is not a pick between exits. */
  readonly select?: ReactNode;
} = {}) {
  return (
    <div {...(action === undefined ? { 'aria-hidden': true } : {})} className="door-rows-header">
      <span aria-hidden="true">{select}</span>
      <span aria-hidden="true">{identity}</span>
      <span aria-hidden="true">{room}</span>
      <span aria-hidden="true">Reward</span>
      <span className="door-rows-header-action">{action}</span>
    </div>
  );
}

/** A physical door's number, with its Olympus exit type where it has one. */
export function DoorNumber({
  index,
  exitTypeLabel,
  lock,
}: {
  readonly index: number;
  readonly exitTypeLabel?: string | undefined;
  /** The door's lock toggle, where the door can lock. */
  readonly lock?: ReactNode;
}) {
  return (
    <span className="door-row-number">
      {lock === undefined || lock === null ? (
        `Door ${index}`
      ) : (
        <span className="door-row-number-locked">
          {`Door ${index}`}
          {lock}
        </span>
      )}
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

/**
 * The interaction supplies one complete removal intent. This renderer keeps
 * danger presentation while deriving no descendant scope or focus policy.
 */
export function TopologyRemovalAction({
  accessibleLabel,
  compact = false,
  icon = false,
  interaction,
  label,
}: {
  readonly accessibleLabel?: string;
  readonly compact?: boolean;
  /** A reset icon in place of the label, which then shows on hover. */
  readonly icon?: boolean;
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
        aria-label={accessibleLabel ?? (icon ? label : undefined)}
        className={
          icon
            ? 'quiet-action topology-removal-icon'
            : `danger-action${compact ? ' action-compact' : ''}`
        }
        disabled={interaction === undefined}
        onClick={() => interaction === undefined || executeIntent(interaction.intent)}
        type="button"
        {...(icon ? hintProps(label, undefined, accessibleLabel ?? label) : {})}
      >
        {icon ? (
          <svg aria-hidden="true" viewBox="0 0 16 16">
            <path d="M12.5 8a4.5 4.5 0 1 1-1.3-3.2" />
            <path d="M12 2.5v2.8H9.2" />
          </svg>
        ) : (
          label
        )}
      </button>
    </div>
  );
}

/** The doors' editor shows each first draw; the Leave row and the press rows show rerolls. */
function firstDrawDoor(door: WorkspacePhysicalTarget['door']): WorkspacePhysicalTarget['door'] {
  if (door.offerRewardSurface.rewards.every((reward) => reward.rerolledSummary === undefined))
    return door;
  return {
    ...door,
    offerRewardSurface: {
      ...door.offerRewardSurface,
      rewards: door.offerRewardSurface.rewards.map(
        ({ rerolledOffer: _offer, rerolledSummary: _summary, ...reward }) => {
          void _offer;
          void _summary;
          return reward;
        },
      ),
    },
  };
}

function TargetRow({
  interactions,
  lock,
  node,
  target,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly lock: ReactNode;
  readonly node: BatchNode;
  readonly target: WorkspacePhysicalTarget;
}) {
  const findingAnchor = useFindingAnchor();
  const dispatch = useAppDispatch();
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
      identity={
        <DoorNumber exitTypeLabel={target.exitTypeLabel} index={target.index} lock={lock} />
      }
      map={{
        gameName: door.room.gameName,
        hostId: target.marker.focusKey,
        points: door.room.map,
        title: door.room.label,
      }}
      mapLink={{ kind: 'door', doorIndex: target.index }}
      reward={
        <DoorRewardEditor
          door={firstDrawDoor(door)}
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
  lock,
  target,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly lock: ReactNode;
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
      mapLink={{ kind: 'door', doorIndex: target.index }}
      identity={
        <DoorNumber exitTypeLabel={target.exitTypeLabel} index={target.index} lock={lock} />
      }
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
}: {
  readonly control: NonNullable<BatchNode['chaos'] | BatchNode['zagreusContract']>;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const executeIntent = useCommandIntent();
  const findingTarget = useFindingTarget();
  const key = workspaceInteractionKey(control.owner);
  const chaos =
    'kind' in control ? requireWorkspaceInteraction(interactions.chaosExits, key) : undefined;
  const room = control.door.room;
  const art = roomKindIcon(room.roomIcon);
  return (
    <DoorRow
      ariaLabel={`${control.exitTypeLabel} exit`}
      identity={
        <span className="door-row-number">{chaos === undefined ? 'Contract' : 'Chaos Gate'}</span>
      }
      map={{ gameName: room.gameName, hostId: key, points: room.map, title: room.label }}
      {...(chaos === undefined ? {} : { mapLink: { kind: 'chaosGate' } as const })}
      reward={
        <span className="door-row-rewards">
          <span className="row-reward-fixed">
            <FixedRewardChip
              badge={undefined}
              icon={rewardIcon(control.fixedRewardType)}
              name={`Reward: ${control.fixedRewardLabel}`}
            />
          </span>
        </span>
      }
      room={
        'kind' in control && chaos !== undefined ? (
          <ContextualPicker
            ariaLabel={`${control.exitTypeLabel} room`}
            // Locked with the other doors where the room's exit is dormant.
            findingTarget={findingTarget(control.owner, `chaos-room-${room.occurrenceId}`)}
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
      state={{ available: true, picked: control.selected }}
    />
  );
}

/** A note's footnote star, which shows the note on hover or keyboard focus. */
export function NoteMarker({ note }: { readonly note: string }) {
  return (
    <sup
      aria-label="Note"
      className="door-note-symbol"
      role="note"
      tabIndex={0}
      {...hintProps(note, undefined, 'Note')}
    >
      *
    </sup>
  );
}

/** A value a note explains, its footnote star following it. */
export function NoteMarked({
  children,
  note,
}: {
  readonly children: ReactNode;
  readonly note: string | undefined;
}) {
  if (note === undefined) return children;
  return (
    <span className="door-note-marked">
      {children}
      <NoteMarker note={note} />
    </span>
  );
}

/** The pool line: the batch's pool, then what the selected exit counts where that differs. */
export function RewardPoolLine({
  effective,
  effectiveNote,
  fixedLabel,
  label,
  picker,
  poolNote,
}: {
  readonly effective?: WorkspaceEffectiveRewardPool | undefined;
  readonly effectiveNote?: string | undefined;
  /** A pool decided elsewhere, shown as a plain value. */
  readonly fixedLabel?: string | undefined;
  readonly label: string;
  readonly picker?: ReactNode;
  readonly poolNote?: string | undefined;
}) {
  const labelId = useId();
  const effectiveLabelId = useId();
  return (
    <div className="door-pool-line">
      {picker ?? (
        <span aria-labelledby={labelId} className="door-pool-value" role="group">
          <span className="door-pool-label" id={labelId}>
            {label}
          </span>
          {fixedLabel === undefined ? null : (
            <NoteMarked note={poolNote}>
              <FixedValueChip label={fixedLabel} />
            </NoteMarked>
          )}
        </span>
      )}
      {effective === undefined ? null : (
        <span className="door-pool-effective">
          {/* With no pool to change from, the label names the effective pool itself. */}
          {picker === undefined && fixedLabel === undefined ? null : (
            <span aria-hidden="true" className="row-reward-arrow">
              →
            </span>
          )}
          <span className="visually-hidden" id={effectiveLabelId}>
            Effective Pool
          </span>
          <NoteMarked note={effectiveNote}>
            <span aria-labelledby={effectiveLabelId} role="status">
              <FixedValueChip label={effective.label} />
            </span>
          </NoteMarked>
        </span>
      )}
    </div>
  );
}

function BatchSettings({
  interactions,
  noteFor,
  node,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly noteFor: DoorNoteFor;
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
          effectiveNote={noteFor('effective')}
          fixedLabel={node.rewardPool.inherited?.label}
          poolNote={noteFor('pool')}
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

/** The doors' removal. */
export function BatchDoorsRepair({
  interactions,
  node,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly node: BatchNode;
}) {
  const removal =
    node.persistence === 'authored' && node.source.kind === 'occurrence'
      ? requireWorkspaceInteraction(
          interactions.topologyRemovals,
          workspaceInteractionKey(node.owner),
        )
      : undefined;
  const executeIntent = useCommandIntent();
  return (
    <button
      className="text-action"
      data-tone="danger"
      {...(removal === undefined ? {} : { 'data-command': removal.intent.command.kind })}
      disabled={removal === undefined}
      onClick={() => removal === undefined || executeIntent(removal.intent)}
      type="button"
    >
      Reset Doors
    </button>
  );
}

/** The doors' compact state on the Doors open row; each chip names its door on hover. */
export function DoorChips({
  chips,
  label = 'Door summary',
}: {
  readonly chips: readonly DoorChip[];
  /** The list's name: a room's doors, or a Ship wheel's offers. */
  readonly label?: string | undefined;
}) {
  const mapLinks = useRoomMapLinks();
  if (chips.length === 0) return null;
  return (
    <span aria-label={label} className="timeline-door-chips" role="list">
      {chips.map((chip) => (
        <span
          {...mapLinks(doorChipMapLink(chip))}
          {...hintProps(chip.label, undefined, chip.label)}
          aria-label={doorChipName(chip)}
          className="timeline-door-chip"
          data-missing={chip.missing}
          data-unavailable={chip.unavailable || undefined}
          key={chip.key}
          role="listitem"
        >
          <DoorChipFace chip={chip} />
        </span>
      ))}
    </span>
  );
}

function doorChipName(chip: DoorChip): string {
  return chip.locked === true ? `${chip.label} · Locked` : chip.label;
}

/** A door chip's room icon, its rewards' icons and its lock. */
export function DoorChipFace({ chip }: { readonly chip: DoorChip }) {
  return (
    <>
      {chip.roomIcon === undefined ? (
        chip.rewards.length > 0 ? null : (
          <span aria-hidden="true" className="timeline-door-chip-blank">
            ?
          </span>
        )
      ) : (
        <ArtworkIcon className="artwork-label-icon" source={roomKindIcon(chip.roomIcon)} />
      )}
      {chip.rewards.map((icon, index) => (
        <ArtworkIcon className="artwork-label-icon" key={index} source={icon} />
      ))}
      {chip.locked === true ? <DoorLockIndicator /> : null}
    </>
  );
}

/**
 * Door chips to pick one from: clicking a chip picks it; the picked chip is lit
 * and the others dim. The picked chip, or else the first, carries `id` and the
 * pick's finding mark.
 */
export function DoorChipOptions({
  chips,
  disabledHint,
  findingMark,
  id,
  label,
  onPick,
}: {
  readonly chips: readonly (DoorChip & { readonly hint?: string })[];
  /** Disables every chip with this hint. */
  readonly disabledHint?: string | undefined;
  readonly findingMark?: FindingMarkProps;
  readonly id: string;
  readonly label: string;
  readonly onPick: (key: string) => void;
}) {
  const mapLinks = useRoomMapLinks();
  const picked = chips.find((chip) => chip.picked === true);
  const anchor = picked ?? chips.find((chip) => chip.unavailable !== true) ?? chips[0];
  return (
    <span aria-label={label} className="timeline-door-chips" role="group">
      {chips.map((chip) => {
        const disabled = disabledHint !== undefined || chip.unavailable === true;
        const name = doorChipName(chip);
        // The anchor chip takes focus for the pick's findings and carries their mark.
        const mark =
          chip !== anchor || findingMark === undefined || !findingMark['data-has-findings']
            ? undefined
            : findingMark;
        return (
          <button
            {...mapLinks(doorChipMapLink(chip))}
            {...mark}
            {...hintProps(
              disabledHint ?? chip.hint ?? chip.label,
              mark?.['aria-description'],
              name,
            )}
            aria-label={name}
            aria-pressed={chip.picked === true}
            className="timeline-door-chip timeline-door-option"
            data-dimmed={(picked !== undefined && chip.picked !== true) || undefined}
            data-picked={chip.picked || undefined}
            data-unavailable={chip.unavailable || undefined}
            disabled={disabled}
            {...(chip === anchor ? { id } : {})}
            key={chip.key}
            onClick={() => {
              if (chip.picked !== true) onPick(chip.key);
            }}
            type="button"
          >
            <DoorChipFace chip={chip} />
          </button>
        );
      })}
    </span>
  );
}

/** The game's lock on a door that is locked at this point. */
export function DoorLockIndicator() {
  return <img alt="Locked" className="door-lock-indicator" src={roomObjectIcon('doorLock')} />;
}

/**
 * A lockable door's lock as the doors open: lit while locked. Locking the
 * room's first door or unlocking its last is the room's Lock Doors setting.
 */
function DoorLockToggle({
  door,
  index,
  interactions,
  lockedDoors,
}: {
  readonly door: WorkspaceLockedDoors['doors'][number];
  readonly index: number;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly lockedDoors: WorkspaceLockedDoors;
}) {
  const executeIntent = useCommandIntent();
  const interaction = requireWorkspaceInteraction(
    interactions.roomObjectEntries,
    lockedDoors.interactionKey,
  );
  return (
    <IconToggle
      disabled={door.lock !== undefined}
      disabledHint={
        door.lock === undefined
          ? undefined
          : door.lock === 'unreached'
            ? candidateWaitingHint
            : 'A room with a challenge switch never locks.'
      }
      icon={roomObjectIcon('doorLock')}
      name={`Lock Door ${index}`}
      onToggle={() => executeIntent(interaction.intentFor(door.exitKey))}
      pressed={door.locked}
    />
  );
}

/**
 * A batch's doors as the Doors open row's detail: the batch rules, then one
 * row per door. The exit pick and the way on sit on the room's last row.
 */
export function BatchDoorsDetail({
  interactions,
  lockedDoors,
  noteFor,
  node,
  repair,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  /** The room's lockable doors, each toggled on its row. */
  readonly lockedDoors?: WorkspaceLockedDoors | undefined;
  readonly noteFor: DoorNoteFor;
  readonly node: BatchNode;
  /** The doors' repair or removal, where it sits under the doors. */
  readonly repair?: ReactNode;
}) {
  const findingAnchor = useFindingAnchor();
  // Where the doors lie past the plan end every door row is read-only together;
  // the end room's own doors still open inside the plan.
  const locked = useAuthoringLocked(node.owner);
  const lockFor = (exitKey: string, index: number) => {
    const door = lockedDoors?.doors.find((candidate) => candidate.exitKey === exitKey);
    return lockedDoors === undefined || door === undefined ? undefined : (
      <DoorLockToggle
        door={door}
        index={index}
        interactions={interactions}
        lockedDoors={lockedDoors}
      />
    );
  };
  return (
    <section
      aria-label="Door details"
      className="biome-batch-workbench door-workbench timeline-doors-detail"
      data-batch-kind={node.kind}
      data-topology-state={node.topologyState}
      {...findingAnchor(node.owner)}
      tabIndex={-1}
    >
      <div className="door-body" data-authoring-locked={locked || undefined} inert={locked}>
        <div className="door-batch">
          <BatchSettings interactions={interactions} noteFor={noteFor} node={node} />
        </div>
        <DoorRows ariaLabel="Door rows" role="group">
          <DoorRowsHeader {...(repair === undefined ? {} : { action: repair })} />
          {node.targets.map((target) => (
            <TargetRow
              interactions={interactions}
              key={target.exitKey}
              lock={lockFor(target.exitKey, target.index)}
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
                  lock={lockFor(target.exitKey, target.index)}
                  target={target}
                />
              ))}
          {[node.zagreusContract, node.chaos].map((control) =>
            control === undefined ? null : (
              <AdditionalExitRow
                control={control}
                interactions={interactions}
                key={workspaceInteractionKey(control.owner)}
              />
            ),
          )}
        </DoorRows>
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
  planEnd,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly frontier: Extract<WorkspaceAuthoringFrontier, { readonly kind: 'exitDecision' }>;
  readonly planEnd?: WorkspaceRoomPlanEnd | undefined;
}) {
  if (frontier.provisionalBatch === undefined) {
    throw new BiomeWorkspaceContractError(
      'An ordinary exit frontier must provide its provisional door workbench.',
    );
  }
  void planEnd;
  return (
    <BatchDoorsDetail
      interactions={interactions}
      noteFor={() => undefined}
      node={frontier.provisionalBatch}
    />
  );
}

export function AuthoringFrontier({
  frontier,
  interactions,
  planEnd,
}: {
  readonly frontier: WorkspaceAuthoringFrontier;
  readonly interactions: WorkspaceInteractionCatalog;
  /** The plan-end action of the room whose doors this frontier authors. */
  readonly planEnd?: WorkspaceRoomPlanEnd | undefined;
}) {
  switch (frontier.kind) {
    case 'start':
      return <StartFrontier interaction={frontier} interactions={interactions} />;
    case 'exitDecision':
      return <ExitFrontier frontier={frontier} interactions={interactions} planEnd={planEnd} />;
    case 'hubVisit':
    case 'hubOpenSet':
      throw new BiomeWorkspaceContractError(
        'Hub structural frontiers must be rendered by HubDecisionWorkbench.',
      );
  }
}

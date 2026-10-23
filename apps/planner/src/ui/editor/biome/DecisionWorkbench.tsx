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
  type WorkspaceBatchRewardPool,
  type WorkspaceInheritedRewardStore,
  type WorkspaceInteractionCatalog,
  type WorkspaceMarker,
  type WorkspaceMissingPhysicalTarget,
  type WorkspacePhysicalTarget,
  type WorkspaceTakeoverBatchNode,
  type WorkspaceOrdinaryBatchNode,
  type WorkspaceMixedBatchNode,
  type WorkspaceTopologyRemovalInteraction,
} from '@planner/projections/structured-workspace';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { doorArtwork } from '@planner/ui/artwork/doors/doorArtwork';
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
import { useId, type ReactNode } from 'react';
import { RoomMapLauncher } from '@planner/ui/room-maps/RoomMapDialog';
import { CandidatePicker } from './CandidatePicker';
import { AnomalyRoomControl, RevertAnomalyAction } from './room-features/AnomalyControls';
import { RoomSelector } from './RoomSelector';
import { RunStateLauncher } from './RunStateSheet';
import { DoorRewardEditor } from './DoorRewardEditor';
import { BiomeWorkspaceContractError } from './workspaceContract';
import { BiomeEntryPicker } from './BiomeEntryPicker';
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
}: {
  readonly ariaLabel?: string;
  readonly idPrefix: string;
  readonly interactionKey: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly label: string;
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
    />
  );
}

/** One door offer card: selection slot, identity heading, then room and reward rows. */
function ExitCard({
  anchor,
  ariaLabel,
  children,
  className,
  icon,
  kicker,
  map,
  selection,
  state,
  title,
}: {
  readonly anchor?: FindingAnchorProps;
  readonly ariaLabel: string;
  readonly children: ReactNode;
  /** Distinguishes physical door targets from additional exits. */
  readonly className?: string;
  /** The exit's door art, for exits that have one. */
  readonly icon?: string;
  readonly kicker: string;
  readonly map?: { readonly gameName: string; readonly hostId: string; readonly title: string };
  /** The selection radio; absent when the card is not individually selectable. */
  readonly selection?: ReactNode;
  readonly state: {
    readonly available: boolean;
    readonly missing?: boolean;
    readonly picked?: boolean;
    readonly retained?: boolean;
  };
  readonly title: string;
}) {
  return (
    <article
      aria-label={ariaLabel}
      className={className === undefined ? 'exit-row' : `exit-row ${className}`}
      data-available={state.available}
      {...(state.missing === undefined ? {} : { 'data-missing': state.missing })}
      {...(state.picked === undefined ? {} : { 'data-picked': state.picked })}
      {...(state.retained === undefined ? {} : { 'data-retained': state.retained })}
      {...anchor}
      tabIndex={-1}
    >
      {selection ?? <div className="exit-marker" aria-hidden="true" />}
      <div className="exit-content">
        <div className="exit-heading">
          {icon === undefined ? null : <img alt="" className="exit-door-icon" src={icon} />}
          <div>
            <p className="card-kicker">{kicker}</p>
            <h4>{title}</h4>
          </div>
          {map === undefined ? null : (
            <RoomMapLauncher gameName={map.gameName} hostId={map.hostId} title={map.title} />
          )}
        </div>
        {children}
      </div>
    </article>
  );
}

/** A declaration-fixed value shown in a control row's place. */
function FixedFieldRow({
  className,
  label,
  value,
}: {
  readonly className?: string;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className={`field-control field-control-inline${className ? ` ${className}` : ''}`}>
      <span>{label}</span>
      <span className="fixed-room-state">{value}</span>
    </div>
  );
}

function doorKicker(index: number, exitTypeLabel: string | undefined): string {
  return exitTypeLabel === undefined ? `Door ${index}` : `Door ${index} · ${exitTypeLabel}`;
}

/** The repair's projected effect names and styles it; a projected mark owner carries the batch's mark. */
function ExactRepairAction({
  intent,
}: {
  readonly intent: WorkspaceBatchRepairIntent | undefined;
}) {
  const findingTarget = useFindingTarget();
  const executeIntent = useCommandIntent();
  const adds = intent?.effect === 'addMissing';
  return (
    <button
      {...(intent?.markOwner === undefined ? {} : findingTarget(intent.markOwner))}
      className={adds ? 'secondary-action' : 'danger-action'}
      {...(intent === undefined ? {} : { 'data-command': intent.command.kind })}
      disabled={intent === undefined}
      onClick={() => intent === undefined || executeIntent(intent)}
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
  const reservesAnomalyAction = node.targets.some(
    (candidate) =>
      candidate.anomalyTakeover !== undefined || candidate.door.room.anomaly !== undefined,
  );
  const authorsRoom =
    node.targetInteraction === 'replaceable' &&
    door.room.roomPicker !== undefined &&
    door.room.anomaly === undefined;
  return (
    <ExitCard
      {...(authorsRoom ? {} : { anchor: findingAnchor(target.marker.address) })}
      ariaLabel={`${door.room.label} room offer`}
      className="biome-target-row"
      kicker={doorKicker(target.index, target.exitTypeLabel)}
      map={{ gameName: door.room.gameName, hostId: target.marker.focusKey, title: door.room.label }}
      {...(selectionChoice === undefined
        ? {}
        : {
            selection: (
              <label className="picked-control">
                <span className="visually-hidden">{`Pick ${door.room.label} from Door ${target.index}`}</span>
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
              </label>
            ),
          })}
      state={{
        available: target.physicalState === 'available',
        picked: target.selected,
        retained: target.retained,
      }}
      title={door.room.label}
    >
      {authorsRoom && door.room.roomPicker !== undefined ? (
        <TargetRoomSelector
          ariaLabel={`Door ${target.index} room`}
          idPrefix={`target-${target.marker.focusKey}`}
          interactionKey={workspaceInteractionKey(door.room.roomPicker.address)}
          interactions={interactions}
          label="Room"
        />
      ) : null}
      <AnomalyRoomControl room={door.room} />
      <div className="door-reward-slot">
        <DoorRewardEditor
          door={door}
          focusOwner={target.marker.address}
          idPrefix={`door-${target.marker.focusKey}`}
          interactions={interactions}
        />
      </div>
      {reservesAnomalyAction ? (
        <div className="anomaly-door-action-slot">
          {!target.selected || target.anomalyTakeover === undefined ? null : (
            <button
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
          )}
          <RevertAnomalyAction room={door.room} />
        </div>
      ) : null}
    </ExitCard>
  );
}

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
    <ExitCard
      {...(canAuthorRoom ? {} : { anchor: findingAnchor(target.marker.address) })}
      ariaLabel={`Door ${target.index} unspecified room offer`}
      className="biome-target-row"
      kicker={doorKicker(target.index, target.exitTypeLabel)}
      state={{ available: true, missing: true }}
      title="Choose room"
    >
      {canAuthorRoom ? (
        <TargetRoomSelector
          ariaLabel={`Door ${target.index} room`}
          idPrefix={`target-${target.marker.focusKey}`}
          interactionKey={target.marker.focusKey}
          interactions={interactions}
          label="Room"
        />
      ) : target.authoring.kind === 'awaitingPriorExit' ? (
        <div
          aria-live="polite"
          className="field-control field-control-inline pending-room-status control-placeholder"
        >
          <span>Room</span>
          <span className="fixed-room-state">Select the earlier door's room first</span>
        </div>
      ) : null}
      {canAuthorRoom ? (
        <div
          aria-live="polite"
          className="field-control field-control-inline pending-reward-status door-reward-slot control-placeholder"
        >
          <span>Reward</span>
          <span className="fixed-room-state">Choose room to show reward</span>
        </div>
      ) : null}
    </ExitCard>
  );
}

/**
 * An authored additional exit beside the normal doors. Presence lives on the
 * source room; the card owns selection, the destination room, and its fixed reward.
 */
function AdditionalExitCard({
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
  return (
    <ExitCard
      ariaLabel={`${control.exitTypeLabel} exit`}
      {...(doorArtwork[control.exitTypeKey] == null
        ? {}
        : { icon: doorArtwork[control.exitTypeKey]! })}
      kicker={control.exitTypeLabel}
      map={{ gameName: room.gameName, hostId: key, title: room.label }}
      selection={
        <label className="picked-control">
          <span className="visually-hidden">{`Take ${control.exitTypeLabel}`}</span>
          <input
            {...findingMark(selection)}
            aria-label={`Take ${control.exitTypeLabel}`}
            checked={control.selected}
            name={selectionName}
            onChange={() => executeIntent(selectIntent)}
            type="radio"
          />
        </label>
      }
      state={{ available: true, picked: control.selected }}
      title={room.label}
    >
      {'kind' in control && chaos !== undefined ? (
        <ContextualPicker
          id={`chaos-room-${room.occurrenceId}`}
          label="Room"
          layout="inline"
          model={declaredChoicesPicker(
            control.mapChoices.map((choice) => ({ ...choice, key: choice.value })),
            room.gameName,
          )}
          onSelect={(gameName) => executeIntent(chaos.mapIntent(gameName))}
          placeholder="Choose a room"
        />
      ) : (
        <FixedFieldRow className="door-fixed-room" label="Room" value={room.label} />
      )}
      <div className="door-reward-slot">
        <FixedFieldRow
          className="door-fixed-reward"
          label="Reward"
          value={control.fixedRewardLabel}
        />
      </div>
    </ExitCard>
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

/** The ship-decided pool: a fixed value at the picker's height, linking to its wheel. */
function InheritedRewardStoreField({
  inherited,
  nodeKey,
}: {
  readonly inherited: WorkspaceInheritedRewardStore;
  readonly nodeKey: string;
}) {
  const dispatch = useAppDispatch();
  const labelId = useId();
  return (
    <div className="field-control field-control-inline batch-inherited-pool">
      <span id={labelId}>Reward Pool</span>
      <span aria-labelledby={labelId} className="batch-pool-value" role="group">
        <strong>{inherited.label}</strong>
        <span className="batch-pool-value-tag">from ship combat</span>
        <button
          className="semantic-focus-link"
          data-workspace-node={inherited.wheel.focusKey}
          id={`${nodeKey}-inherited-reward-store-wheel`}
          onClick={() => dispatch(semanticOwnerFocused(inherited.wheel.address))}
          type="button"
        >
          Open wheel
        </button>
      </span>
    </div>
  );
}

/** The pool row: the batch's pool beside what the selected exit counts, both always in place. */
function RewardPoolRow({
  nodeKey,
  pool,
  picker,
}: {
  readonly nodeKey: string;
  readonly pool: WorkspaceBatchRewardPool;
  readonly picker: ReactNode;
}) {
  const effectiveLabelId = useId();
  return (
    <div className="batch-reward-pool">
      {picker ??
        (pool.inherited === undefined ? (
          <div aria-hidden="true" className="field-control field-control-inline">
            <span>Reward Pool</span>
            <span className="batch-pool-value" />
          </div>
        ) : (
          <InheritedRewardStoreField inherited={pool.inherited} nodeKey={nodeKey} />
        ))}
      <div className="field-control field-control-inline batch-effective-pool">
        <span id={effectiveLabelId}>Effective Pool</span>
        <span aria-labelledby={effectiveLabelId} className="batch-pool-value" role="status">
          {pool.effective ?? ''}
        </span>
      </div>
    </div>
  );
}

function BatchSettings({
  interactions,
  node,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
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
        <RewardPoolRow
          nodeKey={node.key}
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
          pool={node.rewardPool}
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
              <p className="door-information-note">
                {node.fields.cageTargetCount === 0
                  ? 'No offered room uses the Fields multi-cage count; Max still affects later Fields rolls.'
                  : 'Cage rewards appear bottom to top on the door'}
              </p>
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
  const removal =
    node.persistence === 'authored' && node.source.kind === 'occurrence'
      ? requireWorkspaceInteraction(
          interactions.topologyRemovals,
          workspaceInteractionKey(node.owner),
        )
      : undefined;
  const exitSelection =
    (node.persistence === 'uncommitted' && node.targets.length === 0) ||
    (node.targets.length === 1 && node.zagreusContract === undefined && node.chaos === undefined)
      ? undefined
      : requireWorkspaceInteraction(
          interactions.exitSelections,
          workspaceInteractionKey(node.selection.address),
        );
  return (
    <section
      className="decision-card biome-batch-workbench"
      data-batch-kind={node.kind}
      data-topology-state={node.topologyState}
      {...(node.repairIntent?.markOwner === undefined ? findingAnchor(node.owner) : {})}
      tabIndex={-1}
    >
      <header className="decision-heading">
        <div>
          <p className="card-kicker">{label}</p>
          <h3>Configure door offer</h3>
        </div>
        <div className="owner-markers">
          {node.runState === undefined ? null : <RunStateLauncher launcher={node.runState} />}
        </div>
      </header>
      <BatchSettings interactions={interactions} node={node} />
      <div
        aria-label={`${label} room offers`}
        className="exit-list"
        {...findingAnchor(exitSelectionAddress(node.selection), {
          // Navigation lands on the first door that can still be picked.
          focusTarget: (list) =>
            list.querySelector<HTMLElement>('input[type="radio"]:not(:disabled)'),
        })}
        tabIndex={-1}
        role={exitSelection === undefined ? 'group' : 'radiogroup'}
      >
        {node.targets.map((target) => (
          <TargetRow interactions={interactions} key={target.exitKey} node={node} target={target} />
        ))}
        {node.kind === 'takeoverBatch'
          ? null
          : node.missingTargets.map((target) => (
              <MissingTargetRow interactions={interactions} key={target.exitKey} target={target} />
            ))}
        {[node.zagreusContract, node.chaos].map((control) =>
          control === undefined ? null : (
            <AdditionalExitCard
              control={control}
              interactions={interactions}
              key={workspaceInteractionKey(control.owner)}
              selection={exitSelectionAddress(node.selection)}
              selectionName={`selection-${node.key}`}
            />
          ),
        )}
      </div>
      <div className="workbench-action-row">
        <ExactRepairAction intent={node.repairIntent} />
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

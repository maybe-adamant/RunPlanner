import type { ExitSelectionAddress, TargetAddress } from '@run-planner/engine/authored-project';
import type { RoomDeclaration } from '@run-planner/engine/catalog-schema';

import type { ContextualPickerModel } from '@planner/projections/contextualPicker';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceAuthoringFrontier,
  type WorkspaceBatchRepairIntent,
  type WorkspaceInteractionCatalog,
  type WorkspaceMarker,
  type WorkspaceMissingPhysicalTarget,
  type WorkspacePhysicalTarget,
  type WorkspaceTakeoverBatchInteraction,
  type WorkspaceTakeoverBatchNode,
  type WorkspaceOrdinaryBatchNode,
  type WorkspaceMixedBatchNode,
  type WorkspaceCompletedHubHandoffInteraction,
  type WorkspaceTakeoverRepairInteraction,
  type WorkspaceTopologyRemovalInteraction,
} from '@planner/projections/structured-workspace';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { useAppDispatch } from '@planner/state/store';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';
import { CandidateSelect } from './CandidateSelect';
import { AnomalyIdentityControls, NaturalChaosMapWorkbench } from './OccurrenceWorkbench';
import { RoomSelector } from './RoomSelector';
import { RunStateLauncher } from './RunStateSheet';
import { DoorRewardEditor } from './DoorRewardEditor';
import { BiomeWorkspaceContractError } from './workspaceContract';

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
  const executeIntent = useCommandIntent();
  if (interaction.kind !== 'targetRoom' && interaction.kind !== 'decisionEntryRoom') {
    throw new BiomeWorkspaceContractError(`${interactionKey} is not a target-room interaction.`);
  }
  return (
    <RoomSelector
      {...(ariaLabel === undefined ? {} : { ariaLabel })}
      idPrefix={idPrefix}
      interaction={interaction}
      label={label}
      onSelect={(gameName) => executeIntent(interaction.intentFor(gameName))}
    />
  );
}

function roomStatus(target: WorkspacePhysicalTarget): string {
  if (target.door.room.entered) return 'Door taken';
  if (target.selected) return 'Room selected';
  if (target.physicalState === 'unavailable') return 'Unavailable saved room';
  if (target.retained) return 'Saved room';
  if (target.clockworkReward === 'goal') return 'Clockwork Goal';
  if (target.clockworkReward === 'nonGoal') return 'Clockwork NonGoal';
  return target.nextPath === 'startsCompletion' ? 'Preboss route' : 'Offered room';
}

function ExactRepairAction({ intent }: { readonly intent: WorkspaceBatchRepairIntent }) {
  const executeIntent = useCommandIntent();
  return (
    <button
      className="danger-action"
      data-command={intent.command.kind}
      onClick={() => executeIntent(intent)}
      type="button"
    >
      Remove unavailable doors
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
  readonly interaction: WorkspaceTopologyRemovalInteraction;
  readonly label: string;
}) {
  const executeIntent = useCommandIntent();
  return (
    <div className="topology-removal-action" data-command={interaction.intent.command.kind}>
      <button
        aria-label={accessibleLabel}
        className={`danger-action${compact ? ' action-compact' : ''}`}
        onClick={() => executeIntent(interaction.intent)}
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
  const dispatch = useAppDispatch();
  const selectionInteraction =
    node.targets.length === 1 &&
    node.zagreusContract === undefined &&
    node.naturalChaos === undefined
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
  return (
    <article
      aria-label={`${door.room.label} room offer`}
      className="exit-row biome-target-row"
      data-available={target.physicalState === 'available'}
      data-picked={target.selected}
      data-retained={target.retained}
    >
      {selectionChoice === undefined ? (
        <div className="exit-marker" aria-hidden="true" />
      ) : (
        <label className="picked-control">
          <span className="visually-hidden">{`Pick ${door.room.label} from Door ${target.index}`}</span>
          <input
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
      )}
      <div className="exit-content">
        <div className="exit-heading">
          <div>
            <p className="card-kicker">Door {target.index}</p>
            <h4>{door.room.label}</h4>
          </div>
          <div className="owner-markers">
            <SemanticOwnerMarker address={target.marker.address} />
            <SemanticOwnerMarker address={door.room.address} />
            <span className="neutral-status">{roomStatus(target)}</span>
          </div>
        </div>
        {node.targetInteraction !== 'replaceable' ||
        door.room.roomPicker === undefined ||
        door.room.anomaly !== undefined ? null : (
          <TargetRoomSelector
            ariaLabel={`Door ${target.index} room`}
            idPrefix={`target-${target.marker.focusKey}`}
            interactionKey={workspaceInteractionKey(door.room.roomPicker.address)}
            interactions={interactions}
            label="Room"
          />
        )}
        {node.targetInteraction !== 'readOnly' && target.physicalState === 'unavailable' ? (
          <p className="fixed-room-state">
            This saved door is no longer available here. Fix the earlier route first.
          </p>
        ) : null}
        <div className="door-reward-slot">
          <DoorRewardEditor
            door={door}
            idPrefix={`door-${target.marker.focusKey}`}
            interactions={interactions}
          />
        </div>
        {target.anomalyTakeover === undefined ? null : (
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
        <AnomalyIdentityControls room={door.room} />
      </div>
    </article>
  );
}

function MissingTargetRow({
  interactions,
  target,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly target: WorkspaceMissingPhysicalTarget;
}) {
  const interaction = interactions.rooms.get(target.marker.focusKey);
  const canEnterDecision = interaction?.kind === 'decisionEntryRoom';
  return (
    <article
      aria-label={`Door ${target.index} unspecified room offer`}
      className="exit-row biome-target-row"
      data-available="true"
      data-missing="true"
    >
      <div className="exit-marker" aria-hidden="true" />
      <div className="exit-content">
        <div className="exit-heading">
          <div>
            <p className="card-kicker">Door {target.index}</p>
            <h4>Choose room</h4>
          </div>
          <div className="owner-markers">
            <SemanticOwnerMarker address={target.marker.address} />
            <span className="neutral-status">Unspecified</span>
          </div>
        </div>
        {target.authoring.kind !== 'ready' && !canEnterDecision ? null : (
          <TargetRoomSelector
            ariaLabel={`Door ${target.index} room`}
            idPrefix={`target-${target.marker.focusKey}`}
            interactionKey={target.marker.focusKey}
            interactions={interactions}
            label="Room"
          />
        )}
      </div>
    </article>
  );
}

/** The authored additional exit card owns only selection and room navigation. */
function ZagreusContractExit({
  control,
  interactions,
  selectionName,
}: {
  readonly control: NonNullable<BatchNode['zagreusContract']>;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly selectionName: string;
}) {
  const executeIntent = useCommandIntent();
  const interaction = requireWorkspaceInteraction(
    interactions.zagreusContracts,
    workspaceInteractionKey(control.owner),
  );
  return (
    <article
      aria-label="Zagreus contract exit"
      className="exit-row zagreus-contract-exit"
      data-available="true"
      data-picked={control.selected}
    >
      <label className="picked-control">
        <span className="visually-hidden">Take Zagreus contract</span>
        <input
          aria-label="Take Zagreus contract"
          checked={control.selected}
          name={selectionName}
          onChange={() => executeIntent(interaction.selectIntent)}
          type="radio"
        />
      </label>
      <div className="exit-content">
        <div className="exit-heading">
          <div>
            <p className="card-kicker">Additional exit</p>
            <h4>Zagreus contract</h4>
          </div>
          <div className="owner-markers">
            <SemanticOwnerMarker address={control.owner} />
          </div>
        </div>
        <p className="fixed-room-state additional-exit-room-state">
          Room: {control.door.room.label}
        </p>
      </div>
    </article>
  );
}

/** Natural Chaos keeps its door selection, navigation, and map identity together. */
function NaturalChaosExit({
  control,
  interactions,
  selectionName,
}: {
  readonly control: NonNullable<BatchNode['naturalChaos']>;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly selectionName: string;
}) {
  const executeIntent = useCommandIntent();
  const interaction = requireWorkspaceInteraction(
    interactions.naturalChaosExits,
    workspaceInteractionKey(control.owner),
  );
  return (
    <article
      aria-label="Chaos gate exit"
      className="exit-row zagreus-contract-exit"
      data-available="true"
      data-picked={control.selected}
    >
      <label className="picked-control">
        <span className="visually-hidden">Take Chaos gate</span>
        <input
          aria-label="Take Chaos gate"
          checked={control.selected}
          name={selectionName}
          onChange={() => executeIntent(interaction.selectIntent)}
          type="radio"
        />
      </label>
      <div className="exit-content">
        <div className="exit-heading">
          <div>
            <p className="card-kicker">Additional exit</p>
            <h4>Chaos gate</h4>
          </div>
          <div className="owner-markers">
            <SemanticOwnerMarker address={control.owner} />
          </div>
        </div>
        <NaturalChaosMapWorkbench control={control} interactions={interactions} />
      </div>
    </article>
  );
}

function CompletedHubHandoffAction({
  interaction,
}: {
  readonly interaction: WorkspaceCompletedHubHandoffInteraction;
}): never {
  throw new BiomeWorkspaceContractError(
    `The completed Hub handoff for ${interaction.label} belongs to the Hub workbench cutover.`,
  );
}

function TakeoverRepairAction({
  interaction,
}: {
  readonly interaction: WorkspaceTakeoverRepairInteraction;
}) {
  const executeIntent = useCommandIntent();
  return (
    <section
      className="takeover-action"
      data-action={interaction.action}
      data-presentation={interaction.presentation}
    >
      <div className="owner-markers">
        <h4>Fix Preboss doors</h4>
        <SemanticOwnerMarker address={interaction.owner} />
      </div>
      <p className="fixed-room-state">Fix {interaction.label} to restore the missing doors.</p>
      <button
        className="secondary-action"
        onClick={() => executeIntent(interaction.intent())}
        type="button"
      >
        Fix Preboss doors
      </button>
    </section>
  );
}

function TakeoverAction({
  interaction,
}: {
  readonly interaction: WorkspaceTakeoverBatchInteraction;
}) {
  switch (interaction.presentation) {
    case 'completedHubHandoff':
      return <CompletedHubHandoffAction interaction={interaction} />;
    case 'repair':
      return <TakeoverRepairAction interaction={interaction} />;
  }
}

function SelectedContinuationAction({ node }: { readonly node: BatchNode }) {
  const dispatch = useAppDispatch();
  const continuation = node.selectedContinuation;
  return (
    <button
      className="success-action"
      disabled={continuation === undefined}
      onClick={() => {
        if (continuation !== undefined) {
          dispatch(semanticOwnerFocused(continuation.marker.address));
        }
      }}
      type="button"
    >
      Open next room
    </button>
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
      <div className="batch-controls">
        {store === undefined ? null : (
          <CandidateSelect
            id={`${node.key}-reward-store`}
            interaction={store}
            label="Reward Pool"
            onReplace={(storeKey) => executeIntent(store.intentFor(storeKey))}
            placeholder="Select pool"
          />
        )}
        {node.effectiveRewardStore === undefined ? null : (
          <div className="effective-reward-store" role="status">
            <span>Effective reward pool</span>
            <strong>{node.effectiveRewardStore.label}</strong>
          </div>
        )}
      </div>
      {fields === undefined && node.fields === undefined ? null : (
        <div className="fields-batch-editor">
          {fields === undefined ? null : (
            <CandidateSelect
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
              {node.fields.cageTargetCount === 0 ? (
                <p className="fields-batch-note">
                  No offered room uses the Fields multi-cage count; Max still affects later Fields
                  rolls.
                </p>
              ) : null}
            </>
          )}
        </div>
      )}
    </>
  );
}

/** Renders an ordinary, staged, mixed, or atomic takeover decision from its projection. */
export function BatchWorkbench({
  interactions,
  label,
  node,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly label: string;
  readonly node: BatchNode;
}) {
  const projectedTakeover =
    node.kind === 'takeoverBatch'
      ? requireWorkspaceInteraction(interactions.takeoverBatches, node.takeoverInteractionKey)
      : undefined;
  const takeover =
    projectedTakeover?.presentation === 'repair' &&
    node.targets.every((target) => target.physicalState !== 'unavailable') &&
    node.missingTargets.length === 0
      ? undefined
      : projectedTakeover;
  const removal =
    node.persistence === 'authored'
      ? requireWorkspaceInteraction(
          interactions.topologyRemovals,
          workspaceInteractionKey(node.owner),
        )
      : undefined;
  const exitSelection =
    (node.persistence === 'uncommitted' && node.targets.length === 0) ||
    (node.targets.length === 1 &&
      node.zagreusContract === undefined &&
      node.naturalChaos === undefined)
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
    >
      <header className="decision-heading">
        <div>
          <p className="card-kicker">{label}</p>
          <h3>{node.targets.length === 0 ? 'Choose a room' : 'Choose a room and reward'}</h3>
        </div>
        <div className="owner-markers">
          <SemanticOwnerMarker address={node.owner} />
          <SemanticOwnerMarker address={exitSelectionAddress(node.selection)} />
          {node.runState === undefined ? null : <RunStateLauncher launcher={node.runState} />}
        </div>
      </header>
      <BatchSettings interactions={interactions} node={node} />
      <div
        aria-label={`${label} room offers`}
        className="exit-list"
        role={exitSelection === undefined ? 'group' : 'radiogroup'}
      >
        {node.targets.map((target) => (
          <TargetRow interactions={interactions} key={target.exitKey} node={node} target={target} />
        ))}
        {node.kind === 'takeoverBatch' ? (
          node.missingTargets.length === 0 ? null : (
            <p className="fixed-room-state">Fix Preboss doors to restore the missing doors.</p>
          )
        ) : (
          node.missingTargets.map((target) => (
            <MissingTargetRow interactions={interactions} key={target.exitKey} target={target} />
          ))
        )}
        {node.zagreusContract === undefined ? null : (
          <ZagreusContractExit
            control={node.zagreusContract}
            interactions={interactions}
            selectionName={`selection-${node.key}`}
          />
        )}
        {node.naturalChaos === undefined ? null : (
          <NaturalChaosExit
            control={node.naturalChaos}
            interactions={interactions}
            selectionName={`selection-${node.key}`}
          />
        )}
      </div>
      {takeover === undefined ? null : <TakeoverAction interaction={takeover} />}
      <div className="workbench-action-row">
        {node.repairIntent === undefined ? null : <ExactRepairAction intent={node.repairIntent} />}
        {node.selectedContinuation === undefined ? null : (
          <SelectedContinuationAction node={node} />
        )}
        {removal === undefined ? null : (
          <TopologyRemovalAction interaction={removal} label="Remove these doors" />
        )}
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
  const executeIntent = useCommandIntent();
  const start = requireWorkspaceInteraction(interactions.starts, interaction.interactionKey);
  const candidates = useWorkspaceInteraction(start);
  const empty: ContextualPickerModel<RoomDeclaration> = Object.freeze({
    sections: Object.freeze([]),
  });
  if (start.kind === 'fixed') {
    return (
      <section className="frontier-actions biome-start-frontier">
        <div>
          <p className="card-kicker">Next step</p>
          <h3>Start with {start.fixedLabel}</h3>
          <p>The game fixes the first room.</p>
        </div>
        <SemanticOwnerMarker address={start.owner} />
        <button
          className="primary-action"
          onClick={() => executeIntent(start.intent())}
          type="button"
        >
          Start biome
        </button>
      </section>
    );
  }
  return (
    <section className="frontier-actions biome-start-frontier">
      <div>
        <p className="card-kicker">Next step</p>
        <h3>Choose starting room</h3>
        <SemanticOwnerMarker address={start.owner} />
      </div>
      <ContextualPicker
        id={`${start.key}-start`}
        label="Starting room"
        loading={candidates.pending}
        model={candidates.result ?? empty}
        onOpenChange={(open) => {
          if (open) candidates.activate();
        }}
        onSelect={(room) => {
          executeIntent(start.intentFor(room));
        }}
        placeholder="Select a room"
      />
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

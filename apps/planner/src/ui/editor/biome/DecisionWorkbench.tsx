import type {
  BatchRewardStoreAddress,
  ExitSelectionAddress,
  TargetAddress,
} from '@run-planner/engine/authored-project';
import { createBiomeAddress, createOccurrenceAddress } from '@run-planner/engine/authored-project';
import type { RoomDeclaration } from '@run-planner/engine/catalog-schema';
import { useState } from 'react';

import { presentCandidateLabel } from '../../../projections/candidateProjection';
import type { ContextualPickerModel } from '../../../projections/contextualPicker';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceAuthoringFrontier,
  type WorkspaceBatchRepairScope,
  type WorkspaceInteractionCatalog,
  type WorkspaceLinkedExitNode,
  type WorkspaceMarker,
  type WorkspaceMissingPhysicalTarget,
  type WorkspacePhysicalTarget,
  type WorkspaceTakeoverBatchInteraction,
  type WorkspaceTakeoverReplacementImpact,
  type WorkspaceTakeoverBatchNode,
  type WorkspaceOrdinaryBatchNode,
  type WorkspaceMixedBatchNode,
  type WorkspaceCandidateTakeoverBatchInteraction,
  type WorkspaceCompletedHubHandoffInteraction,
  type WorkspaceDirectTerminalTakeoverInteraction,
  type WorkspaceTakeoverRepairInteraction,
} from '../../../projections/structuredWorkspace';
import { semanticOwnerFocused } from '../../../state/editorSessionSlice';
import { authoredProjectCommandDispatched } from '../../../state/projectWorkspaceSlice';
import { useAppDispatch } from '../../../state/store';
import { allocateOccurrenceId } from '../../../workspace/occurrenceIds';
import { ContextualPicker } from '../../controls/ContextualPicker';
import { useWorkspaceInteraction } from '../../controls/useWorkspaceInteraction';
import { candidateMayBeAuthored, candidateSelectState } from '../../feedback/candidatePresentation';
import { SemanticOwnerMarker } from '../../feedback/EvaluationFeedback';
import { CandidateSelect } from './CandidateSelect';
import { RoomSelector } from './RoomSelector';
import { BiomeWorkspaceContractError } from './workspaceContract';

type BatchNode = WorkspaceOrdinaryBatchNode | WorkspaceMixedBatchNode | WorkspaceTakeoverBatchNode;

function occurrenceAddressFor(
  owner: { readonly routeKey: string; readonly biomeKey: string },
  occurrenceId: ReturnType<typeof allocateOccurrenceId>,
) {
  return createOccurrenceAddress(createBiomeAddress(owner.routeKey, owner.biomeKey), occurrenceId);
}

function targetAddress(target: WorkspacePhysicalTarget): TargetAddress {
  if (target.marker.address.kind !== 'target') {
    throw new BiomeWorkspaceContractError('A physical target must own a target semantic address.');
  }
  return target.marker.address;
}

function exitSelectionAddress(marker: WorkspaceMarker): ExitSelectionAddress {
  if (marker.address.kind !== 'exitSelection') {
    throw new BiomeWorkspaceContractError('A batch selection must own an exit-selection address.');
  }
  return marker.address;
}

function batchRewardStoreAddress(marker: WorkspaceMarker): BatchRewardStoreAddress {
  if (marker.address.kind !== 'batchRewardStore') {
    throw new BiomeWorkspaceContractError(
      'A batch reward-pool interaction must retain its batch-store owner.',
    );
  }
  return marker.address;
}

function roomStatus(target: WorkspacePhysicalTarget): string {
  if (target.physicalState === 'unavailable') return 'Unavailable retained offer';
  if (target.selected) return 'Entered route';
  if (target.retained) return 'Retained authored offer';
  if (target.clockworkReward === 'goal') return 'Clockwork Goal';
  if (target.clockworkReward === 'nonGoal') return 'Clockwork NonGoal';
  return target.nextPath === 'startsCompletion' ? 'Preboss route' : 'Generated offer';
}

function scopeSummary(
  scope: WorkspaceBatchRepairScope | WorkspaceTakeoverReplacementImpact,
  excludedOccurrenceIds: readonly string[] = [],
): string {
  const excluded = new Set(excludedOccurrenceIds);
  const occurrenceCount = scope.removedOccurrenceIds.filter((id) => !excluded.has(id)).length;
  const decisionCount = scope.removedDecisionOwners.length;
  const parts = [
    occurrenceCount === 0
      ? undefined
      : `${occurrenceCount} ${occurrenceCount === 1 ? 'room occurrence' : 'room occurrences'}`,
    decisionCount === 0
      ? undefined
      : `${decisionCount} ${decisionCount === 1 ? 'downstream decision' : 'downstream decisions'}`,
  ].filter((value): value is string => value !== undefined);
  return parts.length === 0 ? 'No authored descendants' : parts.join(' and ');
}

function ExactRepairScope({ scope }: { readonly scope: WorkspaceBatchRepairScope }) {
  const dispatch = useAppDispatch();
  if (scope.command === 'ReconcileTakeoverBatch') {
    return (
      <p className="repair-scope" data-command={scope.command}>
        Repair will reconcile {scopeSummary(scope)} through the projected takeover action.
      </p>
    );
  }
  return (
    <div className="repair-scope" data-command={scope.command}>
      <p>Repair removes {scopeSummary(scope)}.</p>
      <button
        className="secondary-action"
        onClick={() =>
          (() => {
            dispatch(semanticOwnerFocused(scope.owner));
            dispatch(
              authoredProjectCommandDispatched({
                kind: 'ReconcileBatchExitCapacity',
                decision: scope.owner,
              }),
            );
          })()
        }
        type="button"
      >
        Reconcile unavailable exits
      </button>
    </div>
  );
}

function TargetRow({
  interactions,
  target,
  targetInteraction,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly target: WorkspacePhysicalTarget;
  readonly targetInteraction: BatchNode['targetInteraction'];
}) {
  const dispatch = useAppDispatch();
  const address = targetAddress(target);
  const replaceable = targetInteraction === 'replaceable' && target.physicalState === 'available';
  return (
    <article
      className="exit-row biome-target-row"
      data-available={target.physicalState === 'available'}
      data-picked={target.selected}
      data-retained={target.retained}
    >
      <div className="exit-marker" aria-hidden="true" />
      <div className="exit-content">
        <div className="exit-heading">
          <div>
            <p className="card-kicker">Exit {target.index}</p>
            <h4>{target.room.label}</h4>
          </div>
          <div className="owner-markers">
            <SemanticOwnerMarker address={address} />
            <SemanticOwnerMarker address={target.room.address} />
            <span className="neutral-status">{roomStatus(target)}</span>
          </div>
        </div>
        {targetInteraction === 'readOnly' ? (
          <p className="fixed-room-state">This Preboss batch is authored atomically.</p>
        ) : !replaceable ? (
          <p className="fixed-room-state">
            {target.physicalState === 'unavailable'
              ? 'This retained exit is unavailable. Reconcile the projected repair scope first.'
              : 'This exit cannot be replaced.'}
          </p>
        ) : (
          <RoomSelector
            idPrefix={`target-${target.room.occurrenceId}`}
            interactions={interactions}
            label={`Exit ${target.index} room`}
            onSelect={(gameName) =>
              dispatch(
                authoredProjectCommandDispatched({
                  kind: 'ReplaceOccurrenceRoom',
                  occurrence: target.room.address,
                  gameName,
                }),
              )
            }
            owner={address}
          />
        )}
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
  const dispatch = useAppDispatch();
  return (
    <article className="exit-row biome-target-row" data-available="true" data-missing="true">
      <div className="exit-marker" aria-hidden="true" />
      <div className="exit-content">
        <div className="exit-heading">
          <div>
            <p className="card-kicker">Exit {target.index}</p>
            <h4>Choose room</h4>
          </div>
          <div className="owner-markers">
            <SemanticOwnerMarker address={target.owner} />
            <span className="neutral-status">Unspecified</span>
          </div>
        </div>
        {target.authoring.kind === 'ready' ? (
          <RoomSelector
            idPrefix={`target-${target.marker.focusKey}`}
            interactions={interactions}
            label={`Exit ${target.index} room`}
            onSelect={(gameName) => {
              const occurrenceId = allocateOccurrenceId();
              dispatch(
                authoredProjectCommandDispatched({
                  kind: 'CreateTarget',
                  target: target.owner,
                  occurrenceId,
                  gameName,
                }),
              );
              dispatch(semanticOwnerFocused(occurrenceAddressFor(target.owner, occurrenceId)));
            }}
            owner={target.owner}
          />
        ) : (
          <label className="field-control" htmlFor={`target-${target.marker.focusKey}-waiting`}>
            <span>{`Exit ${target.index} room`}</span>
            <select disabled id={`target-${target.marker.focusKey}-waiting`} value="">
              <option value="">{target.authoring.message}</option>
            </select>
          </label>
        )}
      </div>
    </article>
  );
}

function ExitSelectionControl({
  interactions,
  node,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly node: BatchNode;
}) {
  const dispatch = useAppDispatch();
  const interaction = interactions.exitSelections.get(
    workspaceInteractionKey(node.selection.address),
  );
  if (interaction === undefined) {
    return (
      <p className="fixed-room-state">
        {node.targets.some((target) => target.selected)
          ? 'The entered exit is derived by this batch.'
          : 'This batch awaits its declaration-owned selection.'}
      </p>
    );
  }
  const selection = exitSelectionAddress(node.selection);
  return (
    <fieldset className="exit-selection-control">
      <legend>
        Entered exit <SemanticOwnerMarker address={selection} />
      </legend>
      {interaction.targets.map((choice) => {
        const target = node.targets.find((candidate) => candidate.exitKey === choice.value);
        const unavailable = target?.physicalState === 'unavailable';
        return (
          <label key={choice.value}>
            <input
              checked={interaction.selectedExitKey === choice.value}
              disabled={unavailable}
              name={`selection-${node.key}`}
              onChange={() =>
                dispatch(
                  authoredProjectCommandDispatched({
                    kind: 'SetExitSelection',
                    selection,
                    value: { kind: 'normal', exitKey: choice.value },
                  }),
                )
              }
              type="radio"
            />
            {`Exit ${choice.value.replace(/^exit/, '')}`}
          </label>
        );
      })}
    </fieldset>
  );
}

function TakeoverImpact({
  impact,
}: {
  readonly impact: WorkspaceTakeoverReplacementImpact | undefined;
}) {
  return impact === undefined ? null : (
    <p className="repair-scope" data-command={impact.command}>
      This replacement removes {scopeSummary(impact, impact.replacedOccurrenceIds)} and resets{' '}
      {impact.replacedOccurrenceIds.length}{' '}
      {impact.replacedOccurrenceIds.length === 1 ? 'physical target' : 'physical targets'}.
    </p>
  );
}

function CandidateTakeoverAction({
  interaction,
}: {
  readonly interaction: WorkspaceCandidateTakeoverBatchInteraction;
}) {
  const dispatch = useAppDispatch();
  const candidates = useWorkspaceInteraction(interaction);
  const [selectionGameName, setSelectionGameName] = useState<string | undefined>(
    interaction.selected?.gameName,
  );
  const selectedGameName = selectionGameName ?? interaction.selected?.gameName;
  const selected = candidates.result?.find(
    (candidate) => candidate.value.gameName === selectedGameName,
  );
  const selectedIsLoaded =
    interaction.selected !== undefined &&
    candidates.result?.some(
      (candidate) => candidate.value.gameName === interaction.selected?.gameName,
    );
  const selectedCanApply =
    selected?.evaluation.kind === 'takeoverPrebossBatch' &&
    selected.evaluation.result.selectedPossible;

  const apply = (): void => {
    if (candidates.result === undefined) {
      candidates.activate();
      return;
    }
    if (!selectedCanApply) return;
    dispatch(semanticOwnerFocused(interaction.owner));
    dispatch(authoredProjectCommandDispatched(interaction.commandFor(selected.value)));
  };

  const title =
    interaction.action === 'create'
      ? 'Create Preboss batch'
      : interaction.action === 'replace'
        ? 'Replace with Preboss batch'
        : 'Repair Preboss batch';

  return (
    <section
      className="takeover-action"
      data-action={interaction.action}
      data-presentation={interaction.presentation}
    >
      <div className="owner-markers">
        <h4>{title}</h4>
        <SemanticOwnerMarker address={interaction.owner} />
      </div>
      <TakeoverImpact impact={interaction.impact} />
      <label className="field-control" htmlFor={`${interaction.key}-takeover`}>
        <span>Preboss declaration</span>
        <select
          {...candidateSelectState(selected)}
          aria-busy={candidates.pending || undefined}
          id={`${interaction.key}-takeover`}
          onChange={(event) => {
            const choice = candidates.result?.find(
              (candidate) => candidate.value.gameName === event.target.value,
            );
            if (choice !== undefined && candidateMayBeAuthored(choice)) {
              setSelectionGameName(choice.value.gameName);
            }
          }}
          onFocus={candidates.activate}
          onPointerDown={candidates.activate}
          value={selectedGameName ?? ''}
        >
          <option disabled value="">
            Select Preboss batch
          </option>
          {interaction.selected === undefined || selectedIsLoaded ? null : (
            <option value={interaction.selected.gameName}>{interaction.selected.label}</option>
          )}
          {candidates.result?.map((candidate) => {
            const retainsImpossibleValue =
              selectedGameName === candidate.value.gameName && !candidateMayBeAuthored(candidate);
            if (!candidateMayBeAuthored(candidate) && !retainsImpossibleValue) return null;
            return (
              <option
                disabled={retainsImpossibleValue}
                key={candidate.value.gameName}
                value={candidate.value.gameName}
                {...candidateSelectState(candidate)}
              >
                {presentCandidateLabel(candidate.value.label, candidate)}
              </option>
            );
          })}
        </select>
      </label>
      <button
        className="secondary-action"
        disabled={candidates.result !== undefined && !selectedCanApply}
        onClick={apply}
        type="button"
      >
        {candidates.result === undefined ? 'Evaluate Preboss batches' : title}
      </button>
    </section>
  );
}

function DirectTerminalTakeoverAction({
  interaction,
}: {
  readonly interaction: WorkspaceDirectTerminalTakeoverInteraction;
}) {
  const dispatch = useAppDispatch();
  const [message, setMessage] = useState<string | undefined>();
  return (
    <section
      className="takeover-action"
      data-action={interaction.action}
      data-presentation={interaction.presentation}
    >
      <div className="owner-markers">
        <h4>Go to Preboss</h4>
        <SemanticOwnerMarker address={interaction.owner} />
      </div>
      <TakeoverImpact impact={interaction.impact} />
      <p className="fixed-room-state">{interaction.summary}</p>
      {message === undefined ? null : <p className="candidate-explanation">{message}</p>}
      <button
        className="secondary-action"
        onClick={() => {
          const result = interaction.execute();
          if (result.kind === 'unavailable') {
            setMessage(result.message);
            return;
          }
          dispatch(semanticOwnerFocused(interaction.owner));
          dispatch(authoredProjectCommandDispatched(result.command));
        }}
        type="button"
      >
        Go to Preboss
      </button>
    </section>
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
  const dispatch = useAppDispatch();
  return (
    <section
      className="takeover-action"
      data-action={interaction.action}
      data-presentation={interaction.presentation}
    >
      <div className="owner-markers">
        <h4>Repair Preboss batch</h4>
        <SemanticOwnerMarker address={interaction.owner} />
      </div>
      <p className="fixed-room-state">
        Reconcile {interaction.label} against the current declaration-owned exits.
      </p>
      <button
        className="secondary-action"
        onClick={() => {
          dispatch(semanticOwnerFocused(interaction.owner));
          dispatch(authoredProjectCommandDispatched(interaction.execute()));
        }}
        type="button"
      >
        Repair Preboss batch
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
    case 'candidate':
      // A tentative declaration belongs to this decision only.  Re-keying the
      // chooser prevents a selection made for one ordinary batch from being
      // carried to another batch when the focused inspector changes.
      return <CandidateTakeoverAction interaction={interaction} key={interaction.key} />;
    case 'directTerminal':
      return <DirectTerminalTakeoverAction interaction={interaction} />;
    case 'completedHubHandoff':
      return <CompletedHubHandoffAction interaction={interaction} />;
    case 'repair':
      return <TakeoverRepairAction interaction={interaction} />;
  }
}

function BatchSettings({
  interactions,
  node,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly node: BatchNode;
}) {
  const dispatch = useAppDispatch();
  const store =
    node.rewardStore === undefined
      ? undefined
      : interactions.batchRewardStores.get(workspaceInteractionKey(node.rewardStore.address));
  const fields = interactions.fieldsCageOutcomes.get(workspaceInteractionKey(node.owner));
  return (
    <div className="batch-controls">
      {store === undefined ? null : (
        <CandidateSelect
          id={`${node.key}-reward-store`}
          interaction={store}
          label="Reward pool"
          onReplace={(storeKey) => {
            const rewardStore = batchRewardStoreAddress(node.rewardStore!);
            dispatch(
              authoredProjectCommandDispatched({
                kind: 'ReplaceBatchRewardStore',
                rewardStore,
                storeKey,
              }),
            );
          }}
          placeholder="Select pool"
        />
      )}
      {fields === undefined ? null : (
        <CandidateSelect
          id={`${node.key}-fields-roll`}
          interaction={fields}
          label="Fields door roll"
          onReplace={(cageOutcome) =>
            dispatch(
              authoredProjectCommandDispatched({
                kind: 'ReplaceFieldsCageOutcome',
                decision: node.owner,
                cageOutcome,
              }),
            )
          }
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
  );
}

/** Renders an ordinary, staged, mixed, or atomic takeover decision from its projection. */
export function BatchWorkbench({
  interactions,
  node,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly node: BatchNode;
}) {
  const projectedTakeover =
    node.kind === 'takeoverBatch'
      ? requireWorkspaceInteraction(interactions.takeoverBatches, node.takeoverInteractionKey)
      : interactions.takeoverBatches.get(workspaceInteractionKey(node.owner));
  const takeover =
    projectedTakeover?.presentation === 'repair' &&
    node.repairScope === undefined &&
    node.missingTargets.length === 0
      ? undefined
      : projectedTakeover;
  return (
    <section
      className="decision-card biome-batch-workbench"
      data-batch-kind={node.kind}
      data-topology-state={node.topologyState}
    >
      <header className="decision-heading">
        <div>
          <p className="card-kicker">
            {node.kind === 'takeoverBatch'
              ? 'Atomic Preboss batch'
              : node.kind === 'mixedBatch'
                ? 'Mixed normal batch'
                : 'Normal batch'}
          </p>
          <h3>{node.targets.length === 0 ? 'Configure physical exits' : 'Generated exits'}</h3>
        </div>
        <div className="owner-markers">
          <SemanticOwnerMarker address={node.owner} />
          <span className="neutral-status">{node.topologyState}</span>
        </div>
      </header>
      <BatchSettings interactions={interactions} node={node} />
      <ExitSelectionControl interactions={interactions} node={node} />
      <div className="exit-list">
        {node.targets.map((target) => (
          <TargetRow
            interactions={interactions}
            key={target.exitKey}
            target={target}
            targetInteraction={node.targetInteraction}
          />
        ))}
        {node.kind === 'takeoverBatch' ? (
          node.missingTargets.length === 0 ? null : (
            <p className="fixed-room-state">
              Missing Preboss exits are repaired atomically through the projected Preboss action.
            </p>
          )
        ) : (
          node.missingTargets.map((target) => (
            <MissingTargetRow interactions={interactions} key={target.exitKey} target={target} />
          ))
        )}
      </div>
      {node.repairScope === undefined ? null : <ExactRepairScope scope={node.repairScope} />}
      {takeover === undefined ? null : <TakeoverAction interaction={takeover} />}
    </section>
  );
}

export function LinkedExitWorkbench({ node }: { readonly node: WorkspaceLinkedExitNode }) {
  return (
    <section className="decision-card linked-exit-workbench">
      <header className="decision-heading">
        <div>
          <p className="card-kicker">Linked exit</p>
          <h3>{node.target.room.label}</h3>
        </div>
        <div className="owner-markers">
          <SemanticOwnerMarker address={node.owner} />
          <SemanticOwnerMarker address={targetAddress(node.target)} />
        </div>
      </header>
      <p className="fixed-room-state">
        This declaration-owned exit is linked to its fixed room; there is no room selector.
      </p>
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
  const dispatch = useAppDispatch();
  const start = requireWorkspaceInteraction(interactions.starts, interaction.interactionKey);
  const candidates = useWorkspaceInteraction(start);
  const empty: ContextualPickerModel<RoomDeclaration> = Object.freeze({
    sections: Object.freeze([]),
  });
  if (start.kind === 'fixed') {
    return (
      <section className="frontier-actions biome-start-frontier">
        <div>
          <p className="card-kicker">Active frontier</p>
          <h3>Start with {start.fixedLabel}</h3>
          <p>This start room is declaration-fixed.</p>
        </div>
        <button
          className="primary-action"
          onClick={() => {
            const occurrenceId = allocateOccurrenceId();
            dispatch(
              authoredProjectCommandDispatched({
                kind: 'CreateStart',
                biome: start.owner,
                occurrenceId,
              }),
            );
            dispatch(semanticOwnerFocused(occurrenceAddressFor(start.owner, occurrenceId)));
          }}
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
        <p className="card-kicker">Active frontier</p>
        <h3>Choose starting room</h3>
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
          const occurrenceId = allocateOccurrenceId();
          dispatch(
            authoredProjectCommandDispatched({
              kind: 'CreateStart',
              biome: start.owner,
              occurrenceId,
              gameName: room.gameName,
            }),
          );
          dispatch(semanticOwnerFocused(occurrenceAddressFor(start.owner, occurrenceId)));
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
  const dispatch = useAppDispatch();
  const structural = interactions.structural.get(frontier.interactionKey);
  const takeover = interactions.takeoverBatches.get(frontier.interactionKey);
  return (
    <section className="frontier-actions biome-exit-frontier">
      <div>
        <p className="card-kicker">Active frontier</p>
        <h3>Continue from this room</h3>
        <SemanticOwnerMarker address={frontier.owner} />
      </div>
      <div className="frontier-buttons">
        {structural?.action === 'createBatch' ? (
          <button
            className="primary-action"
            onClick={() => {
              dispatch(semanticOwnerFocused(structural.owner));
              dispatch(
                authoredProjectCommandDispatched({
                  kind: 'CreateBatch',
                  decision: structural.owner,
                }),
              );
            }}
            type="button"
          >
            Add normal exits
          </button>
        ) : null}
        {structural?.action === 'createLinkedExit' ? (
          <button
            className="primary-action"
            onClick={() => {
              const occurrenceId = allocateOccurrenceId();
              dispatch(
                authoredProjectCommandDispatched({
                  kind: 'CreateLinkedExit',
                  decision: structural.owner,
                  occurrenceId,
                }),
              );
              dispatch(semanticOwnerFocused(occurrenceAddressFor(structural.owner, occurrenceId)));
            }}
            type="button"
          >
            Create linked exit
          </button>
        ) : null}
        {takeover === undefined ? null : <TakeoverAction interaction={takeover} />}
      </div>
    </section>
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
    case 'hubDecision':
    case 'hubVisit':
      throw new BiomeWorkspaceContractError(
        'Hub authoring belongs to the Hub workspace cutover, not the shared non-Hub workbench.',
      );
  }
}

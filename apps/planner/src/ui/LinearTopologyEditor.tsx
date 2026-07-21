import type {
  BiomeAddress,
  BiomeProjectEvaluation,
  CanonicalBatchState,
  Catalog,
  LinearBatchContinuation,
  LinearBiomeTopology,
  LinearTargetReference,
  LinearTerminalContinuation,
  OccurrenceId,
  RoomDeclaration,
  RoomOccurrence,
} from '@run-planner/core';
import {
  createBatchRewardStoreAddress,
  createContinuationAddress,
  createOccurrenceAddress,
  createPickedAddress,
  createTargetAddress,
  projectLinearBatchState,
} from '@run-planner/core';

import {
  presentCandidateLabel,
  type CandidateProjectionService,
} from '../application/candidateProjection';
import { allocateOccurrenceId } from '../application/occurrenceIds';
import { authoredProjectCommandDispatched } from '../application/projectWorkspaceSlice';
import { selectPresentProject, useAppDispatch, useAppSelector } from '../application/store';
import { candidateSelectState } from './candidatePresentation';
import { SemanticOwnerMarker } from './EvaluationFeedback';
import { RoomSelector } from './RoomSelector';
import { RoomStateEditor } from './RoomStateEditor';

interface LinearTopologyEditorProps {
  readonly biome: BiomeAddress;
  readonly candidateProjection: CandidateProjectionService;
  readonly catalog: Catalog;
  readonly evaluation: BiomeProjectEvaluation | undefined;
  readonly topology: LinearBiomeTopology;
}

interface BatchEditorProps extends LinearTopologyEditorProps {
  readonly canCreateTarget: boolean;
  readonly canReplaceWithTerminal: boolean;
  readonly continuation: LinearBatchContinuation;
}

interface TerminalEditorProps extends LinearTopologyEditorProps {
  readonly canReplaceWithBatch: boolean;
  readonly continuation: LinearTerminalContinuation;
}

function occurrence(topology: LinearBiomeTopology, occurrenceId: OccurrenceId): RoomOccurrence {
  const value = topology.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
  if (value === undefined) {
    throw new Error(`Occurrence ${occurrenceId} is missing`);
  }
  return value;
}

function declaration(catalog: Catalog, room: RoomOccurrence): RoomDeclaration {
  const value = catalog.rooms.byKey[room.gameName];
  if (value === undefined) {
    throw new Error(`Room declaration ${room.gameName} is missing`);
  }
  return value;
}

function generatedExitIndexes(room: RoomDeclaration): readonly number[] {
  return room.exits.map((exit) => exit.index).sort((left, right) => left - right);
}

function terminalOccurrenceIds(room: RoomDeclaration): readonly OccurrenceId[] {
  return generatedExitIndexes(room).map(() => allocateOccurrenceId());
}

function confirmDestructive(message: string): boolean {
  return globalThis.confirm(message);
}

function fieldsCageOutcome(value: string): 'min' | 'max' {
  if (value !== 'min' && value !== 'max') {
    throw new Error(`Unknown Fields cage outcome ${value}`);
  }
  return value;
}

function OrdinaryTargetEditor({
  available,
  biome,
  candidateProjection,
  catalog,
  canCreateTarget,
  continuation,
  exitIndex,
  projectedBatchState,
  target,
  topology,
}: LinearTopologyEditorProps & {
  readonly available: boolean;
  readonly canCreateTarget: boolean;
  readonly continuation: LinearBatchContinuation;
  readonly exitIndex: number;
  readonly projectedBatchState: CanonicalBatchState;
  readonly target: LinearTargetReference | undefined;
}) {
  const dispatch = useAppDispatch();
  const idPrefix = `decision-${continuation.parentOccurrenceId}-exit-${exitIndex}`;

  if (target === undefined) {
    return (
      <div className="exit-row" data-available={available}>
        <div className="exit-marker" aria-hidden="true" />
        <div className="exit-content">
          <div className="exit-heading">
            <h4>Exit {exitIndex}</h4>
            <div className="owner-markers">
              <SemanticOwnerMarker
                address={createTargetAddress(biome, continuation.parentOccurrenceId, exitIndex)}
              />
              <span className="neutral-status">Unspecified</span>
            </div>
          </div>
          <RoomSelector
            biomeKey={biome.biomeKey}
            candidateProjection={candidateProjection}
            catalog={catalog}
            disabled={!canCreateTarget}
            idPrefix={idPrefix}
            onSelect={(gameName) =>
              dispatch(
                authoredProjectCommandDispatched({
                  kind: 'CreateTarget',
                  target: createTargetAddress(biome, continuation.parentOccurrenceId, exitIndex),
                  occurrenceId: allocateOccurrenceId(),
                  gameName,
                }),
              )
            }
            target={createTargetAddress(biome, continuation.parentOccurrenceId, exitIndex)}
          />
        </div>
      </div>
    );
  }

  const room = occurrence(topology, target.occurrenceId);
  const roomDeclaration = declaration(catalog, room);
  return (
    <div className="exit-row" data-available={available}>
      <label className="picked-control">
        <input
          checked={continuation.pickedExitIndex === exitIndex}
          disabled={!available}
          name={`picked-${continuation.parentOccurrenceId}`}
          onChange={() =>
            dispatch(
              authoredProjectCommandDispatched({
                kind: 'SetPicked',
                picked: createPickedAddress(biome, continuation.parentOccurrenceId),
                exitIndex,
              }),
            )
          }
          type="radio"
        />
        <span className="visually-hidden">Pick exit {exitIndex}</span>
      </label>
      <div className="exit-content">
        <div className="exit-heading">
          <div>
            <p className="card-kicker">Exit {exitIndex}</p>
            <h4>{roomDeclaration.label}</h4>
          </div>
          <div className="owner-markers">
            <SemanticOwnerMarker
              address={createTargetAddress(biome, continuation.parentOccurrenceId, exitIndex)}
            />
            <SemanticOwnerMarker address={createOccurrenceAddress(biome, room.occurrenceId)} />
            <span className="neutral-status">
              {available ? roomDeclaration.kind : 'Unavailable'}
            </span>
          </div>
        </div>
        <RoomSelector
          biomeKey={biome.biomeKey}
          candidateProjection={candidateProjection}
          catalog={catalog}
          current={roomDeclaration}
          idPrefix={idPrefix}
          onSelect={(gameName) =>
            dispatch(
              authoredProjectCommandDispatched({
                kind: 'ReplaceOccurrenceRoom',
                occurrence: createOccurrenceAddress(biome, room.occurrenceId),
                gameName,
              }),
            )
          }
          target={createTargetAddress(biome, continuation.parentOccurrenceId, exitIndex)}
        />
        <RoomStateEditor
          {...(room.state.kind === 'fieldsCombat' && projectedBatchState.kind === 'fields'
            ? { activeCageCount: projectedBatchState.activeCageCount }
            : {})}
          biome={biome}
          candidateProjection={candidateProjection}
          catalog={catalog}
          occurrence={room}
        />
      </div>
    </div>
  );
}

function BatchEditor({
  biome,
  candidateProjection,
  canCreateTarget,
  canReplaceWithTerminal,
  catalog,
  continuation,
  evaluation,
  topology,
}: BatchEditorProps) {
  const dispatch = useAppDispatch();
  const project = useAppSelector(selectPresentProject);
  const parent = occurrence(topology, continuation.parentOccurrenceId);
  const parentRoom = declaration(catalog, parent);
  const layout = catalog.biomeLayouts.byKey[biome.biomeKey];
  if (layout === undefined) {
    throw new Error(`Biome layout ${biome.biomeKey} is missing`);
  }
  if (layout.kind !== 'LinearBiome') {
    throw new Error(`${biome.biomeKey} is not a linear biome`);
  }
  const projectedBatchState = projectLinearBatchState(catalog, biome, topology, continuation);
  const availableExitIndexes = generatedExitIndexes(parentRoom);
  const available = new Set(availableExitIndexes);
  const exitIndexes = [
    ...new Set([...availableExitIndexes, ...continuation.targets.map((t) => t.exitIndex)]),
  ].sort((left, right) => left - right);
  const unavailableTargets = continuation.targets.filter(
    (target) => !available.has(target.exitIndex),
  );
  const pickedAvailable =
    continuation.pickedExitIndex === null || available.has(continuation.pickedExitIndex);
  const address = createContinuationAddress(biome, continuation.parentOccurrenceId);
  const rewardStoreAddress = createBatchRewardStoreAddress(biome, continuation.parentOccurrenceId);
  const rewardStorePolicy = layout.continuation.rewardStorePolicy;
  const projectedStores =
    continuation.rewardStore.kind === 'authoredBaseStore' &&
    rewardStorePolicy.kind === 'authoredBaseStore'
      ? candidateProjection.batchRewardStores(
          project,
          rewardStoreAddress,
          rewardStorePolicy.storeKeys,
        )
      : Object.freeze([]);
  const selectedStore = projectedStores.find(
    (option) =>
      continuation.rewardStore.kind === 'authoredBaseStore' &&
      option.value === continuation.rewardStore.baseRewardStoreKey,
  );
  const fieldsSupport =
    evaluation?.completion === 'complete'
      ? evaluation.roomGeneration.fieldsCageOutcomes.find(
          (entry) => entry.origin.parentOccurrenceId === continuation.parentOccurrenceId,
        )
      : undefined;
  const projectedFieldsOutcomes =
    projectedBatchState.kind === 'fields' && continuation.batchState !== null
      ? candidateProjection.fieldsCageOutcomes(project, address, ['min', 'max'])
      : Object.freeze([]);
  const selectedFieldsOutcome = projectedFieldsOutcomes.find(
    (option) =>
      continuation.batchState !== null && option.value === continuation.batchState.cageOutcome,
  );

  return (
    <section className="decision-card">
      <header className="decision-heading">
        <div>
          <p className="card-kicker">Decision</p>
          <h3>Doors from {parentRoom.label}</h3>
        </div>
        <div className="owner-markers">
          <SemanticOwnerMarker address={address} />
          <SemanticOwnerMarker
            address={createPickedAddress(biome, continuation.parentOccurrenceId)}
          />
          <span className="neutral-status">
            {continuation.pickedExitIndex === null
              ? 'No picked exit'
              : `Exit ${continuation.pickedExitIndex} picked`}
          </span>
        </div>
      </header>

      {continuation.rewardStore.kind === 'authoredBaseStore' && (
        <label
          className="field-control batch-reward-store"
          htmlFor={`batch-${continuation.parentOccurrenceId}-reward-store`}
        >
          <span className="field-label-with-marker">
            Reward pool
            <SemanticOwnerMarker address={rewardStoreAddress} />
          </span>
          <select
            {...candidateSelectState(selectedStore)}
            id={`batch-${continuation.parentOccurrenceId}-reward-store`}
            onChange={(event) =>
              dispatch(
                authoredProjectCommandDispatched({
                  kind: 'ReplaceBatchRewardStore',
                  rewardStore: rewardStoreAddress,
                  storeKey: event.target.value,
                }),
              )
            }
            value={continuation.rewardStore.baseRewardStoreKey}
          >
            {projectedStores.map((option) => (
              <option key={option.value} value={option.value} {...candidateSelectState(option)}>
                {presentCandidateLabel(
                  option.value === 'RunProgress' ? 'Run Progress' : 'Meta Progress',
                  option,
                )}
              </option>
            ))}
          </select>
        </label>
      )}

      {projectedBatchState.kind === 'fields' && continuation.batchState !== null && (
        <div className="fields-batch-editor">
          <label
            className="field-control"
            htmlFor={`batch-${continuation.parentOccurrenceId}-cage-outcome`}
          >
            <span>Fields cage outcome</span>
            <select
              {...candidateSelectState(selectedFieldsOutcome)}
              aria-label="Fields cage outcome"
              id={`batch-${continuation.parentOccurrenceId}-cage-outcome`}
              onChange={(event) =>
                dispatch(
                  authoredProjectCommandDispatched({
                    kind: 'ReplaceFieldsCageOutcome',
                    continuation: address,
                    cageOutcome: fieldsCageOutcome(event.target.value),
                  }),
                )
              }
              value={continuation.batchState.cageOutcome}
            >
              {projectedFieldsOutcomes.map((option) => (
                <option key={option.value} value={option.value} {...candidateSelectState(option)}>
                  {presentCandidateLabel(option.value === 'min' ? 'Min' : 'Max', option)}
                </option>
              ))}
            </select>
          </label>
          <dl className="fields-batch-summary">
            <div>
              <dt>Active cages</dt>
              <dd>
                {projectedBatchState.activeCageCount} / {projectedBatchState.batchCapacity}
              </dd>
            </div>
            <div>
              <dt>Prior Max outcomes</dt>
              <dd>
                {fieldsSupport === undefined
                  ? 'Unavailable'
                  : `${fieldsSupport.fieldsMaxDoorsRolled} / ${fieldsSupport.maxDoorCageCeiling}`}
              </dd>
            </div>
          </dl>
        </div>
      )}

      <div className="exit-list">
        {exitIndexes.map((exitIndex) => (
          <OrdinaryTargetEditor
            available={available.has(exitIndex)}
            biome={biome}
            candidateProjection={candidateProjection}
            canCreateTarget={canCreateTarget}
            catalog={catalog}
            continuation={continuation}
            evaluation={evaluation}
            exitIndex={exitIndex}
            key={exitIndex}
            projectedBatchState={projectedBatchState}
            target={continuation.targets.find((target) => target.exitIndex === exitIndex)}
            topology={topology}
          />
        ))}
      </div>

      <footer className="structural-actions">
        {unavailableTargets.length > 0 && (
          <button
            disabled={!pickedAvailable}
            onClick={() => {
              if (!confirmDestructive('Remove every unavailable exit and its room state?')) {
                return;
              }
              dispatch(
                authoredProjectCommandDispatched({
                  kind: 'ReconcileExitCapacity',
                  continuation: address,
                }),
              );
            }}
            type="button"
          >
            Remove Unavailable Exits
          </button>
        )}
        <button
          disabled={!canReplaceWithTerminal}
          onClick={() => {
            if (
              !confirmDestructive('Replace this decision and all downstream rooms with Preboss?')
            ) {
              return;
            }
            dispatch(
              authoredProjectCommandDispatched({
                kind: 'ReplaceWithTerminalTransition',
                continuation: address,
                targetOccurrenceIds: terminalOccurrenceIds(parentRoom),
              }),
            );
          }}
          type="button"
        >
          Replace With Preboss
        </button>
        <button
          className="danger-action"
          onClick={() => {
            if (!confirmDestructive('Remove this decision and every downstream room?')) {
              return;
            }
            dispatch(
              authoredProjectCommandDispatched({ kind: 'RemoveBatch', continuation: address }),
            );
          }}
          type="button"
        >
          Remove From Here
        </button>
      </footer>
    </section>
  );
}

function TerminalEditor({
  biome,
  candidateProjection,
  canReplaceWithBatch,
  catalog,
  continuation,
  topology,
}: TerminalEditorProps) {
  const dispatch = useAppDispatch();
  const parent = occurrence(topology, continuation.parentOccurrenceId);
  const parentRoom = declaration(catalog, parent);
  const availableExitIndexes = generatedExitIndexes(parentRoom);
  const available = new Set(availableExitIndexes);
  const unavailableTargets = continuation.targets.filter(
    (target) => !available.has(target.exitIndex),
  );
  const exitIndexes = [
    ...new Set([
      ...availableExitIndexes,
      ...continuation.targets.map((target) => target.exitIndex),
    ]),
  ].sort((left, right) => left - right);
  const pickedAvailable =
    continuation.pickedExitIndex === null || available.has(continuation.pickedExitIndex);
  const address = createContinuationAddress(biome, continuation.parentOccurrenceId);

  return (
    <section className="decision-card terminal-card">
      <header className="decision-heading">
        <div>
          <p className="card-kicker">Terminal transition</p>
          <h3>Preboss from {parentRoom.label}</h3>
        </div>
        <div className="owner-markers">
          <SemanticOwnerMarker address={address} />
          <SemanticOwnerMarker
            address={createPickedAddress(biome, continuation.parentOccurrenceId)}
          />
          <span className="neutral-status">
            {continuation.pickedExitIndex === null
              ? 'No entered exit'
              : `Exit ${continuation.pickedExitIndex} entered`}
          </span>
        </div>
      </header>

      <div className="exit-list">
        {exitIndexes.map((exitIndex) => {
          const target = continuation.targets.find(
            (candidate) => candidate.exitIndex === exitIndex,
          );
          if (target === undefined) {
            return (
              <div className="exit-row" data-available="true" key={exitIndex}>
                <div className="exit-marker" aria-hidden="true" />
                <div className="exit-content">
                  <div className="exit-heading">
                    <div>
                      <p className="card-kicker">Exit {exitIndex}</p>
                      <h4>{exitIndex === 1 ? 'Preboss Shop' : 'Free Reward'}</h4>
                    </div>
                    <div className="owner-markers">
                      <SemanticOwnerMarker
                        address={createTargetAddress(
                          biome,
                          continuation.parentOccurrenceId,
                          exitIndex,
                        )}
                      />
                      <span className="neutral-status">Missing offer</span>
                    </div>
                  </div>
                  <p className="fixed-room-state">
                    Rebuild this Preboss transition to restore its derived offer.
                  </p>
                </div>
              </div>
            );
          }
          const room = occurrence(topology, target.occurrenceId);
          const isAvailable = available.has(target.exitIndex);
          return (
            <div className="exit-row" data-available={isAvailable} key={target.exitIndex}>
              <label className="picked-control">
                <input
                  checked={continuation.pickedExitIndex === target.exitIndex}
                  disabled={!isAvailable}
                  name={`picked-terminal-${continuation.parentOccurrenceId}`}
                  onChange={() =>
                    dispatch(
                      authoredProjectCommandDispatched({
                        kind: 'SetTerminalPicked',
                        picked: createPickedAddress(biome, continuation.parentOccurrenceId),
                        exitIndex: target.exitIndex,
                      }),
                    )
                  }
                  type="radio"
                />
                <span className="visually-hidden">Enter terminal exit {target.exitIndex}</span>
              </label>
              <div className="exit-content">
                <div className="exit-heading">
                  <div>
                    <p className="card-kicker">Exit {target.exitIndex}</p>
                    <h4>{target.exitIndex === 1 ? 'Preboss Shop' : 'Free Reward'}</h4>
                  </div>
                  <div className="owner-markers">
                    <SemanticOwnerMarker
                      address={createTargetAddress(
                        biome,
                        continuation.parentOccurrenceId,
                        target.exitIndex,
                      )}
                    />
                    <SemanticOwnerMarker
                      address={createOccurrenceAddress(biome, room.occurrenceId)}
                    />
                    {!isAvailable && <span className="neutral-status">Unavailable</span>}
                  </div>
                </div>
                <RoomStateEditor
                  biome={biome}
                  candidateProjection={candidateProjection}
                  catalog={catalog}
                  occurrence={room}
                />
              </div>
            </div>
          );
        })}
      </div>

      <footer className="structural-actions">
        {unavailableTargets.length > 0 && (
          <button
            disabled={!pickedAvailable}
            onClick={() => {
              if (!confirmDestructive('Remove every unavailable terminal offer and its state?')) {
                return;
              }
              dispatch(
                authoredProjectCommandDispatched({
                  kind: 'ReconcileTerminalExitCapacity',
                  continuation: address,
                }),
              );
            }}
            type="button"
          >
            Remove Unavailable Exits
          </button>
        )}
        <button
          disabled={!canReplaceWithBatch}
          onClick={() => {
            if (!confirmDestructive('Replace Preboss and its offers with an empty decision?')) {
              return;
            }
            dispatch(
              authoredProjectCommandDispatched({ kind: 'ReplaceWithBatch', continuation: address }),
            );
          }}
          type="button"
        >
          Continue With Rooms
        </button>
        <button
          className="danger-action"
          onClick={() => {
            if (!confirmDestructive('Remove the Preboss transition and all of its offers?')) {
              return;
            }
            dispatch(
              authoredProjectCommandDispatched({
                kind: 'RemoveTerminalTransition',
                continuation: address,
              }),
            );
          }}
          type="button"
        >
          Remove Preboss
        </button>
      </footer>
    </section>
  );
}

function FrontierEditor({
  biome,
  canAddBatch,
  canCreateTerminal,
  catalog,
  parentOccurrenceId,
  topology,
}: LinearTopologyEditorProps & {
  readonly canAddBatch: boolean;
  readonly canCreateTerminal: boolean;
  readonly parentOccurrenceId: OccurrenceId;
}) {
  const dispatch = useAppDispatch();
  const parent = occurrence(topology, parentOccurrenceId);
  const parentRoom = declaration(catalog, parent);
  const address = createContinuationAddress(biome, parentOccurrenceId);
  return (
    <section className="frontier-actions">
      <div>
        <div className="owner-markers frontier-owner">
          <p className="card-kicker">Active frontier</p>
          <SemanticOwnerMarker address={address} />
        </div>
        <h3>Continue from {parentRoom.label}</h3>
        <p>These are structural authoring actions; eligibility is not evaluated yet.</p>
      </div>
      <div className="frontier-buttons">
        <button
          className="primary-action"
          disabled={!canAddBatch}
          onClick={() =>
            dispatch(
              authoredProjectCommandDispatched({ kind: 'CreateBatch', continuation: address }),
            )
          }
          type="button"
        >
          Add Next Decision
        </button>
        <button
          disabled={!canCreateTerminal}
          onClick={() =>
            dispatch(
              authoredProjectCommandDispatched({
                kind: 'CreateTerminalTransition',
                continuation: address,
                targetOccurrenceIds: terminalOccurrenceIds(parentRoom),
              }),
            )
          }
          type="button"
        >
          Go to Preboss
        </button>
      </div>
    </section>
  );
}

function frontierOccurrenceId(topology: LinearBiomeTopology): OccurrenceId | undefined {
  if (topology.continuations.length === 0) {
    return topology.startOccurrenceId;
  }
  const last = topology.continuations.at(-1);
  if (last?.kind !== 'batch' || last.pickedExitIndex === null) {
    return undefined;
  }
  return last.targets.find((target) => target.exitIndex === last.pickedExitIndex)?.occurrenceId;
}

export function LinearTopologyEditor({
  biome,
  candidateProjection,
  catalog,
  evaluation,
  topology,
}: LinearTopologyEditorProps) {
  const layout = catalog.biomeLayouts.byKey[biome.biomeKey];
  if (layout === undefined) {
    throw new Error(`${biome.biomeKey} layout is missing`);
  }
  if (layout.kind !== 'LinearBiome') {
    throw new Error(`${biome.biomeKey} is not a linear biome`);
  }
  const batchCount = topology.continuations.filter(
    (continuation) => continuation.kind === 'batch',
  ).length;
  const targetCount = topology.continuations
    .filter((continuation) => continuation.kind === 'batch')
    .reduce((count, continuation) => count + continuation.targets.length, 0);
  const fixedContinuationCount =
    layout.continuation.progressionPolicy.kind === 'fixedCount'
      ? layout.continuation.progressionPolicy.continuationCount
      : undefined;
  const canAddBatch =
    batchCount < layout.bounds.maxBatches &&
    (fixedContinuationCount === undefined || batchCount < fixedContinuationCount);
  const canCreateTerminal =
    fixedContinuationCount === undefined || batchCount === fixedContinuationCount;
  const frontier = frontierOccurrenceId(topology);
  const frontierRoom =
    frontier === undefined ? undefined : declaration(catalog, occurrence(topology, frontier));
  const frontierTerminalTargetCount =
    frontierRoom === undefined ? 0 : generatedExitIndexes(frontierRoom).length;
  return (
    <div className="topology-editor">
      {topology.continuations.map((continuation) =>
        continuation.kind === 'batch' ? (
          <BatchEditor
            biome={biome}
            candidateProjection={candidateProjection}
            canCreateTarget={targetCount < layout.bounds.maxTargets}
            canReplaceWithTerminal={fixedContinuationCount === undefined}
            catalog={catalog}
            continuation={continuation}
            evaluation={evaluation}
            key={continuation.parentOccurrenceId}
            topology={topology}
          />
        ) : (
          <TerminalEditor
            biome={biome}
            candidateProjection={candidateProjection}
            canReplaceWithBatch={
              fixedContinuationCount === undefined && batchCount < layout.bounds.maxBatches
            }
            catalog={catalog}
            continuation={continuation}
            evaluation={evaluation}
            key={continuation.parentOccurrenceId}
            topology={topology}
          />
        ),
      )}
      {frontier !== undefined && (
        <FrontierEditor
          biome={biome}
          candidateProjection={candidateProjection}
          canAddBatch={canAddBatch}
          canCreateTerminal={canCreateTerminal && frontierTerminalTargetCount > 0}
          catalog={catalog}
          evaluation={evaluation}
          parentOccurrenceId={frontier}
          topology={topology}
        />
      )}
    </div>
  );
}

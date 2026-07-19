import type {
  BiomeAddress,
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
} from '@run-planner/core';

import { authoredProjectCommandDispatched } from '../application/authoredProjectSlice';
import { allocateOccurrenceId } from '../application/occurrenceIds';
import { useAppDispatch } from '../application/store';
import { RoomSelector } from './RoomSelector';
import { RoomStateEditor } from './RoomStateEditor';

interface FTopologyEditorProps {
  readonly biome: BiomeAddress;
  readonly catalog: Catalog;
  readonly topology: LinearBiomeTopology;
}

interface BatchEditorProps extends FTopologyEditorProps {
  readonly canCreateTarget: boolean;
  readonly continuation: LinearBatchContinuation;
}

interface TerminalEditorProps extends FTopologyEditorProps {
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

function OrdinaryTargetEditor({
  available,
  biome,
  catalog,
  canCreateTarget,
  continuation,
  exitIndex,
  target,
  topology,
}: FTopologyEditorProps & {
  readonly available: boolean;
  readonly canCreateTarget: boolean;
  readonly continuation: LinearBatchContinuation;
  readonly exitIndex: number;
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
            <span className="neutral-status">Unspecified</span>
          </div>
          <RoomSelector
            biomeStepKey={biome.biomeStepKey}
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
          <span className="neutral-status">{available ? roomDeclaration.kind : 'Unavailable'}</span>
        </div>
        <RoomSelector
          biomeStepKey={biome.biomeStepKey}
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
        />
        <RoomStateEditor biome={biome} catalog={catalog} occurrence={room} />
      </div>
    </div>
  );
}

function BatchEditor({
  biome,
  canCreateTarget,
  catalog,
  continuation,
  topology,
}: BatchEditorProps) {
  const dispatch = useAppDispatch();
  const parent = occurrence(topology, continuation.parentOccurrenceId);
  const parentRoom = declaration(catalog, parent);
  const layout = catalog.biomeLayouts.byKey[biome.biomeStepKey];
  if (layout === undefined) {
    throw new Error(`Biome layout ${biome.biomeStepKey} is missing`);
  }
  if (layout.kind !== 'LinearBiome') {
    throw new Error(`${biome.biomeStepKey} is not a linear biome`);
  }
  if (layout.continuation.rewardStorePolicy.kind !== 'authoredBaseStore') {
    throw new Error(`${biome.biomeStepKey} does not author a base reward store`);
  }
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

  return (
    <section className="decision-card">
      <header className="decision-heading">
        <div>
          <p className="card-kicker">Decision</p>
          <h3>Doors from {parentRoom.label}</h3>
        </div>
        <span className="neutral-status">
          {continuation.pickedExitIndex === null
            ? 'No picked exit'
            : `Exit ${continuation.pickedExitIndex} picked`}
        </span>
      </header>

      {continuation.rewardStore.kind === 'authoredBaseStore' && (
        <label
          className="field-control batch-reward-store"
          htmlFor={`batch-${continuation.parentOccurrenceId}-reward-store`}
        >
          <span>Reward pool</span>
          <select
            id={`batch-${continuation.parentOccurrenceId}-reward-store`}
            onChange={(event) =>
              dispatch(
                authoredProjectCommandDispatched({
                  kind: 'ReplaceBatchRewardStore',
                  rewardStore: createBatchRewardStoreAddress(
                    biome,
                    continuation.parentOccurrenceId,
                  ),
                  storeKey: event.target.value,
                }),
              )
            }
            value={continuation.rewardStore.baseRewardStoreKey}
          >
            {layout.continuation.rewardStorePolicy.storeKeys.map((storeKey) => (
              <option key={storeKey} value={storeKey}>
                {storeKey === 'RunProgress' ? 'Run Progress' : 'Meta Progress'}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="exit-list">
        {exitIndexes.map((exitIndex) => (
          <OrdinaryTargetEditor
            available={available.has(exitIndex)}
            biome={biome}
            canCreateTarget={canCreateTarget}
            catalog={catalog}
            continuation={continuation}
            exitIndex={exitIndex}
            key={exitIndex}
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
  canReplaceWithBatch,
  catalog,
  continuation,
  topology,
}: TerminalEditorProps) {
  const dispatch = useAppDispatch();
  const parent = occurrence(topology, continuation.parentOccurrenceId);
  const parentRoom = declaration(catalog, parent);
  const available = new Set(generatedExitIndexes(parentRoom));
  const unavailableTargets = continuation.targets.filter(
    (target) => !available.has(target.exitIndex),
  );
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
        <span className="neutral-status">
          {continuation.pickedExitIndex === null
            ? 'No entered exit'
            : `Exit ${continuation.pickedExitIndex} entered`}
        </span>
      </header>

      <div className="exit-list">
        {continuation.targets.map((target) => {
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
                  {!isAvailable && <span className="neutral-status">Unavailable</span>}
                </div>
                <RoomStateEditor biome={biome} catalog={catalog} occurrence={room} />
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
}: FTopologyEditorProps & {
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
        <p className="card-kicker">Active frontier</p>
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

export function FTopologyEditor({ biome, catalog, topology }: FTopologyEditorProps) {
  const layout = catalog.biomeLayouts.byKey[biome.biomeStepKey];
  if (layout === undefined) {
    throw new Error(`${biome.biomeStepKey} layout is missing`);
  }
  if (layout.kind !== 'LinearBiome') {
    throw new Error(`${biome.biomeStepKey} is not a linear biome`);
  }
  const batchCount = topology.continuations.filter(
    (continuation) => continuation.kind === 'batch',
  ).length;
  const targetCount = topology.continuations.reduce(
    (count, continuation) => count + continuation.targets.length,
    0,
  );
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
            canCreateTarget={targetCount < layout.bounds.maxTargets}
            catalog={catalog}
            continuation={continuation}
            key={continuation.parentOccurrenceId}
            topology={topology}
          />
        ) : (
          <TerminalEditor
            biome={biome}
            canReplaceWithBatch={batchCount < layout.bounds.maxBatches}
            catalog={catalog}
            continuation={continuation}
            key={continuation.parentOccurrenceId}
            topology={topology}
          />
        ),
      )}
      {frontier !== undefined && (
        <FrontierEditor
          biome={biome}
          canAddBatch={batchCount < layout.bounds.maxBatches}
          canCreateTerminal={targetCount + frontierTerminalTargetCount <= layout.bounds.maxTargets}
          catalog={catalog}
          parentOccurrenceId={frontier}
          topology={topology}
        />
      )}
    </div>
  );
}

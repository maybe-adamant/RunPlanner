import type {
  BiomeAddress,
  LinearBatchContinuation,
  LinearBiomePlan,
  LinearBiomeTopology,
  LinearTargetReference,
  LinearTerminalContinuation,
  OccurrenceId,
  RoomOccurrence,
} from '@run-planner/engine/authored-project';
import type {
  LinearBiomeProjectEvaluation,
  CanonicalBatchState,
  ClockworkBatchProjection,
} from '@run-planner/engine/simulation';
import type { Catalog, RoomDeclaration } from '@run-planner/engine/catalog-schema';
import {
  createBatchRewardStoreAddress,
  createContinuationAddress,
  createOccurrenceAddress,
  createPickedAddress,
  createTargetAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { projectClockworkTopology, projectLinearBatchState } from '@run-planner/engine/simulation';

import type { WorkspaceInteractionCatalog } from '../../../projections/structuredWorkspace';
import { allocateOccurrenceId } from '../../../workspace/occurrenceIds';
import { authoredProjectCommandDispatched } from '../../../state/projectWorkspaceSlice';
import { useAppDispatch } from '../../../state/store';
import { SemanticOwnerMarker } from '../../feedback/EvaluationFeedback';
import { RoomSelector } from './RoomSelector';
import { BatchRewardStoreControl, FieldsBatchControl } from './BatchSettings';
import { RoomStateEditor } from '../rooms/RoomStateEditor';

interface LinearTopologyEditorProps {
  readonly biome: BiomeAddress;
  readonly catalog: Catalog;
  readonly evaluation: LinearBiomeProjectEvaluation | undefined;
  readonly focusedNodeKey?: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly plan: LinearBiomePlan;
  readonly topology: LinearBiomeTopology;
}

interface BatchEditorProps extends LinearTopologyEditorProps {
  readonly canCreateTarget: boolean;
  readonly canReplaceWithTerminal: boolean;
  readonly clockworkBatch?: ClockworkBatchProjection;
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

function focusedTargetExitIndex(
  biome: BiomeAddress,
  topology: LinearBiomeTopology,
  continuation: LinearBiomeTopology['continuations'][number],
  focusedNodeKey: string | undefined,
  exitIndexes: readonly number[],
): number | undefined {
  if (focusedNodeKey === undefined) {
    return undefined;
  }
  for (const exitIndex of exitIndexes) {
    if (
      focusedNodeKey ===
      semanticAddressKey(createTargetAddress(biome, continuation.parentOccurrenceId, exitIndex))
    ) {
      return exitIndex;
    }
  }
  for (const target of continuation.targets) {
    if (
      focusedNodeKey === semanticAddressKey(createOccurrenceAddress(biome, target.occurrenceId))
    ) {
      return target.exitIndex;
    }
  }
  return undefined;
}

function OrdinaryTargetEditor({
  available,
  biome,
  catalog,
  interactions,
  canCreateTarget,
  continuation,
  exitIndex,
  focused,
  clockworkReward,
  projectedBatchState,
  target,
  topology,
}: LinearTopologyEditorProps & {
  readonly available: boolean;
  readonly canCreateTarget: boolean;
  readonly continuation: LinearBatchContinuation;
  readonly clockworkReward?: 'goal' | 'nonGoal';
  readonly exitIndex: number;
  readonly focused: boolean;
  readonly projectedBatchState: CanonicalBatchState;
  readonly target: LinearTargetReference | undefined;
}) {
  const dispatch = useAppDispatch();
  const idPrefix = `decision-${continuation.parentOccurrenceId}-exit-${exitIndex}`;

  if (target === undefined) {
    return (
      <div className="exit-row" data-available={available} data-focused={focused}>
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
            interactions={interactions}
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
            owner={createTargetAddress(biome, continuation.parentOccurrenceId, exitIndex)}
          />
        </div>
      </div>
    );
  }

  const room = occurrence(topology, target.occurrenceId);
  const roomDeclaration = declaration(catalog, room);
  return (
    <div
      className="exit-row"
      data-available={available}
      data-focused={focused}
      data-picked={continuation.pickedExitIndex === exitIndex}
    >
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
              {!available
                ? 'Unavailable'
                : clockworkReward === undefined
                  ? roomDeclaration.kind
                  : clockworkReward === 'goal'
                    ? 'Goal'
                    : 'NonGoal'}
            </span>
          </div>
        </div>
        <RoomSelector
          interactions={interactions}
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
          owner={createTargetAddress(biome, continuation.parentOccurrenceId, exitIndex)}
        />
        <RoomStateEditor
          {...(room.state.kind === 'fieldsCombat' && projectedBatchState.kind === 'fields'
            ? { activeCageCount: projectedBatchState.doorCageRewardCount }
            : {})}
          biome={biome}
          catalog={catalog}
          interactions={interactions}
          {...(clockworkReward === undefined ? {} : { clockworkReward })}
          entryActive={continuation.pickedExitIndex === exitIndex}
          occurrence={room}
        />
      </div>
    </div>
  );
}

function BatchEditor({
  biome,
  canCreateTarget,
  canReplaceWithTerminal,
  catalog,
  clockworkBatch,
  continuation,
  focusedNodeKey,
  interactions,
  evaluation,
  plan,
  topology,
}: BatchEditorProps) {
  const dispatch = useAppDispatch();
  const layout = catalog.biomeLayouts.byKey[biome.biomeKey];
  if (layout === undefined) {
    throw new Error(`Biome layout ${biome.biomeKey} is missing`);
  }
  if (layout.kind !== 'LinearBiome') {
    throw new Error(`${biome.biomeKey} is not a linear biome`);
  }
  const parentRoom =
    continuation.parentOccurrenceId === null
      ? (() => {
          if (layout.start.kind !== 'fixedEntry') {
            throw new Error(`${layout.biomeKey} has no fixed entry source`);
          }
          const source = layout.entries.at(-1) ?? layout.start;
          const room = catalog.rooms.byKey[source.roomGameName];
          if (room === undefined) {
            throw new Error(`${source.roomGameName} fixed entry is missing`);
          }
          return room;
        })()
      : declaration(catalog, occurrence(topology, continuation.parentOccurrenceId));
  const projectedBatchState =
    layout.continuation.batchPolicy.kind === 'clockwork'
      ? (() => {
          if (clockworkBatch === undefined) {
            throw new Error(
              `${layout.biomeKey} batch ${continuation.parentOccurrenceId} has no Clockwork projection`,
            );
          }
          return clockworkBatch.batchState;
        })()
      : projectLinearBatchState(catalog, biome, topology, continuation);
  const fieldsPolicy =
    layout.continuation.batchPolicy.kind === 'fields' ? layout.continuation.batchPolicy : undefined;
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
  const fieldsSupport =
    evaluation?.authoring === 'complete'
      ? evaluation.roomGeneration.fieldsCageOutcomes.find(
          (entry) => entry.origin.parentOccurrenceId === continuation.parentOccurrenceId,
        )
      : undefined;
  const focusedExitIndex = focusedTargetExitIndex(
    biome,
    topology,
    continuation,
    focusedNodeKey,
    exitIndexes,
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

      <div className="batch-controls">
        {continuation.rewardStore.kind === 'authoredBaseStore' && (
          <BatchRewardStoreControl
            address={rewardStoreAddress}
            interactions={interactions}
            id={`batch-${continuation.parentOccurrenceId}-reward-store`}
            onReplace={(storeKey) =>
              dispatch(
                authoredProjectCommandDispatched({
                  kind: 'ReplaceBatchRewardStore',
                  rewardStore: rewardStoreAddress,
                  storeKey,
                }),
              )
            }
          />
        )}

        {projectedBatchState.kind === 'fields' &&
          fieldsPolicy !== undefined &&
          continuation.batchState !== null && (
            <FieldsBatchControl
              batchState={projectedBatchState}
              interactions={interactions}
              continuation={address}
              id={`batch-${continuation.parentOccurrenceId}-cage-outcome`}
              onReplace={(cageOutcome) =>
                dispatch(
                  authoredProjectCommandDispatched({
                    kind: 'ReplaceFieldsCageOutcome',
                    continuation: address,
                    cageOutcome: fieldsCageOutcome(cageOutcome),
                  }),
                )
              }
              {...(fieldsSupport === undefined ? {} : { priorMaxOutcomes: fieldsSupport })}
            />
          )}
      </div>

      <div className="exit-list">
        {exitIndexes.map((exitIndex) => (
          <OrdinaryTargetEditor
            available={available.has(exitIndex)}
            biome={biome}
            canCreateTarget={canCreateTarget}
            catalog={catalog}
            continuation={continuation}
            interactions={interactions}
            evaluation={evaluation}
            exitIndex={exitIndex}
            focused={focusedExitIndex === exitIndex}
            key={exitIndex}
            plan={plan}
            projectedBatchState={projectedBatchState}
            {...(() => {
              const reward = clockworkBatch?.targets.find(
                (candidate) => candidate.exitIndex === exitIndex,
              )?.reward;
              return reward === undefined ? {} : { clockworkReward: reward };
            })()}
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
        {layout.terminal.kind !== 'generatedTarget' && (
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
        )}
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
  interactions,
  continuation,
  focusedNodeKey,
  topology,
}: TerminalEditorProps) {
  const dispatch = useAppDispatch();
  if (continuation.parentOccurrenceId === null) {
    throw new Error('Layout-entry terminals are not projected by the active editor');
  }
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
  const focusedExitIndex = focusedTargetExitIndex(
    biome,
    topology,
    continuation,
    focusedNodeKey,
    exitIndexes,
  );
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
              <div
                className="exit-row"
                data-available="true"
                data-focused={focusedExitIndex === exitIndex}
                key={exitIndex}
              >
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
            <div
              className="exit-row"
              data-available={isAvailable}
              data-focused={focusedExitIndex === target.exitIndex}
              data-picked={continuation.pickedExitIndex === target.exitIndex}
              key={target.exitIndex}
            >
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
                  catalog={catalog}
                  interactions={interactions}
                  entryActive={continuation.pickedExitIndex === target.exitIndex}
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
  const layout = catalog.biomeLayouts.byKey[biome.biomeKey];
  if (layout?.kind !== 'LinearBiome') {
    throw new Error(`${biome.biomeKey} is not a linear biome`);
  }
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
        {layout.terminal.kind !== 'generatedTarget' && (
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
        )}
      </div>
    </section>
  );
}

function frontierOccurrenceId(
  topology: LinearBiomeTopology,
  terminalRoomGameName?: string,
): OccurrenceId | undefined {
  if (topology.continuations.length === 0) {
    return topology.startOccurrenceId ?? undefined;
  }
  const last = topology.continuations.at(-1);
  if (last?.kind !== 'batch' || last.pickedExitIndex === null) {
    return undefined;
  }
  const picked = last.targets.find((target) => target.exitIndex === last.pickedExitIndex);
  if (
    picked === undefined ||
    (terminalRoomGameName !== undefined &&
      occurrence(topology, picked.occurrenceId).gameName === terminalRoomGameName)
  ) {
    return undefined;
  }
  return picked.occurrenceId;
}

function continuationOwnsNode(
  catalog: Catalog,
  biome: BiomeAddress,
  topology: LinearBiomeTopology,
  continuation: LinearBiomeTopology['continuations'][number],
  focusedNodeKey: string,
): boolean {
  const layout = catalog.biomeLayouts.byKey[biome.biomeKey];
  if (layout?.kind !== 'LinearBiome') {
    throw new Error(`${biome.biomeKey} is not a linear biome`);
  }
  const parentRoom =
    continuation.parentOccurrenceId === null
      ? layout.start.kind === 'fixedEntry'
        ? (() => {
            const source = layout.entries.at(-1) ?? layout.start;
            const room = catalog.rooms.byKey[source.roomGameName];
            if (room === undefined) {
              throw new Error(`${source.roomGameName} fixed entry is missing`);
            }
            return room;
          })()
        : undefined
      : declaration(catalog, occurrence(topology, continuation.parentOccurrenceId));
  const physicalTargetKeys =
    parentRoom === undefined
      ? []
      : generatedExitIndexes(parentRoom).map((exitIndex) =>
          semanticAddressKey(
            createTargetAddress(biome, continuation.parentOccurrenceId, exitIndex),
          ),
        );
  const ownerKeys = [
    semanticAddressKey(createContinuationAddress(biome, continuation.parentOccurrenceId)),
    semanticAddressKey(createPickedAddress(biome, continuation.parentOccurrenceId)),
    semanticAddressKey(createBatchRewardStoreAddress(biome, continuation.parentOccurrenceId)),
    ...physicalTargetKeys,
    ...continuation.targets.flatMap((target) => [
      semanticAddressKey(
        createTargetAddress(biome, continuation.parentOccurrenceId, target.exitIndex),
      ),
      semanticAddressKey(
        createOccurrenceAddress(biome, occurrence(topology, target.occurrenceId).occurrenceId),
      ),
    ]),
  ];
  return ownerKeys.includes(focusedNodeKey);
}

export function LinearTopologyEditor({
  biome,
  catalog,
  focusedNodeKey,
  interactions,
  evaluation,
  plan,
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
  const constrainedContinuationCount =
    layout.continuation.progressionPolicy.kind === 'fixedCount'
      ? layout.continuation.progressionPolicy.continuationCount
      : layout.continuation.progressionPolicy.kind === 'staged'
        ? layout.continuation.progressionPolicy.stages.length
        : undefined;
  const canAddBatch =
    batchCount < layout.bounds.maxBatches &&
    (constrainedContinuationCount === undefined || batchCount < constrainedContinuationCount);
  const canCreateTerminal =
    constrainedContinuationCount === undefined || batchCount === constrainedContinuationCount;
  const frontier = frontierOccurrenceId(
    topology,
    layout.terminal.kind === 'generatedTarget' ? layout.terminal.roomGameName : undefined,
  );
  const frontierRoom =
    frontier === undefined ? undefined : declaration(catalog, occurrence(topology, frontier));
  const frontierTerminalTargetCount =
    frontierRoom === undefined ? 0 : generatedExitIndexes(frontierRoom).length;
  const clockworkBatches =
    layout.continuation.batchPolicy.kind === 'clockwork'
      ? projectClockworkTopology(catalog, biome, plan)
      : Object.freeze([]);
  return (
    <div className="topology-editor">
      {topology.continuations.map((continuation) => {
        if (
          focusedNodeKey !== undefined &&
          !continuationOwnsNode(catalog, biome, topology, continuation, focusedNodeKey)
        ) {
          return null;
        }
        return continuation.kind === 'batch' ? (
          <BatchEditor
            biome={biome}
            canCreateTarget={targetCount < layout.bounds.maxTargets}
            canReplaceWithTerminal={
              constrainedContinuationCount === undefined &&
              layout.terminal.kind !== 'generatedTarget'
            }
            catalog={catalog}
            interactions={interactions}
            {...(focusedNodeKey === undefined ? {} : { focusedNodeKey })}
            {...(() => {
              const clockworkBatch = clockworkBatches.find(
                (batch) => batch.parentOccurrenceId === continuation.parentOccurrenceId,
              );
              return clockworkBatch === undefined ? {} : { clockworkBatch };
            })()}
            continuation={continuation}
            evaluation={evaluation}
            key={continuation.parentOccurrenceId ?? 'layout-entry'}
            plan={plan}
            topology={topology}
          />
        ) : (
          <TerminalEditor
            biome={biome}
            canReplaceWithBatch={
              constrainedContinuationCount === undefined && batchCount < layout.bounds.maxBatches
            }
            catalog={catalog}
            interactions={interactions}
            {...(focusedNodeKey === undefined ? {} : { focusedNodeKey })}
            continuation={continuation}
            evaluation={evaluation}
            key={continuation.parentOccurrenceId ?? 'layout-entry'}
            plan={plan}
            topology={topology}
          />
        );
      })}
      {frontier !== undefined &&
        (focusedNodeKey === undefined ||
          focusedNodeKey === semanticAddressKey(createContinuationAddress(biome, frontier))) && (
          <FrontierEditor
            biome={biome}
            canAddBatch={canAddBatch}
            canCreateTerminal={canCreateTerminal && frontierTerminalTargetCount > 0}
            catalog={catalog}
            interactions={interactions}
            evaluation={evaluation}
            parentOccurrenceId={frontier}
            plan={plan}
            topology={topology}
          />
        )}
    </div>
  );
}

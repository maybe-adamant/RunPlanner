import {
  createBiomeAddress,
  createFixedEntryRoomAddress,
  createHubOpenSetAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createLocalChildAddress,
  createLocalChildGroupAddress,
  createLocalRewardAddress,
  type EphyraCombatState,
  type HubBiomePlan,
  type OccurrenceId,
  type RoomOccurrence,
} from '@run-planner/engine/authored-project';
import {
  type Catalog,
  type FixedAuthoredSlotDescriptor,
  type HubBiomeLayout,
} from '@run-planner/engine/catalog-schema';
import { type HubBiomeProjectEvaluation } from '@run-planner/engine/simulation';
import { useMemo } from 'react';

import { type CandidateProjectionService } from '../../../projections/candidateProjection';
import type { RewardPickerProjectionService } from '../../../projections/rewardPicker';
import { presentBiomeStatus } from '../../../projections/evaluationProjection';
import { authoredProjectCommandDispatched } from '../../../state/projectWorkspaceSlice';
import { selectPresentProject, useAppDispatch, useAppSelector } from '../../../state/store';
import { allocateOccurrenceId } from '../../../workspace/occurrenceIds';
import {
  SemanticFindingsScope,
  SemanticOwnerMarker,
  StatusBadge,
} from '../../feedback/EvaluationFeedback';
import { CountedRewardEditor } from '../rewards/RewardEditors';
import { RoomStateEditor } from '../rooms/RoomStateEditor';
import {
  HubSlotMembership,
  HubVisitControl,
  SideEntryAction,
  SideGenerationControl,
} from './HubCandidateControls';

interface HubBiomeEditorProps {
  readonly candidateProjection: CandidateProjectionService;
  readonly catalog: Catalog;
  readonly evaluation: HubBiomeProjectEvaluation | undefined;
  readonly plan: HubBiomePlan;
  readonly rewardPicker: RewardPickerProjectionService;
  readonly routeKey: string;
}

function EphyraSideRooms({
  biome,
  candidateProjection,
  catalog,
  occurrence,
  rewardPicker,
  state,
}: {
  readonly biome: ReturnType<typeof createBiomeAddress>;
  readonly candidateProjection: CandidateProjectionService;
  readonly catalog: Catalog;
  readonly occurrence: RoomOccurrence;
  readonly rewardPicker: RewardPickerProjectionService;
  readonly state: EphyraCombatState;
}) {
  const dispatch = useAppDispatch();
  const project = useAppSelector(selectPresentProject);
  const room = catalog.rooms.byKey[occurrence.gameName];
  if (room === undefined) {
    throw new Error(`Ephyra room ${occurrence.gameName} is missing`);
  }
  const group = room.localChildren.find((child) => child.kind === 'fixedRoomSlots');
  if (group?.kind !== 'fixedRoomSlots') {
    return null;
  }
  const groupAddress = createLocalChildGroupAddress(biome, occurrence.occurrenceId, group.key);
  const enteredSlotKeys = Object.entries(state.sideRooms)
    .filter(
      (entry): entry is [string, (typeof entry)[1] & { readonly enteredOrdinal: number }] =>
        entry[1].enteredOrdinal !== null,
    )
    .sort((left, right) => left[1].enteredOrdinal - right[1].enteredOrdinal)
    .map(([slotKey]) => slotKey);
  const replaceEntryOrder = (next: readonly string[]) =>
    dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceSideRoomEntryOrder',
        group: groupAddress,
        enteredSlotKeys: next,
      }),
    );

  return (
    <section className="ephyra-side-editor" aria-label={`${room.label} side rooms`}>
      <header className="local-reward-heading">
        <div className="owner-markers">
          <h4>Side rooms</h4>
          <SemanticOwnerMarker address={groupAddress} />
        </div>
        <span className="neutral-status">
          {enteredSlotKeys.length} entered · {group.slots.length} possible
        </span>
      </header>
      <div className="ephyra-side-list">
        {group.slots.map((slot) => {
          const sideState = state.sideRooms[slot.slotKey];
          const sideRoom = catalog.rooms.byKey[slot.roomGameName];
          if (sideState === undefined || sideRoom === undefined) {
            throw new Error(`${room.gameName} side slot ${slot.slotKey} is incomplete`);
          }
          if (sideRoom.incomingReward.kind !== 'countedChoice') {
            throw new Error(`${sideRoom.gameName} has no counted side-room reward`);
          }
          const childAddress = createLocalChildAddress(
            biome,
            occurrence.occurrenceId,
            group.key,
            slot.slotKey,
          );
          const rewardAddress = createLocalRewardAddress(
            biome,
            occurrence.occurrenceId,
            group.key,
            slot.slotKey,
          );
          const enteredIndex = enteredSlotKeys.indexOf(slot.slotKey);
          const entered = enteredIndex >= 0;
          const toggledOrder = entered
            ? enteredSlotKeys.filter((slotKey) => slotKey !== slot.slotKey)
            : [...enteredSlotKeys, slot.slotKey];
          const earlierOrder = [...enteredSlotKeys];
          if (enteredIndex > 0) {
            const previous = earlierOrder[enteredIndex - 1]!;
            earlierOrder[enteredIndex - 1] = earlierOrder[enteredIndex]!;
            earlierOrder[enteredIndex] = previous;
          }
          const laterOrder = [...enteredSlotKeys];
          if (enteredIndex >= 0 && enteredIndex < enteredSlotKeys.length - 1) {
            const next = laterOrder[enteredIndex + 1]!;
            laterOrder[enteredIndex + 1] = laterOrder[enteredIndex]!;
            laterOrder[enteredIndex] = next;
          }

          return (
            <article
              aria-label={sideRoom.label}
              className="ephyra-side-card"
              data-generated={sideState.generation === 'generated'}
              key={slot.slotKey}
            >
              <div className="local-reward-heading">
                <div>
                  <p className="card-kicker">Door {slot.physicalDoorId}</p>
                  <div className="owner-markers">
                    <h4>{sideRoom.label}</h4>
                    <SemanticOwnerMarker address={childAddress} />
                  </div>
                </div>
                <span className="neutral-status">
                  {entered ? `Entered ${enteredIndex + 1}` : 'Not entered'}
                </span>
              </div>
              <div className="ephyra-side-controls">
                <SideGenerationControl
                  address={childAddress}
                  candidateProjection={candidateProjection}
                  entered={entered}
                  generation={sideState.generation}
                  label={sideRoom.label}
                  onReplace={(generation) =>
                    dispatch(
                      authoredProjectCommandDispatched({
                        kind: 'ReplaceSideRoomGeneration',
                        sideRoom: childAddress,
                        generation,
                      }),
                    )
                  }
                  project={project}
                />
                <SideEntryAction
                  ariaLabel={`${entered ? 'Remove' : 'Enter'} ${sideRoom.label}`}
                  candidateProjection={candidateProjection}
                  disabled={sideState.generation !== 'generated'}
                  group={groupAddress}
                  onApply={() => replaceEntryOrder(toggledOrder)}
                  project={project}
                  proposedOrder={toggledOrder}
                >
                  {entered ? 'Remove From Entry Order' : 'Enter Last'}
                </SideEntryAction>
              </div>
              {entered && enteredSlotKeys.length > 1 && (
                <div className="side-order-actions">
                  <SideEntryAction
                    ariaLabel={`Move ${sideRoom.label} earlier`}
                    candidateProjection={candidateProjection}
                    disabled={enteredIndex === 0}
                    group={groupAddress}
                    onApply={() => replaceEntryOrder(earlierOrder)}
                    project={project}
                    proposedOrder={earlierOrder}
                  >
                    Earlier
                  </SideEntryAction>
                  <SideEntryAction
                    ariaLabel={`Move ${sideRoom.label} later`}
                    candidateProjection={candidateProjection}
                    disabled={enteredIndex === enteredSlotKeys.length - 1}
                    group={groupAddress}
                    onApply={() => replaceEntryOrder(laterOrder)}
                    project={project}
                    proposedOrder={laterOrder}
                  >
                    Later
                  </SideEntryAction>
                </div>
              )}
              <div
                className="room-state-with-marker"
                data-active={sideState.generation === 'generated'}
              >
                <SemanticOwnerMarker address={rewardAddress} />
                <CountedRewardEditor
                  binding={sideRoom.incomingReward}
                  candidateOwner={{ kind: 'localReward', address: rewardAddress }}
                  candidateProjection={candidateProjection}
                  idPrefix={`side-${occurrence.occurrenceId}-${slot.slotKey}`}
                  offer={sideState.offer}
                  onReplace={(value) =>
                    dispatch(
                      authoredProjectCommandDispatched({
                        kind: 'ReplaceLocalReward',
                        reward: rewardAddress,
                        value,
                      }),
                    )
                  }
                  project={project}
                  rewardPicker={rewardPicker}
                />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function fixedDescriptors(layout: HubBiomeLayout): readonly FixedAuthoredSlotDescriptor[] {
  if (
    layout.entries.some((entry) => entry.kind !== 'fixedAuthoredSlot') ||
    layout.terminal.kind !== 'fixedAuthoredSlot'
  ) {
    throw new Error(`${layout.biomeKey} editor requires fixed authored boundaries`);
  }
  return [...(layout.entries as readonly FixedAuthoredSlotDescriptor[]), layout.terminal];
}

function requireOccurrence(
  occurrences: readonly RoomOccurrence[],
  occurrenceId: OccurrenceId,
): RoomOccurrence {
  const occurrence = occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
  if (occurrence === undefined) {
    throw new Error(`Hub editor is missing occurrence ${occurrenceId}`);
  }
  return occurrence;
}

export function HubBiomeEditor({
  candidateProjection,
  catalog,
  evaluation,
  plan,
  rewardPicker,
  routeKey,
}: HubBiomeEditorProps) {
  const dispatch = useAppDispatch();
  const project = useAppSelector(selectPresentProject);
  const biome = createBiomeAddress(routeKey, plan.biomeKey);
  const declaration = catalog.biomes.byKey[plan.biomeKey];
  const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
  if (declaration === undefined || layout?.kind !== 'HubBiome') {
    throw new Error(`${plan.biomeKey} has no Hub editor declaration`);
  }
  if (evaluation !== undefined && evaluation.biomeKey !== plan.biomeKey) {
    throw new Error(`${plan.biomeKey} editor received ${evaluation.biomeKey} evaluation`);
  }
  const descriptors = fixedDescriptors(layout);
  if (layout.terminal.kind !== 'fixedAuthoredSlot') {
    throw new Error(`${plan.biomeKey} Hub terminal is not a fixed authored slot`);
  }
  const terminalSlotKey = layout.terminal.slotKey;
  const pendingOccurrenceIds = useMemo(
    () =>
      Object.fromEntries(
        layout.hub.slots.map((slot) => [slot.slotKey, allocateOccurrenceId()] as const),
      ) as Readonly<Record<string, OccurrenceId>>,
    [layout],
  );
  const topology = plan.topology;
  const titleId = `${plan.biomeKey.toLowerCase()}-biome-title`;

  if (topology === null) {
    return (
      <SemanticFindingsScope findings={evaluation?.findings ?? []}>
        <section className="biome-editor" aria-labelledby={titleId}>
          <header className="panel-heading">
            <div>
              <p className="eyebrow">
                {routeKey} · {plan.biomeKey}
              </p>
              <h2 id={titleId}>{declaration.label}</h2>
            </div>
            <div className="panel-heading-actions">
              <SemanticOwnerMarker address={biome} />
              <StatusBadge status={presentBiomeStatus(evaluation)} />
            </div>
          </header>
          <div className="empty-topology">
            <div>
              <h3>Initialize the persistent Hub</h3>
              <p>
                Create Ephyra's fixed Opening, Pre-Hub, and Preboss leaves before selecting its
                physical open board.
              </p>
            </div>
            <button
              className="primary-action"
              onClick={() =>
                dispatch(
                  authoredProjectCommandDispatched({
                    kind: 'CreateHubTopology',
                    biome,
                    fixedOccurrenceIds: Object.fromEntries(
                      descriptors.map((descriptor) => [descriptor.slotKey, allocateOccurrenceId()]),
                    ),
                  }),
                )
              }
              type="button"
            >
              Initialize {declaration.label}
            </button>
          </div>
        </section>
      </SemanticFindingsScope>
    );
  }

  const openBySlot = new Map(topology.openTargets.map((target) => [target.hubSlotKey, target]));
  const visited = new Set(topology.visitOrder);
  const roomLabels = Object.fromEntries(
    layout.hub.slots.map((slot) => {
      const room = catalog.rooms.byKey[slot.roomGameName];
      if (room === undefined) {
        throw new Error(`Hub slot ${slot.slotKey} references missing ${slot.roomGameName}`);
      }
      return [slot.slotKey, room.label];
    }),
  );
  const fixedByKey = new Map(topology.fixedRooms.map((fixed) => [fixed.fixedSlotKey, fixed]));
  const entryDescriptors = descriptors.filter(
    (descriptor) => descriptor.slotKey !== terminalSlotKey,
  );
  const terminalDescriptor = descriptors.find(
    (descriptor) => descriptor.slotKey === terminalSlotKey,
  );
  if (terminalDescriptor === undefined) {
    throw new Error(`${plan.biomeKey} terminal descriptor is missing`);
  }

  return (
    <SemanticFindingsScope findings={evaluation?.findings ?? []}>
      <section className="biome-editor hub-biome-editor" aria-labelledby={titleId}>
        <header className="panel-heading">
          <div>
            <p className="eyebrow">
              {routeKey} · {plan.biomeKey}
            </p>
            <h2 id={titleId}>{declaration.label}</h2>
          </div>
          <div className="panel-heading-actions">
            <SemanticOwnerMarker address={biome} />
            <StatusBadge status={presentBiomeStatus(evaluation)} />
            <button
              className="danger-action"
              onClick={() => {
                if (
                  !globalThis.confirm(`Clear all authored ${declaration.label} rooms and rewards?`)
                ) {
                  return;
                }
                dispatch(authoredProjectCommandDispatched({ kind: 'ClearTopology', biome }));
              }}
              type="button"
            >
              Clear {declaration.label}
            </button>
          </div>
        </header>

        <div className="fixed-entry-list" aria-label="Fixed biome entries" role="group">
          {entryDescriptors.map((descriptor) => {
            const fixed = fixedByKey.get(descriptor.slotKey);
            if (fixed === undefined) {
              throw new Error(`Hub editor is missing fixed ${descriptor.slotKey}`);
            }
            const occurrence = requireOccurrence(topology.occurrences, fixed.occurrenceId);
            const room = catalog.rooms.byKey[occurrence.gameName];
            if (room === undefined) {
              throw new Error(`Hub fixed room ${occurrence.gameName} is missing`);
            }
            return (
              <article className="room-card" key={descriptor.slotKey}>
                <div className="room-card-heading">
                  <div>
                    <p className="card-kicker">Fixed {descriptor.slotKey}</p>
                    <h3>{room.label}</h3>
                  </div>
                  <span className="room-kind">{room.kind}</span>
                  <SemanticOwnerMarker
                    address={createFixedEntryRoomAddress(biome, descriptor.slotKey)}
                  />
                </div>
                <RoomStateEditor
                  biome={biome}
                  candidateProjection={candidateProjection}
                  catalog={catalog}
                  entryActive={true}
                  occurrence={occurrence}
                  rewardPicker={rewardPicker}
                />
              </article>
            );
          })}
        </div>

        <section className="hub-board" aria-labelledby="hub-board-title">
          <header className="decision-heading">
            <div>
              <div className="owner-markers">
                <p className="card-kicker">Persistent offer board</p>
                <SemanticOwnerMarker address={createHubOpenSetAddress(biome)} />
              </div>
              <h3 id="hub-board-title">Open Ephyra rooms</h3>
            </div>
            <span className="neutral-status">
              {topology.openTargets.length} / {layout.hub.openCount.min}–{layout.hub.openCount.max}
            </span>
          </header>
          <div className="hub-slot-grid">
            {layout.hub.slots.map((slot) => {
              const room = catalog.rooms.byKey[slot.roomGameName];
              if (room === undefined) {
                throw new Error(`Hub slot ${slot.slotKey} room is missing`);
              }
              const target = openBySlot.get(slot.slotKey);
              const occurrence =
                target === undefined
                  ? undefined
                  : requireOccurrence(topology.occurrences, target.occurrenceId);
              const isVisited = visited.has(slot.slotKey);
              const candidateOccurrenceId =
                occurrence?.occurrenceId ?? pendingOccurrenceIds[slot.slotKey];
              if (candidateOccurrenceId === undefined) {
                throw new Error(`Hub slot ${slot.slotKey} has no pending occurrence identity`);
              }
              const slotAddress = createHubSlotAddress(biome, slot.slotKey);
              return (
                <article
                  aria-label={`${room.label} Hub slot`}
                  className="hub-slot-card"
                  data-open={target !== undefined}
                  key={slot.slotKey}
                >
                  <div className="hub-slot-heading">
                    <div>
                      <p className="card-kicker">Door {slot.physicalDoorId}</p>
                      <div className="owner-markers">
                        <h3>{room.label}</h3>
                        <SemanticOwnerMarker address={slotAddress} />
                      </div>
                    </div>
                    <HubSlotMembership
                      candidateOccurrenceId={candidateOccurrenceId}
                      candidateProjection={candidateProjection}
                      disabled={
                        isVisited ||
                        (target === undefined &&
                          topology.openTargets.length >= layout.hub.openCount.max)
                      }
                      label={room.label}
                      onChange={(open) =>
                        dispatch(
                          authoredProjectCommandDispatched(
                            open
                              ? {
                                  kind: 'OpenHubSlot',
                                  slot: slotAddress,
                                  occurrenceId: candidateOccurrenceId,
                                }
                              : { kind: 'CloseHubSlot', slot: slotAddress },
                          ),
                        )
                      }
                      open={target !== undefined}
                      project={project}
                      slotAddress={slotAddress}
                    />
                  </div>
                  <div className="hub-slot-meta">
                    <span className="room-kind">{room.kind}</span>
                    {isVisited && <span className="neutral-status">Visited</span>}
                  </div>
                  {occurrence === undefined ? (
                    <p className="fixed-room-state">Closed fixed slot.</p>
                  ) : (
                    <RoomStateEditor
                      biome={biome}
                      candidateProjection={candidateProjection}
                      catalog={catalog}
                      entryActive={isVisited}
                      occurrence={occurrence}
                      rewardPicker={rewardPicker}
                    />
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <section className="hub-visit-timeline" aria-labelledby="hub-visits-title">
          <header className="decision-heading">
            <div>
              <p className="card-kicker">Player traversal</p>
              <h3 id="hub-visits-title">Pylon visit order</h3>
            </div>
            <span className="neutral-status">
              {topology.visitOrder.length} / {layout.hub.requiredVisits}
            </span>
          </header>
          <ol className="hub-visit-list">
            {Array.from({ length: layout.hub.requiredVisits }, (_, index) => {
              const visitIndex = index + 1;
              const visit = createHubVisitAddress(biome, visitIndex);
              const current = topology.visitOrder[index];
              const isNext = index === topology.visitOrder.length;
              const availableForAppend = topology.openTargets.filter(
                (target) => !topology.visitOrder.includes(target.hubSlotKey),
              );
              return (
                <li className="hub-visit-row" key={visitIndex}>
                  <div className="hub-visit-index">{visitIndex}</div>
                  <div className="hub-visit-content">
                    <div className="owner-markers">
                      <span className="visually-hidden">Visit {visitIndex}</span>
                      <SemanticOwnerMarker address={visit} />
                    </div>
                    {current !== undefined ? (
                      <HubVisitControl
                        candidateProjection={candidateProjection}
                        current={current}
                        hubSlotKeys={topology.openTargets.map((target) => target.hubSlotKey)}
                        labels={roomLabels}
                        onReplace={(hubSlotKey) =>
                          dispatch(
                            authoredProjectCommandDispatched({
                              kind: 'ReplaceHubVisit',
                              visit,
                              hubSlotKey,
                            }),
                          )
                        }
                        project={project}
                        visit={visit}
                      />
                    ) : (
                      <select
                        aria-label={`Visit ${visitIndex} room`}
                        disabled={!isNext || availableForAppend.length === 0}
                        onChange={(event) => {
                          if (event.target.value === '') {
                            return;
                          }
                          dispatch(
                            authoredProjectCommandDispatched({
                              kind: 'AppendHubVisit',
                              visit,
                              hubSlotKey: event.target.value,
                            }),
                          );
                        }}
                        value=""
                      >
                        <option value="">
                          {isNext ? 'Choose next room' : 'Complete prior visit'}
                        </option>
                        {availableForAppend.map((target) => (
                          <option key={target.hubSlotKey} value={target.hubSlotKey}>
                            {roomLabels[target.hubSlotKey] ?? target.hubSlotKey}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  {current !== undefined && (
                    <button
                      aria-label={`Remove visits from Visit ${visitIndex}`}
                      className="danger-action"
                      onClick={() => {
                        if (
                          !globalThis.confirm(
                            `Remove Hub visit ${visitIndex} and every later visit?`,
                          )
                        ) {
                          return;
                        }
                        dispatch(
                          authoredProjectCommandDispatched({ kind: 'RemoveHubVisitsFrom', visit }),
                        );
                      }}
                      type="button"
                    >
                      Remove From Here
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        <section className="visited-room-list" aria-labelledby="visited-rooms-title">
          <header className="decision-heading">
            <div>
              <p className="card-kicker">Visited parent state</p>
              <h3 id="visited-rooms-title">Side-room generation and entry</h3>
            </div>
          </header>
          {topology.visitOrder.map((hubSlotKey, index) => {
            const target = openBySlot.get(hubSlotKey);
            if (target === undefined) {
              throw new Error(`Visited Hub slot ${hubSlotKey} is not open`);
            }
            const occurrence = requireOccurrence(topology.occurrences, target.occurrenceId);
            if (occurrence.state.kind !== 'ephyraCombat') {
              return null;
            }
            const room = catalog.rooms.byKey[occurrence.gameName];
            if (room === undefined) {
              throw new Error(`Visited room ${occurrence.gameName} is missing`);
            }
            if (!room.localChildren.some((child) => child.kind === 'fixedRoomSlots')) {
              return null;
            }
            return (
              <article
                aria-label={`${room.label} visit details`}
                className="visited-room-card"
                key={hubSlotKey}
              >
                <header className="room-card-heading">
                  <div>
                    <p className="card-kicker">Visit {index + 1}</p>
                    <h3>{room.label}</h3>
                  </div>
                  <span className="room-kind">{room.kind}</span>
                </header>
                <EphyraSideRooms
                  biome={biome}
                  candidateProjection={candidateProjection}
                  catalog={catalog}
                  occurrence={occurrence}
                  rewardPicker={rewardPicker}
                  state={occurrence.state}
                />
              </article>
            );
          })}
        </section>

        {(() => {
          const fixed = fixedByKey.get(terminalDescriptor.slotKey);
          if (fixed === undefined) {
            throw new Error(`Hub editor is missing fixed ${terminalDescriptor.slotKey}`);
          }
          const occurrence = requireOccurrence(topology.occurrences, fixed.occurrenceId);
          const room = catalog.rooms.byKey[occurrence.gameName];
          if (room === undefined) {
            throw new Error(`Hub terminal room ${occurrence.gameName} is missing`);
          }
          return (
            <article className="room-card terminal-card">
              <div className="room-card-heading">
                <div>
                  <p className="card-kicker">Fixed terminal</p>
                  <h3>{room.label}</h3>
                </div>
                <span className="room-kind">{room.kind}</span>
                <SemanticOwnerMarker
                  address={createFixedEntryRoomAddress(biome, terminalDescriptor.slotKey)}
                />
              </div>
              <RoomStateEditor
                biome={biome}
                candidateProjection={candidateProjection}
                catalog={catalog}
                entryActive={true}
                occurrence={occurrence}
                rewardPicker={rewardPicker}
              />
            </article>
          );
        })()}
      </section>
    </SemanticFindingsScope>
  );
}

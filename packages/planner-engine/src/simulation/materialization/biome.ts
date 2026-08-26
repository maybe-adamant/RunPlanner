import type {
  BiomeLayout,
  Catalog,
  HubDecisionDescriptor,
  RoomDeclaration,
} from '../../catalog-schema';
import {
  createExitDecisionAddress,
  createExitSelectionAddress,
  createHubDecisionAddress,
  createHubVisitAddress,
  type BiomeAddress,
  type ExitDecisionSourceAddress,
} from '../../authored-project/addresses';
import type {
  AuthoredBiomeState,
  AuthoredBiomePlan,
  BiomeTopology,
  ExitDecision,
  ExitDecisionSource,
  ExitTargetReference,
  HubDecision,
  OccurrenceId,
  RoomOccurrence,
  RouteWeaponAspectLoadout,
} from '../../authored-project/model';
import {
  additionalExitsForDecision,
  exitDecisionForSource,
  hubDecisionHandoffReadiness,
  hubTerminalTakeoverForSource,
  isExactTerminalTakeoverEnvelope,
  selectedExitContinuation,
  selectedExitKey,
} from '../../authored-project/topology/query';
import { legalTopologyOccurrenceRoom } from '../../authored-project/topology/room-ownership';
import { createDefaultCompletionOccurrences } from '../../authored-project/room-state/defaults';
import type { CompleteBiomeCompletenessResult } from '../completeness';
import { batchTakesOverNormalDoors } from './decision-facts';
import {
  BiomeMaterializationContractError,
  canonicalPhysicalExits,
  initialClockworkState,
  materializeAdditionalContinuations,
  materializeBatch,
  selectedBatchContinuation,
  type ClockworkState,
} from './batch';
import { materializeHubDecision } from './hub';
import { materializeAuthoredRoom } from './rooms';
import type {
  CanonicalAuthoredRoom,
  CanonicalAdditionalContinuation,
  CanonicalBatch,
  CanonicalBiome,
  CanonicalBiomeState,
  CanonicalDecision,
  CanonicalDecisionParent,
  CanonicalRoomReference,
  MaterializedBiomePrefix,
  MaterializedExitDecisionFrontier,
  MaterializedHubContinuationFrontier,
  MaterializedHubDecisionFrontier,
} from './model';

function fail(detail: string): never {
  throw new BiomeMaterializationContractError(detail);
}

function requireLoadout(context: RouteWeaponAspectLoadout): RouteWeaponAspectLoadout {
  if (
    context === null ||
    typeof context !== 'object' ||
    typeof context.weaponKey !== 'string' ||
    context.weaponKey.length === 0 ||
    typeof context.aspectKey !== 'string' ||
    context.aspectKey.length === 0
  ) {
    fail('public biome materialization requires a route weapon and aspect loadout');
  }
  return Object.freeze({ weaponKey: context.weaponKey, aspectKey: context.aspectKey });
}

function sourceAddress(source: ExitDecisionSource): ExitDecisionSourceAddress {
  return source.kind === 'occurrence'
    ? Object.freeze({ kind: 'occurrence', occurrenceId: source.occurrenceId })
    : Object.freeze({ kind: 'hubDecision', decisionKey: source.decisionKey });
}

function requireLayout(catalog: Catalog, biome: BiomeAddress): BiomeLayout {
  const route = catalog.routes.byKey[biome.routeKey];
  if (route === undefined || !route.biomeKeys.includes(biome.biomeKey)) {
    fail(`${biome.routeKey} does not place biome ${biome.biomeKey}`);
  }
  const layout = catalog.biomeLayouts.byKey[biome.biomeKey];
  if (layout === undefined) fail(`catalog has no ${biome.biomeKey} layout`);
  return layout;
}

function occurrenceMap(topology: BiomeTopology): ReadonlyMap<OccurrenceId, RoomOccurrence> {
  return new Map(topology.occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence]));
}

function requireOccurrence(
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  occurrenceId: OccurrenceId,
): RoomOccurrence {
  const occurrence = occurrences.get(occurrenceId);
  if (occurrence === undefined) fail(`trusted topology lost occurrence ${occurrenceId}`);
  return occurrence;
}

function requireRoom(
  catalog: Catalog,
  layout: BiomeLayout,
  topology: BiomeTopology,
  occurrence: RoomOccurrence,
): RoomDeclaration {
  const room = legalTopologyOccurrenceRoom(catalog, layout, topology, occurrence.occurrenceId);
  if (room === undefined) fail(`trusted topology lost legal room ${occurrence.gameName}`);
  return room;
}

function requireCatalogRoom(catalog: Catalog, occurrence: RoomOccurrence): RoomDeclaration {
  const room = catalog.rooms.byKey[occurrence.gameName];
  if (room === undefined) fail(`trusted topology lost room ${occurrence.gameName}`);
  return room;
}

function roomReference(room: CanonicalAuthoredRoom): CanonicalRoomReference {
  return Object.freeze({
    origin: room.origin,
    occurrenceId: room.occurrenceId,
    gameName: room.gameName,
  });
}

function canonicalBiomeState(biomeKey: string, state: AuthoredBiomeState): CanonicalBiomeState {
  const unresolved = Object.entries(state).find(([, value]) => value === null);
  if (unresolved !== undefined) fail(`${biomeKey} has no authored ${unresolved[0]}`);
  return Object.freeze(
    Object.fromEntries(Object.entries(state)) as Record<string, boolean | number | string>,
  );
}
function hubDecisionForSource(
  topology: BiomeTopology,
  descriptor: HubDecisionDescriptor,
  source: ExitDecisionSource,
): HubDecision | undefined {
  if (source.kind !== 'occurrence') return undefined;
  return topology.decisions.find(
    (candidate): candidate is HubDecision =>
      candidate.kind === 'hub' &&
      candidate.hubKey === descriptor.hubKey &&
      candidate.source.occurrenceId === source.occurrenceId,
  );
}

function handoffDecision(topology: BiomeTopology, descriptor: HubDecisionDescriptor): ExitDecision {
  const decision = exitDecisionForSource(topology, {
    kind: 'hubDecision',
    decisionKey: descriptor.hubKey,
  });
  if (decision === undefined) fail(`${descriptor.hubKey} completed-Hub exit is missing`);
  return decision;
}

function materializeStart(
  catalog: Catalog,
  biome: BiomeAddress,
  layout: BiomeLayout,
  topology: BiomeTopology,
  occurrence: RoomOccurrence,
  loadout?: RouteWeaponAspectLoadout,
): CanonicalAuthoredRoom {
  const room = requireRoom(catalog, layout, topology, occurrence);
  return materializeAuthoredRoom({
    catalog,
    biome,
    room,
    occurrence,
    role: 'ordinary',
    entered: true,
    ...(loadout === undefined ? {} : { loadout }),
  });
}

function prefix(
  biome: BiomeAddress,
  biomeState: CanonicalBiomeState,
  entryRoom: CanonicalAuthoredRoom | undefined,
  decisions: readonly CanonicalDecision[],
  frontier?: MaterializedExitDecisionFrontier | MaterializedHubDecisionFrontier,
  automaticRooms?: CanonicalBiome['automaticRooms'],
): MaterializedBiomePrefix {
  return Object.freeze({
    kind: 'biomePrefix',
    routeKey: biome.routeKey,
    biomeKey: biome.biomeKey,
    ...(entryRoom === undefined ? {} : { entryRoom }),
    decisions: Object.freeze([...decisions]),
    ...(automaticRooms === undefined ? {} : { automaticRooms }),
    ...(frontier === undefined ? {} : { frontier }),
    biomeState,
  });
}

function automaticTailForSelectedPreboss(
  catalog: Catalog,
  biome: BiomeAddress,
  layout: BiomeLayout,
  completionOccurrences: readonly RoomOccurrence[],
  loadout: RouteWeaponAspectLoadout,
  preboss: CanonicalAuthoredRoom,
): CanonicalBiome['automaticRooms'] {
  return Object.freeze(
    completionOccurrences.map((occurrence) => {
      const room = catalog.rooms.byKey[occurrence.gameName];
      if (room?.mode.kind !== 'automatic') fail(`${occurrence.gameName} is not an automatic room`);
      const materialized = materializeAuthoredRoom({
        catalog,
        biome,
        room,
        occurrence,
        role: 'automatic',
        entered: true,
        loadout,
      });
      const inheritedStoreKey =
        room.enteredRewardStoreHistory.kind === 'resolvedOffer'
          ? preboss.incomingReward?.resolvedStoreKey
          : room.enteredRewardStoreHistory.kind === 'fixed'
            ? room.enteredRewardStoreHistory.storeKey
            : undefined;
      return inheritedStoreKey === undefined
        ? materialized
        : Object.freeze({ ...materialized, enteredRewardStoreKey: inheritedStoreKey });
    }),
  );
}

/**
 * N's bounded Hub progression has two deliberately narrow empty envelopes.
 * They still complete the entered source-room lifecycle against an empty
 * outgoing projection: Opening exposes its depth-one entry picker, and the
 * selected PreHub exposes the depth-two terminal Hub takeover. Ordinary empty
 * decisions intentionally do not acquire this continuation behavior.
 */
function hubContinuationFrontier(
  catalog: Catalog,
  layout: BiomeLayout,
  topology: BiomeTopology,
  source: ExitDecisionSource,
  decision: ExitDecision | undefined,
): MaterializedHubContinuationFrontier | undefined {
  if (
    layout.progression.kind !== 'hub' ||
    source.kind !== 'occurrence' ||
    decision === undefined ||
    !isExactTerminalTakeoverEnvelope(decision)
  ) {
    return undefined;
  }
  if (source.occurrenceId === topology.startOccurrenceId) {
    return Object.freeze({ kind: 'boundedEntry', hubKey: layout.progression.hubKey });
  }
  const terminal = hubTerminalTakeoverForSource(catalog, layout, topology, source);
  return terminal === undefined
    ? undefined
    : Object.freeze({ kind: 'terminalTakeover', hubKey: terminal.hubKey });
}

function decisionFrontier(
  biome: BiomeAddress,
  decision: ExitDecision | undefined,
  source: ExitDecisionSource,
  parent: CanonicalDecisionParent,
  partial?: CanonicalBatch,
  hubContinuation?: MaterializedHubContinuationFrontier,
  additional: readonly CanonicalAdditionalContinuation[] = Object.freeze([]),
): MaterializedExitDecisionFrontier {
  const address = sourceAddress(source);
  const pickedExitKey = decision === undefined ? null : selectedExitKey(decision);
  if (decision?.selection.kind === 'derived' && pickedExitKey === undefined) {
    fail('complete width-one batch has no target');
  }
  return Object.freeze({
    kind: 'exitDecision',
    origin: createExitDecisionAddress(biome, address),
    parent,
    targets: partial?.targets ?? Object.freeze([]),
    additional,
    ...(partial === undefined ? {} : { partialBatch: partial, batchState: partial.batchState }),
    selectedExitKey: pickedExitKey ?? null,
    selectedOrigin: createExitSelectionAddress(biome, address),
    ...(hubContinuation === undefined ? {} : { hubContinuation }),
  });
}

function isCompleteBatch(
  catalog: Catalog,
  layout: BiomeLayout,
  topology: BiomeTopology,
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  decision: ExitDecision,
): boolean {
  if (decision.selection.kind === 'unresolved') return false;
  const normal = decision.normal;
  const takeover = batchTakesOverNormalDoors(
    catalog,
    (occurrenceId) => occurrences.get(occurrenceId),
    decision,
  );
  const physicalExits = canonicalPhysicalExits(catalog, layout, topology, decision.source);
  const allPhysicalTargets = [...physicalExits.keys()].every((exitKey) =>
    normal.targets.some((target) => target.exitKey === exitKey),
  );
  const hasStore =
    takeover ||
    normal.rewardStore.kind !== 'authoredBaseStore' ||
    normal.rewardStore.baseRewardStoreKey !== null;
  const selected = selectedExitContinuation(
    decision,
    additionalExitsForDecision(topology, decision),
  );
  if (decision.selection.kind === 'derived' && selected?.kind !== 'normal') {
    fail('complete width-one batch has no target');
  }
  const pickedOccurrence =
    selected?.kind === 'normal'
      ? occurrences.get(selected.target.occurrenceId)
      : selected?.kind === 'additional'
        ? occurrences.get(selected.exit.occurrenceId)
        : undefined;
  const selectedNaturalChaos =
    selected?.kind === 'additional' &&
    (selected.exit.kind === 'naturalChaos' || selected.exit.kind === 'sparkChaos');
  return (
    (selectedNaturalChaos || (allPhysicalTargets && hasStore)) &&
    selected !== undefined &&
    !(pickedOccurrence?.state.kind === 'shop' && pickedOccurrence.state.shop === undefined)
  );
}

function materializeContiguousBatchPrefix(
  catalog: Catalog,
  biome: BiomeAddress,
  layout: BiomeLayout,
  topology: BiomeTopology,
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  decision: ExitDecision | undefined,
  parent: CanonicalDecisionParent,
  sourceRoom: RoomDeclaration | undefined,
  sourceAuthoredRoom: CanonicalAuthoredRoom | undefined,
  clockwork: ClockworkState | undefined,
  loadout?: RouteWeaponAspectLoadout,
): CanonicalBatch | undefined {
  if (decision === undefined || sourceRoom === undefined) return undefined;
  const takeover = batchTakesOverNormalDoors(
    catalog,
    (occurrenceId) => occurrences.get(occurrenceId),
    decision,
  );
  if (
    !takeover &&
    decision.normal.rewardStore.kind === 'authoredBaseStore' &&
    decision.normal.rewardStore.baseRewardStoreKey === null
  ) {
    return undefined;
  }
  const targetsByExit = new Map(
    decision.normal.targets.map((target) => [target.exitKey, target] as const),
  );
  const physicalExits = canonicalPhysicalExits(catalog, layout, topology, decision.source);
  const contiguous: ExitTargetReference[] = [];
  for (const exitKey of physicalExits.keys()) {
    const target = targetsByExit.get(exitKey);
    if (target === undefined) break;
    contiguous.push(target);
  }
  if (contiguous.length === 0) return undefined;
  const partialDecision: ExitDecision = Object.freeze({
    ...decision,
    normal: Object.freeze({ ...decision.normal, targets: Object.freeze(contiguous) }),
  });
  return materializeBatch(
    catalog,
    biome,
    layout,
    topology,
    occurrences,
    partialDecision,
    parent,
    sourceAuthoredRoom,
    clockwork,
    { allowUnselected: true, physicalExits },
    loadout,
  ).batch;
}

/**
 * Materializes only the structurally complete selected prefix. The first
 * absent or unresolved decision remains explicit frontier state; it is never
 * silently reinterpreted as a completed room choice.
 */
export function materializeBiomePrefix(
  catalog: Catalog,
  biome: BiomeAddress,
  plan: AuthoredBiomePlan,
  loadout: RouteWeaponAspectLoadout,
): MaterializedBiomePrefix | null {
  loadout = requireLoadout(loadout);
  const layout = requireLayout(catalog, biome);
  if (Object.values(plan.state).some((value) => value === null)) return null;
  const biomeState = canonicalBiomeState(layout.biomeKey, plan.state);
  const topology = plan.topology;
  if (topology === null) return prefix(biome, biomeState, undefined, []);
  const occurrences = occurrenceMap(topology);
  const startOccurrence = requireOccurrence(occurrences, topology.startOccurrenceId);
  const entryRoom = materializeStart(catalog, biome, layout, topology, startOccurrence, loadout);
  const decisions: CanonicalDecision[] = [];
  let current = entryRoom;
  let clockwork =
    layout.progression.kind === 'generated'
      ? initialClockworkState(layout.progression, biomeState)
      : undefined;
  const traversed = new Set<OccurrenceId>();
  while (!traversed.has(current.occurrenceId)) {
    traversed.add(current.occurrenceId);
    const source: ExitDecisionSource = Object.freeze({
      kind: 'occurrence',
      occurrenceId: current.occurrenceId,
    });
    const decision = exitDecisionForSource(topology, source);
    const sourceRoom = requireRoom(
      catalog,
      layout,
      topology,
      requireOccurrence(occurrences, current.occurrenceId),
    );
    if (decision === undefined) {
      const authoredHub =
        layout.progression.kind === 'hub'
          ? hubDecisionForSource(topology, layout.progression, source)
          : undefined;
      if (authoredHub !== undefined && layout.progression.kind === 'hub') {
        const hub = materializeHubDecision(
          catalog,
          biome,
          layout.progression,
          authoredHub,
          topology.decisions.filter((candidate) => candidate.kind === 'localVisit'),
          occurrences,
          loadout,
        );
        decisions.push(hub);
        const hubReadiness = hubDecisionHandoffReadiness(layout.progression, authoredHub);
        if (hubReadiness.kind === 'openSetIncomplete') {
          return prefix(
            biome,
            biomeState,
            entryRoom,
            decisions,
            Object.freeze({
              kind: 'hubBoard',
              origin: createHubDecisionAddress(biome, layout.progression.hubKey),
            }),
          );
        }
        if (hubReadiness.kind === 'visitOrderIncomplete') {
          return prefix(
            biome,
            biomeState,
            entryRoom,
            decisions,
            Object.freeze({
              kind: 'hubVisit',
              origin: createHubVisitAddress(
                biome,
                layout.progression.hubKey,
                hubReadiness.actualCount + 1,
              ),
            }),
          );
        }
        if (hubReadiness.kind !== 'ready') {
          fail(`${layout.progression.hubKey} Hub handoff lost its authored decision`);
        }
        const handoffSource: ExitDecisionSource = Object.freeze({
          kind: 'hubDecision',
          decisionKey: layout.progression.hubKey,
        });
        const handoff = exitDecisionForSource(topology, handoffSource);
        const parent = Object.freeze({ origin: hub.room.origin, gameName: hub.room.gameName });
        if (
          handoff === undefined ||
          !isCompleteBatch(catalog, layout, topology, occurrences, handoff)
        ) {
          return prefix(
            biome,
            biomeState,
            entryRoom,
            decisions,
            decisionFrontier(biome, handoff, handoffSource, parent),
          );
        }
        const materialized = materializeBatch(
          catalog,
          biome,
          layout,
          topology,
          occurrences,
          handoff,
          parent,
          undefined,
          undefined,
          { physicalExits: canonicalPhysicalExits(catalog, layout, topology, handoff.source) },
          loadout,
        );
        decisions.push(materialized.batch);
        const selected = selectedBatchContinuation(materialized.batch);
        return prefix(
          biome,
          biomeState,
          entryRoom,
          decisions,
          undefined,
          selected?.kind === 'normal' && selected.target.continuation === 'startsCompletion'
            ? automaticTailForSelectedPreboss(
                catalog,
                biome,
                layout,
                plan.completionOccurrences,
                loadout,
                selected.target.room,
              )
            : undefined,
        );
      }
      return prefix(
        biome,
        biomeState,
        entryRoom,
        decisions,
        decisionFrontier(biome, undefined, source, roomReference(current)),
      );
    }
    if (!isCompleteBatch(catalog, layout, topology, occurrences, decision)) {
      const hubContinuation = hubContinuationFrontier(catalog, layout, topology, source, decision);
      const partial = materializeContiguousBatchPrefix(
        catalog,
        biome,
        layout,
        topology,
        occurrences,
        decision,
        roomReference(current),
        sourceRoom,
        current,
        clockwork,
        loadout,
      );
      const additional =
        partial?.additional ??
        materializeAdditionalContinuations(
          catalog,
          biome,
          layout,
          topology,
          occurrences,
          decision,
          loadout,
        );
      return prefix(
        biome,
        biomeState,
        entryRoom,
        decisions,
        decisionFrontier(
          biome,
          decision,
          source,
          roomReference(current),
          partial,
          hubContinuation,
          additional,
        ),
      );
    }
    const materialized = materializeBatch(
      catalog,
      biome,
      layout,
      topology,
      occurrences,
      decision,
      roomReference(current),
      current,
      clockwork,
      { physicalExits: canonicalPhysicalExits(catalog, layout, topology, decision.source) },
      loadout,
    );
    decisions.push(materialized.batch);
    clockwork = materialized.nextClockwork;
    const selected = selectedBatchContinuation(materialized.batch);
    if (selected === undefined) {
      return prefix(biome, biomeState, entryRoom, decisions);
    }
    if (selected.kind === 'normal' && selected.target.continuation === 'startsCompletion') {
      return prefix(
        biome,
        biomeState,
        entryRoom,
        decisions,
        undefined,
        automaticTailForSelectedPreboss(
          catalog,
          biome,
          layout,
          plan.completionOccurrences,
          loadout,
          selected.target.room,
        ),
      );
    }
    current = selected.kind === 'normal' ? selected.target.room : selected.continuation.room;
  }
  fail(`${layout.biomeKey} prefix selected spine contains a cycle`);
}

export function materializeBiome(
  catalog: Catalog,
  biome: BiomeAddress,
  completeness: CompleteBiomeCompletenessResult,
  loadout: RouteWeaponAspectLoadout,
  completionOccurrences = createDefaultCompletionOccurrences(catalog, biome.biomeKey, loadout),
  echoKeepsakeReplayResults?: Pick<
    import('../../authored-project/model').AuthoredKeepsakeEquipResults,
    'experimentalHammer'
  >,
): CanonicalBiome {
  loadout = requireLoadout(loadout);
  if (completeness.completion !== 'complete') fail('biome materialization requires completeness');
  const layout = requireLayout(catalog, biome);
  const topology = completeness.topology;
  const occurrences = occurrenceMap(topology);
  const biomeState = canonicalBiomeState(layout.biomeKey, completeness.biomeState);
  const startOccurrence = requireOccurrence(occurrences, topology.startOccurrenceId);
  const entryRoom = materializeStart(catalog, biome, layout, topology, startOccurrence, loadout);
  const decisions: CanonicalDecision[] = [];
  let currentRoom = entryRoom;
  let clockwork =
    layout.progression.kind === 'generated'
      ? initialClockworkState(layout.progression, biomeState)
      : undefined;
  let enteredPreboss: CanonicalAuthoredRoom | undefined;
  const traversed = new Set<OccurrenceId>();

  while (!traversed.has(currentRoom.occurrenceId)) {
    traversed.add(currentRoom.occurrenceId);
    const source: ExitDecisionSource = Object.freeze({
      kind: 'occurrence',
      occurrenceId: currentRoom.occurrenceId,
    });
    const decision = exitDecisionForSource(topology, source);
    if (decision === undefined) {
      const authoredHub =
        layout.progression.kind === 'hub'
          ? hubDecisionForSource(topology, layout.progression, source)
          : undefined;
      if (authoredHub !== undefined && layout.progression.kind === 'hub') {
        const hub = materializeHubDecision(
          catalog,
          biome,
          layout.progression,
          authoredHub,
          topology.decisions.filter((candidate) => candidate.kind === 'localVisit'),
          occurrences,
          loadout,
        );
        decisions.push(hub);
        const handoff = handoffDecision(topology, layout.progression);
        const materialized = materializeBatch(
          catalog,
          biome,
          layout,
          topology,
          occurrences,
          handoff,
          Object.freeze({ origin: hub.room.origin, gameName: hub.room.gameName }),
          undefined,
          undefined,
          { physicalExits: canonicalPhysicalExits(catalog, layout, topology, handoff.source) },
          loadout,
        );
        decisions.push(materialized.batch);
        enteredPreboss = materialized.batch.targets.find((target) => target.picked)?.room;
        break;
      }
      fail(`${currentRoom.gameName} has no selected-spine exit decision`);
    }
    const materialized = materializeBatch(
      catalog,
      biome,
      layout,
      topology,
      occurrences,
      decision,
      roomReference(currentRoom),
      currentRoom,
      clockwork,
      { physicalExits: canonicalPhysicalExits(catalog, layout, topology, decision.source) },
      loadout,
    );
    decisions.push(materialized.batch);
    clockwork = materialized.nextClockwork;
    const selected = selectedBatchContinuation(materialized.batch);
    if (selected === undefined) fail(`${currentRoom.gameName} lost selected target`);
    if (selected.kind === 'normal' && selected.target.continuation === 'startsCompletion') {
      enteredPreboss = selected.target.room;
      break;
    }
    currentRoom = selected.kind === 'normal' ? selected.target.room : selected.continuation.room;
  }
  if (enteredPreboss === undefined) fail(`${layout.biomeKey} has no selected Preboss`);
  const automaticRooms = automaticTailForSelectedPreboss(
    catalog,
    biome,
    layout,
    completionOccurrences,
    loadout,
    enteredPreboss,
  );
  return Object.freeze({
    kind: 'biome',
    routeKey: biome.routeKey,
    biomeKey: layout.biomeKey,
    entryRoom,
    decisions: Object.freeze(decisions),
    automaticRooms,
    biomeState,
    ...(echoKeepsakeReplayResults === undefined ? {} : { echoKeepsakeReplayResults }),
  });
}

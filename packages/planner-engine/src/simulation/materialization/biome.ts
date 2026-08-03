import type {
  BiomeLayout,
  Catalog,
  GeneratedProgressionDescriptor,
  HubDecisionDescriptor,
  RoomDeclaration,
} from '../../catalog-schema';
import {
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createHubDecisionAddress,
  createHubVisitAddress,
  createTargetAddress,
  type BiomeAddress,
  type ExitDecisionSourceAddress,
} from '../../authored-project/addresses';
import type {
  AuthoredBiomeState,
  AuthoredBiomePlan,
  BatchRewardStoreState,
  BiomeTopology,
  ExitDecision,
  ExitDecisionSource,
  ExitTargetReference,
  HubDecision,
  OccurrenceId,
  RoomOccurrence,
} from '../../authored-project/model';
import {
  declaredPhysicalExits,
  exitDecisionForSource,
  hubDecisionHandoffReadiness,
  hubTerminalTakeoverForSource,
  isExactTerminalTakeoverEnvelope,
  possibleGeneratedNormalExitKeys,
  selectedExitKey,
  selectedExitTarget,
} from '../../authored-project/topology/query';
import type { CompleteBiomeCompletenessResult } from '../completeness';
import { materializeCompletionRooms } from './completion';
import { batchTakesOverNormalDoors, fieldsBatchFacts, targetContinuation } from './decision-facts';
import { materializeHubDecision } from './hub';
import { materializeAuthoredRoom, type AuthoredRoomRole } from './rooms';
import type {
  CanonicalAuthoredRoom,
  CanonicalBatch,
  CanonicalBatchRewardStore,
  CanonicalBatchState,
  CanonicalBiome,
  CanonicalBiomeState,
  CanonicalDecision,
  CanonicalDecisionParent,
  CanonicalPhysicalExit,
  CanonicalRoomReference,
  CanonicalTarget,
  MaterializedBiomePrefix,
  MaterializedExitDecisionFrontier,
  MaterializedHubContinuationFrontier,
  MaterializedHubDecisionFrontier,
} from './model';

export class BiomeMaterializationContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'BiomeMaterializationContractError';
  }
}

function fail(detail: string): never {
  throw new BiomeMaterializationContractError(detail);
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

function requireRoom(catalog: Catalog, occurrence: RoomOccurrence): RoomDeclaration {
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

function exitIndex(exitKey: string): number {
  const match = /^exit(\d+)$/.exec(exitKey);
  return match === null ? 1 : Number(match[1]);
}

/**
 * The topology query owns non-default physical identities such as N's
 * `prehub` exit key. Materialization preserves that key while still exposing
 * the declaration's physical exit facts through the ordinary batch product.
 */
function canonicalPhysicalExits(
  catalog: Catalog,
  layout: BiomeLayout,
  topology: BiomeTopology,
  source: ExitDecisionSource,
): ReadonlyMap<string, CanonicalPhysicalExit> {
  const exits = declaredPhysicalExits(catalog, layout, topology, source);
  if (exits === undefined) {
    fail(`${layout.biomeKey} source has no declaration-owned physical exits`);
  }
  return new Map(
    exits.map((exit) => [
      exit.exitKey,
      Object.freeze({
        kind: 'available' as const,
        exitKey: exit.exitKey,
        index: exit.index,
        type: exit.type,
        compatibilityPolicyKey: exit.compatibilityPolicyKey,
      }),
    ]),
  );
}

/**
 * Replacing a generated source room can narrow its physical door set while
 * retaining an already-authored target until an explicit capacity repair.
 * The topology codec admits only this biome's declaration-owned `exitN`
 * vocabulary, so materialization preserves such a target as semantically
 * unavailable. Invented keys and every bounded-Hub source remain structural
 * contract failures instead of being quietly converted into an unavailable
 * door.
 */
function retainedUnavailablePhysicalExit(
  catalog: Catalog,
  layout: BiomeLayout,
  decision: ExitDecision,
  exitKey: string,
): CanonicalPhysicalExit | undefined {
  if (layout.progression.kind !== 'generated' || decision.source.kind !== 'occurrence') {
    return undefined;
  }
  if (!possibleGeneratedNormalExitKeys(catalog, layout).includes(exitKey)) {
    return undefined;
  }
  const match = /^exit(\d+)$/.exec(exitKey);
  if (match === null) return undefined;
  const index = Number(match[1]);
  return Object.freeze({ kind: 'unavailable', exitKey, index });
}

export function orderedTargets(
  targets: readonly ExitTargetReference[],
): readonly ExitTargetReference[] {
  return Object.freeze(
    [...targets].sort((left, right) => {
      return (
        exitIndex(left.exitKey) - exitIndex(right.exitKey) ||
        left.exitKey.localeCompare(right.exitKey)
      );
    }),
  );
}

function canonicalRewardStore(
  biome: BiomeAddress,
  source: ExitDecisionSourceAddress,
  state: BatchRewardStoreState,
  takeover: boolean,
): CanonicalBatchRewardStore {
  const origin = createBatchRewardStoreAddress(biome, source);
  if (state.kind === 'authoredBaseStore') {
    if (state.baseRewardStoreKey === null) {
      if (takeover) return Object.freeze({ origin, kind: 'none' });
      fail('complete batch has no authored reward store');
    }
    return Object.freeze({
      origin,
      kind: state.kind,
      baseRewardStoreKey: state.baseRewardStoreKey,
    });
  }
  return Object.freeze({ origin, kind: state.kind });
}

function batchStoreKey(
  parent: CanonicalAuthoredRoom | undefined,
  state: BatchRewardStoreState,
): string | undefined {
  if (state.kind === 'authoredBaseStore') return state.baseRewardStoreKey ?? undefined;
  if (state.kind === 'sourceOfferPoint') {
    const wheel = parent?.rewardWheels?.at(-1);
    if (wheel === undefined) fail(`${parent?.gameName ?? 'Hub'} has no active source reward wheel`);
    return wheel.storeKey;
  }
  return undefined;
}

/**
 * A forced target store updates the shared store used by its physical batch.
 * Earlier ordinary peers materialize against that final store, while an
 * individual target override remains local to that target.
 */
export function finalSharedBatchStoreKey(
  catalog: Catalog,
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  targets: readonly ExitTargetReference[],
  initialStoreKey: string | undefined,
): string | undefined {
  let storeKey = initialStoreKey;
  for (const target of targets) {
    const room = requireRoom(catalog, requireOccurrence(occurrences, target.occurrenceId));
    if (room.forcedRewardStoreKey !== undefined) storeKey = room.forcedRewardStoreKey;
  }
  return storeKey;
}

interface ClockworkState {
  readonly goalsRemaining: number;
  readonly nonGoalRewardsAcquired: number;
  readonly maxNonGoalRewards: number;
}

function initialClockworkState(
  layout: GeneratedProgressionDescriptor,
  biomeState: CanonicalBiomeState,
): ClockworkState | undefined {
  if (layout.batchPolicy.kind !== 'clockwork') return undefined;
  const maxNonGoalRewards = biomeState.maxNonGoalRewards;
  if (typeof maxNonGoalRewards !== 'number' || !Number.isInteger(maxNonGoalRewards)) {
    fail('Clockwork progression has no maxNonGoalRewards');
  }
  return Object.freeze({
    goalsRemaining: layout.batchPolicy.initialGoalCount,
    nonGoalRewardsAcquired: 0,
    maxNonGoalRewards,
  });
}

function clockworkReward(
  room: RoomDeclaration,
  state: ClockworkState,
  goalAlreadyOffered: boolean,
): 'goal' | 'nonGoal' | undefined {
  if (room.kind === 'Preboss') return 'goal';
  if (room.kind === 'Story') return undefined;
  if (room.kind !== 'Combat') return 'nonGoal';
  return (state.goalsRemaining > 0 && !goalAlreadyOffered) ||
    state.nonGoalRewardsAcquired >= state.maxNonGoalRewards
    ? 'goal'
    : 'nonGoal';
}

function advanceClockworkState(
  state: ClockworkState,
  reward: 'goal' | 'nonGoal' | undefined,
): ClockworkState {
  if (reward === undefined) return state;
  return reward === 'goal'
    ? Object.freeze({ ...state, goalsRemaining: Math.max(0, state.goalsRemaining - 1) })
    : Object.freeze({ ...state, nonGoalRewardsAcquired: state.nonGoalRewardsAcquired + 1 });
}

function materializeBatchState(
  catalog: Catalog,
  layout: BiomeLayout,
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  decision: ExitDecision,
  takeover: boolean,
  clockwork: ClockworkState | undefined,
): CanonicalBatchState {
  if (takeover || layout.progression.kind !== 'generated') {
    return Object.freeze({ kind: 'standard' });
  }
  const policy = layout.progression.batchPolicy;
  if (policy.kind === 'standard') return Object.freeze({ kind: 'standard' });
  if (policy.kind === 'clockwork') {
    if (clockwork === undefined) fail(`${layout.biomeKey} Clockwork state is unavailable`);
    return Object.freeze({ kind: 'clockwork', ...clockwork });
  }
  if (decision.normal.batchState === null) {
    fail(`${layout.biomeKey} Fields batch has no authored cage outcome`);
  }
  const fields = fieldsBatchFacts(
    catalog,
    layout,
    (occurrenceId) => occurrences.get(occurrenceId),
    decision,
  );
  if (fields === undefined) fail(`${layout.biomeKey} Fields batch has no authored cage outcome`);
  return Object.freeze({
    kind: 'fields',
    ...fields,
  });
}

function prebossRole(room: RoomDeclaration, targetIndex: number): AuthoredRoomRole {
  if (room.kind !== 'Preboss') return 'ordinary';
  if (room.prebossBatchPolicy?.kind === 'takeOverNormalDoors') {
    return targetIndex === 0 ? 'prebossShop' : 'prebossFreeReward';
  }
  return 'prebossShop';
}

function materializeTarget(
  catalog: Catalog,
  biome: BiomeAddress,
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  source: ExitDecisionSourceAddress,
  target: ExitTargetReference,
  targetIndex: number,
  selectedExitKey: string | undefined,
  batchStore: string | undefined,
  batchState: CanonicalBatchState,
  clockworkRewardValue: 'goal' | 'nonGoal' | undefined,
  physicalExit: CanonicalPhysicalExit,
): CanonicalTarget {
  const occurrence = requireOccurrence(occurrences, target.occurrenceId);
  const room = requireRoom(catalog, occurrence);
  const picked = target.exitKey === selectedExitKey;
  return Object.freeze({
    origin: createTargetAddress(biome, source, target.exitKey),
    exit: physicalExit,
    picked,
    continuation: targetContinuation(picked, room.kind),
    room: materializeAuthoredRoom({
      catalog,
      biome,
      room,
      occurrence,
      role: prebossRole(room, targetIndex),
      entered: picked,
      ...(batchStore === undefined ? {} : { batchStoreKey: batchStore }),
      ...(batchState.kind === 'fields' ? { activeCageCount: batchState.doorCageRewardCount } : {}),
      ...(clockworkRewardValue === undefined ? {} : { clockworkReward: clockworkRewardValue }),
    }),
  });
}

function materializeBatch(
  catalog: Catalog,
  biome: BiomeAddress,
  layout: BiomeLayout,
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  decision: ExitDecision,
  parent: CanonicalDecisionParent,
  sourceAuthoredRoom: CanonicalAuthoredRoom | undefined,
  clockwork: ClockworkState | undefined,
  options: {
    readonly allowUnselected?: boolean;
    readonly physicalExits: ReadonlyMap<string, CanonicalPhysicalExit>;
  },
): { readonly batch: CanonicalBatch; readonly nextClockwork: ClockworkState | undefined } {
  const normal = decision.normal;
  const source = sourceAddress(decision.source);
  const takeover = batchTakesOverNormalDoors(
    catalog,
    (occurrenceId) => occurrences.get(occurrenceId),
    decision,
  );
  const batchState = materializeBatchState(
    catalog,
    layout,
    occurrences,
    decision,
    takeover,
    clockwork,
  );
  const selected = selectedExitKey(decision);
  if (decision.selection.kind === 'derived' && selected === undefined) {
    fail('complete width-one batch has no target');
  }
  const ordered = orderedTargets(normal.targets);
  const sharedBatchStoreKey = finalSharedBatchStoreKey(
    catalog,
    occurrences,
    ordered,
    batchStoreKey(sourceAuthoredRoom, normal.rewardStore),
  );
  let goalAlreadyOffered = false;
  const rewards = new Map<string, 'goal' | 'nonGoal' | undefined>();
  if (batchState.kind === 'clockwork') {
    for (const target of ordered) {
      const room = requireRoom(catalog, requireOccurrence(occurrences, target.occurrenceId));
      const reward = clockworkReward(room, batchState, goalAlreadyOffered);
      if (reward === 'goal') goalAlreadyOffered = true;
      rewards.set(target.exitKey, reward);
    }
  }
  const targets = Object.freeze(
    ordered.map((target, index) => {
      const physicalExit =
        options.physicalExits.get(target.exitKey) ??
        retainedUnavailablePhysicalExit(catalog, layout, decision, target.exitKey);
      if (physicalExit === undefined) {
        fail(`${target.exitKey} has no declaration-owned physical exit`);
      }
      return materializeTarget(
        catalog,
        biome,
        occurrences,
        source,
        target,
        index,
        selected,
        sharedBatchStoreKey,
        batchState,
        rewards.get(target.exitKey),
        physicalExit,
      );
    }),
  );
  const selectedTarget = targets.find((target) => target.picked);
  if (selectedTarget === undefined && options.allowUnselected !== true) {
    fail(`complete ${layout.biomeKey} batch lost selected target`);
  }
  const nextClockwork =
    batchState.kind === 'clockwork' && selectedTarget !== undefined
      ? advanceClockworkState(batchState, rewards.get(selectedTarget.exit.exitKey))
      : clockwork;
  return Object.freeze({
    batch: Object.freeze({
      kind: 'batch',
      origin: createExitDecisionAddress(biome, source),
      source,
      parent,
      rewardStore: canonicalRewardStore(biome, source, normal.rewardStore, takeover),
      ...(sharedBatchStoreKey === undefined
        ? {}
        : { resolvedSharedRewardStoreKey: sharedBatchStoreKey }),
      batchState,
      targets,
      selectedExitKey: selected ?? null,
      selectedOrigin: createExitSelectionAddress(biome, source),
    }),
    nextClockwork,
  });
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
  occurrence: RoomOccurrence,
): CanonicalAuthoredRoom {
  const room = requireRoom(catalog, occurrence);
  return materializeAuthoredRoom({
    catalog,
    biome,
    room,
    occurrence,
    role: 'ordinary',
    entered: true,
    ...(layout.progression.kind === 'hub' &&
    layout.start.kind === 'fixedAuthored' &&
    room.gameName === layout.start.roomGameName
      ? { lifecycleProfileKey: 'EphyraOpeningRoom' }
      : {}),
  });
}

function prefix(
  biome: BiomeAddress,
  biomeState: CanonicalBiomeState,
  entryRoom: CanonicalAuthoredRoom | undefined,
  decisions: readonly CanonicalDecision[],
  frontier?: MaterializedExitDecisionFrontier | MaterializedHubDecisionFrontier,
): MaterializedBiomePrefix {
  return Object.freeze({
    kind: 'biomePrefix',
    routeKey: biome.routeKey,
    biomeKey: biome.biomeKey,
    ...(entryRoom === undefined ? {} : { entryRoom }),
    decisions: Object.freeze([...decisions]),
    ...(frontier === undefined ? {} : { frontier }),
    biomeState,
  });
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
  const picked = selectedExitTarget(decision);
  if (decision.selection.kind === 'derived' && picked === undefined) {
    fail('complete width-one batch has no target');
  }
  const pickedOccurrence = picked === undefined ? undefined : occurrences.get(picked.occurrenceId);
  return (
    allPhysicalTargets &&
    hasStore &&
    picked !== undefined &&
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
    occurrences,
    partialDecision,
    parent,
    sourceAuthoredRoom,
    clockwork,
    { allowUnselected: true, physicalExits },
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
): MaterializedBiomePrefix | null {
  const layout = requireLayout(catalog, biome);
  if (Object.values(plan.state).some((value) => value === null)) return null;
  const biomeState = canonicalBiomeState(layout.biomeKey, plan.state);
  const topology = plan.topology;
  if (topology === null) return prefix(biome, biomeState, undefined, []);
  const occurrences = occurrenceMap(topology);
  const startOccurrence = requireOccurrence(occurrences, topology.startOccurrenceId);
  const entryRoom = materializeStart(catalog, biome, layout, startOccurrence);
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
    const sourceRoom = requireRoom(catalog, requireOccurrence(occurrences, current.occurrenceId));
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
          occurrences,
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
          occurrences,
          handoff,
          parent,
          undefined,
          undefined,
          { physicalExits: canonicalPhysicalExits(catalog, layout, topology, handoff.source) },
        );
        decisions.push(materialized.batch);
        return prefix(biome, biomeState, entryRoom, decisions);
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
      );
      return prefix(
        biome,
        biomeState,
        entryRoom,
        decisions,
        decisionFrontier(biome, decision, source, roomReference(current), partial, hubContinuation),
      );
    }
    const materialized = materializeBatch(
      catalog,
      biome,
      layout,
      occurrences,
      decision,
      roomReference(current),
      current,
      clockwork,
      { physicalExits: canonicalPhysicalExits(catalog, layout, topology, decision.source) },
    );
    decisions.push(materialized.batch);
    clockwork = materialized.nextClockwork;
    const selected = materialized.batch.targets.find((target) => target.picked);
    if (selected === undefined || selected.continuation === 'startsCompletion') {
      return prefix(biome, biomeState, entryRoom, decisions);
    }
    current = selected.room;
  }
  fail(`${layout.biomeKey} prefix selected spine contains a cycle`);
}

export function materializeBiome(
  catalog: Catalog,
  biome: BiomeAddress,
  completeness: CompleteBiomeCompletenessResult,
): CanonicalBiome {
  if (completeness.completion !== 'complete') fail('biome materialization requires completeness');
  const layout = requireLayout(catalog, biome);
  const topology = completeness.topology;
  const occurrences = occurrenceMap(topology);
  const biomeState = canonicalBiomeState(layout.biomeKey, completeness.biomeState);
  const startOccurrence = requireOccurrence(occurrences, topology.startOccurrenceId);
  const entryRoom = materializeStart(catalog, biome, layout, startOccurrence);
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
          occurrences,
        );
        decisions.push(hub);
        const handoff = handoffDecision(topology, layout.progression);
        const materialized = materializeBatch(
          catalog,
          biome,
          layout,
          occurrences,
          handoff,
          Object.freeze({ origin: hub.room.origin, gameName: hub.room.gameName }),
          undefined,
          undefined,
          { physicalExits: canonicalPhysicalExits(catalog, layout, topology, handoff.source) },
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
      occurrences,
      decision,
      roomReference(currentRoom),
      currentRoom,
      clockwork,
      { physicalExits: canonicalPhysicalExits(catalog, layout, topology, decision.source) },
    );
    decisions.push(materialized.batch);
    clockwork = materialized.nextClockwork;
    const selected = materialized.batch.targets.find((target) => target.picked);
    if (selected === undefined) fail(`${currentRoom.gameName} lost selected target`);
    if (selected.continuation === 'startsCompletion') {
      enteredPreboss = selected.room;
      break;
    }
    currentRoom = selected.room;
  }
  if (enteredPreboss === undefined) fail(`${layout.biomeKey} has no selected Preboss`);
  const completionRooms = materializeCompletionRooms({
    catalog,
    biome,
    completion: layout.completion,
    enteredStorePolicy: {
      kind: 'declared',
      ...(enteredPreboss.incomingReward?.resolvedStoreKey === undefined
        ? {}
        : { resolvedOfferStoreKey: enteredPreboss.incomingReward.resolvedStoreKey }),
    },
    lifecycleProducerPolicy: 'encounterCompatible',
    fail,
  });
  return Object.freeze({
    kind: 'biome',
    routeKey: biome.routeKey,
    biomeKey: layout.biomeKey,
    entryRoom,
    decisions: Object.freeze(decisions),
    completionRooms,
    biomeState,
  });
}

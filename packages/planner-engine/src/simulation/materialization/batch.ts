import type {
  BiomeLayout,
  Catalog,
  GeneratedProgressionDescriptor,
  RoomDeclaration,
} from '../../catalog-schema';
import {
  createAdditionalExitAddress,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createTargetAddress,
  type BiomeAddress,
  type ExitDecisionSourceAddress,
} from '../../authored-project/addresses';
import type {
  AuthoredBiomeState,
  BatchRewardStoreState,
  BiomeTopology,
  ExitDecision,
  ExitDecisionSource,
  ExitTargetReference,
  OccurrenceId,
  RoomOccurrence,
  RouteWeaponAspectLoadout,
} from '../../authored-project/model';
import {
  additionalExitsForDecision,
  declaredPhysicalExits,
  possibleGeneratedNormalExitKeys,
  selectedAdditionalExit,
  selectedExitKey,
} from '../../authored-project/topology/query';
import { legalTopologyOccurrenceRoom } from '../../authored-project/topology/room-ownership';
import { batchTakesOverNormalDoors, fieldsBatchFacts, targetContinuation } from './decision-facts';
import { materializeAuthoredRoom, type AuthoredRoomRole } from './rooms';
import type {
  CanonicalAdditionalContinuation,
  CanonicalAuthoredRoom,
  CanonicalBatch,
  CanonicalBatchRewardStore,
  CanonicalBatchState,
  CanonicalBiomeState,
  CanonicalDecisionParent,
  CanonicalPhysicalExit,
  CanonicalSelectedBatchContinuation,
  CanonicalTarget,
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

function exitIndex(exitKey: string): number {
  const match = /^exit(\d+)$/.exec(exitKey);
  return match === null ? 1 : Number(match[1]);
}

function sourceAddress(source: ExitDecisionSource): ExitDecisionSourceAddress {
  return source.kind === 'occurrence'
    ? Object.freeze({ kind: 'occurrence', occurrenceId: source.occurrenceId })
    : Object.freeze({ kind: 'hubDecision', decisionKey: source.decisionKey });
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

/** Preserves declaration-owned physical identities, including topology-owned keys such as N's prehub. */
export function canonicalPhysicalExits(
  catalog: Catalog,
  layout: BiomeLayout,
  topology: BiomeTopology,
  source: ExitDecisionSource,
): ReadonlyMap<string, CanonicalPhysicalExit> {
  const exits = declaredPhysicalExits(catalog, layout, topology, source);
  if (exits === undefined)
    fail(`${layout.biomeKey} source has no declaration-owned physical exits`);
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

function retainedUnavailablePhysicalExit(
  catalog: Catalog,
  layout: BiomeLayout,
  decision: ExitDecision,
  exitKey: string,
): CanonicalPhysicalExit | undefined {
  if (layout.progression.kind !== 'generated' || decision.source.kind !== 'occurrence')
    return undefined;
  if (!possibleGeneratedNormalExitKeys(catalog, layout).includes(exitKey)) return undefined;
  const match = /^exit(\d+)$/.exec(exitKey);
  if (match === null) return undefined;
  return Object.freeze({ kind: 'unavailable', exitKey, index: Number(match[1]) });
}

export function orderedTargets(
  targets: readonly ExitTargetReference[],
): readonly ExitTargetReference[] {
  return Object.freeze(
    [...targets].sort(
      (left, right) =>
        exitIndex(left.exitKey) - exitIndex(right.exitKey) ||
        left.exitKey.localeCompare(right.exitKey),
    ),
  );
}

function canonicalRewardStore(
  biome: BiomeAddress,
  source: ExitDecisionSourceAddress,
  state: BatchRewardStoreState,
  takeover: boolean,
  naturalChaosSelected: boolean,
): CanonicalBatchRewardStore {
  const origin = createBatchRewardStoreAddress(biome, source);
  if (state.kind === 'authoredBaseStore') {
    if (state.baseRewardStoreKey === null) {
      if (takeover || naturalChaosSelected) return Object.freeze({ origin, kind: 'none' });
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

export function finalSharedBatchStoreKey(
  catalog: Catalog,
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  targets: readonly ExitTargetReference[],
  initialStoreKey: string | undefined,
): string | undefined {
  let storeKey = initialStoreKey;
  for (const target of targets) {
    const room = requireCatalogRoom(catalog, requireOccurrence(occurrences, target.occurrenceId));
    if (room.forcedRewardStoreKey !== undefined) storeKey = room.forcedRewardStoreKey;
  }
  return storeKey;
}

export interface ClockworkState {
  readonly goalsRemaining: number;
  readonly nonGoalRewardsAcquired: number;
  readonly maxNonGoalRewards: number;
}

export function initialClockworkState(
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
  if (takeover || layout.progression.kind !== 'generated')
    return Object.freeze({ kind: 'standard' });
  const policy = layout.progression.batchPolicy;
  if (policy.kind === 'standard') return Object.freeze({ kind: 'standard' });
  if (policy.kind === 'clockwork') {
    if (clockwork === undefined) fail(`${layout.biomeKey} Clockwork state is unavailable`);
    return Object.freeze({ kind: 'clockwork', ...clockwork });
  }
  if (decision.normal.batchState === null)
    fail(`${layout.biomeKey} Fields batch has no authored cage outcome`);
  const fields = fieldsBatchFacts(
    catalog,
    layout,
    (occurrenceId) => occurrences.get(occurrenceId),
    decision,
  );
  if (fields === undefined) fail(`${layout.biomeKey} Fields batch has no authored cage outcome`);
  return Object.freeze({ kind: 'fields', ...fields });
}

function prebossRole(room: RoomDeclaration, targetIndex: number): AuthoredRoomRole {
  if (room.kind !== 'Preboss') return 'ordinary';
  return room.prebossBatchPolicy?.kind === 'takeOverNormalDoors'
    ? targetIndex === 0
      ? 'prebossShop'
      : 'prebossFreeReward'
    : 'prebossShop';
}

function materializeTarget(
  catalog: Catalog,
  biome: BiomeAddress,
  layout: BiomeLayout,
  topology: BiomeTopology,
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  source: ExitDecisionSourceAddress,
  target: ExitTargetReference,
  targetIndex: number,
  selectedExitKey: string | undefined,
  batchStore: string | undefined,
  batchState: CanonicalBatchState,
  clockworkRewardValue: 'goal' | 'nonGoal' | undefined,
  physicalExit: CanonicalPhysicalExit,
  loadout?: RouteWeaponAspectLoadout,
): CanonicalTarget {
  const occurrence = requireOccurrence(occurrences, target.occurrenceId);
  const room = requireRoom(catalog, layout, topology, occurrence);
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
      ...(loadout === undefined ? {} : { loadout }),
    }),
  });
}

export function materializeAdditionalContinuations(
  catalog: Catalog,
  biome: BiomeAddress,
  layout: BiomeLayout,
  topology: BiomeTopology,
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  decision: ExitDecision,
  loadout?: RouteWeaponAspectLoadout,
): readonly CanonicalAdditionalContinuation[] {
  const additionalExits = additionalExitsForDecision(topology, decision);
  if (additionalExits.length === 0) return Object.freeze([]);
  if (decision.source.kind !== 'occurrence')
    fail('only an authored occurrence may own an additional continuation');
  const sourceOccurrenceId = decision.source.occurrenceId;
  const selected = selectedAdditionalExit(decision, additionalExits)?.key;
  return Object.freeze(
    additionalExits.map((additional) => {
      const occurrence = requireOccurrence(occurrences, additional.occurrenceId);
      const room =
        additional.kind === 'naturalChaos' || additional.kind === 'sparkChaos'
          ? requireCatalogRoom(catalog, occurrence)
          : requireRoom(catalog, layout, topology, occurrence);
      if (additional.kind === 'zagreusContract') {
        if (
          room.gameName !== 'C_Boss01' ||
          room.mode.kind !== 'authored' ||
          room.mode.templateKey !== 'ContractBoss'
        ) {
          fail(`${additional.key} has the wrong contract room`);
        }
      } else if (room.mode.kind !== 'authored' || room.mode.templateKey !== 'Chaos') {
        fail(`${additional.key} has the wrong Chaos room`);
      }
      return Object.freeze({
        origin: createAdditionalExitAddress(biome, sourceOccurrenceId, additional.key),
        key: additional.key,
        picked: selected === additional.key,
        room: materializeAuthoredRoom({
          catalog,
          biome,
          room,
          occurrence,
          role: 'ordinary',
          entered: selected === additional.key,
          ...(loadout === undefined ? {} : { loadout }),
        }),
      });
    }),
  );
}

export interface BatchMaterializationOptions {
  readonly allowUnselected?: boolean;
  readonly physicalExits: ReadonlyMap<string, CanonicalPhysicalExit>;
}

export interface MaterializedBatch {
  readonly batch: CanonicalBatch;
  readonly nextClockwork: ClockworkState | undefined;
}

export function materializeBatch(
  catalog: Catalog,
  biome: BiomeAddress,
  layout: BiomeLayout,
  topology: BiomeTopology,
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  decision: ExitDecision,
  parent: CanonicalDecisionParent,
  sourceAuthoredRoom: CanonicalAuthoredRoom | undefined,
  clockwork: ClockworkState | undefined,
  options: BatchMaterializationOptions,
  loadout?: RouteWeaponAspectLoadout,
): MaterializedBatch {
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
  if (decision.selection.kind === 'derived' && selected === undefined)
    fail('complete width-one batch has no target');
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
      const reward = clockworkReward(
        requireRoom(catalog, layout, topology, requireOccurrence(occurrences, target.occurrenceId)),
        batchState,
        goalAlreadyOffered,
      );
      if (reward === 'goal') goalAlreadyOffered = true;
      rewards.set(target.exitKey, reward);
    }
  }
  const targets = Object.freeze(
    ordered.map((target, index) => {
      const physicalExit =
        options.physicalExits.get(target.exitKey) ??
        retainedUnavailablePhysicalExit(catalog, layout, decision, target.exitKey);
      if (physicalExit === undefined)
        fail(`${target.exitKey} has no declaration-owned physical exit`);
      return materializeTarget(
        catalog,
        biome,
        layout,
        topology,
        occurrences,
        source,
        target,
        index,
        selected,
        sharedBatchStoreKey,
        batchState,
        rewards.get(target.exitKey),
        physicalExit,
        loadout,
      );
    }),
  );
  const additional = materializeAdditionalContinuations(
    catalog,
    biome,
    layout,
    topology,
    occurrences,
    decision,
    loadout,
  );
  const selectedTarget = targets.find((target) => target.picked);
  const selectedAdditional = additional.find((continuation) => continuation.picked);
  if (
    selectedTarget === undefined &&
    selectedAdditional === undefined &&
    options.allowUnselected !== true
  ) {
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
      rewardStore: canonicalRewardStore(
        biome,
        source,
        normal.rewardStore,
        takeover,
        selectedAdditional?.key === 'naturalChaos' || selectedAdditional?.key === 'sparkChaos',
      ),
      ...(sharedBatchStoreKey === undefined
        ? {}
        : { resolvedSharedRewardStoreKey: sharedBatchStoreKey }),
      batchState,
      targets,
      additional,
      selectedExitKey: selected ?? null,
      selectedOrigin: createExitSelectionAddress(biome, source),
    }),
    nextClockwork,
  });
}

export function selectedBatchContinuation(
  batch: CanonicalBatch,
): CanonicalSelectedBatchContinuation | undefined {
  const normal = batch.targets.filter((target) => target.picked);
  const additional = batch.additional.filter((continuation) => continuation.picked);
  if (normal.length + additional.length === 0) return undefined;
  if (normal.length + additional.length !== 1)
    fail(`${batch.origin.source.kind} batch has multiple selected continuations`);
  const target = normal[0];
  return target === undefined
    ? Object.freeze({ kind: 'additional', continuation: additional[0]! })
    : Object.freeze({ kind: 'normal', target });
}

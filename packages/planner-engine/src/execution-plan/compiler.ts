import {
  createRoomRunStateCheckpointAddress,
  semanticAddressKey,
} from '../authored-project/addresses';
import type { CanonicalAuthoredRoom, CanonicalBatch } from '../simulation/materialization';
import { assertExactProjectEvaluationAssembly } from '../simulation/project-evaluation-assembly';
import type { CompleteValidBiomeProjectEvaluation } from '../simulation/evaluation-products';
import type { RunStateSnapshot } from '../simulation/rewards/run-state';
import {
  EXECUTION_CATALOG_VERSION,
  EXECUTION_PLAN_FORMAT,
  EXECUTION_PROTOCOL_VERSION,
  type ExecutionCompilerInput,
  type ExecutionOutgoing,
  type ExecutionPlan,
  type ExecutionReward,
  type ExecutionRoom,
  type ExecutionRunStateCount,
  type ExecutionRunStateDiagnostic,
  type ExecutionTraceStep,
} from './model';

class CompilerError extends Error {
  readonly code: NonNullable<import('./model').ExecutionCompilerError['code']>;

  constructor(
    code: NonNullable<import('./model').ExecutionCompilerError['code']>,
    message: string,
  ) {
    super(message);
    this.name = 'ExecutionCompilerError';
    this.code = code;
  }
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
    .join(',')}}`;
}

function fingerprint(value: unknown): string {
  let hash = 2166136261;
  for (const character of stableJson(value)) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function ownerKey(room: CanonicalAuthoredRoom): string {
  return semanticAddressKey(room.origin);
}

function executionReward(room: CanonicalAuthoredRoom): ExecutionReward | undefined {
  const incoming = room.incomingReward;
  if (incoming === undefined) return undefined;
  const payload = incoming.offer.payload;
  return Object.freeze({
    rewardType: incoming.offer.rewardType,
    producerLifecycleKey: incoming.producerLifecycleKey,
    ...(incoming.resolvedStoreKey === undefined
      ? {}
      : { resolvedStoreKey: incoming.resolvedStoreKey }),
    ...(payload?.kind === 'BoonSource' ? { source: payload.source } : {}),
    ...(payload?.kind === 'DevotionPair'
      ? { source: payload.chosenSource, spurnedSource: payload.spurnedSource }
      : {}),
  });
}

function executionCount(value: ExecutionRunStateCount): ExecutionRunStateCount {
  return value.kind === 'exact'
    ? Object.freeze({ kind: 'exact', count: value.count })
    : Object.freeze({ kind: 'range', min: value.min, max: value.max });
}

function diagnostic(
  snapshot: RunStateSnapshot | undefined,
): ExecutionRunStateDiagnostic | undefined {
  if (snapshot === undefined) return undefined;
  return Object.freeze({
    owner: semanticAddressKey(snapshot.owner),
    checkpoint: snapshot.checkpoint === 'roomEntered' ? 'roomEntered' : 'beforeRoomExit',
    counters: Object.freeze({
      biomeDepthCache: snapshot.counters.biomeDepthCache,
      biomeEncounterDepth: snapshot.counters.biomeEncounterDepth,
      routeEncounterDepth: snapshot.counters.routeEncounterDepth,
      roomHistoryOrdinal: snapshot.counters.roomHistoryOrdinal,
    }),
    bags: Object.freeze(
      snapshot.bags.map((bag) =>
        Object.freeze({ storeKey: bag.storeKey, remaining: executionCount(bag.remaining) }),
      ),
    ),
  });
}

function roomSnapshots(
  biome: CompleteValidBiomeProjectEvaluation,
): ReadonlyMap<string, RunStateSnapshot> {
  const result = new Map<string, RunStateSnapshot>();
  for (const snapshot of biome.rewards.runStateSnapshots) {
    result.set(semanticAddressKey(snapshot.owner), snapshot);
  }
  return result;
}

function addRoom(
  rooms: CanonicalAuthoredRoom[],
  seen: Set<string>,
  room: CanonicalAuthoredRoom,
): void {
  const key = ownerKey(room);
  if (seen.has(key)) return;
  seen.add(key);
  rooms.push(room);
}

function orderedRooms(
  biomes: readonly CompleteValidBiomeProjectEvaluation[],
): CanonicalAuthoredRoom[] {
  const rooms: CanonicalAuthoredRoom[] = [];
  const seen = new Set<string>();
  for (const evaluation of biomes) {
    const snapshot = evaluation.snapshot;
    addRoom(rooms, seen, snapshot.entryRoom);
    for (const decision of snapshot.decisions) {
      if (decision.kind !== 'batch') continue;
      for (const target of decision.targets) addRoom(rooms, seen, target.room);
      for (const additional of decision.additional) addRoom(rooms, seen, additional.room);
    }
    for (const link of snapshot.fixedRoomLinks) {
      addRoom(rooms, seen, link.source);
      addRoom(rooms, seen, link.target);
    }
  }
  return rooms;
}

function batchByRoom(
  biomes: readonly CompleteValidBiomeProjectEvaluation[],
): ReadonlyMap<string, CanonicalBatch> {
  const result = new Map<string, CanonicalBatch>();
  for (const evaluation of biomes) {
    for (const decision of evaluation.snapshot.decisions) {
      if (decision.kind !== 'batch' || decision.parent.origin.kind !== 'occurrence') continue;
      result.set(semanticAddressKey(decision.parent.origin), decision);
    }
  }
  return result;
}

function fixedTargetByRoom(
  biomes: readonly CompleteValidBiomeProjectEvaluation[],
): ReadonlyMap<string, CanonicalAuthoredRoom> {
  const result = new Map<string, CanonicalAuthoredRoom>();
  for (const evaluation of biomes) {
    for (const link of evaluation.snapshot.fixedRoomLinks) {
      result.set(ownerKey(link.source), link.target);
    }
  }
  return result;
}

function executionTrace(
  room: CanonicalAuthoredRoom,
  snapshots: ReadonlyMap<string, RunStateSnapshot>,
): readonly ExecutionTraceStep[] {
  if (!room.entered) return Object.freeze([]);
  const owner = ownerKey(room);
  const entryOwner = createRoomRunStateCheckpointAddress(room.origin, { kind: 'roomEntered' });
  const exitOwner = createRoomRunStateCheckpointAddress(room.origin, { kind: 'beforeRoomExit' });
  const entrySnapshot = snapshots.get(semanticAddressKey(entryOwner));
  const exitSnapshot = snapshots.get(semanticAddressKey(exitOwner));
  if (entrySnapshot === undefined || exitSnapshot === undefined) {
    throw new CompilerError(
      'runStateMissing',
      `${room.gameName} is entered but lacks roomEntered and beforeRoomExit snapshots`,
    );
  }
  const entry = diagnostic(entrySnapshot);
  const exit = diagnostic(exitSnapshot);
  if (entry === undefined || exit === undefined) {
    throw new CompilerError(
      'runStateMissing',
      `${room.gameName} is entered but lacks a usable run-state snapshot`,
    );
  }
  return Object.freeze([
    Object.freeze({
      id: `${owner}:roomEntered`,
      kind: 'roomEntered' as const,
      checkpoint: 'roomEntered' as const,
      owner,
      runState: entry,
    }),
    Object.freeze({
      id: `${owner}:beforeRoomExit`,
      kind: 'beforeRoomExit' as const,
      checkpoint: 'beforeRoomExit' as const,
      owner,
      runState: exit,
    }),
  ]);
}

function executionOutgoing(
  room: CanonicalAuthoredRoom,
  batches: ReadonlyMap<string, CanonicalBatch>,
  fixedTargets: ReadonlyMap<string, CanonicalAuthoredRoom>,
  crossBiomeTarget: CanonicalAuthoredRoom | undefined,
  crossBiomeSourceId: string | undefined,
): ExecutionOutgoing {
  const owner = ownerKey(room);
  const batch = batches.get(owner);
  if (batch !== undefined) {
    if (batch.selectedExitKey === null) {
      throw new CompilerError('openingSelectionMissing', `${room.gameName} has no selected exit`);
    }
    return Object.freeze({
      owner: semanticAddressKey(batch.origin),
      kind: 'batch',
      targets: Object.freeze(
        batch.targets.map((target) =>
          Object.freeze({
            exitKey: target.exit.exitKey,
            index: target.exit.index,
            type: target.exit.kind === 'available' ? target.exit.type : '',
            room: Object.freeze({
              id: target.room.occurrenceId,
              biomeKey: target.room.origin.biomeKey,
              gameName: target.room.gameName,
            }),
            picked: target.picked,
          }),
        ),
      ),
      selectedExitKey: batch.selectedExitKey,
      ...(batch.resolvedSharedRewardStoreKey === undefined
        ? {}
        : { resolvedSharedRewardStoreKey: batch.resolvedSharedRewardStoreKey }),
    });
  }
  const fixed =
    fixedTargets.get(owner) ?? (owner === crossBiomeSourceId ? crossBiomeTarget : undefined);
  if (fixed !== undefined) {
    return Object.freeze({
      owner,
      kind: 'fixed',
      target: Object.freeze({
        id: fixed.occurrenceId,
        biomeKey: fixed.origin.biomeKey,
        gameName: fixed.gameName,
      }),
    });
  }
  return Object.freeze({ owner, kind: 'terminal' });
}

function executionRoom(
  room: CanonicalAuthoredRoom,
  snapshots: ReadonlyMap<string, RunStateSnapshot>,
  batches: ReadonlyMap<string, CanonicalBatch>,
  fixedTargets: ReadonlyMap<string, CanonicalAuthoredRoom>,
  crossBiomeTarget: CanonicalAuthoredRoom | undefined,
  crossBiomeSourceId: string | undefined,
): ExecutionRoom {
  const reward = executionReward(room);
  return Object.freeze({
    id: room.occurrenceId,
    owner: ownerKey(room),
    biomeKey: room.origin.biomeKey,
    gameName: room.gameName,
    kind: room.encounterEnvelopeKey,
    entered: room.entered,
    contents: Object.freeze({
      ...(reward === undefined ? {} : { incomingReward: reward }),
      encounterPhases: Object.freeze(
        room.encounterPhases.map((phase) =>
          Object.freeze({
            slotKey: phase.slotKey,
            encounterKey: phase.encounterKey,
            kind: phase.kind,
          }),
        ),
      ),
      requiredObjects: Object.freeze((room.requiredObjects ?? []).map((object) => object.key)),
    }),
    trace: executionTrace(room, snapshots),
    outgoing: executionOutgoing(room, batches, fixedTargets, crossBiomeTarget, crossBiomeSourceId),
  });
}

function completeBiomes(
  assembly: ExecutionCompilerInput['assembly'],
): CompleteValidBiomeProjectEvaluation[] {
  const route = assembly.evaluation.route;
  if (!route.summary.eligibleForExecutionPlan) {
    throw new CompilerError('notEligible', 'project evaluation is not eligible for execution');
  }
  const values: CompleteValidBiomeProjectEvaluation[] = [];
  for (const biome of route.biomes) {
    if (biome.authoring !== 'complete' || biome.validity !== 'valid') {
      throw new CompilerError('notEligible', `${biome.biomeKey} is not complete-valid`);
    }
    values.push(biome);
  }
  return values;
}

export function compileExecutionPlan({ assembly }: ExecutionCompilerInput): ExecutionPlan {
  assertExactProjectEvaluationAssembly(assembly);
  const { evaluation } = assembly;
  if (evaluation.catalogVersion !== EXECUTION_CATALOG_VERSION) {
    throw new CompilerError('unsupportedExtent', 'execution catalog version is unsupported');
  }
  if (evaluation.route.routeKey !== 'Underworld') {
    throw new CompilerError('unsupportedRoute', 'F/G execution supports only the Underworld route');
  }
  const keys = evaluation.route.configuredBiomeKeys;
  if (
    !(keys.length === 1 && keys[0] === 'F') &&
    !(keys.length === 2 && keys[0] === 'F' && keys[1] === 'G')
  ) {
    throw new CompilerError(
      'unsupportedExtent',
      'execution supports only configured F or F/G prefixes',
    );
  }
  const biomes = completeBiomes(assembly);
  const rooms = orderedRooms(biomes);
  if (rooms.length === 0 || rooms.length > 256) {
    throw new CompilerError('openingMissing', 'execution route has no bounded room product');
  }
  const batches = batchByRoom(biomes);
  const fixedTargets = fixedTargetByRoom(biomes);
  const snapshots = new Map<string, RunStateSnapshot>();
  for (const biome of biomes) {
    for (const [key, value] of roomSnapshots(biome)) snapshots.set(key, value);
  }
  const entryByBiome = new Map(
    biomes.map((biome) => [biome.biomeKey, biome.snapshot.entryRoom] as const),
  );
  const executionRooms = rooms.map((room) => {
    const index = keys.indexOf(room.origin.biomeKey);
    const nextBiomeKey = index >= 0 ? keys[index + 1] : undefined;
    const crossBiomeTarget =
      nextBiomeKey !== undefined && room.gameName === `${room.origin.biomeKey}_PostBoss01`
        ? entryByBiome.get(nextBiomeKey)
        : undefined;
    const crossBiomeSourceId = crossBiomeTarget === undefined ? undefined : ownerKey(room);
    return executionRoom(
      room,
      snapshots,
      batches,
      fixedTargets,
      crossBiomeTarget,
      crossBiomeSourceId,
    );
  });
  const extent = Object.freeze({
    kind: 'configuredPrefix' as const,
    biomeKeys: Object.freeze([...keys]) as readonly ['F'] | readonly ['F', 'G'],
    terminalBiomeKey: keys[keys.length - 1] as 'F' | 'G',
  });
  const base = Object.freeze({
    format: EXECUTION_PLAN_FORMAT,
    protocolVersion: EXECUTION_PROTOCOL_VERSION,
    catalogVersion: evaluation.catalogVersion,
    projectId: evaluation.projectId,
    routeKey: 'Underworld' as const,
    extent,
    rooms: Object.freeze(executionRooms),
  });
  return Object.freeze({ ...base, planFingerprint: fingerprint(base) });
}

export { CompilerError as ExecutionCompilerError };

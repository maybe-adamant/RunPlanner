import type { Catalog, BiomeLayout } from '../../../catalog-schema';
import {
  semanticAddressKey,
  type AcquisitionSiteOwnerAddress,
} from '../../../authored-project/addresses';
import type { HistoryEvent, ProgressiveRoomHistoryViews } from '../../history';
import type {
  CanonicalAdditionalContinuation,
  CanonicalBatch,
  CanonicalHubRoom,
  CanonicalHubTarget,
  CanonicalTarget,
  MaterializedBiomePrefix,
  MaterializedHubVisitFrontier,
} from '../../materialization';
import type { CanonicalDecision } from '../../materialization/model';
import { BiomeRewardSimulationContractError } from './biome-contract';
import type { BiomeRewardHistory, BiomeRewardSnapshot } from './evaluation-contract';

type CanonicalRewardSource =
  import('../../materialization').CanonicalAuthoredRoom | CanonicalHubRoom;
type CanonicalRewardRoom = import('../../materialization').CanonicalAuthoredRoom;

/** Preparation needs lookup semantics, not mutable collection ownership. */
class ImmutableMapView<Key, Value> implements ReadonlyMap<Key, Value> {
  readonly #entries: Map<Key, Value>;

  constructor(entries: Iterable<readonly [Key, Value]>) {
    this.#entries = new Map(entries);
    Object.freeze(this);
  }
  get size(): number {
    return this.#entries.size;
  }
  get(key: Key): Value | undefined {
    return this.#entries.get(key);
  }
  has(key: Key): boolean {
    return this.#entries.has(key);
  }
  entries(): MapIterator<[Key, Value]> {
    return this.#entries.entries();
  }
  keys(): MapIterator<Key> {
    return this.#entries.keys();
  }
  values(): MapIterator<Value> {
    return this.#entries.values();
  }
  forEach(
    callbackfn: (value: Value, key: Key, map: ReadonlyMap<Key, Value>) => void,
    thisArg?: unknown,
  ): void {
    for (const [key, value] of this.#entries) callbackfn.call(thisArg, value, key, this);
  }
  [Symbol.iterator](): MapIterator<[Key, Value]> {
    return this.#entries[Symbol.iterator]();
  }
}

export class ImmutableSetView<Value> implements ReadonlySet<Value> {
  readonly #values: Set<Value>;

  constructor(values: Iterable<Value>) {
    this.#values = new Set(values);
    Object.freeze(this);
  }
  get size(): number {
    return this.#values.size;
  }
  has(value: Value): boolean {
    return this.#values.has(value);
  }
  entries(): SetIterator<[Value, Value]> {
    return this.#values.entries();
  }
  keys(): SetIterator<Value> {
    return this.#values.keys();
  }
  values(): SetIterator<Value> {
    return this.#values.values();
  }
  forEach(
    callbackfn: (value: Value, value2: Value, set: ReadonlySet<Value>) => void,
    thisArg?: unknown,
  ): void {
    for (const value of this.#values) callbackfn.call(thisArg, value, value, this);
  }
  [Symbol.iterator](): SetIterator<Value> {
    return this.#values[Symbol.iterator]();
  }
}

export interface RewardLifecycleReferences {
  readonly emptyOutgoingOwnerKeys: ReadonlySet<string>;
  readonly producerPointsByOwner: ReadonlyMap<
    string,
    readonly Extract<HistoryEvent, { readonly kind: 'producerPointReached' }>[]
  >;
  readonly acquisitionPointsByOwner: ReadonlyMap<
    string,
    readonly Extract<HistoryEvent, { readonly kind: 'acquisitionPointReached' }>[]
  >;
  readonly wheelsByOwner: ReadonlyMap<
    string,
    readonly Extract<HistoryEvent, { readonly kind: 'offerPointAcquired' }>[]
  >;
  readonly encounterCompletionsByOwner: ReadonlyMap<
    string,
    readonly Extract<HistoryEvent, { readonly kind: 'encounterCompleted' }>[]
  >;
}

export interface PreparedRewardEvaluationInputs {
  readonly layout: BiomeLayout;
  readonly rewardLookup: {
    readonly internal: Readonly<Record<string, ReadonlySet<string>>>;
    readonly public: Readonly<Record<string, readonly string[]>>;
  };
  readonly rooms: ReadonlyMap<string, CanonicalRewardSource>;
  readonly views: ReadonlyMap<string, ProgressiveRoomHistoryViews>;
  readonly targets: ReadonlyMap<string, CanonicalTarget>;
  readonly additionalContinuations: ReadonlyMap<string, CanonicalAdditionalContinuation>;
  readonly hubTargetByOrigin: ReadonlyMap<string, CanonicalHubTarget>;
  readonly batchesByParent: ReadonlyMap<string, CanonicalBatch>;
  readonly activeHubVisit: MaterializedHubVisitFrontier | undefined;
  readonly lifecycle: RewardLifecycleReferences;
}

function frontierBatch(snapshot: BiomeRewardSnapshot): readonly CanonicalBatch[] {
  return snapshot.kind === 'biomePrefix' && snapshot.frontier?.kind === 'exitDecision'
    ? snapshot.frontier.partialBatch === undefined
      ? Object.freeze([])
      : Object.freeze([snapshot.frontier.partialBatch])
    : Object.freeze([]);
}

function frontierAdditional(
  snapshot: BiomeRewardSnapshot,
): readonly CanonicalAdditionalContinuation[] {
  return snapshot.kind === 'biomePrefix' && snapshot.frontier?.kind === 'exitDecision'
    ? snapshot.frontier.additional
    : Object.freeze([]);
}

function decisions(snapshot: BiomeRewardSnapshot): readonly CanonicalDecision[] {
  return Object.freeze([...snapshot.decisions, ...frontierBatch(snapshot)]);
}

function hasHubVisitDetails(
  frontier: MaterializedBiomePrefix['frontier'] | undefined,
): frontier is MaterializedHubVisitFrontier {
  return frontier?.kind === 'hubVisit' && 'phase' in frontier;
}

function activeHubVisit(snapshot: BiomeRewardSnapshot): MaterializedHubVisitFrontier | undefined {
  const frontier = snapshot.kind === 'biomePrefix' ? snapshot.frontier : undefined;
  return hasHubVisitDetails(frontier) ? frontier : undefined;
}

export function preparedHubVisitFrontier(
  snapshot: BiomeRewardSnapshot,
): MaterializedHubVisitFrontier | undefined {
  return activeHubVisit(snapshot);
}

export function samePreparedRewardRoomOwner(
  left: {
    readonly routeKey: string;
    readonly biomeKey: string;
    readonly occurrenceId?: string;
    readonly groupKey?: string;
    readonly slotKey?: string;
  },
  right: {
    readonly routeKey: string;
    readonly biomeKey: string;
    readonly occurrenceId?: string;
    readonly groupKey?: string;
    readonly slotKey?: string;
  },
): boolean {
  if (left.routeKey !== right.routeKey || left.biomeKey !== right.biomeKey) return false;
  if (
    left.groupKey !== undefined ||
    left.slotKey !== undefined ||
    right.groupKey !== undefined ||
    right.slotKey !== undefined
  )
    return (
      left.occurrenceId === right.occurrenceId &&
      left.groupKey === right.groupKey &&
      left.slotKey === right.slotKey
    );
  return left.occurrenceId !== undefined && left.occurrenceId === right.occurrenceId;
}

export function preparedAcquisitionSiteOwner(
  snapshot: BiomeRewardSnapshot,
  room: CanonicalRewardRoom,
): AcquisitionSiteOwnerAddress {
  if ('localVisit' in room) return room.origin;
  for (const decision of snapshot.decisions) {
    if (decision.kind !== 'hub') continue;
    const visit = decision.visits.find((candidate) =>
      samePreparedRewardRoomOwner(candidate.target.room.origin, room.origin),
    );
    if (visit !== undefined) return visit.origin;
  }
  const frontier = activeHubVisit(snapshot);
  return frontier !== undefined &&
    samePreparedRewardRoomOwner(frontier.target.room.origin, room.origin)
    ? frontier.origin
    : room.origin;
}

function requireLayout(catalog: Catalog, snapshot: BiomeRewardSnapshot): BiomeLayout {
  const layout = catalog.biomeLayouts.byKey[snapshot.biomeKey];
  const supported =
    layout !== undefined &&
    (layout.progression.kind === 'hub' ||
      layout.progression.rewardStorePolicy.kind === 'authoredBaseStore' ||
      (layout.progression.progressionPolicy.kind === 'staged' &&
        layout.progression.batchPolicy.kind === 'standard' &&
        layout.progression.rewardStorePolicy.kind === 'none') ||
      (layout.progression.batchPolicy.kind === 'clockwork' &&
        layout.progression.rewardStorePolicy.kind === 'none') ||
      (layout.progression.batchPolicy.kind === 'fields' &&
        layout.progression.rewardStorePolicy.kind === 'none'));
  if (!supported)
    throw new BiomeRewardSimulationContractError(
      `catalog does not provide supported ${snapshot.biomeKey} reward stores`,
    );
  return layout;
}

function rewardLookup(
  catalog: Catalog,
  snapshot: BiomeRewardSnapshot,
): PreparedRewardEvaluationInputs['rewardLookup'] {
  const descriptor = catalog.biomeLayouts.byKey[snapshot.biomeKey]?.progression;
  const hub = snapshot.decisions.find(
    (decision): decision is Extract<CanonicalDecision, { readonly kind: 'hub' }> =>
      decision.kind === 'hub',
  );
  if (descriptor?.kind !== 'hub' || hub === undefined)
    return Object.freeze({ internal: Object.freeze({}), public: Object.freeze({}) });
  if (hub.origin.hubKey !== descriptor.hubKey)
    throw new BiomeRewardSimulationContractError(
      `${snapshot.biomeKey} reward lookup has the wrong Hub decision`,
    );
  const types: string[] = [];
  const unique = new Set<string>();
  for (const target of hub.board.targets) {
    const type = target.room.incomingReward?.offer.rewardType;
    if (type !== undefined && !unique.has(type)) {
      unique.add(type);
      types.push(type);
    }
  }
  return Object.freeze({
    internal: Object.freeze({ [descriptor.rewardLookup.key]: new ImmutableSetView(unique) }),
    public: Object.freeze({ [descriptor.rewardLookup.key]: Object.freeze(types) }),
  });
}

function lifecycleReferences(events: readonly HistoryEvent[]): RewardLifecycleReferences {
  const emptyOutgoingOwnerKeys = new Set<string>();
  const producer = new Map<
    string,
    Extract<HistoryEvent, { readonly kind: 'producerPointReached' }>[]
  >();
  const acquisition = new Map<
    string,
    Extract<HistoryEvent, { readonly kind: 'acquisitionPointReached' }>[]
  >();
  const wheels = new Map<
    string,
    Extract<HistoryEvent, { readonly kind: 'offerPointAcquired' }>[]
  >();
  const completed = new Map<
    string,
    Extract<HistoryEvent, { readonly kind: 'encounterCompleted' }>[]
  >();
  for (const event of events) {
    if (event.kind === 'emptyOutgoingGenerationCompleted')
      emptyOutgoingOwnerKeys.add(semanticAddressKey(event.origin));
    const key = semanticAddressKey(event.origin);
    if (event.kind === 'producerPointReached')
      producer.set(key, [...(producer.get(key) ?? []), event]);
    if (event.kind === 'acquisitionPointReached')
      acquisition.set(key, [...(acquisition.get(key) ?? []), event]);
    if (event.kind === 'offerPointAcquired') wheels.set(key, [...(wheels.get(key) ?? []), event]);
    if (event.kind === 'encounterCompleted')
      completed.set(key, [...(completed.get(key) ?? []), event]);
  }
  return Object.freeze({
    emptyOutgoingOwnerKeys: new ImmutableSetView(emptyOutgoingOwnerKeys),
    producerPointsByOwner: new ImmutableMapView(
      [...producer.entries()].map(([key, points]) => [key, Object.freeze(points)] as const),
    ),
    acquisitionPointsByOwner: new ImmutableMapView(
      [...acquisition.entries()].map(([key, points]) => [key, Object.freeze(points)] as const),
    ),
    wheelsByOwner: new ImmutableMapView(
      [...wheels.entries()].map(([key, points]) => [key, Object.freeze(points)] as const),
    ),
    encounterCompletionsByOwner: new ImmutableMapView(
      [...completed.entries()].map(([key, points]) => [key, Object.freeze(points)] as const),
    ),
  });
}

export function prepareRewardEvaluationInputs(
  catalog: Catalog,
  snapshot: BiomeRewardSnapshot,
  history: BiomeRewardHistory,
): PreparedRewardEvaluationInputs {
  const allDecisions = decisions(snapshot);
  const hubFrontier = activeHubVisit(snapshot);
  const rooms = [
    snapshot.entryRoom,
    ...allDecisions.flatMap((decision) =>
      decision.kind === 'batch'
        ? [
            ...decision.targets.map((target) => target.room),
            ...decision.additional.map((continuation) => continuation.room),
          ]
        : [
            decision.room,
            ...decision.board.targets.map((target) => target.room),
            ...decision.visits.flatMap((visit) => visit.localSlots),
          ],
    ),
    ...frontierAdditional(snapshot).map((continuation) => continuation.room),
    ...(hubFrontier === undefined ? [] : [hubFrontier.target.room, ...hubFrontier.localSlots]),
    ...(snapshot.automaticRooms ?? []),
  ];
  const batchDecisions = allDecisions.filter(
    (decision): decision is CanonicalBatch => decision.kind === 'batch',
  );
  return Object.freeze({
    layout: requireLayout(catalog, snapshot),
    rewardLookup: rewardLookup(catalog, snapshot),
    rooms: new ImmutableMapView(
      rooms.map((room) => [semanticAddressKey(room.origin), room] as const),
    ),
    views: new ImmutableMapView(
      history.rooms.map((room) => [semanticAddressKey(room.origin), room] as const),
    ),
    targets: new ImmutableMapView(
      batchDecisions
        .flatMap((batch) => batch.targets)
        .map((target) => [semanticAddressKey(target.origin), target] as const),
    ),
    additionalContinuations: new ImmutableMapView(
      [...batchDecisions.flatMap((batch) => batch.additional), ...frontierAdditional(snapshot)].map(
        (continuation) => [semanticAddressKey(continuation.origin), continuation] as const,
      ),
    ),
    hubTargetByOrigin: new ImmutableMapView(
      allDecisions
        .filter(
          (decision): decision is Extract<CanonicalDecision, { readonly kind: 'hub' }> =>
            decision.kind === 'hub',
        )
        .flatMap((decision) => decision.board.targets)
        .map((target) => [semanticAddressKey(target.origin), target] as const),
    ),
    batchesByParent: new ImmutableMapView(
      batchDecisions.map((batch) => [semanticAddressKey(batch.parent.origin), batch] as const),
    ),
    activeHubVisit: hubFrontier,
    lifecycle: lifecycleReferences(history.events),
  });
}

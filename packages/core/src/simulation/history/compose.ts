import type { Catalog } from '../../catalog';
import {
  createBiomeAddress,
  semanticAddressKey,
  type BiomeAddress,
  type OccurrenceAddress,
} from '../../project/addresses';
import type { EnteredRewardStoreHistoryPolicy } from '../../rewards';
import { executeRoomLifecycle, type RoomLifecycleEvent } from '../lifecycle';
import type {
  CanonicalAuthoredRoom,
  CanonicalLinearBiome,
  CanonicalRoom,
  CanonicalTarget,
} from '../materialization';
import { foldLinearHistoryEvents } from './fold';
import type { CanonicalLinearHistory, LinearHistoryEvent, RoomCreatedHistoryEvent } from './model';

export class LinearHistoryCompositionContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'LinearHistoryCompositionContractError';
  }
}

interface EventBuilder {
  readonly events: LinearHistoryEvent[];
  readonly sequenceBase: number;
}

type LinearHistoryEventData<Event extends LinearHistoryEvent = LinearHistoryEvent> =
  Event extends LinearHistoryEvent ? Omit<Event, 'sequence'> : never;

function append(builder: EventBuilder, event: LinearHistoryEventData): void {
  builder.events.push(
    Object.freeze({
      ...event,
      sequence: builder.sequenceBase + builder.events.length + 1,
    }) as LinearHistoryEvent,
  );
}

function appendLifecycleEvent(builder: EventBuilder, event: RoomLifecycleEvent): void {
  const { sequence: localSequence, ...data } = event;
  if (localSequence <= 0) {
    throw new LinearHistoryCompositionContractError('room fragment has an invalid local sequence');
  }
  append(builder, data);
}

function standaloneRoomCreated(
  builder: EventBuilder,
  room: CanonicalRoom,
  source: 'biomeEntry' | 'layoutCompletion',
): void {
  append(builder, {
    kind: 'roomCreated',
    origin: room.origin,
    gameName: room.gameName,
    source,
    picked: true,
  });
}

function generatedTargetCreated(
  builder: EventBuilder,
  parentOrigin: OccurrenceAddress,
  target: CanonicalTarget,
  generationIndex: number,
  generationCount: number,
): void {
  const event: LinearHistoryEventData<RoomCreatedHistoryEvent> = {
    kind: 'roomCreated',
    origin: target.room.origin,
    gameName: target.room.gameName,
    source: 'generatedTarget',
    picked: target.picked,
    parentOrigin,
    targetOrigin: target.origin,
    generationIndex,
    generationCount,
  };
  append(builder, event);
  append(builder, {
    kind: 'targetGenerationCompleted',
    origin: target.origin,
    roomOrigin: target.room.origin,
    parentOrigin,
    generationIndex,
    generationCount,
  });
}

function enteredStoreKey(
  policy: EnteredRewardStoreHistoryPolicy,
  room: CanonicalRoom,
): string | undefined {
  switch (policy.kind) {
    case 'fixed':
      return policy.storeKey;
    case 'none':
      return undefined;
    case 'resolvedOffer': {
      const resolvedStoreKey =
        room.kind === 'authored'
          ? room.incomingReward?.resolvedStoreKey
          : room.enteredRewardStoreKey;
      if (resolvedStoreKey === undefined) {
        throw new LinearHistoryCompositionContractError(
          `${room.gameName} requires resolved entered-store provenance`,
        );
      }
      return resolvedStoreKey;
    }
  }
}

function lifecycleInput(catalog: Catalog, room: CanonicalRoom) {
  const declaration = catalog.rooms.byKey[room.gameName];
  if (declaration === undefined) {
    throw new LinearHistoryCompositionContractError(`unknown canonical room ${room.gameName}`);
  }
  const storeKey = enteredStoreKey(declaration.enteredRewardStoreHistory, room);
  return {
    origin: room.origin,
    lifecycleProfileKey: room.lifecycleProfileKey,
    encounterProfileKey: room.encounterProfileKey,
    counterEffects: room.counterEffects,
    ...(room.kind === 'authored' && room.incomingReward !== undefined
      ? {
          producer: {
            lifecycleProfileKey: room.incomingReward.producerLifecycleKey,
            offer: room.incomingReward.offer,
          },
        }
      : {}),
    ...(storeKey === undefined ? {} : { enteredRewardStoreKey: storeKey }),
  };
}

function appendGeneratedTargets(
  builder: EventBuilder,
  parentOrigin: OccurrenceAddress,
  targets: readonly CanonicalTarget[],
): void {
  targets.forEach((target, index) =>
    generatedTargetCreated(builder, parentOrigin, target, index + 1, targets.length),
  );
}

function appendRoomLifecycle(
  builder: EventBuilder,
  catalog: Catalog,
  room: CanonicalRoom,
  generatedTargets?: readonly CanonicalTarget[],
): void {
  if (room.kind === 'authored' && !room.entered) {
    throw new LinearHistoryCompositionContractError(
      `unpicked occurrence ${semanticAddressKey(room.origin)} cannot execute a lifecycle`,
    );
  }
  const fragment = executeRoomLifecycle(catalog, lifecycleInput(catalog, room));
  let injectedTargets = false;
  for (const event of fragment.events) {
    appendLifecycleEvent(builder, event);
    if (event.kind === 'outgoingGenerationCheckpoint') {
      if (generatedTargets === undefined) {
        throw new LinearHistoryCompositionContractError(
          `${room.gameName} reached outgoing generation without canonical targets`,
        );
      }
      if (room.origin.kind !== 'occurrence') {
        throw new LinearHistoryCompositionContractError(
          `${room.gameName} derived room cannot own generated targets`,
        );
      }
      appendGeneratedTargets(builder, room.origin, generatedTargets);
      injectedTargets = true;
    }
  }
  if (generatedTargets !== undefined && !injectedTargets) {
    throw new LinearHistoryCompositionContractError(
      `${room.gameName} has canonical targets but no outgoing-generation operation`,
    );
  }
}

function pickedRoom(targets: readonly CanonicalTarget[], owner: string): CanonicalAuthoredRoom {
  const picked = targets.filter((target) => target.picked);
  if (picked.length !== 1 || picked[0] === undefined) {
    throw new LinearHistoryCompositionContractError(
      `${owner} must contain exactly one picked target`,
    );
  }
  return picked[0].room;
}

function requireParent(
  source: CanonicalAuthoredRoom,
  parent: OccurrenceAddress,
  owner: string,
): void {
  if (semanticAddressKey(source.origin) !== semanticAddressKey(parent)) {
    throw new LinearHistoryCompositionContractError(
      `${owner} parent ${semanticAddressKey(parent)} does not match ${semanticAddressKey(source.origin)}`,
    );
  }
}

function requireLinearLayout(
  catalog: Catalog,
  snapshot: CanonicalLinearBiome,
  previous?: CanonicalLinearHistory,
) {
  const route = catalog.routes.byKey[snapshot.routeKey];
  const layout = catalog.biomeLayouts.byKey[snapshot.biomeKey];
  if (
    route === undefined ||
    !route.biomeKeys.includes(snapshot.biomeKey) ||
    layout?.kind !== 'LinearBiome'
  ) {
    throw new LinearHistoryCompositionContractError(
      `catalog cannot place canonical ${snapshot.biomeKey} history`,
    );
  }
  const biomeIndex = route.biomeKeys.indexOf(snapshot.biomeKey);
  const expectedPreviousBiomeKey = route.biomeKeys[biomeIndex - 1];
  if (expectedPreviousBiomeKey === undefined) {
    if (previous !== undefined) {
      throw new LinearHistoryCompositionContractError(
        `${snapshot.biomeKey} is the first ${route.key} biome and cannot consume prior history`,
      );
    }
  } else if (
    previous === undefined ||
    previous.routeKey !== snapshot.routeKey ||
    previous.biomeKey !== expectedPreviousBiomeKey
  ) {
    throw new LinearHistoryCompositionContractError(
      `${snapshot.biomeKey} requires validated ${expectedPreviousBiomeKey} history`,
    );
  }
  return layout;
}

export function composeLinearHistory(
  catalog: Catalog,
  snapshot: CanonicalLinearBiome,
  previous?: CanonicalLinearHistory,
): CanonicalLinearHistory {
  const layout = requireLinearLayout(catalog, snapshot, previous);
  const seed = previous?.afterTransition;
  const entry = snapshot.entryRooms[0];
  if (snapshot.entryRooms.length !== 1 || entry === undefined) {
    throw new LinearHistoryCompositionContractError(
      `${snapshot.biomeKey} history requires one canonical entry room`,
    );
  }
  const builder: EventBuilder = { events: [], sequenceBase: seed?.sequence ?? 0 };
  const biome: BiomeAddress = createBiomeAddress(snapshot.routeKey, snapshot.biomeKey);
  append(builder, {
    kind: 'biomeStarted',
    origin: biome,
    counters: Object.freeze({
      biomeDepthCache: layout.initialCounters.biomeDepthCache,
      biomeEncounterDepth: layout.initialCounters.biomeEncounterDepth,
      routeEncounterDepth: seed?.ledgers.counters.routeEncounterDepth ?? 1,
      roomHistoryOrdinal: seed?.ledgers.counters.roomHistoryOrdinal ?? 0,
    }),
  });
  standaloneRoomCreated(builder, entry, 'biomeEntry');
  let source = entry;

  for (const batch of snapshot.batches) {
    requireParent(source, batch.parent.origin, 'batch');
    appendRoomLifecycle(builder, catalog, source, batch.targets);
    source = pickedRoom(batch.targets, semanticAddressKey(batch.origin));
  }

  requireParent(source, snapshot.terminalEntry.predecessor.origin, 'terminal entry');
  appendRoomLifecycle(builder, catalog, source, snapshot.terminalEntry.targets);
  const terminal = pickedRoom(
    snapshot.terminalEntry.targets,
    semanticAddressKey(snapshot.terminalEntry.origin),
  );
  appendRoomLifecycle(builder, catalog, terminal);

  for (const completion of snapshot.completionRooms) {
    standaloneRoomCreated(builder, completion, 'layoutCompletion');
    appendRoomLifecycle(builder, catalog, completion);
  }

  append(builder, { kind: 'biomeCompleted', origin: biome });
  for (const effect of layout.completion.transitionEffects) {
    append(builder, {
      kind: 'biomeCounterReset',
      origin: biome,
      axis: effect.axis,
      value: 0,
    });
  }
  return foldLinearHistoryEvents(builder.events, seed);
}

export function composeFHistory(
  catalog: Catalog,
  snapshot: CanonicalLinearBiome,
): CanonicalLinearHistory {
  if (snapshot.biomeKey !== 'F') {
    throw new LinearHistoryCompositionContractError(
      `F history cannot compose biome ${snapshot.biomeKey}`,
    );
  }
  return composeLinearHistory(catalog, snapshot);
}

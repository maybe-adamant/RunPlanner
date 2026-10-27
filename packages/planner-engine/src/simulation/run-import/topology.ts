import {
  createAdditionalExitAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  declaredPhysicalExits,
  semanticAddressKey,
  takeoverPrebossGameNames,
  type OccurrenceId,
  type ProjectCommand,
  type SemanticAddress,
  type TargetAddress,
} from '../../authored-project';
import { applyProjectCommand } from '../../authored-project/commands/dispatch';
import { exitDecisionForSource } from '../../authored-project/topology/query';
import type { RunRecordDoor } from '../../run-record/model';
import type { SemanticFinding } from '../model';
import type { RunImportContext } from './import';

type Origin<K extends SemanticAddress['kind']> = Extract<SemanticAddress, { readonly kind: K }>;

const chaosRoom = (context: RunImportContext, gameName: string) =>
  context.catalog.rooms.byKey[gameName]?.roomSetKey === 'Chaos';

/** The Zagreus contract's room: a Midshop's additional door, never an ordinary exit. */
const contractRoom = (context: RunImportContext, gameName: string) => {
  const mode = context.catalog.rooms.byKey[gameName]?.mode;
  return mode?.kind === 'authored' && mode.templateKey === 'ContractBoss';
};

/** Answers route-start, door and exit questions from the record's rooms and doors. */
export function answerTopology(context: RunImportContext, reason: SemanticFinding): boolean {
  const origin = reason.origin;
  switch (reason.code) {
    case 'biomeTopologyMissing':
      return origin.kind === 'biome' && createStart(context, origin);
    case 'biomeFieldMissing':
      return origin.kind === 'biomeField' && biomeField(context, origin);
    case 'targetMissing':
      return origin.kind === 'target' && createTarget(context, origin);
    case 'pickedTargetMissing':
      return origin.kind === 'exitSelection' && selectExit(context, origin);
    case 'batchRewardStoreMissing':
    case 'baseRewardStoreUnavailable':
      return origin.kind === 'batchRewardStore' && batchRewardStore(context, origin);
    default:
      return false;
  }
}

/** Tartarus's cap of non-goal reward doors, rolled on entering it. */
function biomeField(context: RunImportContext, field: Origin<'biomeField'>): boolean {
  const value =
    field.fieldKey === 'maxNonGoalRewards'
      ? context.record.route.maxClockworkNonGoalRewards
      : undefined;
  if (value === undefined) return false;
  if (context.apply({ kind: 'ReplaceBiomeField', field, value })) return true;
  context.refuse();
  return false;
}

function createStart(context: RunImportContext, biome: Origin<'biome'>): boolean {
  const roomIndex = context.occurrences.biomeOfRoom.indexOf(biome.biomeKey);
  if (roomIndex < 0) return false;
  return context.apply({
    kind: 'CreateStart',
    biome,
    occurrenceId: context.occurrences.occurrenceOf(roomIndex),
    gameName: context.record.rooms[roomIndex]!.name,
  });
}

/** The record visit whose doors an occurrence source offered: its first visit that recorded doors. */
function sourceVisit(context: RunImportContext, occurrenceId: string): number | undefined {
  const visits = context.occurrences.visitsOf(occurrenceId);
  return visits.find((index) => context.record.rooms[index]!.doors.length > 0) ?? visits[0];
}

/**
 * The source visit's ordinary doors in ascending door id. Native door order
 * ties on the obstacle name and falls back to table order, which no save keeps.
 */
function ordinaryDoors(context: RunImportContext, roomIndex: number): readonly RunRecordDoor[] {
  return [...context.record.rooms[roomIndex]!.doors]
    .filter((door) => !chaosRoom(context, door.room) && !contractRoom(context, door.room))
    .sort((left, right) => left.door - right.door);
}

/** The occurrence a door creates: the entered room for the taken door, else its own offered room. */
function doorOccurrence(
  context: RunImportContext,
  roomIndex: number,
  doors: readonly RunRecordDoor[],
  door: RunRecordDoor,
): OccurrenceId {
  const room = context.record.rooms[roomIndex]!;
  const next = context.record.rooms[roomIndex + 1];
  const sameRoom = doors.filter((candidate) => candidate.room === room.exit);
  const taken =
    sameRoom.length === 1
      ? sameRoom[0]
      : sameRoom.find((candidate) => candidate.reward?.type === next?.reward?.type);
  return taken === door && next !== undefined
    ? context.occurrences.occurrenceOf(roomIndex + 1)
    : context.occurrences.offeredOccurrence(roomIndex, door.door);
}

const topologyOccurrence = (context: RunImportContext, biomeKey: string, occurrenceId: string) =>
  context
    .assembly()
    .project.route.biomes.find((biome) => biome.biomeKey === biomeKey)
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);

function ensureChaos(context: RunImportContext, biomeKey: string, sourceIndex: number): void {
  const door = context.record.rooms[sourceIndex]!.doors.find((candidate) =>
    chaosRoom(context, candidate.room),
  );
  if (door === undefined) return;
  const project = context.assembly().project;
  const source = context.occurrences.occurrenceOf(sourceIndex);
  const occurrence = project.route.biomes
    .find((biome) => biome.biomeKey === biomeKey)
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === source);
  if (occurrence === undefined) return;
  const biome = createBiomeAddress(project.route.routeKey, biomeKey);
  const existing = occurrence.additionalExits.find((exit) => exit.key === 'chaos');
  if (existing !== undefined) {
    // An Ixion gate opens on its own; its map is still the record's.
    const gate = topologyOccurrence(context, biomeKey, existing.occurrenceId);
    const map: ProjectCommand = {
      kind: 'ReplaceChaosMap',
      occurrence: createOccurrenceAddress(biome, existing.occurrenceId),
      gameName: door.room,
    };
    if (gate !== undefined && gate.gameName !== door.room && !context.apply(map))
      context.note({
        area: 'chaosGate',
        reason: 'refused',
        address: map.occurrence,
        record: { roomIndex: sourceIndex, visit: 0, door: door.door },
      });
    return;
  }
  const chaosId =
    context.record.rooms[sourceIndex]!.exit === door.room
      ? context.occurrences.occurrenceOf(sourceIndex + 1)
      : context.occurrences.offeredOccurrence(sourceIndex, door.door);
  const additional = createAdditionalExitAddress(biome, source, 'chaos');
  if (!context.apply({ kind: 'AddChaos', additional, occurrenceId: chaosId })) {
    context.note({
      area: 'chaosGate',
      reason: 'refused',
      address: additional,
      record: { roomIndex: sourceIndex, visit: 0 },
    });
    return;
  }
  const map: ProjectCommand = {
    kind: 'ReplaceChaosMap',
    occurrence: createOccurrenceAddress(biome, chaosId),
    gameName: door.room,
  };
  if (!context.apply(map))
    context.note({
      area: 'chaosGate',
      reason: 'refused',
      address: map.occurrence,
      record: { roomIndex: sourceIndex, visit: 0, door: door.door },
    });
}

/** Adds the source's Zagreus contract door when the record offered one. */
function ensureZagreusContract(context: RunImportContext, biomeKey: string, sourceIndex: number) {
  const door = context.record.rooms[sourceIndex]!.doors.find((candidate) =>
    contractRoom(context, candidate.room),
  );
  if (door === undefined) return;
  const source = context.occurrences.occurrenceOf(sourceIndex);
  const occurrence = topologyOccurrence(context, biomeKey, source);
  if (occurrence === undefined) return;
  if (occurrence.additionalExits.some((exit) => exit.kind === 'zagreusContract')) return;
  const project = context.assembly().project;
  const additional = createAdditionalExitAddress(
    createBiomeAddress(project.route.routeKey, biomeKey),
    source,
    'zagreusContract',
  );
  const occurrenceId =
    context.record.rooms[sourceIndex]!.exit === door.room
      ? context.occurrences.occurrenceOf(sourceIndex + 1)
      : context.occurrences.offeredOccurrence(sourceIndex, door.door);
  if (!context.apply({ kind: 'AddZagreusContract', additional, occurrenceId }))
    context.note({
      area: 'doors',
      reason: 'refused',
      address: additional,
      record: { roomIndex: sourceIndex, visit: 0, door: door.door },
    });
}

/** The batch's ascending door order is an assumption, reported once when its first door lands. */
function noteDoorOrder(
  context: RunImportContext,
  decision: ReturnType<typeof createExitDecisionAddress>,
  sourceIndex: number,
  doorCount: number,
): void {
  const used = `doorOrder:${semanticAddressKey(decision)}`;
  if (doorCount < 2 || context.used.has(used)) return;
  context.used.add(used);
  context.note({
    area: 'doors',
    reason: 'assumption',
    address: decision,
    record: { roomIndex: sourceIndex, visit: 0 },
  });
}

function createTarget(context: RunImportContext, target: TargetAddress): boolean {
  if (target.source.kind !== 'occurrence') return false;
  const sourceIndex = sourceVisit(context, target.source.occurrenceId);
  if (sourceIndex === undefined) return false;
  const project = context.assembly().project;
  const layout = context.catalog.biomeLayouts.byKey[target.biomeKey];
  const topology = project.route.biomes.find(
    (biome) => biome.biomeKey === target.biomeKey,
  )?.topology;
  if (layout === undefined || topology === undefined || topology === null) return false;
  ensureChaos(context, target.biomeKey, sourceIndex);
  ensureZagreusContract(context, target.biomeKey, sourceIndex);
  const exits = (
    declaredPhysicalExits(context.catalog, layout, topology, target.source) ?? []
  ).filter((exit) => exit.kind === 'normal');
  const doors = ordinaryDoors(context, sourceIndex);
  const position = exits.findIndex((exit) => exit.exitKey === target.exitKey);
  if (position < 0 || doors[position] === undefined) return false;
  const decision = createExitDecisionAddress(
    createBiomeAddress(target.routeKey, target.biomeKey),
    target.source,
  );
  const positional = doors[position]!;
  if (takeoverPrebossGameNames(context.catalog, target.biomeKey).includes(positional.room))
    return createTakeover(context, decision, sourceIndex, exits, doors, positional.room);
  // The positional door goes first; a door the engine refuses at this exit
  // yields to the next unplaced door in ascending id, reported with its id.
  const existing = exitDecisionForSource(topology, target.source);
  const placed = new Set(
    existing?.normal.kind === 'batch'
      ? existing.normal.targets.map((entry) => entry.occurrenceId as string)
      : [],
  );
  const unplaced = doors.filter(
    (door) => !placed.has(doorOccurrence(context, sourceIndex, doors, door)),
  );
  const ordered = [
    ...unplaced.filter((door) => door === positional),
    ...unplaced.filter((door) => door !== positional),
  ];
  let positionalRefused = false;
  for (const door of ordered) {
    const evaluation = context
      .candidates()
      .evaluate({ kind: 'roomTarget', target, gameName: door.room });
    if (evaluation.kind === 'roomTarget' && evaluation.result.findings.length > 0) {
      if (door === positional) positionalRefused = true;
      continue;
    }
    const occurrenceId = doorOccurrence(context, sourceIndex, doors, door);
    const created: ProjectCommand = {
      kind: 'CreateTarget',
      target,
      occurrenceId,
      gameName: door.room,
    };
    const initialized: ProjectCommand = {
      kind: 'InitializeExitDecision',
      decision,
      edit: { kind: 'target', target, occurrenceId, gameName: door.room },
    };
    const applied = context.apply(created)
      ? created
      : context.apply(initialized)
        ? initialized
        : undefined;
    if (applied === undefined) continue;
    noteDoorOrder(context, decision, sourceIndex, doors.length);
    // The engine refused the positional door here, or an earlier exit took it.
    if (door !== positional)
      context.note({
        area: 'doors',
        reason: positionalRefused ? 'refused' : 'assumption',
        address: target,
        applied,
        record: {
          roomIndex: sourceIndex,
          visit: 0,
          door: positionalRefused ? positional.door : door.door,
        },
      });
    return true;
  }
  context.refuse();
  return false;
}

/**
 * A Preboss takes over the source's doors: one of them is its Shop, the rest
 * carry counted offers. The record's Shop door becomes the takeover's Shop
 * target; the others follow ascending door id.
 */
function createTakeover(
  context: RunImportContext,
  decision: ReturnType<typeof createExitDecisionAddress>,
  sourceIndex: number,
  exits: readonly { readonly exitKey: string }[],
  doors: readonly RunRecordDoor[],
  gameName: string,
): boolean {
  const evaluation = context
    .candidates()
    .evaluate({ kind: 'takeoverPrebossBatch', source: decision, gameName });
  if (evaluation.kind !== 'takeoverPrebossBatch') return false;
  const required = evaluation.result.requiredExitKeys;
  const provisional = Object.fromEntries(
    required.map((exitKey, index) => [exitKey, createOccurrenceId(`takeover-${index}`)]),
  );
  const project = context.assembly().project;
  const preview = (['CreateTakeoverBatch', 'ReplaceWithTakeoverBatch'] as const)
    .map((kind) => {
      try {
        return applyProjectCommand(project, context.catalog, {
          kind,
          decision,
          gameName,
          targetOccurrenceIds: provisional,
        });
      } catch {
        return undefined;
      }
    })
    .find((document) => document !== undefined);
  if (preview === undefined) return false;
  const occurrences =
    preview.route.biomes.find((biome) => biome.biomeKey === decision.biomeKey)?.topology
      ?.occurrences ?? [];
  const shopExit = required.find(
    (exitKey) =>
      occurrences.find((occurrence) => occurrence.occurrenceId === provisional[exitKey])?.state
        .kind === 'shop',
  );
  const shopDoor = doors.find((candidate) => candidate.reward?.type === 'Shop');
  const others = doors.filter((candidate) => candidate !== shopDoor);
  const orderedExits = exits.filter(
    (exit) => required.includes(exit.exitKey) && exit.exitKey !== shopExit,
  );
  const targetOccurrenceIds = Object.fromEntries(
    required.flatMap((exitKey) => {
      const matched =
        exitKey === shopExit && shopDoor !== undefined
          ? shopDoor
          : others[orderedExits.findIndex((exit) => exit.exitKey === exitKey)];
      return matched === undefined
        ? []
        : [[exitKey, doorOccurrence(context, sourceIndex, doors, matched)]];
    }),
  );
  if (Object.keys(targetOccurrenceIds).length !== required.length) return false;
  const edit = { decision, gameName, targetOccurrenceIds };
  if (
    context.apply({ kind: 'CreateTakeoverBatch', ...edit }) ||
    context.apply({ kind: 'ReplaceWithTakeoverBatch', ...edit })
  ) {
    noteDoorOrder(context, decision, sourceIndex, others.length);
    return true;
  }
  context.refuse();
  return false;
}

function selectExit(context: RunImportContext, selection: Origin<'exitSelection'>): boolean {
  if (selection.source.kind !== 'occurrence') return false;
  const visits = context.occurrences.visitsOf(selection.source.occurrenceId);
  const project = context.assembly().project;
  const topology = project.route.biomes.find(
    (biome) => biome.biomeKey === selection.biomeKey,
  )?.topology;
  if (topology === undefined || topology === null) return false;
  const decision = exitDecisionForSource(topology, selection.source);
  if (decision === undefined) return false;
  for (const roomIndex of visits) {
    const next = roomIndex + 1;
    if (next >= context.record.rooms.length) continue;
    const nextId = context.occurrences.occurrenceOf(next);
    if (chaosRoom(context, context.record.rooms[next]!.name)) {
      ensureChaos(context, selection.biomeKey, roomIndex);
      if (
        context.apply({
          kind: 'SetExitSelection',
          selection,
          value: { kind: 'additional', additionalExitKey: 'chaos' },
        })
      )
        return true;
    }
    if (contractRoom(context, context.record.rooms[next]!.name)) {
      ensureZagreusContract(context, selection.biomeKey, roomIndex);
      if (
        context.apply({
          kind: 'SetExitSelection',
          selection,
          value: { kind: 'additional', additionalExitKey: 'zagreusContract' },
        })
      )
        return true;
    }
    const target =
      decision.normal.kind === 'batch'
        ? decision.normal.targets.find((candidate) => candidate.occurrenceId === nextId)
        : undefined;
    if (
      target !== undefined &&
      context.apply({
        kind: 'SetExitSelection',
        selection,
        value: { kind: 'normal', exitKey: target.exitKey },
      })
    )
      return true;
  }
  return false;
}

/**
 * The store the source's doors drew from: the entered room's own store when an
 * ordinary door was taken, else the one supported store holding every offered type.
 */
function batchRewardStore(context: RunImportContext, store: Origin<'batchRewardStore'>): boolean {
  if (store.source.kind !== 'occurrence') return false;
  const sourceIndex = sourceVisit(context, store.source.occurrenceId);
  if (sourceIndex === undefined) return false;
  const evaluation = context
    .candidates()
    .evaluate({ kind: 'batchRewardStore', rewardStore: store, storeKey: '' });
  if (evaluation.kind !== 'batchRewardStore') return false;
  const supported = evaluation.result.supportStoreKeys;
  const next = context.record.rooms[sourceIndex + 1];
  const entered =
    next !== undefined && !chaosRoom(context, next.name) && !contractRoom(context, next.name)
      ? next.reward?.store
      : undefined;
  const stores = context.catalog.rewards.stores;
  const offered = ordinaryDoors(context, sourceIndex).flatMap((door) =>
    door.reward === undefined ||
    !stores.values.some((entry) =>
      entry.entries.some((item) => item.rewardType === door.reward!.type),
    )
      ? []
      : [door.reward.type],
  );
  const holding = supported.filter((key) =>
    offered.every((type) => stores.byKey[key]?.entries.some((item) => item.rewardType === type)),
  );
  const storeKey =
    entered !== undefined && supported.includes(entered)
      ? entered
      : holding.length === 1
        ? holding[0]
        : undefined;
  if (storeKey === undefined) {
    if (entered !== undefined) context.refuse();
    return false;
  }
  const decision = createExitDecisionAddress(
    createBiomeAddress(store.routeKey, store.biomeKey),
    store.source,
  );
  return (
    context.apply({
      kind: 'InitializeExitDecision',
      decision,
      edit: { kind: 'rewardStore', storeKey },
    }) ||
    context.apply({ kind: 'ReplaceBatchRewardStore', rewardStore: store, storeKey }) ||
    context.apply({ kind: 'ReplaceBossDoorRewardStore', rewardStore: store, storeKey })
  );
}

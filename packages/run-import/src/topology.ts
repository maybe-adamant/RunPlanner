import {
  createAdditionalExitAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createTargetAddress,
  declaredPhysicalExits,
  semanticAddressKey,
  takeoverPrebossGameNames,
  type OccurrenceId,
  type ProjectCommand,
  type SemanticAddress,
  type TargetAddress,
  applyProjectCommand,
  exitDecisionForSource,
} from '@run-planner/engine/authored-project';
import { nativeExitDoorOrder } from '@run-planner/engine/catalog-schema';
import type { SemanticFinding } from '@run-planner/engine/simulation';
import type { RunRecordDoor } from './run-record/model';
import type { RunImportContext } from './import';
import { recordedEntryStates } from './conformance';
import { searchRoom } from './room-search';
import { pickupUseCount } from './vocabulary';

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

/** The source visit's ordinary doors, before any order is applied. */
const unorderedDoors = (context: RunImportContext, roomIndex: number) =>
  context.record.rooms[roomIndex]!.doors.filter(
    (door) => !chaosRoom(context, door.room) && !contractRoom(context, door.room),
  );

/**
 * Every door the visit offered in the game's processing order, when the
 * catalog declares the room's door-setup order.
 */
function nativeDoorOrder(
  context: RunImportContext,
  roomIndex: number,
): readonly number[] | undefined {
  const room = context.record.rooms[roomIndex]!;
  return nativeExitDoorOrder(
    context.catalog,
    room.name,
    room.doors.map((door) =>
      chaosRoom(context, door.room)
        ? { doorId: door.door, additionalExitKey: 'chaos' }
        : contractRoom(context, door.room)
          ? { doorId: door.door, additionalExitKey: 'zagreusContract' }
          : { doorId: door.door },
    ),
  );
}

/**
 * The source visit's ordinary doors in native order. Same-name doors keep
 * the offered-exit table's order, which no save keeps: a room without a
 * declared door-setup order takes ascending door id.
 */
function ordinaryDoors(context: RunImportContext, roomIndex: number): readonly RunRecordDoor[] {
  const order = nativeDoorOrder(context, roomIndex);
  const rank = (door: RunRecordDoor) =>
    order === undefined ? door.door : order.indexOf(door.door);
  return [...unorderedDoors(context, roomIndex)].sort((left, right) => rank(left) - rank(right));
}

/** The occurrence a door creates: the entered room for the taken door, else its own offered room. */
function doorOccurrence(
  context: RunImportContext,
  roomIndex: number,
  doors: readonly RunRecordDoor[],
  door: RunRecordDoor,
): OccurrenceId {
  const next = context.record.rooms[roomIndex + 1];
  const tied = tiedTwins(context, roomIndex, doors);
  const taken =
    tied.find((candidate) => context.used.has(twinPin(roomIndex, candidate))) ?? tied[0];
  return taken === door && next !== undefined
    ? context.occurrences.occurrenceOf(roomIndex + 1)
    : context.occurrences.offeredOccurrence(roomIndex, door.door);
}

const twinPin = (roomIndex: number, door: RunRecordDoor) => `twinTaken:${roomIndex}:${door.door}`;

/**
 * The doors to the entered room the taken one may be, in native order. Twin
 * doors can lead to one room: the taken one offered the collected reward, god
 * included, and only doors alike in both remain tied.
 */
function tiedTwins(
  context: RunImportContext,
  roomIndex: number,
  doors: readonly RunRecordDoor[],
): readonly RunRecordDoor[] {
  const room = context.record.rooms[roomIndex]!;
  const next = context.record.rooms[roomIndex + 1];
  const sameRoom = doors.filter((candidate) => candidate.room === room.exit);
  if (sameRoom.length <= 1) return sameRoom;
  const sameType = sameRoom.filter((candidate) => candidate.reward?.type === next?.reward?.type);
  const sameGod = sameType.filter(
    (candidate) => candidate.reward?.lootName === next?.reward?.lootName,
  );
  return sameGod.length > 0 ? sameGod : sameType.slice(0, 1);
}

/**
 * Chooses the taken door among tied twins once, as the source's first exit
 * is placed: each twin is placed as taken and the source judged at its next
 * entry save, which draws both doors' rewards in door order. The first
 * accepted twin is taken; without one the first in native order; several
 * accepted are reported.
 */
function chooseTakenTwin(
  context: RunImportContext,
  target: TargetAddress,
  sourceIndex: number,
  doors: readonly RunRecordDoor[],
): void {
  const tied = tiedTwins(context, sourceIndex, doors);
  const searched = `twinSearch:${sourceIndex}`;
  if (
    tied.length < 2 ||
    context.used.has(searched) ||
    tied.some((door) => context.used.has(twinPin(sourceIndex, door)))
  )
    return;
  context.used.add(searched);
  if (recordedEntryStates(context.record)[sourceIndex + 1] === undefined) return;
  const search = searchRoom(context, {
    roomIndex: sourceIndex,
    candidates: tied,
    author: (door) => {
      context.used.add(twinPin(sourceIndex, door));
      return createTarget(context, target) ? door : undefined;
    },
    settles: [
      ...doors.map((door) => context.occurrences.offeredOccurrence(sourceIndex, door.door)),
      context.occurrences.occurrenceOf(sourceIndex + 1),
    ],
    limit: tied.length,
  });
  const accepted = search.fits.filter((fit) => fit.accepted).map((fit) => fit.choice);
  const taken = accepted[0] ?? tied[0]!;
  context.used.add(twinPin(sourceIndex, taken));
  if (accepted.length > 1)
    context.note({
      area: 'doors',
      reason: 'notInRecord',
      address: createExitDecisionAddress(
        createBiomeAddress(target.routeKey, target.biomeKey),
        target.source,
      ),
      record: { roomIndex: sourceIndex, visit: 0, door: taken.door },
    });
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

/**
 * A batch's ascending door order is an assumption, reported once when its first
 * door lands; a native order is exact.
 */
function noteDoorOrder(
  context: RunImportContext,
  decision: ReturnType<typeof createExitDecisionAddress>,
  sourceIndex: number,
  doorCount: number,
): void {
  const used = `doorOrder:${semanticAddressKey(decision)}`;
  if (doorCount < 2 || context.used.has(used)) return;
  if (nativeDoorOrder(context, sourceIndex) !== undefined) return;
  context.used.add(used);
  context.note({
    area: 'doors',
    reason: 'assumption',
    address: decision,
    record: { roomIndex: sourceIndex, visit: 0 },
  });
}

/** Authors a room at the target's exit, returning the command applied. */
function placeRoom(
  context: RunImportContext,
  target: TargetAddress,
  decision: ReturnType<typeof createExitDecisionAddress>,
  occurrenceId: OccurrenceId,
  gameName: string,
): ProjectCommand | undefined {
  const created: ProjectCommand = { kind: 'CreateTarget', target, occurrenceId, gameName };
  const initialized: ProjectCommand = {
    kind: 'InitializeExitDecision',
    decision,
    edit: { kind: 'target', target, occurrenceId, gameName },
  };
  return context.apply(created) ? created : context.apply(initialized) ? initialized : undefined;
}

/** Authors the door's room at the target's exit, returning the command applied. */
function placeDoor(
  context: RunImportContext,
  target: TargetAddress,
  decision: ReturnType<typeof createExitDecisionAddress>,
  sourceIndex: number,
  doors: readonly RunRecordDoor[],
  door: RunRecordDoor,
): ProjectCommand | undefined {
  const occurrenceId = doorOccurrence(context, sourceIndex, doors, door);
  if (anomalyRoom(context, door.room))
    return placeAnomaly(context, target, decision, sourceIndex, occurrenceId, door);
  return placeRoom(context, target, decision, occurrenceId, door.room);
}

const anomalyRoom = (context: RunImportContext, gameName: string) =>
  context.catalog.rooms.byKey[gameName]?.roomSetKey === 'Anomaly';

/** The G rooms an Anomaly may displace at a target, when the target's biome declares the detour. */
function replaceableRooms(context: RunImportContext, target: TargetAddress): readonly string[] {
  const progression = context.catalog.biomeLayouts.byKey[target.biomeKey]?.progression;
  return progression?.kind === 'generated'
    ? (progression.anomalyReplacement?.replaceableTargetRoomGameNames ?? [])
    : [];
}

/**
 * An Anomaly door is a G target the game swapped for the Anomaly map, so it is
 * first authored as the first G room the engine admits there; once every door
 * of the source is placed, it is switched to the recorded map. No save names
 * the displaced room, which leaves no trace in the run: the first admitted
 * one stands for any, reported.
 */
function placeAnomaly(
  context: RunImportContext,
  target: TargetAddress,
  decision: ReturnType<typeof createExitDecisionAddress>,
  sourceIndex: number,
  occurrenceId: OccurrenceId,
  door: RunRecordDoor,
): ProjectCommand | undefined {
  for (const gameName of replaceableRooms(context, target)) {
    if (roomRefusedAt(context, target, gameName)) continue;
    const applied = placeRoom(context, target, decision, occurrenceId, gameName);
    if (applied === undefined) continue;
    context.note({
      area: 'doors',
      reason: 'assumption',
      address: target,
      applied,
      record: { roomIndex: sourceIndex, visit: 0, door: door.door },
    });
    return applied;
  }
  return undefined;
}

/**
 * Switches the source's placed Anomaly doors to their recorded maps once all
 * its doors are placed: a batch takes no new target beside an Anomaly. The
 * entered map's challenge succeeded when its reward was picked up.
 */
function switchAnomalies(
  context: RunImportContext,
  decision: ReturnType<typeof createExitDecisionAddress>,
  sourceIndex: number,
  doors: readonly RunRecordDoor[],
): void {
  if (!doors.some((door) => anomalyRoom(context, door.room))) return;
  const topology = context
    .assembly()
    .project.route.biomes.find((biome) => biome.biomeKey === decision.biomeKey)?.topology;
  if (topology === undefined || topology === null) return;
  const placed = exitDecisionForSource(topology, decision.source)?.normal;
  if (placed?.kind !== 'batch' || placed.targets.length < doors.length) return;
  const biome = createBiomeAddress(decision.routeKey, decision.biomeKey);
  for (const door of doors) {
    if (!anomalyRoom(context, door.room)) continue;
    const occurrenceId = doorOccurrence(context, sourceIndex, doors, door);
    const entry = placed.targets.find((candidate) => candidate.occurrenceId === occurrenceId);
    const current = topologyOccurrence(context, decision.biomeKey, occurrenceId);
    if (entry === undefined || current === undefined || current.anomalyReplacement !== undefined)
      continue;
    const target = createTargetAddress(biome, decision.source, entry.exitKey);
    const occurrence = createOccurrenceAddress(biome, occurrenceId);
    const entered =
      occurrenceId === context.occurrences.occurrenceOf(sourceIndex + 1)
        ? context.record.rooms[sourceIndex + 1]
        : undefined;
    const rewardType = entered?.reward?.type;
    const switched = context.transaction(() => {
      if (!context.apply({ kind: 'SwitchTargetToAnomaly', target })) return false;
      context.apply({ kind: 'ReplaceAnomalyMap', occurrence, gameName: door.room });
      if (
        entered !== undefined &&
        rewardType !== undefined &&
        pickupUseCount(context.catalog, entered, rewardType) === 0
      )
        context.apply({ kind: 'ReplaceAnomalySuccess', occurrence, success: false });
      return topologyOccurrence(context, decision.biomeKey, occurrenceId)?.gameName === door.room;
    });
    if (!switched)
      context.note({
        area: 'doors',
        reason: 'refused',
        address: target,
        record: { roomIndex: sourceIndex, visit: 0, door: door.door },
      });
  }
}

const roomRefusedAt = (context: RunImportContext, target: TargetAddress, gameName: string) => {
  const evaluation = context.candidates().evaluate({ kind: 'roomTarget', target, gameName });
  return evaluation.kind === 'roomTarget' && evaluation.result.findings.length > 0;
};

const refusedAt = (context: RunImportContext, target: TargetAddress, door: RunRecordDoor) =>
  anomalyRoom(context, door.room)
    ? replaceableRooms(context, target).every((gameName) =>
        roomRefusedAt(context, target, gameName),
      )
    : roomRefusedAt(context, target, door.room);

/**
 * The pairings of the unplaced doors with the open exits that the engine
 * accepts, each exit in turn, in door order; two are enough to tell a
 * determined pairing from a choice.
 */
function acceptedPairings(
  context: RunImportContext,
  decision: ReturnType<typeof createExitDecisionAddress>,
  sourceIndex: number,
  exitKeys: readonly string[],
  doors: readonly RunRecordDoor[],
  unplaced: readonly RunRecordDoor[],
): readonly (readonly RunRecordDoor[])[] {
  const accepted: (readonly RunRecordDoor[])[] = [];
  const pair = (paired: readonly RunRecordDoor[]): void => {
    if (paired.length === exitKeys.length) {
      accepted.push(paired);
      return;
    }
    const target = createTargetAddress(
      createBiomeAddress(decision.routeKey, decision.biomeKey),
      decision.source,
      exitKeys[paired.length]!,
    );
    for (const door of unplaced) {
      if (accepted.length >= 2) return;
      if (paired.includes(door) || refusedAt(context, target, door)) continue;
      // A lone open exit's door is placed for real by the caller, which checks it there.
      if (exitKeys.length === 1) {
        accepted.push([door]);
        continue;
      }
      context.probe(() => {
        if (placeDoor(context, target, decision, sourceIndex, doors, door) !== undefined)
          pair([...paired, door]);
      });
    }
  };
  pair([]);
  return accepted;
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
  chooseTakenTwin(context, target, sourceIndex, doors);
  const positional = doors[position]!;
  const takeovers = takeoverPrebossGameNames(context.catalog, target.biomeKey);
  if (takeovers.includes(positional.room))
    return createTakeover(context, decision, sourceIndex, exits, doors, positional.room);
  const existing = exitDecisionForSource(topology, target.source);
  const placedTargets = existing?.normal.kind === 'batch' ? existing.normal.targets : [];
  const placed = new Set(placedTargets.map((entry) => entry.occurrenceId as string));
  const unplaced = doors.filter(
    (door) => !placed.has(doorOccurrence(context, sourceIndex, doors, door)),
  );
  // Doors pair with exits as the engine's exit compatibility allows: one
  // accepted pairing is exact, several keep door order among them.
  const openExits = exits
    .slice(0, doors.length)
    .map((exit) => exit.exitKey)
    .filter((exitKey) => !placedTargets.some((entry) => entry.exitKey === exitKey));
  const pairings =
    openExits.length === unplaced.length && !unplaced.some((door) => takeovers.includes(door.room))
      ? acceptedPairings(context, decision, sourceIndex, openExits, doors, unplaced)
      : [];
  const paired = pairings[0]?.[openExits.indexOf(target.exitKey)];
  if (paired !== undefined) {
    const applied = placeDoor(context, target, decision, sourceIndex, doors, paired);
    if (applied !== undefined) {
      if (pairings.length > 1) noteDoorOrder(context, decision, sourceIndex, doors.length);
      // A native order the engine refuses is reported, not overridden silently.
      if (paired !== positional && nativeDoorOrder(context, sourceIndex) !== undefined)
        context.note({
          area: 'doors',
          reason: 'refused',
          address: target,
          applied,
          record: { roomIndex: sourceIndex, visit: 0, door: positional.door },
        });
      switchAnomalies(context, decision, sourceIndex, doors);
      return true;
    }
  }
  // No pairing places every door: the positional door goes first; a door the
  // engine refuses at this exit yields to the next unplaced door in door
  // order, reported with its id.
  const ordered = [
    ...unplaced.filter((door) => door === positional),
    ...unplaced.filter((door) => door !== positional),
  ];
  let positionalRefused = false;
  for (const door of ordered) {
    if (refusedAt(context, target, door)) {
      if (door === positional) positionalRefused = true;
      continue;
    }
    const applied = placeDoor(context, target, decision, sourceIndex, doors, door);
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
    switchAnomalies(context, decision, sourceIndex, doors);
    return true;
  }
  context.refuse();
  return false;
}

/**
 * A Preboss takes over the source's doors: one of them is its Shop, the rest
 * carry counted offers. The record's Shop door becomes the takeover's Shop
 * target; the others follow door order.
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

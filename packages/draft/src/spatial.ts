import type {
  Catalog,
  HubDecisionDescriptor,
  RoomDeclaration,
} from '@run-planner/engine/catalog-schema';

/** A spot on a room's map, in map units. */
export interface DraftPoint {
  readonly x: number;
  readonly y: number;
}

function squaredDistance(from: DraftPoint, to: DraftPoint): number {
  return (from.x - to.x) ** 2 + (from.y - to.y) ** 2;
}

/**
 * The values nearest `from` first, by squared distance; ties keep their order, and values
 * without a known spot follow in theirs. With `from` unknown, the order is kept.
 */
export function nearestFirst<T>(
  from: DraftPoint | undefined,
  values: readonly T[],
  at: (value: T) => DraftPoint | undefined,
): T[] {
  if (from === undefined) return [...values];
  const distance = (value: T) => {
    const point = at(value);
    return point === undefined ? Infinity : squaredDistance(from, point);
  };
  return values
    .map((value, index) => ({ value, index, distance: distance(value) }))
    .sort((left, right) => left.distance - right.distance || left.index - right.index)
    .map((entry) => entry.value);
}

/** A room's `HeroStart` by its ObjectId. */
export function draftHeroStart(
  room: RoomDeclaration | undefined,
  startPointId: number,
): DraftPoint | undefined {
  return room?.mapPoints?.heroStarts.find((point) => point.id === startPointId);
}

/** Where a Fields cage slot's stored point stands; undefined while it has none. */
export function draftFieldsCagePoint(
  room: RoomDeclaration | undefined,
  pointId: number | null | undefined,
): DraftPoint | undefined {
  if (pointId === null || pointId === undefined) return undefined;
  return room?.mapPoints?.fieldsCagePoints?.find((point) => point.id === pointId);
}

/** The local reward slot a Fields cage phase unlocks, as the room's encounter envelope declares it. */
export function draftFieldsCageSlotKey(
  catalog: Catalog,
  room: RoomDeclaration | undefined,
  phaseKey: string,
): string | undefined {
  if (room === undefined) return undefined;
  const attachment = catalog.encounterEnvelopes.byKey[room.encounterEnvelopeKey]?.slots.find(
    (slot) => slot.key === phaseKey,
  )?.rewardAttachment;
  return attachment?.kind === 'localReward' ? attachment.slotKey : undefined;
}

/**
 * The Hub's spots a visit order walks between: where Melinoë enters it (the Hub room's own
 * `HeroStartPoint`, which the PreHub's door also sets), each slot's door, where she returns
 * from its room, and the Hub's fountain.
 */
export interface DraftHubMap {
  readonly entry?: DraftPoint;
  readonly fountain?: DraftPoint;
  readonly doorBySlot: ReadonlyMap<string, DraftPoint>;
}

export function draftHubMap(catalog: Catalog, progression: HubDecisionDescriptor): DraftHubMap {
  const room = catalog.rooms.byKey[progression.restoreRoomGameName];
  const entryId = room?.orientation?.entry?.startPointId;
  const entry = entryId === undefined ? undefined : draftHeroStart(room, entryId);
  const fountain = room?.mapPoints?.healthFountainPoint;
  const doorBySlot = new Map<string, DraftPoint>();
  for (const slot of progression.slots) {
    const door = room?.mapPoints?.exitDoors.find((point) => point.id === slot.physicalDoorId);
    if (door !== undefined) doorBySlot.set(slot.slotKey, door);
  }
  return {
    ...(entry === undefined ? {} : { entry }),
    ...(fountain === undefined ? {} : { fountain }),
    doorBySlot,
  };
}

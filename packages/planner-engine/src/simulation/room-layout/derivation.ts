import {
  nativeExitDoorOrder,
  type Catalog,
  type RoomDeclaration,
  type RoomMapDirection,
  type RoomMapExitDoor,
} from '../../catalog-schema';
import type { RoomLayout } from '../../authored-project/model';

/**
 * The door a room is entered through, relative to the room left before it: an
 * ordinary exit by its index, a map door by id (Hub board and side-room
 * doors), the left room's only door (fixed links and biome transitions), or a
 * door spawned at runtime.
 */
export type RoomEntryDoor =
  | { readonly kind: 'exit'; readonly index: number }
  | { readonly kind: 'mapDoor'; readonly doorId: number }
  | { readonly kind: 'soleDoor' }
  | { readonly kind: 'chaosGate' }
  | { readonly kind: 'zagreusContract' };

/** The room native `LeaveRoom` last left, as the next room's flip and entry read it. */
export interface RoomDeparture {
  readonly gameName: string;
  /** Absent while the left room's flip is an unset roll. */
  readonly flipped?: boolean;
}

/** What the previous room's exit tells the entered room. */
export type RoomArrival =
  | { readonly kind: 'runStart' }
  | {
      readonly kind: 'door';
      /** The live exit direction; absent when the game names none or it is not known. */
      readonly exitDirection?: RoomMapDirection;
      /** The entry the left room's door sets (`OnUseSetRunData`). */
      readonly forcedEntry?: RoomEntryPoint;
    };

export interface RoomEntryPoint {
  readonly startPointId: number;
  readonly endPointId: number;
}

/** An eligible entry, with the flip it needs when the room's flip is a roll. */
export interface RoomEntryOption extends RoomEntryPoint {
  readonly flipped?: boolean;
}

export type RoomLayoutFlip =
  | { readonly kind: 'fixed' | 'derived'; readonly value: boolean }
  /** A roll: the authored value, else the one the authored entry needs; absent leaves it native. */
  | { readonly kind: 'roll'; readonly chance: number; readonly value?: boolean };

export type RoomLayoutEntry =
  | { readonly kind: 'fixed' | 'derived'; readonly point: RoomEntryPoint }
  | {
      readonly kind: 'choice';
      /** Every entry the game can pick, across both flips of a roll. */
      readonly eligible: readonly RoomEntryOption[];
      /** The authored entry when it is eligible, even where it alone remains; absent leaves it native. */
      readonly point?: RoomEntryPoint;
    }
  /** The room has no entry points on record. */
  | { readonly kind: 'unknown' };

export interface RoomLayoutDerivation {
  readonly arrival: RoomArrival['kind'];
  readonly exitDirection?: RoomMapDirection;
  readonly flip: RoomLayoutFlip;
  readonly entry: RoomLayoutEntry;
  /** The authored flip where the room's flip is not a roll. */
  readonly flipUnavailable?: boolean;
  /** The authored entry where it is not eligible. */
  readonly entryUnavailable?: { readonly eligibleStartPointIds: readonly number[] };
}

/**
 * Horizontal mirroring of a direction: Left/Right and West/East swap, North
 * and South stay. Unverified: assumed from the icon code mirroring on
 * `IsHorizontallyFlipped`; the in-game probe confirms or corrects it.
 */
function mirrored(direction: RoomMapDirection): RoomMapDirection {
  switch (direction) {
    case 'Left':
      return 'Right';
    case 'Right':
      return 'Left';
    case 'West':
      return 'East';
    case 'East':
      return 'West';
    case 'North':
    case 'South':
      return direction;
  }
}

function live(direction: RoomMapDirection, flipped: boolean): RoomMapDirection {
  return flipped ? mirrored(direction) : direction;
}

/** The map door an entry door names in the left room; undefined for a spawned door. */
function mapDoorThrough(
  catalog: Pick<Catalog, 'rooms' | 'exitTypes'>,
  room: RoomDeclaration,
  door: RoomEntryDoor,
): RoomMapExitDoor | undefined {
  const doors = room.mapPoints?.exitDoors ?? [];
  switch (door.kind) {
    case 'mapDoor':
      return doors.find((candidate) => candidate.id === door.doorId);
    case 'soleDoor':
      return doors.length === 1 ? doors[0] : undefined;
    case 'exit': {
      // Exit N is realized at the Nth map door in the game's door order.
      const order =
        doors.length === 1
          ? [doors[0]!.id]
          : nativeExitDoorOrder(
              catalog,
              room.gameName,
              doors.map((candidate) => ({ doorId: candidate.id })),
            );
      const doorId = order?.[door.index - 1];
      return doors.find((candidate) => candidate.id === doorId);
    }
    case 'chaosGate':
    case 'zagreusContract':
      // A spawned door has no map HeroExit fact on record.
      return undefined;
  }
}

/**
 * The previous room's exit as the next room reads it: the taken door's
 * canonical direction, mirrored when that room was flipped, and the entry
 * its door sets. Unknown at run start, where the left room ignores exit
 * direction or has no `HeroExit` for the door, or while its flip is unset.
 */
export function roomArrivalThrough(
  catalog: Pick<Catalog, 'rooms' | 'exitTypes'>,
  departure: RoomDeparture | undefined,
  door: RoomEntryDoor,
): RoomArrival {
  if (departure === undefined) return Object.freeze({ kind: 'runStart' });
  const previous = catalog.rooms.byKey[departure.gameName];
  const mapDoor = previous === undefined ? undefined : mapDoorThrough(catalog, previous, door);
  const forced = previous?.orientation?.nextRoomEntries?.find(
    (entry) => entry.obstacleName === mapDoor?.obstacleName,
  );
  const canonical =
    previous?.orientation?.ignoresExitDirection === true ? undefined : mapDoor?.exitDirection;
  const exitDirection =
    canonical === undefined || departure.flipped === undefined
      ? undefined
      : live(canonical, departure.flipped);
  return Object.freeze({
    kind: 'door',
    ...(exitDirection === undefined ? {} : { exitDirection }),
    ...(forced === undefined
      ? {}
      : {
          forcedEntry: Object.freeze({
            startPointId: forced.startPointId,
            endPointId: forced.endPointId,
          }),
        }),
  });
}

const DEFAULT_FLIP_CHANCE = 0.5;

function nativeFlip(room: RoomDeclaration, arrival: RoomArrival): RoomLayoutFlip {
  // Run start loads the first room unflipped.
  if (arrival.kind === 'runStart') return Object.freeze({ kind: 'fixed', value: false });
  const entrance = room.orientation?.entranceDirection;
  const exit = arrival.exitDirection;
  if ((entrance === 'Left' || entrance === 'Right') && exit !== undefined)
    return Object.freeze({ kind: 'derived', value: entrance !== exit });
  const chance = room.orientation?.flipChance ?? DEFAULT_FLIP_CHANCE;
  if (chance <= 0) return Object.freeze({ kind: 'fixed', value: false });
  if (chance >= 1) return Object.freeze({ kind: 'fixed', value: true });
  return Object.freeze({ kind: 'roll', chance });
}

/**
 * The entries the game can pick under one flip: the pairs whose live
 * direction equals the exit, every pair when the exit is unknown, else the
 * lowest-id start with the lowest-id end.
 */
function entriesUnder(
  room: RoomDeclaration,
  exit: RoomMapDirection | undefined,
  flipped: boolean,
): readonly RoomEntryPoint[] {
  const points = room.mapPoints!;
  const pairs = points.entryPairs;
  const matching =
    exit === undefined
      ? pairs
      : pairs.filter(
          (pair) => pair.direction !== undefined && live(pair.direction, flipped) === exit,
        );
  if (matching.length > 0)
    return matching.map((pair) => ({
      startPointId: pair.startPointId,
      endPointId: pair.endPointId,
    }));
  const start = Math.min(...points.heroStarts.map((point) => point.id));
  const end = Math.min(...points.heroEnds.map((point) => point.id));
  return [{ startPointId: start, endPointId: end }];
}

function compatible(option: RoomEntryOption, flipped: boolean | undefined): boolean {
  return option.flipped === undefined || flipped === undefined || option.flipped === flipped;
}

/**
 * The one derivation rule for a room's flip and entry as it is entered, from
 * the previous room's exit and the room's own authored layout.
 */
export function deriveRoomLayout(
  room: RoomDeclaration,
  arrival: RoomArrival,
  authored: RoomLayout | undefined,
): RoomLayoutDerivation {
  const native = nativeFlip(room, arrival);
  const exitDirection = arrival.kind === 'door' ? arrival.exitDirection : undefined;
  const flipUnavailable = authored?.flipped !== undefined && native.kind !== 'roll';
  const forced =
    (arrival.kind === 'door' ? arrival.forcedEntry : undefined) ?? room.orientation?.entry;
  const points = room.mapPoints;
  const flips = native.kind === 'roll' ? [false, true] : [native.value];
  const options: RoomEntryOption[] = [];
  if (
    forced === undefined &&
    points !== undefined &&
    points.heroStarts.length > 0 &&
    points.heroEnds.length > 0
  ) {
    const byStart = new Map<number, { point: RoomEntryPoint; flips: Set<boolean> }>();
    for (const flipped of flips)
      for (const point of entriesUnder(room, exitDirection, flipped)) {
        const entry = byStart.get(point.startPointId) ?? { point, flips: new Set<boolean>() };
        entry.flips.add(flipped);
        byStart.set(point.startPointId, entry);
      }
    for (const { point, flips: needed } of [...byStart.values()].sort(
      (left, right) => left.point.startPointId - right.point.startPointId,
    ))
      options.push(
        Object.freeze({
          ...point,
          ...(native.kind === 'roll' && needed.size === 1 ? { flipped: [...needed][0]! } : {}),
        }),
      );
  }
  const authoredFlip = native.kind === 'roll' ? authored?.flipped : undefined;
  const authoredEntry = authored?.entryStartPointId;
  const chosen =
    authoredEntry === undefined
      ? undefined
      : forced !== undefined
        ? forced.startPointId === authoredEntry
          ? Object.freeze({ ...forced })
          : undefined
        : options.find(
            (option) =>
              option.startPointId === authoredEntry &&
              compatible(option, native.kind === 'roll' ? authoredFlip : native.value),
          );
  const flipValue =
    native.kind === 'roll'
      ? (authoredFlip ?? (chosen as RoomEntryOption | undefined)?.flipped)
      : native.value;
  const flip: RoomLayoutFlip =
    native.kind === 'roll'
      ? Object.freeze({ ...native, ...(flipValue === undefined ? {} : { value: flipValue }) })
      : native;
  const open = options.filter((option) => compatible(option, flipValue));
  const point = (option: RoomEntryPoint): RoomEntryPoint =>
    Object.freeze({ startPointId: option.startPointId, endPointId: option.endPointId });
  const entry: RoomLayoutEntry =
    forced !== undefined
      ? Object.freeze({ kind: 'fixed', point: point(forced) })
      : options.length === 0
        ? Object.freeze({ kind: 'unknown' })
        : open.length === 1 && chosen === undefined
          ? Object.freeze({ kind: 'derived', point: point(open[0]!) })
          : Object.freeze({
              kind: 'choice',
              eligible: Object.freeze(options),
              ...(chosen === undefined ? {} : { point: point(chosen) }),
            });
  const entryUnavailable =
    authoredEntry !== undefined && chosen === undefined
      ? Object.freeze({
          eligibleStartPointIds: Object.freeze(
            forced !== undefined
              ? [forced.startPointId]
              : open.map((option) => option.startPointId),
          ),
        })
      : undefined;
  return Object.freeze({
    arrival: arrival.kind,
    ...(exitDirection === undefined ? {} : { exitDirection }),
    flip,
    entry,
    ...(flipUnavailable ? { flipUnavailable: true } : {}),
    ...(entryUnavailable === undefined ? {} : { entryUnavailable }),
  });
}

/** The flip a derived layout leaves the room with, as its departure records it. */
export function departureFrom(gameName: string, layout: RoomLayoutDerivation): RoomDeparture {
  const flipped = layout.flip.value;
  return Object.freeze({ gameName, ...(flipped === undefined ? {} : { flipped }) });
}

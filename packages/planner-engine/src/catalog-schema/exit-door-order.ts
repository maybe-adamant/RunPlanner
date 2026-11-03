/**
 * The order the game processes a room's open exit doors in.
 *
 * Each open door enters `MapState.OfferedExitDoors`, keyed by its ObjectId: the
 * map's doors in the room's door-setup order, then doors spawned at runtime.
 * `DoUnlockRoomExits` walks that Lua 5.2 table in `pairs()` order and
 * `table.sort`s it by obstacle name; same-name doors tie, so the table walk and
 * the sort's pivot swaps decide their order.
 */
import type { AdditionalExitDeclaration, Catalog, ExitDoorSetup } from './index';

/** A door the record saw open: a map door, or the door of one of the room's additional exits. */
export interface OpenExitDoor {
  readonly doorId: number;
  readonly additionalExitKey?: AdditionalExitDeclaration['key'];
}

/**
 * The open doors' ids in native processing order, or undefined when the room
 * declares no door-setup order or an open door is neither a declared map door
 * nor one of the room's additional exits.
 */
export function nativeExitDoorOrder(
  catalog: Pick<Catalog, 'rooms' | 'exitTypes'>,
  roomGameName: string,
  open: readonly OpenExitDoor[],
): readonly number[] | undefined {
  const room = catalog.rooms.byKey[roomGameName];
  const setup = room?.exitDoorSetupOrder;
  if (room === undefined || setup === undefined) return undefined;
  const openIds = new Set(open.map((door) => door.doorId));
  const spawned: ExitDoorSetup[] = [];
  for (const door of open) {
    if (door.additionalExitKey === undefined) {
      if (!setup.some((entry) => entry.doorId === door.doorId)) return undefined;
      continue;
    }
    const exit = room.additionalExits.find((entry) => entry.key === door.additionalExitKey);
    const obstacleName =
      exit === undefined
        ? undefined
        : catalog.exitTypes.byKey[exit.physicalExit.type]?.spawnedObstacleName;
    if (obstacleName === undefined) return undefined;
    spawned.push({ doorId: door.doorId, obstacleName });
  }
  return offeredExitDoorOrder([...setup.filter((entry) => openIds.has(entry.doorId)), ...spawned]);
}

/** Door ids in `DoUnlockRoomExits` order, from the open doors in table insertion order. */
export function offeredExitDoorOrder(inserted: readonly ExitDoorSetup[]): readonly number[] {
  const nameOf = new Map(inserted.map((door) => [door.doorId, door.obstacleName]));
  if (nameOf.size !== inserted.length) throw new Error('offered exit doors repeat an ObjectId');
  return luaSort(
    luaPairsOrder(inserted.map((door) => door.doorId)),
    (left, right) => nameOf.get(left)! < nameOf.get(right)!,
  );
}

const hashBytes = new DataView(new ArrayBuffer(8));

/** Lua 5.2 `hashnum` with the IEEE754 `luai_hashnum`: word sum of `n + 1.0`, made non-negative. */
function luaNumberHash(key: number): number {
  hashBytes.setFloat64(0, key + 1, true);
  let hash = (hashBytes.getUint32(0, true) + hashBytes.getUint32(4, true)) | 0;
  if (hash < 0) hash = hash === -2147483648 ? 0 : -hash;
  return hash;
}

/**
 * `pairs()` order of a Lua 5.2 table that starts empty and receives these
 * number keys in order: only the hash part holds them, `next` walks its nodes
 * by index.
 */
export function luaPairsOrder(keys: readonly number[]): readonly number[] {
  let nodes: (number | undefined)[] = [undefined];
  let chain: (number | undefined)[] = [undefined];
  // The empty table's shared dummy node holds no key and has no free position.
  let dummy = true;
  let lastFree = 0;
  const mainPosition = (key: number) => luaNumberHash(key) % ((nodes.length - 1) | 1);
  const freePosition = (): number | undefined => {
    while (lastFree > 0) {
      lastFree -= 1;
      if (nodes[lastFree] === undefined) return lastFree;
    }
    return undefined;
  };
  const resize = (count: number) => {
    const size = 2 ** Math.ceil(Math.log2(count));
    nodes = new Array<number | undefined>(size).fill(undefined);
    chain = new Array<number | undefined>(size).fill(undefined);
    dummy = false;
    lastFree = size;
  };
  const insert = (key: number): void => {
    if (dummy) return rehash(key);
    const main = mainPosition(key);
    const occupant = nodes[main];
    if (occupant === undefined) {
      nodes[main] = key;
      return;
    }
    const free = freePosition();
    if (free === undefined) return rehash(key);
    let previous = mainPosition(occupant);
    if (previous !== main) {
      // The occupant is not in its main position: move it and take the slot.
      while (chain[previous] !== main) previous = chain[previous]!;
      chain[previous] = free;
      nodes[free] = occupant;
      chain[free] = chain[main];
      chain[main] = undefined;
      nodes[main] = key;
    } else {
      chain[free] = chain[main];
      chain[main] = free;
      nodes[free] = key;
    }
  };
  const rehash = (key: number): void => {
    const old = nodes;
    resize(old.filter((node) => node !== undefined).length + 1);
    for (let index = old.length - 1; index >= 0; index -= 1) {
      const node = old[index];
      if (node !== undefined) insert(node);
    }
    insert(key);
  };
  for (const key of keys) insert(key);
  return Object.freeze(nodes.filter((node): node is number => node !== undefined));
}

/**
 * Lua 5.2 `table.sort` (`auxsort`). It is not stable: even when the
 * comparator orders no two elements, the pivot swaps permute the array.
 */
export function luaSort(
  values: readonly number[],
  lessThan: (left: number, right: number) => boolean,
): readonly number[] {
  // One-based like the Lua array; index 0 is unused.
  const array = [0, ...values];
  const swap = (left: number, right: number) => {
    [array[left], array[right]] = [array[right]!, array[left]!];
  };
  const auxsort = (lower: number, upper: number): void => {
    while (lower < upper) {
      if (lessThan(array[upper]!, array[lower]!)) swap(lower, upper);
      if (upper - lower === 1) break;
      let i = Math.floor((lower + upper) / 2);
      if (lessThan(array[i]!, array[lower]!)) swap(i, lower);
      else if (lessThan(array[upper]!, array[i]!)) swap(i, upper);
      if (upper - lower === 2) break;
      const pivot = array[i]!;
      swap(i, upper - 1);
      i = lower;
      let j = upper - 1;
      for (;;) {
        i += 1;
        while (lessThan(array[i]!, pivot)) i += 1;
        j -= 1;
        while (lessThan(pivot, array[j]!)) j -= 1;
        if (j < i) break;
        swap(i, j);
      }
      swap(upper - 1, i);
      if (i - lower < upper - i) {
        j = lower;
        i -= 1;
        lower = i + 2;
      } else {
        j = i + 1;
        i = upper;
        upper = j - 2;
      }
      auxsort(j, i);
    }
  };
  auxsort(1, values.length);
  return Object.freeze(array.slice(1));
}

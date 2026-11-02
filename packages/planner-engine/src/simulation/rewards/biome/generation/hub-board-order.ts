/**
 * The game's reward-assignment order for an open Hub board.
 *
 * `SetupDefaultDoor` inserts each open door into `MapState.OfferedExitDoors`
 * keyed by its ObjectId, in the map's fixed door-setup order;
 * `DoUnlockRoomExits` walks that Lua 5.2 table in `pairs()` order and then
 * `table.sort`s it with a comparator under which every board door ties. Each
 * door draws its reward in the resulting order, after the doors before it.
 */
export interface HubBoardDoor {
  readonly physicalDoorId: number;
  readonly offeredExitInsertionRank: number;
}

/** Returns the doors in the order the game assigns their rewards. */
export function hubBoardRewardAssignmentOrder<Door extends HubBoardDoor>(
  doors: readonly Door[],
): readonly Door[] {
  const inserted = [...doors].sort(
    (left, right) => left.offeredExitInsertionRank - right.offeredExitInsertionRank,
  );
  const byId = new Map(inserted.map((door) => [door.physicalDoorId, door]));
  if (byId.size !== inserted.length) throw new Error('Hub board doors repeat an ObjectId');
  // Every board door has the same obstacle name, so the comparator ties them all.
  const walked = luaSort(luaPairsOrder(inserted.map((door) => door.physicalDoorId)), () => false);
  return Object.freeze(walked.map((id) => byId.get(id)!));
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

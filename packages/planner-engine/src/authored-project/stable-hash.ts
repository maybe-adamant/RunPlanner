/** FNV-1a of a string: stable across runs and platforms. */
export function stableHash(identity: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * The choice an item scores highest by a stable hash of (item, choice), ties
 * to the earlier choice; undefined when there is none. Each item ranks every
 * choice on its own, so taking one away moves only the items whose best it was.
 */
export function stableChoice<T extends string | number | boolean>(
  identity: string,
  choices: readonly T[],
): T | undefined {
  let best: T | undefined;
  let bestScore = -1;
  for (const choice of choices) {
    const score = stableHash(`${identity}|${String(choice)}`);
    if (score > bestScore) {
      best = choice;
      bestScore = score;
    }
  }
  return best;
}

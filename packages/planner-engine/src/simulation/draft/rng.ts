/** A seeded xorshift stream; every random draft choice reads it. */
export type DraftRng = () => number;

export function createDraftRng(seed: number): DraftRng {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

/** A Fisher–Yates shuffle read from the stream. */
export function shuffleDraft<T>(rng: DraftRng, values: readonly T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [result[index], result[swap]] = [result[swap]!, result[index]!];
  }
  return result;
}

/**
 * A run trait's `Id` concatenates the trait count, run depth (`1 + #RoomHistory`),
 * `_worldTime` and a random float beginning `0.`, without separators
 * (`GetTraitUniqueId`). Returns the world time when exactly one reading falls
 * inside `[after, before]`, or, among several, exactly one reads `depth`.
 */
export function traitWorldTime(
  id: string,
  after: number,
  before: number,
  depth?: number,
): number | undefined {
  const match = /^(\d+)(?:\.(\d+))?0\.\d+$/.exec(id);
  if (match === null) return undefined;
  const digits = match[1]!;
  const fraction = match[2];
  const readings = new Map<number, Set<number>>();
  // Count and depth each take at least one digit; the remainder is the whole seconds.
  for (let countEnd = 1; countEnd <= digits.length - 2; countEnd += 1) {
    if (digits[0] === '0' && countEnd > 1) break;
    for (let depthEnd = countEnd + 1; depthEnd <= digits.length - 1; depthEnd += 1) {
      if (digits[countEnd] === '0') break;
      const seconds = digits.slice(depthEnd);
      if (seconds.length > 1 && seconds[0] === '0') continue;
      const time = Number(fraction === undefined ? seconds : `${seconds}.${fraction}`);
      if (time < after - 1e-6 || time > before + 1e-6) continue;
      const depths = readings.get(time) ?? new Set<number>();
      depths.add(Number(digits.slice(countEnd, depthEnd)));
      readings.set(time, depths);
    }
  }
  if (readings.size === 1) return [...readings.keys()][0];
  const atDepth = [...readings].filter(([, depths]) => depth !== undefined && depths.has(depth));
  return atDepth.length === 1 ? atDepth[0]![0] : undefined;
}

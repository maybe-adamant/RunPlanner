/** A decoded save is about 3.3 MB; anything near this bound is not a save. */
export const LZ4_MAX_OUTPUT = 64 * 1024 * 1024;

/** Decompresses one raw LZ4 block whose decompressed size is not stored. */
export function decompressLz4Block(
  input: Uint8Array,
  initialCapacity = input.length * 4,
  maxOutput = LZ4_MAX_OUTPUT,
): Uint8Array {
  let output = new Uint8Array(Math.min(Math.max(initialCapacity, 64), maxOutput));
  let written = 0;
  const reserve = (extra: number) => {
    if (written + extra <= output.length) return;
    if (written + extra > maxOutput) throw new Error('LZ4 output exceeds its bound');
    let capacity = output.length * 2;
    while (capacity < written + extra) capacity *= 2;
    capacity = Math.min(capacity, maxOutput);
    const grown = new Uint8Array(capacity);
    grown.set(output.subarray(0, written));
    output = grown;
  };
  const byteAt = (position: number): number => {
    const value = input[position];
    if (value === undefined) throw new Error('LZ4 block ends inside a sequence');
    return value;
  };
  const length = (base: number, position: number): [number, number] => {
    let total = base;
    if (base !== 15) return [total, position];
    for (;;) {
      const extra = byteAt(position++);
      total += extra;
      if (extra !== 255) return [total, position];
    }
  };
  let position = 0;
  while (position < input.length) {
    const token = byteAt(position++);
    let literals: number;
    [literals, position] = length(token >> 4, position);
    if (position + literals > input.length) throw new Error('LZ4 literals overrun the block');
    reserve(literals);
    output.set(input.subarray(position, position + literals), written);
    written += literals;
    position += literals;
    if (position === input.length) break;
    const offset = byteAt(position) | (byteAt(position + 1) << 8);
    position += 2;
    if (offset === 0 || offset > written) throw new Error('LZ4 match offset is invalid');
    let matchLength: number;
    [matchLength, position] = length(token & 15, position);
    matchLength += 4;
    reserve(matchLength);
    let source = written - offset;
    for (let index = 0; index < matchLength; index += 1) output[written++] = output[source++]!;
  }
  return output.slice(0, written);
}

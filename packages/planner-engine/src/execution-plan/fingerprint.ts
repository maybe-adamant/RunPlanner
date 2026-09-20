/** Protocol checksum encoding, independent of JSON spelling and host locale. */
function utf8Hex(value: string): string {
  const bytes: number[] = [];
  for (const character of value) {
    const code = character.codePointAt(0)!;
    if (code >= 0xd800 && code <= 0xdfff)
      throw new Error('Execution fingerprint strings must contain Unicode scalar values');
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000)
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    else
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 63),
        0x80 | ((code >> 6) & 63),
        0x80 | (code & 63),
      );
  }
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function canonicalFingerprintInput(value: unknown): string {
  if (value === null) return 'z';
  if (typeof value === 'boolean') return value ? 't' : 'f';
  if (typeof value === 'string') return `s${utf8Hex(value)};`;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Execution fingerprint numbers must be finite');
    const bits = new DataView(new ArrayBuffer(8));
    bits.setFloat64(0, value === 0 ? 0 : value, false);
    return `n${bits.getUint32(0).toString(16).padStart(8, '0')}${bits
      .getUint32(4)
      .toString(16)
      .padStart(8, '0')};`;
  }
  if (Array.isArray(value)) return `[${value.map(canonicalFingerprintInput).join('')}]`;
  if (typeof value !== 'object') throw new Error('Unsupported execution fingerprint value');
  return `{${Object.entries(value)
    .map(([key, entry]) => ({ key: utf8Hex(key), entry }))
    .sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0))
    .map(({ key, entry }) => `s${key};${canonicalFingerprintInput(entry)}`)
    .join('')}}`;
}

export function fingerprint(value: unknown): string {
  let hash = 2166136261;
  for (const character of canonicalFingerprintInput(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

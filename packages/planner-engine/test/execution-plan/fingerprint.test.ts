import { describe, expect, it } from 'vitest';
import { canonicalFingerprintInput, fingerprint } from '../../src/execution-plan/fingerprint';
import vectors from './fixtures/fingerprint-vectors.json';

describe('execution fingerprint canonical encoding', () => {
  // Independent protocol vectors: source JSON, literal canonical bytes, and FNV-1a checksum.
  it.each(vectors)('$name', ({ json, canonical, fingerprint: expected }) => {
    const value: unknown = JSON.parse(json);
    expect(canonicalFingerprintInput(value)).toBe(canonical);
    expect(fingerprint(value)).toBe(expected);
  });

  it('ignores key insertion order and JSON number/string spelling', () => {
    expect(fingerprint({ z: 1, a: 'a' })).toBe(fingerprint(JSON.parse('{"a":"\\u0061","z":1e0}')));
    expect(fingerprint(-0)).toBe(fingerprint(0));
  });

  it('detects numeric, string, type, and array-order mutations', () => {
    for (const [before, after] of [
      [1 / 3, 0.33333333333333],
      [2 / 3, 0.66666666666667],
      ['é', 'e'],
      [1, '1'],
      [
        [1, 2],
        [2, 1],
      ],
      [{ a: true }, { A: true }],
    ])
      expect(fingerprint(before)).not.toBe(fingerprint(after));
  });

  it('rejects non-finite numbers and unpaired surrogates', () => {
    for (const value of [NaN, Infinity, -Infinity, '\ud800', '\udfff'])
      expect(() => fingerprint(value)).toThrow();
  });
});

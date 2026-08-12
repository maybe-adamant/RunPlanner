import { describe, expect, it } from 'vitest';

import { keepsakes } from '../../src/declarations/keepsakes';
import { normalizeKeepsakes } from '../../src/compiler/keepsakes';

describe('keepsake normalization', () => {
  it('rejects malformed rank and Fated inventory facts before catalog construction', () => {
    const wrongRank = keepsakes.map((keepsake) => ({ ...keepsake }));
    wrongRank[0] = { ...wrongRank[0]!, rank: 'Rare' as never };
    expect(() => normalizeKeepsakes(wrongRank)).toThrow('must be fixed rank III (Epic)');

    const wrongDisposition = keepsakes.map((keepsake) => ({ ...keepsake }));
    wrongDisposition[29] = { ...wrongDisposition[29]!, fatedDisposition: 'neutral' };
    expect(() => normalizeKeepsakes(wrongDisposition)).toThrow('expected enabling');

    expect(
      normalizeKeepsakes([...keepsakes].reverse()).values.map((keepsake) => keepsake.key),
    ).toEqual([...keepsakes].reverse().map((keepsake) => keepsake.key));

    const replaced = keepsakes.map((keepsake) => ({ ...keepsake }));
    replaced[0] = { ...replaced[0]!, key: 'UnknownKeepsake' };
    expect(() => normalizeKeepsakes(replaced)).toThrow(
      'must declare the exact authoritative ordinary keepsake inventory',
    );
  });
});

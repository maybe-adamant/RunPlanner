import { describe, expect, it } from 'vitest';

import { evaluate } from '../../support/f-generation-evaluation';

describe('F room generation assembly', () => {
  it('authors the selected F spine and takeover as a complete direct-engine project', () => {
    const result = evaluate();

    expect(result.snapshot.decisions).toHaveLength(11);
    expect(result.generation.validity).toBe('valid');
    expect(result.generation.findings).toEqual([]);
  });
});

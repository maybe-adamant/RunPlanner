import { describe, expect, it } from 'vitest';

import { createCatalog } from '@run-planner/hades2-catalog';
import { declarations } from '@run-planner/hades2-catalog/test-support';

describe('unified biome decisions catalog', () => {
  it('assembles every supported biome through the common immutable catalog envelope', () => {
    const catalog = createCatalog(declarations);
    expect(catalog.version).toBe('0.49.0-completion-topology');
    expect(catalog.biomeLayouts.values.map((layout) => layout.biomeKey)).toEqual([
      'F',
      'G',
      'P',
      'Q',
      'H',
      'O',
      'I',
      'N',
    ]);
    expect(catalog.biomeLayouts.byKey.N).toMatchObject({
      start: { kind: 'fixedAuthored', roomGameName: 'N_Opening01' },
      progression: { kind: 'hub', hubKey: 'hub' },
    });
  });
});

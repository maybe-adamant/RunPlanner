import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { loadUnderworldFGHICheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { createDefaultRouteLoadout } from '../../../src/authored-project/loadout';
import { simulateProjectAssembly, type DraftSpec } from '../../../src/simulation';
import { draftReport } from '../../../src/simulation/draft/report';

describe('draft report', () => {
  it('reports a basket trait the evaluated route never equips as unmet', () => {
    const { startingReward: _startingReward, ...loadout } = createDefaultRouteLoadout(catalog);
    void _startingReward;
    const spec: DraftSpec = {
      loadout,
      world: { godKeys: [], storyNpcByBiome: {}, fieldNpcsByBiome: {} },
      basketTraitKeys: ['SuperSacrificeBoonHera'],
      rackKeepsakeKeys: [null, null, null],
    };
    const project = loadUnderworldFGHICheckpoint();
    const report = draftReport(catalog, spec, simulateProjectAssembly(catalog, project));
    expect(report.targets).toContainEqual({
      kind: 'basketTrait',
      key: 'SuperSacrificeBoonHera',
      met: false,
    });
  });
});

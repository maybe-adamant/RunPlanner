import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { simulateProject } from '@run-planner/engine/simulation';
import { createCompleteFGProject } from '@run-planner/test-fixtures/underworld';
import { evaluateBiomeRewardsAssemblyInternal } from '../../../../src/simulation/rewards/biome';
import { ordinaryRoutePosition } from '../../../support/route-position';

describe('chronology walk cut', () => {
  it('publishes the whole walk for a cut after every walked event', () => {
    const project = createCompleteFGProject();
    const f = simulateProject(catalog, project).route.biomes.find(
      (biome) => biome.biomeKey === 'F',
    );
    if (f?.authoring !== 'complete' || f.validity !== 'valid') throw new Error('F must be valid');
    const full = evaluateBiomeRewardsAssemblyInternal(
      catalog,
      f.snapshot,
      f.history,
      ordinaryRoutePosition(catalog, 'Underworld', 'F'),
      project.route.loadout,
    );
    const last = f.history.events.at(-1)!.sequence;
    for (const boundary of ['before', 'at', 'after'] as const)
      expect(full.through({ kind: 'history', sequence: last + 1, boundary }).simulation).toEqual(
        full.simulation,
      );
  });
});

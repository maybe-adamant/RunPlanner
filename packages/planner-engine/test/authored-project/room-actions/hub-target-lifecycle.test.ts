import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { loadSurfaceNProject } from '@run-planner/test-fixtures/surface';

import { createBiomeAddress } from '../../../src/authored-project/addresses';
import { roomActionDomainForOccurrence } from '../../../src/authored-project/room-actions/defaults';

describe('Hub target lifecycle at command time', () => {
  it('builds every open Hub target in its Hub-target lifecycle, a Miniboss among them', () => {
    const project = loadSurfaceNProject();
    const plan = project.route.biomes.find((biome) => biome.biomeKey === 'N')!;
    const topology = plan.topology!;
    const biome = createBiomeAddress(project.route.routeKey, 'N');
    const targets = topology.decisions.flatMap((decision) =>
      decision.kind === 'hub' ? decision.openTargets : [],
    );
    const profiles = targets.map((target) => {
      const occurrence = topology.occurrences.find(
        (candidate) => candidate.occurrenceId === target.occurrenceId,
      )!;
      return [
        occurrence.gameName,
        roomActionDomainForOccurrence(project, catalog, biome, target.occurrenceId)!.domain
          .eventGraph.profileKey,
      ] as const;
    });
    expect(profiles.some(([gameName]) => gameName.startsWith('N_MiniBoss'))).toBe(true);
    for (const [, profileKey] of profiles) expect(profileKey).toBe('EphyraMainRoom');
  });
});

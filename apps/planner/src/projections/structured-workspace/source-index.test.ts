import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createExitDecisionAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFStartId,
} from '../../../test/fixtures/underworldProject';
import {
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceId,
} from '../../../test/fixtures/surfaceProject';
import { createWorkspaceProjectSourceIndex } from './source-index';

function biomeSource(
  index: ReturnType<typeof createWorkspaceProjectSourceIndex>,
  routeKey: string,
  biomeKey: string,
) {
  const source = index.routes
    .find((route) => route.routeKey === routeKey)
    ?.biomes.find((biome) => biome.plan.biomeKey === biomeKey);
  if (source === undefined) throw new Error(`${routeKey}/${biomeKey} source is missing`);
  return source;
}

function reversedFDecisionSerialization() {
  const project = createGoldenFGHIProject(catalog);
  return {
    ...project,
    routes: project.routes.map((route) =>
      route.routeKey !== 'Underworld'
        ? route
        : {
            ...route,
            biomes: route.biomes.map((plan) =>
              plan.biomeKey !== 'F' || plan.topology === null
                ? plan
                : {
                    ...plan,
                    topology: {
                      ...plan.topology,
                      decisions: Object.freeze([...plan.topology.decisions].reverse()),
                    },
                  },
            ),
          },
    ),
  };
}

describe('structured workspace source index', () => {
  it('keeps authored source lookup and decision order independent of serialization order', () => {
    const project = createGoldenFGHIProject(catalog);
    const indexed = createWorkspaceProjectSourceIndex(
      catalog,
      project,
      simulateProject(catalog, project),
    );
    const reversed = reversedFDecisionSerialization();
    const reversedIndexed = createWorkspaceProjectSourceIndex(
      catalog,
      reversed,
      simulateProject(catalog, reversed),
    );
    const f = biomeSource(indexed, 'Underworld', 'F');
    const reversedF = biomeSource(reversedIndexed, 'Underworld', 'F');
    const startOwner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFStartId,
    });

    expect(f.occurrence(goldenFStartId)?.gameName).toBe('F_Opening01');
    expect(f.exitDecision(startOwner.source)).toBeDefined();
    expect(
      f.exitDecisions.map((decision) =>
        semanticAddressKey(createExitDecisionAddress(f.biome, decision.source)),
      ),
    ).toEqual(
      reversedF.exitDecisions.map((decision) =>
        semanticAddressKey(createExitDecisionAddress(reversedF.biome, decision.source)),
      ),
    );
  });

  it('keeps evaluator products and findings addressed to authored owners', () => {
    const combat = nOccurrenceId('combat10');
    const project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, combat),
      value: { rewardType: 'WeaponUpgrade' },
    });
    const source = biomeSource(
      createWorkspaceProjectSourceIndex(catalog, project, simulateProject(catalog, project)),
      'Surface',
      'N',
    );
    const reward = createIncomingRewardAddress(nBiome, combat);
    const firstDecision = source.exitDecisions[0];
    if (firstDecision === undefined) throw new Error('N has no authored exit decision');
    const firstOwner = createExitDecisionAddress(source.biome, firstDecision.source);
    const missingOwner = createExitDecisionAddress(source.biome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('evaluator-only'),
    });

    expect(source.findingsFor(reward)).toHaveLength(1);
    expect(source.evaluatedLinkedExit(firstOwner)).toBeDefined();
    expect(source.evaluatedLinkedExit(missingOwner)).toBeUndefined();
    expect(source.occurrence(combat)?.gameName).toBe('N_Combat10');
  });
});

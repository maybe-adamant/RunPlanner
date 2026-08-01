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
  goldenFOccurrenceId,
  goldenFStartId,
} from '../../../../../test/fixtures/authored-project';
import {
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceId,
} from '../../../../../test/fixtures/authored-project';
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
  const project = createGoldenFGHIProject();
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
    const project = createGoldenFGHIProject();
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

  it('orders the selected authored subtree before retained peers independently of serialization order', () => {
    const base = createGoldenFGHIProject();
    const forkSource = goldenFOccurrenceId(1, 1);
    const selectedChildSource = goldenFOccurrenceId(2, 2);
    const movedDecisionSource = goldenFOccurrenceId(3, 1);
    const withSelectedSpine = (reverse: boolean): typeof base =>
      ({
        ...base,
        routes: base.routes.map((route) =>
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
                          decisions: (reverse
                            ? [...plan.topology.decisions].reverse()
                            : plan.topology.decisions
                          ).map((decision) => {
                            if (decision.kind !== 'exit') return decision;
                            const normal =
                              decision.normal.kind !== 'batch' || !reverse
                                ? decision.normal
                                : {
                                    ...decision.normal,
                                    targets: [...decision.normal.targets].reverse(),
                                  };
                            if (
                              decision.source.kind === 'occurrence' &&
                              decision.source.occurrenceId === forkSource
                            ) {
                              return {
                                ...decision,
                                normal,
                                selection: { kind: 'normal' as const, exitKey: 'exit2' },
                              };
                            }
                            if (
                              decision.source.kind === 'occurrence' &&
                              decision.source.occurrenceId === movedDecisionSource
                            ) {
                              return {
                                ...decision,
                                normal,
                                source: {
                                  kind: 'occurrence' as const,
                                  occurrenceId: selectedChildSource,
                                },
                              };
                            }
                            return normal === decision.normal ? decision : { ...decision, normal };
                          }),
                        },
                      },
                ),
              },
        ),
      }) as typeof base;
    const orderedSources = (project: typeof base) =>
      biomeSource(
        createWorkspaceProjectSourceIndex(catalog, project, simulateProject(catalog, project)),
        'Underworld',
        'F',
      ).exitDecisions.map((decision) =>
        decision.source.kind === 'occurrence' ? decision.source.occurrenceId : decision.source.kind,
      );
    const ordered = orderedSources(withSelectedSpine(false));

    expect(ordered).toEqual([
      goldenFStartId,
      forkSource,
      selectedChildSource,
      goldenFOccurrenceId(4, 1),
      goldenFOccurrenceId(5, 1),
      goldenFOccurrenceId(6, 1),
      goldenFOccurrenceId(7, 1),
      goldenFOccurrenceId(8, 1),
      goldenFOccurrenceId(9, 1),
      goldenFOccurrenceId(10, 1),
      goldenFOccurrenceId(2, 1),
    ]);
    expect(orderedSources(withSelectedSpine(true))).toEqual(ordered);
  });

  it('retains downstream authored decisions when an unresolved prefix has no evaluated overlay', () => {
    const base = createGoldenFGHIProject();
    const incomplete = {
      ...base,
      routes: base.routes.map((route) =>
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
                        decisions: plan.topology.decisions.map((decision) =>
                          decision.kind === 'exit' &&
                          decision.source.kind === 'occurrence' &&
                          decision.source.occurrenceId === goldenFStartId
                            ? { ...decision, selection: { kind: 'unresolved' as const } }
                            : decision,
                        ),
                      },
                    },
              ),
            },
      ),
    };
    const source = biomeSource(
      createWorkspaceProjectSourceIndex(catalog, incomplete, simulateProject(catalog, incomplete)),
      'Underworld',
      'F',
    );
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(1, 1),
    });

    expect(source.exitDecision(owner.source)).toBeDefined();
    expect(source.evaluatedBatch(owner)).toBeUndefined();
    expect(source.isAssessed(owner)).toBe(false);
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

import { describe, expect, it } from 'vitest';

import * as support from '@planner-test/support/structured-workspace/interaction-binding.test-support';
import type { ProjectDocument } from '@planner-test/support/structured-workspace/interaction-binding.test-support';

const {
  bind,
  catalog,
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createOccurrenceId,
  createProjectDocument,
  semanticAddressKey,
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
} = support;

describe('structured workspace interaction binding', () => {
  it('binds the provisional batch reward pool to one atomic before-focus intent', () => {
    const startId = createOccurrenceId('structural-batch-start');
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: startId,
    });
    const project = applyProjectCommand(
      createProjectDocument(catalog, {
        configuredBiomeCounts: { Underworld: 1 },
        projectId: 'structural-batch-binding',
      }),
      catalog,
      {
        biome: goldenFBiome,
        gameName: 'F_Opening01',
        kind: 'CreateStart',
        occurrenceId: startId,
      },
    );
    const interaction = bind(project, 'Underworld', 'F').interactions.batchRewardStores.get(
      semanticAddressKey(createBatchRewardStoreAddress(goldenFBiome, owner.source)),
    );
    if (interaction === undefined) throw new Error('F provisional reward pool is missing');

    expect(interaction.intentFor('RunProgress')).toEqual({
      command: {
        decision: owner,
        edit: { kind: 'rewardStore', storeKey: 'RunProgress' },
        kind: 'InitializeExitDecision',
      },
      focus: { owner, timing: 'before' },
    });
  });

  it('binds selected exit choices in canonical physical order after authored serialization reorders', () => {
    const base = createGoldenFGHIProject();
    const forkSource = goldenFOccurrenceId(1, 1);
    const selectedChildSource = goldenFOccurrenceId(2, 2);
    const movedDecisionSource = goldenFOccurrenceId(3, 1);
    const withSelectedSpine = (reverse: boolean): ProjectDocument => ({
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
    });
    const interactionFor = (
      project: ProjectDocument,
      owner: ReturnType<typeof createExitDecisionAddress>,
    ) => {
      const interaction = [
        ...bind(project, 'Underworld', 'F').interactions.exitSelections.values(),
      ].find((candidate) => semanticAddressKey(candidate.owner) === semanticAddressKey(owner));
      if (interaction === undefined) {
        throw new Error(`exit-selection interaction for ${semanticAddressKey(owner)} is missing`);
      }
      return interaction;
    };
    const forkOwner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: forkSource,
    });
    const selectedChildOwner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: selectedChildSource,
    });
    const normalFork = interactionFor(withSelectedSpine(false), forkOwner);
    const reversedFork = interactionFor(withSelectedSpine(true), forkOwner);
    const normalSelectedChild = interactionFor(withSelectedSpine(false), selectedChildOwner);
    const reversedSelectedChild = interactionFor(withSelectedSpine(true), selectedChildOwner);

    expect(normalFork).toEqual({
      key: semanticAddressKey(createExitSelectionAddress(goldenFBiome, forkOwner.source)),
      owner: forkOwner,
      selectedExitKey: 'exit2',
      targets: [
        { label: 'exit1', value: 'exit1' },
        { label: 'exit2', value: 'exit2' },
      ],
    });
    expect(reversedFork).toEqual(normalFork);
    expect(reversedSelectedChild.targets).toEqual(normalSelectedChild.targets);
    expect(reversedSelectedChild.targets.map((target) => target.value)).toEqual(['exit1', 'exit2']);
  });
});

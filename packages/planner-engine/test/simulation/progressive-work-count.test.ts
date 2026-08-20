import { describe, expect, it, vi } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { applyProjectCommand, createOccurrenceAddress } from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import {
  createCompleteFGProject,
  goldenFBiome,
  goldenFOccurrenceId,
} from '@run-planner/test-fixtures/underworld';

const rewardAssemblyCalls = vi.hoisted(
  () => [] as { readonly biomeKey: string; readonly materializationKind: string }[],
);

vi.mock('../../src/simulation/rewards/biome', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/simulation/rewards/biome')>();
  return {
    ...actual,
    evaluateBiomeRewardsAssemblyInternal: (
      ...args: Parameters<typeof actual.evaluateBiomeRewardsAssemblyInternal>
    ) => {
      rewardAssemblyCalls.push({
        biomeKey: args[1].biomeKey,
        materializationKind: args[1].kind,
      });
      return actual.evaluateBiomeRewardsAssemblyInternal(...args);
    },
  };
});

describe('complete-invalid progressive work count', () => {
  it('reuses the selected full products before the two bounded clamp replays', () => {
    const project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(1, 1)),
      gameName: 'F_Combat14',
    });
    rewardAssemblyCalls.length = 0;

    const evaluation = simulateProject(catalog, project);

    expect(evaluation.status).toBe('invalid');
    expect(rewardAssemblyCalls.filter((call) => call.biomeKey === 'F')).toEqual([
      { biomeKey: 'F', materializationKind: 'biome' },
      { biomeKey: 'F', materializationKind: 'biomePrefix' },
      { biomeKey: 'F', materializationKind: 'biomePrefix' },
    ]);
  });
});

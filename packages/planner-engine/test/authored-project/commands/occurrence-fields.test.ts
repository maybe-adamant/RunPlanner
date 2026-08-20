import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createOccurrenceAddress,
  createOccurrenceId,
  type FieldsCombatState,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { createGoldenFGHProject, goldenHBiome } from '@run-planner/test-fixtures/underworld';

function fieldsState(
  project: ProjectDocument,
  occurrenceId: ReturnType<typeof createOccurrenceId>,
): FieldsCombatState {
  const state = project.routes
    .find((route) => route.routeKey === 'Underworld')
    ?.biomes.find((biome) => biome.biomeKey === 'H')
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId)?.state;
  if (state?.kind !== 'fieldsCombat') throw new Error('missing Fields occurrence');
  return state;
}

describe('authored Fields occurrence payload commands', () => {
  it.each([
    ['golden-h-combat09', 2],
    ['golden-h-combat02', 3],
    ['golden-h-combat05', 4],
  ] as const)('supports the full optional domain for %s (capacity %i)', (id, capacity) => {
    const occurrenceId = createOccurrenceId(id);
    const occurrence = createOccurrenceAddress(goldenHBiome, occurrenceId);
    let project = createGoldenFGHProject();
    const retainedRewards = fieldsState(project, occurrenceId).optionalRewards;
    for (let optionalRewardCount = 0; optionalRewardCount <= capacity; optionalRewardCount += 1) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceFieldsOptionalRewardCount',
        occurrence,
        optionalRewardCount,
      });
      expect(fieldsState(project, occurrenceId)).toMatchObject({ optionalRewardCount });
      expect(fieldsState(project, occurrenceId).optionalRewards).toEqual(retainedRewards);
    }
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceFieldsOptionalRewardCount',
        occurrence,
        optionalRewardCount: capacity + 1,
      }),
    ).toThrow(`optional reward count must be within 0..${capacity}`);
  });
});

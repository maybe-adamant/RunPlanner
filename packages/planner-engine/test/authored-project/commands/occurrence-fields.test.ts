import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  type FieldsCombatState,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { fieldsOptionalRewardCountSupport } from '@run-planner/engine/simulation';
import { createGoldenFGHProject, goldenHBiome } from '@run-planner/test-fixtures/underworld';

function fieldsState(
  project: ProjectDocument,
  occurrenceId: ReturnType<typeof createOccurrenceId>,
): FieldsCombatState {
  const state = project.route.biomes
    .find((biome) => biome.biomeKey === 'H')
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId)?.state;
  if (state?.kind !== 'fieldsCombat') throw new Error('missing Fields occurrence');
  return state;
}

function fieldsOccurrence(
  project: ProjectDocument,
  occurrenceId: ReturnType<typeof createOccurrenceId>,
) {
  const occurrence = project.route.biomes
    .find((biome) => biome.biomeKey === 'H')
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
  if (occurrence === undefined) throw new Error('missing Fields occurrence');
  return occurrence;
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
    expect(
      fieldsOptionalRewardCountSupport(
        catalog,
        fieldsOccurrence(project, occurrenceId),
        occurrence,
      ),
    ).toMatchObject({
      physicalMaximum: capacity,
      effectiveMaximum: capacity,
      reservesNemesisPosition: false,
    });
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

  it('reserves one H optional position for Passive Nemesis without destroying retained overflow', () => {
    const occurrenceId = createOccurrenceId('golden-h-combat05');
    const occurrence = createOccurrenceAddress(goldenHBiome, occurrenceId);
    const passive = createEncounterPhaseAddress(
      goldenHBiome,
      { kind: 'occurrence', occurrenceId },
      'Passive',
    );
    let project = createGoldenFGHProject();
    expect(fieldsState(project, occurrenceId).optionalRewardCount).toBe(2);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFieldsOptionalRewardCount',
      occurrence,
      optionalRewardCount: 4,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase: passive,
      encounterKey: 'NemesisRandomEvent',
    });
    expect(fieldsState(project, occurrenceId).optionalRewardCount).toBe(4);
    expect(
      fieldsOptionalRewardCountSupport(
        catalog,
        fieldsOccurrence(project, occurrenceId),
        occurrence,
      ),
    ).toMatchObject({
      physicalMaximum: 4,
      effectiveMaximum: 3,
      reservesNemesisPosition: true,
    });
    // The physical declaration range remains authorable after enabling the
    // feature; simulation owns the retained-overflow finding and repair.
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFieldsOptionalRewardCount',
      occurrence,
      optionalRewardCount: 4,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFieldsOptionalRewardCount',
      occurrence,
      optionalRewardCount: 3,
    });
    expect(fieldsState(project, occurrenceId).optionalRewardCount).toBe(3);
  });
});

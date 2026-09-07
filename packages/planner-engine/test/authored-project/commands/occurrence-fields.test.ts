import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  createFieldsSpatialAddress,
  createOccurrenceAddress,
  createRoomFeatureAddress,
  createOccurrenceId,
  decodeProjectDocument,
  encodeProjectDocument,
  type FieldsCombatState,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  fieldsOptionalRewardCountSupport,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
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

type EncodedProject = {
  route: {
    biomes: Array<{
      biomeKey: string;
      topology?: {
        occurrences: Array<{ occurrenceId: string; state: Record<string, unknown> }>;
      } | null;
    }>;
  };
};

function encodedProject(project: ProjectDocument): EncodedProject {
  return JSON.parse(encodeProjectDocument(project)) as EncodedProject;
}

function encodedFieldsState(
  document: EncodedProject,
  occurrenceId: string,
): Record<string, unknown> {
  const state = document.route.biomes
    .find((biome) => biome.biomeKey === 'H')
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId)?.state;
  if (state === undefined) throw new Error('missing encoded Fields state');
  return state;
}

describe('authored Fields occurrence payload commands', () => {
  it('assigns occurrence-owned spatial points without changing reward or timeline ownership', () => {
    const occurrenceId = createOccurrenceId('golden-h-combat05');
    const occurrence = createOccurrenceAddress(goldenHBiome, occurrenceId);
    const initial = createGoldenFGHProject();
    const changed = applyProjectCommand(initial, catalog, {
      kind: 'ReplaceFieldsSpatialPoint',
      spatial: createFieldsSpatialAddress(occurrence, { kind: 'entry' }),
      pointId: 755863,
    });
    const state = fieldsState(changed, occurrenceId);
    expect(state.spatial.entryStartPointId).toBe(755863);
    expect(Object.isFrozen(state.spatial)).toBe(true);
    expect(state.cages).toEqual(fieldsState(initial, occurrenceId).cages);
    expect(changed.route.biomes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ biomeKey: 'F' }),
        expect.objectContaining({ biomeKey: 'G' }),
      ]),
    );
    expect(
      applyProjectCommand(changed, catalog, {
        kind: 'ReplaceFieldsSpatialPoint',
        spatial: createFieldsSpatialAddress(occurrence, { kind: 'entry' }),
        pointId: 755863,
      }),
    ).toBe(changed);

    const cageChanged = applyProjectCommand(changed, catalog, {
      kind: 'ReplaceFieldsSpatialPoint',
      spatial: createFieldsSpatialAddress(occurrence, { kind: 'cage', slotKey: 'cage1' }),
      pointId: 573087,
    });
    expect(Object.isFrozen(fieldsState(cageChanged, occurrenceId).spatial.cagePointIdBySlot)).toBe(
      true,
    );
    const optionalChanged = applyProjectCommand(cageChanged, catalog, {
      kind: 'ReplaceFieldsSpatialPoint',
      spatial: createFieldsSpatialAddress(occurrence, {
        kind: 'optional',
        slotKey: 'optional1',
      }),
      pointId: 572849,
    });
    expect(
      Object.isFrozen(fieldsState(optionalChanged, occurrenceId).spatial.optionalPointIdBySlot),
    ).toBe(true);
  });

  it('resets room-scoped spatial identities when the Fields declaration changes', () => {
    const occurrenceId = createOccurrenceId('golden-h-combat05');
    const occurrence = createOccurrenceAddress(goldenHBiome, occurrenceId);
    const assigned = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceFieldsSpatialPoint',
      spatial: createFieldsSpatialAddress(occurrence, { kind: 'entry' }),
      pointId: 755863,
    });
    const replaced = applyProjectCommand(assigned, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence,
      gameName: 'H_Combat04',
    });

    expect(fieldsState(replaced, occurrenceId).spatial).toEqual({
      entryStartPointId: null,
      cagePointIdBySlot: { cage1: null, cage2: null, cage3: null },
      optionalPointIdBySlot: {
        optional1: null,
        optional2: null,
        optional3: null,
        optional4: null,
      },
      nemesisPointId: null,
    });
  });

  it('round-trips spatial selections and rejects points outside the selected declaration', () => {
    const occurrenceId = createOccurrenceId('golden-h-combat05');
    const occurrence = createOccurrenceAddress(goldenHBiome, occurrenceId);
    const assigned = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceFieldsSpatialPoint',
      spatial: createFieldsSpatialAddress(occurrence, { kind: 'entry' }),
      pointId: 755863,
    });
    const encoded = encodedProject(assigned);
    expect(fieldsState(decodeProjectDocument(encoded, catalog), occurrenceId).spatial).toEqual(
      fieldsState(assigned, occurrenceId).spatial,
    );

    const invalid = encodedProject(assigned);
    const state = encodedFieldsState(invalid, occurrenceId);
    const spatial = state.spatial as Record<string, unknown>;
    spatial.entryStartPointId = 999_999;
    expect(() => decodeProjectDocument(invalid, catalog)).toThrow(/declared point set/);
  });

  it.each([
    ['golden-h-combat09', 2, 2],
    ['golden-h-combat02', 3, 3],
    ['golden-h-combat05', 7, 4],
  ] as const)(
    'supports the full optional point domain for %s (physical %i, logical %i)',
    (id, physicalMaximum, logicalMaximum) => {
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
        physicalMaximum,
        effectiveMaximum: logicalMaximum,
        reservesNemesisPosition: false,
      });
      const retainedRewards = fieldsState(project, occurrenceId).optionalRewards;
      for (
        let optionalRewardCount = 0;
        optionalRewardCount <= logicalMaximum;
        optionalRewardCount += 1
      ) {
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
          optionalRewardCount: logicalMaximum + 1,
        }),
      ).toThrow(`optional reward count must be within 0..${logicalMaximum}`);
    },
  );

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
      physicalMaximum: 7,
      effectiveMaximum: 4,
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

  it('requires a free optional point for Passive Nemesis in a two-point H room', () => {
    const occurrenceId = createOccurrenceId('golden-h-combat09');
    const occurrence = createOccurrenceAddress(goldenHBiome, occurrenceId);
    const passive = createEncounterPhaseAddress(
      goldenHBiome,
      { kind: 'occurrence', occurrenceId },
      'Passive',
    );
    let project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'SelectEncounter',
      phase: passive,
      encounterKey: 'NemesisRandomEvent',
    });
    expect(
      fieldsOptionalRewardCountSupport(
        catalog,
        fieldsOccurrence(project, occurrenceId),
        occurrence,
      ),
    ).toMatchObject({
      physicalMaximum: 2,
      effectiveMaximum: 1,
      reservesNemesisPosition: true,
    });
    const overCapacityFindings = simulateProjectAssembly(catalog, project).evaluation.findings;
    expect(overCapacityFindings).toContainEqual(
      expect.objectContaining({
        code: 'fieldsSpatialPointMissing',
        origin: createFieldsSpatialAddress(occurrence, { kind: 'nemesis' }),
        evidence: expect.objectContaining({ supportPointIds: [] }),
      }),
    );
    expect(overCapacityFindings).toContainEqual(
      expect.objectContaining({
        code: 'fieldsOptionalCapacityUnavailable',
        origin: createRoomFeatureAddress(occurrence, { kind: 'fieldsOptionalRewardCount' }),
      }),
    );
    expect(
      overCapacityFindings.filter(
        (finding) => finding.code === 'fieldsOptionalCapacityUnavailable',
      ),
    ).toHaveLength(1);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFieldsOptionalRewardCount',
      occurrence,
      optionalRewardCount: 1,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFieldsSpatialPoint',
      spatial: createFieldsSpatialAddress(occurrence, { kind: 'nemesis' }),
      pointId: 715349,
    });
    const repairedFindings = simulateProjectAssembly(catalog, project).evaluation.findings;
    expect(repairedFindings).not.toContainEqual(
      expect.objectContaining({
        code: 'fieldsSpatialPointMissing',
        origin: createFieldsSpatialAddress(occurrence, { kind: 'nemesis' }),
      }),
    );
    expect(repairedFindings).not.toContainEqual(
      expect.objectContaining({ code: 'fieldsOptionalCapacityUnavailable' }),
    );
    expect(
      repairedFindings.filter(
        (finding) =>
          finding.code.startsWith('fieldsSpatial') ||
          finding.code === 'fieldsOptionalCapacityUnavailable',
      ),
    ).toEqual([]);
  });
});

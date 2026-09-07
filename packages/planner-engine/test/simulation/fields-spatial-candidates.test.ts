import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  createFieldsSpatialAddress,
  createNemesisRandomEventAddress,
  createOccurrenceAddress,
  createOccurrenceId,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createGoldenFGHProject,
  goldenHBiome,
  loadNemesisFieldsCheckpoint,
} from '@run-planner/test-fixtures/underworld';

const occurrenceId = createOccurrenceId('golden-h-combat05');
const occurrence = createOccurrenceAddress(goldenHBiome, occurrenceId);

function evaluate(
  project: ReturnType<typeof loadNemesisFieldsCheckpoint>,
  target: Parameters<typeof createFieldsSpatialAddress>[1],
  pointId: number | null,
  owner = occurrence,
) {
  return createPreparedProjectCandidateSession(
    catalog,
    simulateProjectAssembly(catalog, project),
  ).evaluate({
    kind: 'fieldsSpatialPoint',
    spatial: createFieldsSpatialAddress(owner, target),
    pointId,
  });
}

describe('Fields spatial candidates', () => {
  it('publishes declaration points and a stable occurrence-owned entry address', () => {
    const result = evaluate(loadNemesisFieldsCheckpoint(), { kind: 'entry' }, 755863);

    expect(result).toMatchObject({
      kind: 'fieldsSpatialPoint',
      result: {
        spatial: { kind: 'fieldsSpatial', occurrenceId: occurrenceId },
        selectedPossible: true,
        supportPointIds: [755863, 755866],
        findings: [],
      },
    });
  });

  it('reserves active sibling points and reports duplicates without repairing state', () => {
    let project = loadNemesisFieldsCheckpoint();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFieldsSpatialPoint',
      spatial: createFieldsSpatialAddress(occurrence, { kind: 'cage', slotKey: 'cage1' }),
      pointId: 573087,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFieldsSpatialPoint',
      spatial: createFieldsSpatialAddress(occurrence, { kind: 'cage', slotKey: 'cage2' }),
      pointId: 573087,
    });

    const result = evaluate(project, { kind: 'cage', slotKey: 'cage2' }, 573087);
    expect(result).toMatchObject({
      kind: 'fieldsSpatialPoint',
      result: {
        selectedPossible: false,
        findings: [
          {
            code: 'fieldsSpatialPointDuplicate',
            origin: { kind: 'fieldsSpatial', occurrenceId: occurrenceId },
          },
        ],
      },
    });
  });

  it('treats an active missing assignment as incomplete and allows dormant values', () => {
    const missing = evaluate(
      loadNemesisFieldsCheckpoint(),
      { kind: 'cage', slotKey: 'cage1' },
      null,
    );
    expect(missing).toMatchObject({
      kind: 'fieldsSpatialPoint',
      result: {
        selectedPossible: false,
        findings: [{ code: 'fieldsSpatialPointMissing' }],
      },
    });

    let dormantProject = loadNemesisFieldsCheckpoint();
    dormantProject = applyProjectCommand(dormantProject, catalog, {
      kind: 'ReplaceFieldsSpatialPoint',
      spatial: createFieldsSpatialAddress(occurrence, { kind: 'nemesis' }),
      pointId: 572849,
    });
    dormantProject = applyProjectCommand(dormantProject, catalog, {
      kind: 'ReplaceFieldsSpatialPoint',
      spatial: createFieldsSpatialAddress(occurrence, { kind: 'optional', slotKey: 'optional4' }),
      pointId: 572849,
    });
    expect(
      evaluate(dormantProject, { kind: 'optional', slotKey: 'optional4' }, 572849),
    ).toMatchObject({
      kind: 'fieldsSpatialPoint',
      result: { selectedPossible: true, findings: [] },
    });
  });

  it('shares active optional points with Nemesis and applies the H_Combat04 source exclusion', () => {
    let collisionProject = loadNemesisFieldsCheckpoint();
    collisionProject = applyProjectCommand(collisionProject, catalog, {
      kind: 'ReplaceFieldsSpatialPoint',
      spatial: createFieldsSpatialAddress(occurrence, { kind: 'nemesis' }),
      pointId: 572849,
    });
    collisionProject = applyProjectCommand(collisionProject, catalog, {
      kind: 'ReplaceFieldsSpatialPoint',
      spatial: createFieldsSpatialAddress(occurrence, { kind: 'optional', slotKey: 'optional1' }),
      pointId: 572849,
    });
    expect(
      evaluate(collisionProject, { kind: 'optional', slotKey: 'optional1' }, 572849),
    ).toMatchObject({
      kind: 'fieldsSpatialPoint',
      result: {
        selectedPossible: false,
        findings: [{ code: 'fieldsSpatialPointDuplicate' }],
      },
    });

    const combat04Id = createOccurrenceId('golden-h-combat04');
    const combat04 = createOccurrenceAddress(goldenHBiome, combat04Id);
    const passive = createEncounterPhaseAddress(
      goldenHBiome,
      { kind: 'occurrence', occurrenceId: combat04Id },
      'Passive',
    );
    let combat04Project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'SelectEncounter',
      phase: passive,
      encounterKey: 'NemesisRandomEvent',
    });
    combat04Project = applyProjectCommand(combat04Project, catalog, {
      kind: 'ReplaceNemesisRandomEventOutcome',
      event: createNemesisRandomEventAddress(passive),
      value: { kind: 'freeItem' },
      reward: { rewardType: 'ArmorBoost' },
    });
    const excluded = evaluate(combat04Project, { kind: 'nemesis' }, 572886, combat04);
    expect(excluded).toMatchObject({
      kind: 'fieldsSpatialPoint',
      result: {
        selectedPossible: false,
        findings: [
          {
            code: 'fieldsSpatialPointUnavailable',
            evidence: { pointId: 572886, reason: 'sourceExcluded' },
          },
        ],
      },
    });
    if (excluded.kind !== 'fieldsSpatialPoint') throw new Error('missing spatial candidate');
    expect(excluded.result.supportPointIds).not.toContain(572886);
  });
});

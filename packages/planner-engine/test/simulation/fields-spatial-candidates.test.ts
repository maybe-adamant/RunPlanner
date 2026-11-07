import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createFieldsSpatialAddress,
  createLocalRewardAddress,
  createNemesisRandomEventAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRouteAddress,
  createTargetAddress,
} from '@run-planner/engine/authored-project';
import {
  authoringReadinessAt,
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createCompleteFGProject,
  createGoldenFGHProject,
  goldenHBiome,
  loadNemesisFieldsCheckpoint,
  replaceNemesisRandomEventInteraction,
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
  it('defines cage and optional rewards before requiring their room placement', () => {
    let project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ConfigureRoutePrefix',
      route: createRouteAddress('Underworld'),
      configuredBiomeCount: 3,
    });
    const introId = project.route.biomes[2]!.topology!.startOccurrenceId;
    const combatId = createOccurrenceId('fields-layout-combat13');
    const decision = createExitDecisionAddress(goldenHBiome, {
      kind: 'occurrence',
      occurrenceId: introId,
    });
    const target = createTargetAddress(goldenHBiome, decision.source, 'exit1');
    const combat = createOccurrenceAddress(goldenHBiome, combatId);
    project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFieldsCageOutcome',
      decision,
      cageOutcome: 'max',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target,
      occurrenceId: combatId,
      gameName: 'H_Combat13',
    });

    for (const [slotKey, rewardType] of [
      ['cage1', 'MaxHealthDrop'],
      ['cage2', 'MaxManaDrop'],
    ] as const) {
      const reward = createLocalRewardAddress(goldenHBiome, combatId, 'cages', slotKey);
      const value = { rewardType };
      const assembly = simulateProjectAssembly(catalog, project);
      expect(authoringReadinessAt(assembly, reward)).toBe('editable');
      expect(
        createPreparedProjectCandidateSession(catalog, assembly).evaluate({
          kind: 'localReward',
          reward,
          value,
        }),
      ).toMatchObject({ kind: 'localReward', result: { supported: true, findings: [] } });
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceLocalReward',
        reward,
        value,
      });
    }

    for (const slotKey of ['optional2', 'optional1'] as const) {
      const assembly = simulateProjectAssembly(catalog, project);
      expect(assembly.evaluation.findings).not.toContainEqual(
        expect.objectContaining({ code: 'fieldsSpatialPointMissing' }),
      );
      const reward = createLocalRewardAddress(goldenHBiome, combatId, 'optionalRewards', slotKey);
      const value = { rewardType: 'RoomMoneyTinyDrop' };
      expect(
        createPreparedProjectCandidateSession(catalog, assembly).evaluate({
          kind: 'localReward',
          reward,
          value,
        }),
      ).toMatchObject({ kind: 'localReward', result: { supported: true, findings: [] } });
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceLocalReward',
        reward,
        value,
      });
    }

    // Unset points leave the game to place each slot: the room needs none to be complete.
    const assembly = simulateProjectAssembly(catalog, project);
    expect(
      assembly.evaluation.findings.filter((finding) => finding.origin.kind === 'fieldsSpatial'),
    ).toEqual([]);
    expect(authoringReadinessAt(assembly, combat)).toBe('editable');
    expect(
      authoringReadinessAt(
        assembly,
        createExitDecisionAddress(goldenHBiome, { kind: 'occurrence', occurrenceId: combatId }),
      ),
    ).toBe('editable');
    expect(
      createPreparedProjectCandidateSession(catalog, assembly).evaluate({
        kind: 'fieldsSpatialPoint',
        spatial: createFieldsSpatialAddress(combat, { kind: 'cage', slotKey: 'cage1' }),
        pointId: null,
      }),
    ).toMatchObject({ kind: 'fieldsSpatialPoint', result: { selectedPossible: true } });
  });

  it('keeps the layout of an unvisited door alternative dormant', () => {
    const unvisited = createOccurrenceAddress(
      goldenHBiome,
      createOccurrenceId('golden-h-combat03'),
    );
    const project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceFieldsSpatialPoint',
      spatial: createFieldsSpatialAddress(unvisited, { kind: 'cage', slotKey: 'cage1' }),
      pointId: null,
    });
    expect(simulateProjectAssembly(catalog, project).evaluation.status).toBe('valid');
  });

  it('publishes declaration points and a stable occurrence-owned point address', () => {
    const result = evaluate(
      loadNemesisFieldsCheckpoint(),
      { kind: 'cage', slotKey: 'cage1' },
      573087,
    );

    expect(result).toMatchObject({
      kind: 'fieldsSpatialPoint',
      result: {
        spatial: { kind: 'fieldsSpatial', occurrenceId: occurrenceId },
        selectedPossible: true,
        supportPointIds: expect.arrayContaining([573087]),
        findings: [],
      },
    });
  });

  it('allows assigning occupied points while reporting duplicate placements', () => {
    let project = createGoldenFGHProject();
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
        assignable: true,
        findings: [
          {
            code: 'fieldsSpatialPointDuplicate',
            origin: { kind: 'fieldsSpatial', occurrenceId: occurrenceId },
          },
        ],
      },
    });
    expect(simulateProjectAssembly(catalog, project).evaluation.findings).toContainEqual(
      expect.objectContaining({
        code: 'fieldsSpatialPointDuplicate',
        origin: createFieldsSpatialAddress(occurrence, {
          kind: 'cage',
          slotKey: 'cage1',
        }),
      }),
    );
  });

  it('leaves an unset point to the game and allows dormant values', () => {
    const unset = evaluate(loadNemesisFieldsCheckpoint(), { kind: 'cage', slotKey: 'cage1' }, null);
    expect(unset).toMatchObject({
      kind: 'fieldsSpatialPoint',
      result: { selectedPossible: true, findings: [] },
    });
    const unsetProject = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceFieldsSpatialPoint',
      spatial: createFieldsSpatialAddress(occurrence, { kind: 'cage', slotKey: 'cage1' }),
      pointId: null,
    });
    expect(
      simulateProjectAssembly(catalog, unsetProject).evaluation.findings.filter(
        (finding) => finding.origin.kind === 'fieldsSpatial',
      ),
    ).toEqual([]);

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
        assignable: true,
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
    let unoccupiedCombat04Project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceFieldsOptionalRewardCount',
      occurrence: combat04,
      optionalRewardCount: 0,
    });
    unoccupiedCombat04Project = applyProjectCommand(unoccupiedCombat04Project, catalog, {
      kind: 'SelectEncounter',
      phase: passive,
      encounterKey: 'NemesisRandomEvent',
    });
    unoccupiedCombat04Project = replaceNemesisRandomEventInteraction(
      unoccupiedCombat04Project,
      createNemesisRandomEventAddress(passive),
      { kind: 'freeItem' },
      { rewardType: 'ArmorBoost' },
    );
    const sourceEligible = evaluate(
      unoccupiedCombat04Project,
      { kind: 'nemesis' },
      572851,
      combat04,
    );
    if (sourceEligible.kind !== 'fieldsSpatialPoint') {
      throw new Error('missing unoccupied spatial candidate');
    }
    expect(catalog.rooms.byKey.H_Combat04?.fieldsSpatial?.optionalPointIds).toHaveLength(7);
    expect(sourceEligible.result.supportPointIds).toHaveLength(6);
    expect(sourceEligible.result.supportPointIds).not.toContain(572886);

    let combat04Project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'SelectEncounter',
      phase: passive,
      encounterKey: 'NemesisRandomEvent',
    });
    combat04Project = replaceNemesisRandomEventInteraction(
      combat04Project,
      createNemesisRandomEventAddress(passive),
      { kind: 'freeItem' },
      { rewardType: 'ArmorBoost' },
    );
    const excluded = evaluate(combat04Project, { kind: 'nemesis' }, 572886, combat04);
    expect(excluded).toMatchObject({
      kind: 'fieldsSpatialPoint',
      result: {
        selectedPossible: false,
        assignable: false,
        findings: [
          {
            code: 'fieldsSpatialPointUnavailable',
            evidence: { pointId: 572886, reason: 'sourceExcluded' },
          },
        ],
      },
    });
    if (excluded.kind !== 'fieldsSpatialPoint') throw new Error('missing spatial candidate');
    expect(excluded.result.supportPointIds).toHaveLength(4);
    expect(excluded.result.supportPointIds).not.toContain(572886);
  });
});

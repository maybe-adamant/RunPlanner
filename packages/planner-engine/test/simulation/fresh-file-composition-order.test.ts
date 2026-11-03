import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createTargetAddress,
} from '@run-planner/engine/authored-project';
import {
  assembleExecutionProduct,
  compileExecutionPlan,
  encodeExecutionPlan,
} from '@run-planner/engine/execution-plan';
import {
  generatedEncounterSupportForProjectEvaluationAssembly,
  simulateProject,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import {
  authorFreshFileRoomIssues,
  createFreshFileFProject,
  createFreshFileRouteProject,
  newHFieldsRoomId,
  withNewHFieldsRoom,
} from '@run-planner/test-fixtures/fresh-file';
import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';

import { executionFixturePath } from '../execution-plan/support/execution-fixtures';
import { currentSchemaWire } from '../execution-plan/support/current-schema-wire';

describe('Fresh File room issue chronology with uncustomized compositions', () => {
  it('asks for no cage composition, only the room features and Timeline', () => {
    expect(
      authorFreshFileRoomIssues(
        withNewHFieldsRoom(createFreshFileRouteProject(), 'FreshFile', 'max'),
        'H',
        newHFieldsRoomId,
      ).labels,
    ).toEqual(['optionalReward', 'spatial', 'trait:cage2', 'continuation']);
  });

  it('keeps every phase support in its room while an Overview or Timeline input is the issue', () => {
    const phases = ['Passive', 'Cage01', 'Cage02', 'Cage03'];
    const supported = (assembly: ReturnType<typeof simulateProjectAssembly>) =>
      phases
        .filter(
          (phaseKey) =>
            generatedEncounterSupportForProjectEvaluationAssembly(
              assembly,
              createEncounterPhaseAddress(
                createBiomeAddress('FreshFile', 'H'),
                { kind: 'occurrence', occurrenceId: newHFieldsRoomId },
                phaseKey,
              ),
            ) !== undefined,
        )
        .join('+');
    const all = 'Passive+Cage01+Cage02+Cage03';
    expect(
      authorFreshFileRoomIssues(
        withNewHFieldsRoom(createFreshFileRouteProject(), 'FreshFile', 'max'),
        'H',
        newHFieldsRoomId,
        supported,
      ).labels,
    ).toEqual(
      ['optionalReward', 'spatial', 'trait:cage2', 'continuation'].map(
        (label) => `${label} ${all}`,
      ),
    );
  });

  it('keeps the mature twin on the same entry, placement and offer order', () => {
    expect(
      authorFreshFileRoomIssues(
        withNewHFieldsRoom(createGoldenFGHIProject(), 'Underworld', 'min'),
        'H',
        newHFieldsRoomId,
      ).labels,
    ).toEqual(['optionalReward', 'spatial', 'trait:cage1', 'continuation']);
  });

  it('asks a new uncustomized F combat only for its door reward and offer', () => {
    const biome = createBiomeAddress('FreshFile', 'F');
    const source = { kind: 'occurrence', occurrenceId: createOccurrenceId('fresh-2-0') } as const;
    const decision = createExitDecisionAddress(biome, source);
    const combat = createOccurrenceId('fresh-new-combat');
    let project = applyProjectCommand(createFreshFileFProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision,
    });
    project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(biome, source),
      storeKey: 'RunProgress',
    });
    // fresh-2-0 is the one-exit F_Combat09.
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, source, 'exit1'),
      occurrenceId: combat,
      gameName: 'F_Combat07',
    });
    expect(
      simulateProjectAssembly(catalog, project).evaluation.route.biomes[0]!.issue?.owner,
    ).toEqual(createIncomingRewardAddress(biome, combat));
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(biome, combat),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    });
    expect(authorFreshFileRoomIssues(project, 'F', combat).labels).toEqual([
      'trait:incomingReward',
      'continuation',
    ]);
  });

  it('leaves the complete Fresh products on their committed execution plan', () => {
    for (const project of [createFreshFileRouteProject(), createFreshFileFProject()]) {
      const evaluation = simulateProject(catalog, project);
      expect(evaluation.status).toBe('valid');
      expect(evaluation.findings).toEqual([]);
    }
    const plan = compileExecutionPlan({
      product: assembleExecutionProduct({
        assembly: simulateProjectAssembly(catalog, createFreshFileRouteProject()),
        catalog,
      }),
    });
    expect(JSON.parse(encodeExecutionPlan(plan))).toEqual(
      currentSchemaWire(JSON.parse(readFileSync(executionFixturePath('fresh-file-fghi'), 'utf8'))),
    );
  });
});

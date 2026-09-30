import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
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

describe('Fresh File generated-composition issue chronology', () => {
  it('asks for each cage composition where that cage starts, after room entry features', () => {
    expect(
      authorFreshFileRoomIssues(
        withNewHFieldsRoom(createFreshFileRouteProject(), 'FreshFile', 'max'),
        'H',
        newHFieldsRoomId,
      ).labels,
    ).toEqual([
      // Fields Passive has no lifecycle start; it stays at room preparation.
      'composition:Passive',
      'optionalReward',
      'spatial',
      'composition:Cage01',
      'composition:Cage02',
      'trait:cage2',
      'composition:Cage03',
      'trait:cage3',
      'continuation',
    ]);
  });

  it('keeps an earlier phase support in its room while a later input is the issue', () => {
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
    expect(
      authorFreshFileRoomIssues(
        withNewHFieldsRoom(createFreshFileRouteProject(), 'FreshFile', 'max'),
        'H',
        newHFieldsRoomId,
        supported,
      ).labels,
    ).toEqual([
      'composition:Passive Passive',
      'optionalReward Passive',
      'spatial Passive',
      'composition:Cage01 Passive+Cage01',
      'composition:Cage02 Passive+Cage01+Cage02',
      'trait:cage2 Passive+Cage01+Cage02',
      'composition:Cage03 Passive+Cage01+Cage02+Cage03',
      'trait:cage3 Passive+Cage01+Cage02+Cage03',
      'continuation Passive+Cage01+Cage02+Cage03',
    ]);
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

  it('asks for a new F combat composition after its door reward and before its offer', () => {
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
    const boon = (godSource: string) =>
      ({ rewardType: 'Boon', payload: { kind: 'BoonSource', source: godSource } }) as const;
    for (const [exitKey, occurrenceId, gameName, reward] of [
      ['exit1', combat, 'F_Combat07', boon('ApolloUpgrade')],
      ['exit2', createOccurrenceId('fresh-new-sibling'), 'F_Combat06', boon('PoseidonUpgrade')],
    ] as const) {
      project = applyProjectCommand(project, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(biome, source, exitKey),
        occurrenceId,
        gameName,
      });
      expect(
        simulateProjectAssembly(catalog, project).evaluation.route.biomes[0]!.issue?.owner,
      ).toEqual(createIncomingRewardAddress(biome, occurrenceId));
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(biome, occurrenceId),
        value: reward,
      });
    }
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(biome, source),
      value: { kind: 'normal', exitKey: 'exit1' },
    });
    expect(authorFreshFileRoomIssues(project, 'F', combat).labels).toEqual([
      'composition:Encounter',
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
      JSON.parse(readFileSync(executionFixturePath('fresh-file-fghi'), 'utf8')),
    );
  });
});

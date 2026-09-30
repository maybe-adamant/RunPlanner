import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createOccurrenceId,
  createTargetAddress,
  encodeProjectDocument,
  type EncounterPhaseAddress,
  type FieldsSpatialAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  assembleExecutionProduct,
  compileExecutionPlan,
  encodeExecutionPlan,
} from '@run-planner/engine/execution-plan';
import {
  createPreparedProjectCandidateSession,
  generatedEncounterSupportForProjectEvaluationAssembly,
  simulateProject,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import {
  createFreshFileFProject,
  createFreshFileRouteProject,
} from '@run-planner/test-fixtures/fresh-file';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';

import { executionFixturePath } from '../execution-plan/support/execution-fixtures';

type Label = string;

/**
 * Authors each published issue with a reached value and records its owner, so
 * the sequence observes the engine's issue chronology rather than predicting it.
 */
function issueSequence(project: ProjectDocument, biomeKey: string, roomId: string): Label[] {
  const labels: Label[] = [];
  let current = project;
  for (let pass = 0; pass < 32; pass += 1) {
    const assembly = simulateProjectAssembly(catalog, current);
    const issue = assembly.evaluation.route.biomes.find(
      (biome) => biome.biomeKey === biomeKey,
    )?.issue;
    if (issue === undefined) throw new Error(`${biomeKey} published no issue`);
    const owner = issue.owner;
    const codes = issue.reasons.map((reason) => reason.code);
    let label: Label;
    if (owner.kind === 'encounterPhase' && codes.includes('encounterCustomizationRequired')) {
      label = `composition:${owner.phaseKey}`;
      const required = issue.reasons.find(
        (reason) => reason.code === 'encounterCustomizationRequired',
      )!;
      const value = generatedEncounterSupportForProjectEvaluationAssembly(
        assembly,
        owner as EncounterPhaseAddress,
      )?.initialize();
      if (value === undefined) throw new Error(`${owner.phaseKey} cannot initialize`);
      current = applyProjectCommand(current, catalog, {
        kind: 'ReplaceEncounterCustomization',
        phase: owner as EncounterPhaseAddress,
        decisionKey: String(required.evidence.decisionKey),
        value,
      });
    } else if (owner.kind === 'localReward' && owner.groupKey === 'optionalRewards') {
      label = 'optionalReward';
      current = applyProjectCommand(current, catalog, {
        kind: 'ReplaceLocalReward',
        reward: owner,
        value: { rewardType: 'RoomMoneyTinyDrop' },
      });
    } else if (owner.kind === 'fieldsSpatial') {
      label = 'spatial';
      const session = createPreparedProjectCandidateSession(catalog, assembly);
      const used = new Set<number>();
      for (const reason of issue.reasons) {
        const spatial = reason.origin as FieldsSpatialAddress;
        const result = session.evaluate({ kind: 'fieldsSpatialPoint', spatial, pointId: null });
        if (result.kind !== 'fieldsSpatialPoint') throw new Error('no spatial candidate');
        const pointId = result.result.supportPointIds.find((id) => !used.has(id));
        if (pointId === undefined) throw new Error('no free spatial point');
        used.add(pointId);
        current = applyProjectCommand(current, catalog, {
          kind: 'ReplaceFieldsSpatialPoint',
          spatial,
          pointId,
        });
      }
    } else if (owner.kind === 'traitOffer') {
      label = `trait:${owner.owner.kind === 'localReward' ? owner.owner.slotKey : owner.owner.kind}`;
      current = authorLegalTraitOffers(current);
    } else if (
      owner.kind === 'exitDecision' &&
      owner.source.kind === 'occurrence' &&
      owner.source.occurrenceId === roomId
    ) {
      labels.push('continuation');
      return labels;
    } else {
      throw new Error(`unexpected issue ${JSON.stringify(owner)} ${codes.join(',')}`);
    }
    if (labels.at(-1) !== label) labels.push(label);
  }
  throw new Error('issue walk did not reach the continuation');
}

/**
 * Replaces the H batch after golden-h-combat02 with H_Combat04 and an
 * H_Combat05 sibling, carrying the replaced rooms' reached cage offers.
 */
function withNewHFieldsRoom(
  project: ProjectDocument,
  routeKey: string,
  cageOutcome: 'min' | 'max',
): ProjectDocument {
  const biome = createBiomeAddress(routeKey, 'H');
  const raw = JSON.parse(encodeProjectDocument(project));
  const occurrences = raw.route.biomes.find((entry: { biomeKey: string }) => entry.biomeKey === 'H')
    .topology.occurrences as { occurrenceId: string; state: { cages: Record<string, unknown> } }[];
  const cagesOf = (id: string) =>
    Object.entries(occurrences.find((occurrence) => occurrence.occurrenceId === id)!.state.cages);
  const source = {
    kind: 'occurrence',
    occurrenceId: createOccurrenceId('golden-h-combat02'),
  } as const;
  const decision = createExitDecisionAddress(biome, source);
  let current = applyProjectCommand(project, catalog, { kind: 'RemoveExitDecision', decision });
  current = applyProjectCommand(current, catalog, { kind: 'CreateBatch', decision });
  current = applyProjectCommand(current, catalog, {
    kind: 'ReplaceFieldsCageOutcome',
    decision,
    cageOutcome,
  });
  for (const [exitKey, id, gameName, from] of [
    ['exit1', 'new-h-combat04', 'H_Combat04', 'golden-h-combat09'],
    ['exit2', 'new-h-combat05', 'H_Combat05', 'golden-h-combat03'],
  ] as const) {
    current = applyProjectCommand(current, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, source, exitKey),
      occurrenceId: createOccurrenceId(id),
      gameName,
    });
    for (const [slotKey, cage] of cagesOf(from))
      current = applyProjectCommand(current, catalog, {
        kind: 'ReplaceLocalReward',
        reward: createLocalRewardAddress(biome, createOccurrenceId(id), 'cages', slotKey),
        value: (cage as { offer: never }).offer,
      });
  }
  return applyProjectCommand(current, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(biome, source),
    value: { kind: 'normal', exitKey: 'exit1' },
  });
}

describe('Fresh File generated-composition issue chronology', () => {
  it('asks for each cage composition where that cage starts, after room entry features', () => {
    expect(
      issueSequence(
        withNewHFieldsRoom(createFreshFileRouteProject(), 'FreshFile', 'max'),
        'H',
        'new-h-combat04',
      ),
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

  it('keeps the mature twin on the same entry, placement and offer order', () => {
    expect(
      issueSequence(
        withNewHFieldsRoom(createGoldenFGHIProject(), 'Underworld', 'min'),
        'H',
        'new-h-combat04',
      ),
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
    expect(issueSequence(project, 'F', combat)).toEqual([
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

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createExitDecisionAddress,
  createOccurrenceId,
  createProjectDocument,
  createTargetAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { createGoldenFGHIProject, goldenHBiome } from '@run-planner/test-fixtures';
import { createWorkspaceFieldsActiveCageCounts } from './fields-cage-counts';
import { createWorkspaceProjectSourceIndex } from '../source-index';

function hSource(project: ProjectDocument) {
  const source = createWorkspaceProjectSourceIndex(
    catalog,
    project,
    simulateProject(catalog, project),
  )
    .routes.find((route) => route.routeKey === 'Underworld')
    ?.biomes.find((biome) => biome.plan.biomeKey === 'H');
  if (source === undefined) throw new Error('Underworld/H source is missing');
  return source;
}

describe('structured workspace Fields active-cage counts', () => {
  it('derives one decision-owned count for its Fields target occurrences', () => {
    const source = hSource(createGoldenFGHIProject());
    const decision = source.exitDecisions.find(
      (candidate) =>
        candidate.normal.kind === 'batch' &&
        candidate.normal.targets.some(
          (target) => source.occurrence(target.occurrenceId)?.state.kind === 'fieldsCombat',
        ),
    );
    if (decision?.normal.kind !== 'batch') throw new Error('H Fields batch is missing');
    const counts = createWorkspaceFieldsActiveCageCounts(catalog, source);
    const count = counts.countForDecision(decision);

    expect(count).toBeDefined();
    for (const target of decision.normal.targets) {
      if (source.occurrence(target.occurrenceId)?.state.kind !== 'fieldsCombat') continue;
      expect(counts.countForOccurrence(target.occurrenceId)).toBe(count);
    }
  });

  it('retains an authored cage outcome when the Fields biome is blocked upstream', () => {
    const start = createOccurrenceId('blocked-fields-count-start');
    const combat = createOccurrenceId('blocked-fields-count-combat');
    let project = createProjectDocument(catalog, {
      configuredBiomeCounts: { Underworld: 3 },
      name: 'Blocked Fields count',
      projectId: 'blocked-fields-count',
    });
    project = applyProjectCommand(project, catalog, {
      biome: goldenHBiome,
      kind: 'CreateStart',
      occurrenceId: start,
    });
    const decision = createExitDecisionAddress(goldenHBiome, {
      kind: 'occurrence',
      occurrenceId: start,
    });
    project = applyProjectCommand(project, catalog, { decision, kind: 'CreateBatch' });
    project = applyProjectCommand(project, catalog, {
      cageOutcome: 'min',
      decision,
      kind: 'ReplaceFieldsCageOutcome',
    });
    project = applyProjectCommand(project, catalog, {
      gameName: 'H_Combat02',
      kind: 'CreateTarget',
      occurrenceId: combat,
      target: createTargetAddress(goldenHBiome, decision.source, 'exit1'),
    });
    const source = hSource(project);
    const authored = source.exitDecision(decision.source);
    if (authored?.normal.kind !== 'batch') throw new Error('blocked Fields decision is missing');
    const counts = createWorkspaceFieldsActiveCageCounts(catalog, source);

    expect(source.evaluation).toBeUndefined();
    expect(counts.countForDecision(authored)).toBe(2);
    expect(counts.countForOccurrence(combat)).toBe(2);
  });
});

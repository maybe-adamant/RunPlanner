import { catalog } from '@run-planner/hades2-catalog';
import { type ProjectDocument } from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { createGoldenFGHIProject } from '../../../../../../test/fixtures/authored-project';
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
});

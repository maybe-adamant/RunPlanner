import { catalog } from '@run-planner/hades2-catalog';
import { createOccurrenceId, type ProjectDocument } from '@run-planner/engine/authored-project';
import {
  encounterPhaseSequenceStatusForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { createGoldenFGHIProject, goldenFOccurrenceId } from '@run-planner/test-fixtures';
import { createRepresentativeNOPQProject, nOccurrenceId } from '@run-planner/test-fixtures';
import { createWorkspaceBiomeOccurrenceAssemblyFacts } from './occurrence-facts';
import { createWorkspaceProjectSourceIndex } from '../source-index';

function biomeSource(project: ProjectDocument, routeKey: string, biomeKey: string) {
  const assembly = simulateProjectAssembly(catalog, project);
  const source = createWorkspaceProjectSourceIndex(catalog, project, assembly.evaluation, (phase) =>
    encounterPhaseSequenceStatusForProjectEvaluationAssembly(assembly, phase),
  )
    .routes.find((route) => route.routeKey === routeKey)
    ?.biomes.find((biome) => biome.plan.biomeKey === biomeKey);
  if (source === undefined) throw new Error(`${routeKey}/${biomeKey} source is missing`);
  return source;
}

function withFPrebossSelection(
  project: ProjectDocument,
  exitKey: 'exit1' | 'exit2',
): ProjectDocument {
  const sourceOccurrenceId = goldenFOccurrenceId(10, 1);
  return {
    ...project,
    routes: project.routes.map((route) =>
      route.routeKey !== 'Underworld'
        ? route
        : {
            ...route,
            biomes: route.biomes.map((plan) =>
              plan.biomeKey !== 'F' || plan.topology === null
                ? plan
                : {
                    ...plan,
                    topology: {
                      ...plan.topology,
                      decisions: plan.topology.decisions.map((decision) =>
                        decision.kind === 'exit' &&
                        decision.source.kind === 'occurrence' &&
                        decision.source.occurrenceId === sourceOccurrenceId
                          ? { ...decision, selection: { kind: 'normal' as const, exitKey } }
                          : decision,
                      ),
                    },
                  },
            ),
          },
    ),
  };
}

describe('structured workspace occurrence assembly facts', () => {
  it('keeps authored detail activation separate from evaluated entry', () => {
    const facts = createWorkspaceBiomeOccurrenceAssemblyFacts(
      biomeSource(createRepresentativeNOPQProject(), 'Surface', 'N'),
    );
    const activeEphyra = nOccurrenceId('combat05');
    const dormantEphyra = nOccurrenceId('combat10');

    expect(facts.occurrence(activeEphyra)?.detailsActive).toBe(true);
    expect(facts.occurrence(dormantEphyra)?.detailsActive).toBe(false);
    expect(facts.occurrence(createOccurrenceId('not-in-plan'))).toBeUndefined();
  });

  it('keeps a selected Shop active behind an unresolved prefix while its retained sibling is inactive', () => {
    const shop = createOccurrenceId('golden-f-preboss-shop');
    const selected = createWorkspaceBiomeOccurrenceAssemblyFacts(
      biomeSource(withFPrebossSelection(createGoldenFGHIProject(), 'exit1'), 'Underworld', 'F'),
    );
    const unpicked = createWorkspaceBiomeOccurrenceAssemblyFacts(
      biomeSource(withFPrebossSelection(createGoldenFGHIProject(), 'exit2'), 'Underworld', 'F'),
    );

    expect(selected.occurrence(shop)?.detailsActive).toBe(true);
    expect(unpicked.occurrence(shop)?.detailsActive).toBe(false);
  });
});

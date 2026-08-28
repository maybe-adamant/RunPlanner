import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createExitSelectionAddress,
  createOccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  encounterPhaseSequenceStatusForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNOPQProject, nOccurrenceId } from '@run-planner/test-fixtures/surface';
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
  return applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: sourceOccurrenceId,
    }),
    value: { kind: 'normal', exitKey },
  });
}

describe('structured workspace occurrence assembly facts', () => {
  it('keeps authored detail activation separate from evaluated entry', () => {
    const facts = createWorkspaceBiomeOccurrenceAssemblyFacts(
      biomeSource(loadSurfaceNOPQProject(), 'Surface', 'N'),
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

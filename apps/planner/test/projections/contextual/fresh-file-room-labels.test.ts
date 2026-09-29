import { expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { createOccurrenceId, createTargetAddress } from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
  type ProjectCandidateEvaluation,
} from '@run-planner/engine/simulation';
import {
  createFreshFileRouteProject,
  freshFileHBiome,
} from '@run-planner/test-fixtures/fresh-file';
import { explainCandidateEvaluation } from '@planner/projections/contextual/contextualOptions';

it('names the forced Fresh bridge by its realized Shop label in a door explanation', () => {
  const session = createPreparedProjectCandidateSession(
    catalog,
    simulateProjectAssembly(catalog, createFreshFileRouteProject()),
  );
  // H_Combat09's second door holds the forced H_Bridge01.
  const target = createTargetAddress(
    freshFileHBiome,
    { kind: 'occurrence', occurrenceId: createOccurrenceId('golden-h-combat09') },
    'exit2',
  );
  const evaluation = session.evaluate({
    kind: 'roomTarget',
    target,
    gameName: 'H_Combat01',
  }) as ProjectCandidateEvaluation;
  const message = explainCandidateEvaluation(catalog, evaluation)?.message;
  expect(message).toBe('These rooms must be included here: Queen Lamia, Shop.');
  expect(message).not.toContain('Echo');
});

import { catalog } from '@run-planner/hades2-catalog';
import { createBiomeAddress, createTargetAddress } from '@run-planner/engine/authored-project';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';
import { describe, expect, it, vi } from 'vitest';

import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';
import { candidateSupport, createCandidateSessionFactory } from './candidateProjection';

function fPlan(project: ReturnType<typeof createGoldenFGHIProject>) {
  const plan = project.routes
    .find((route) => route.routeKey === 'Underworld')
    ?.biomes.find((biome) => biome.biomeKey === 'F');
  if (plan?.topology === null || plan === undefined) throw new Error('F topology is missing');
  return plan;
}

describe('candidate projection session core', () => {
  it('keeps one bound session and one cached query domain per assembly identity', () => {
    const project = createGoldenFGHIProject();
    const assembly = simulateProjectAssembly(catalog, project);
    const observeCandidateEvaluation = vi.fn();
    const factory = createCandidateSessionFactory(catalog, { observeCandidateEvaluation });
    const session = factory.bind(assembly);

    expect(factory.bind(assembly)).toBe(session);

    const first = fPlan(project).topology!.decisions.find((decision) => decision.kind === 'exit');
    if (first?.kind !== 'exit' || first.normal.kind !== 'batch') {
      throw new Error('F first batch is missing');
    }
    const target = first.normal.targets[0];
    if (target === undefined) throw new Error('F first target is missing');
    const address = createTargetAddress(
      createBiomeAddress('Underworld', 'F'),
      first.source,
      target.exitKey,
    );
    const rooms = [catalog.rooms.byKey.F_Combat02!];

    const one = session.roomTargets(address, rooms);
    const two = session.roomTargets(address, rooms);

    expect(one).toBe(two);
    expect(one[0]?.evaluation.kind).toBe('roomTarget');
    expect(candidateSupport(one[0])).toBe('possible');
    expect(observeCandidateEvaluation).toHaveBeenCalledTimes(1);
  });
});

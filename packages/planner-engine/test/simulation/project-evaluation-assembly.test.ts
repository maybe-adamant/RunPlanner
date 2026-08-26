import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import type { ProjectDocument } from '@run-planner/engine/authored-project';
import {
  candidateArtifactsForProjectEvaluationAssembly,
  ProjectSimulationContractError,
} from '../../src/simulation/project-evaluation-assembly';
import { simulateProjectAssembly } from '../../src/simulation/project';
import type {
  ProjectEvaluation,
  ProjectEvaluationAssembly,
} from '../../src/simulation/evaluation-products';

import { createCompleteFTakeoverProject } from './support/f-takeover-project';

describe('exact project evaluation assembly', () => {
  it('rejects missing, forged, and mixed exact assembly products', () => {
    const project = createCompleteFTakeoverProject();
    const first = simulateProjectAssembly(catalog, project);
    const second = simulateProjectAssembly(catalog, project);
    const withoutArtifacts = Object.freeze({
      project: first.project,
      evaluation: first.evaluation,
    }) as unknown as ProjectEvaluationAssembly;
    const mixed = Object.freeze({
      project: first.project,
      evaluation: second.evaluation,
    }) as ProjectEvaluationAssembly;
    const forgedPrototype = Object.freeze(
      Object.assign(Object.create(Object.getPrototypeOf(first)), {
        project: first.project,
        evaluation: first.evaluation,
      }),
    ) as ProjectEvaluationAssembly;
    const reflectedAssemblyConstructor = Object.getPrototypeOf(first).constructor;
    const ReflectedAssemblyConstructor = reflectedAssemblyConstructor as unknown as new (
      project: ProjectDocument,
      evaluation: ProjectEvaluation,
      candidateArtifacts: unknown,
    ) => ProjectEvaluationAssembly;

    expect(() => candidateArtifactsForProjectEvaluationAssembly(withoutArtifacts)).toThrow(
      ProjectSimulationContractError,
    );
    expect(() => candidateArtifactsForProjectEvaluationAssembly(mixed)).toThrow(
      /was not produced by this simulator execution/,
    );
    expect(() => candidateArtifactsForProjectEvaluationAssembly(forgedPrototype)).toThrow(
      ProjectSimulationContractError,
    );
    expect('candidateArtifacts' in reflectedAssemblyConstructor).toBe(false);
    expect('isExact' in reflectedAssemblyConstructor).toBe(false);
    expect(
      () => new ReflectedAssemblyConstructor(first.project, first.evaluation, Object.freeze({})),
    ).toThrow(ProjectSimulationContractError);
    expect(candidateArtifactsForProjectEvaluationAssembly(first)).toBeDefined();
  });
});

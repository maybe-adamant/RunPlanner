import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createContinuationAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createTargetAddress,
  encodeProjectDocument,
  parseProjectDocument,
  ProjectCommandContractError,
  type LinearBiomePlan,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { evaluateLinearCompleteness } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createRepresentativeNOPProject,
  createRepresentativeNOPQProject,
  qBiome,
  qOccurrenceIds,
} from '../../../../../apps/planner/src/testing/surfaceProject';

function qPlan(project: ProjectDocument): LinearBiomePlan {
  const plan = project.routes
    .find((route) => route.routeKey === qBiome.routeKey)
    ?.biomes.find((biome) => biome.biomeKey === qBiome.biomeKey);
  if (plan?.kind !== 'LinearBiome') {
    throw new Error('Q authorship fixture has no linear plan');
  }
  return plan;
}

describe('Q scripted authorship', () => {
  it('admits an incomplete staged plan through the shared completeness boundary', () => {
    const project = createProjectDocument(catalog, {
      projectId: 'q-completeness-gate',
      name: 'Q Completeness Gate',
      configuredBiomeCounts: { Surface: 4 },
    });
    const plan = project.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'Q');
    if (plan?.kind !== 'LinearBiome') {
      throw new Error('fixture lost Q plan');
    }

    expect(evaluateLinearCompleteness(catalog, qBiome, plan)).toMatchObject({
      completion: 'incomplete',
      findings: [{ code: 'biomeTopologyMissing' }],
    });
  });

  it('round trips the ordered six-stage tree and direct terminal', () => {
    const project = createRepresentativeNOPQProject();
    const plan = qPlan(project);

    expect(parseProjectDocument(encodeProjectDocument(project), catalog)).toEqual(project);
    expect(evaluateLinearCompleteness(catalog, qBiome, plan)).toMatchObject({
      completion: 'complete',
    });
    expect(plan.topology?.continuations.map((continuation) => continuation.kind)).toEqual([
      'batch',
      'batch',
      'batch',
      'batch',
      'batch',
      'batch',
      'terminal',
    ]);
    expect(plan.topology?.continuations[2]?.targets).toEqual([
      { exitIndex: 1, occurrenceId: qOccurrenceIds.firstMiniboss1 },
      { exitIndex: 2, occurrenceId: qOccurrenceIds.firstMiniboss2 },
    ]);
  });

  it('rejects out-of-stage targets and early terminal transitions', () => {
    let project = applyProjectCommand(createRepresentativeNOPProject(), catalog, {
      kind: 'ConfigureRoutePrefix',
      route: { kind: 'route', routeKey: 'Surface' },
      configuredBiomeCount: 4,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateStart',
      biome: qBiome,
      occurrenceId: qOccurrenceIds.intro,
      gameName: 'Q_Intro',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      continuation: createContinuationAddress(qBiome, qOccurrenceIds.intro),
    });

    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(qBiome, qOccurrenceIds.intro, 1),
        occurrenceId: createOccurrenceId('bad-q-foyer'),
        gameName: 'Q_Combat01',
      }),
    ).toThrowError(ProjectCommandContractError);
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'CreateTerminalTransition',
        continuation: createContinuationAddress(qBiome, qOccurrenceIds.intro),
        targetOccurrenceIds: [createOccurrenceId('early-q-preboss')],
      }),
    ).toThrowError(ProjectCommandContractError);
  });

  it('retains the downstream tree when an occurrence is replaced inside its stage', () => {
    const project = createRepresentativeNOPQProject();
    const before = qPlan(project).topology;
    const replaced = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(qBiome, qOccurrenceIds.foyer),
      gameName: 'Q_Combat11',
    });
    const after = qPlan(replaced).topology;

    expect(after?.occurrences).toHaveLength(before?.occurrences.length ?? 0);
    expect(after?.continuations).toEqual(before?.continuations);
    expect(
      after?.occurrences.find((occurrence) => occurrence.occurrenceId === qOccurrenceIds.foyer)
        ?.gameName,
    ).toBe('Q_Combat11');
    expect(() =>
      applyProjectCommand(replaced, catalog, {
        kind: 'ReplaceOccurrenceRoom',
        occurrence: createOccurrenceAddress(qBiome, qOccurrenceIds.foyer),
        gameName: 'Q_Combat01',
      }),
    ).toThrowError(ProjectCommandContractError);
  });
});

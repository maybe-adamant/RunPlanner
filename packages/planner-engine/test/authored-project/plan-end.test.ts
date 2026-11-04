import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { createCompleteFGProject } from '@run-planner/test-fixtures/underworld';
import {
  applyProjectCommand,
  createBiomeAddress,
  createProjectAddress,
  createExitDecisionAddress,
  createRouteAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  ProjectCommandContractError,
  ProjectDocumentContractError,
  type OccurrenceId,
  type PlanEnd,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';

const route = createRouteAddress('Underworld');
const end = (biomeKey: string, occurrenceId: string): PlanEnd => ({
  biomeKey,
  occurrenceId: occurrenceId as OccurrenceId,
});
const replace = (document: ProjectDocument, planEnd: PlanEnd | null) =>
  applyProjectCommand(document, catalog, { kind: 'ReplacePlanEnd', route, planEnd });
const withRawEnd = (document: ProjectDocument, value: unknown): unknown => ({
  ...document,
  route: { ...document.route, planEnd: value },
});

describe('Plan end', () => {
  it('is absent on a project and round-trips through the codec', () => {
    const project = createCompleteFGProject();
    expect(project.route).not.toHaveProperty('planEnd');
    const ended = replace(project, end('F', 'golden-f-b5-e1'));
    expect(ended.route.planEnd).toEqual(end('F', 'golden-f-b5-e1'));
    const decoded = decodeProjectDocument(JSON.parse(encodeProjectDocument(ended)), catalog);
    expect(decoded.route.planEnd).toEqual(end('F', 'golden-f-b5-e1'));
  });

  it('decodes strictly: the occurrence must exist in a configured biome', () => {
    const project = createCompleteFGProject();
    for (const value of [
      end('H', 'golden-f-b5-e1'),
      end('F', 'not-an-occurrence'),
      end('G', 'golden-f-b5-e1'),
      { biomeKey: 'F' },
      { ...end('F', 'golden-f-b5-e1'), extra: true },
      'F',
    ])
      expect(() => decodeProjectDocument(withRawEnd(project, value), catalog)).toThrow(
        ProjectDocumentContractError,
      );
  });

  it('sets, keeps identity for an equal value, and clears through ReplacePlanEnd', () => {
    const project = createCompleteFGProject();
    const ended = replace(project, end('F', 'golden-f-b5-e1'));
    expect(replace(ended, end('F', 'golden-f-b5-e1'))).toBe(ended);
    const cleared = replace(ended, null);
    expect(cleared.route).not.toHaveProperty('planEnd');
    expect(encodeProjectDocument(cleared)).toEqual(encodeProjectDocument(project));
    expect(replace(project, null)).toBe(project);
  });

  it('refuses a dangling or malformed end', () => {
    const project = createCompleteFGProject();
    for (const value of [end('F', 'missing'), end('H', 'golden-f-b5-e1')])
      expect(() => replace(project, value)).toThrow(ProjectCommandContractError);
  });

  it('is cleared in the step that removes its occurrence or its biome', () => {
    const project = replace(createCompleteFGProject(), end('F', 'golden-f-b9-e1'));
    const removed = applyProjectCommand(project, catalog, {
      kind: 'RemoveExitDecision',
      decision: createExitDecisionAddress(createBiomeAddress('Underworld', 'F'), {
        kind: 'occurrence',
        occurrenceId: 'golden-f-b8-e1' as OccurrenceId,
      }),
    });
    expect(removed.route).not.toHaveProperty('planEnd');
    expect(project.route.planEnd).toEqual(end('F', 'golden-f-b9-e1'));

    const inG = replace(createCompleteFGProject(), end('G', 'golden-g-b5-e1'));
    const shrunk = applyProjectCommand(inG, catalog, {
      kind: 'ConfigureRoutePrefix',
      route,
      configuredBiomeCount: 1,
    });
    expect(shrunk.route).not.toHaveProperty('planEnd');

    // A reset biome reuses its start occurrence ID; the end is still cleared.
    const atStart = replace(createCompleteFGProject(), end('G', 'golden-g-intro'));
    const reset = applyProjectCommand(atStart, catalog, {
      kind: 'ClearTopology',
      biome: createBiomeAddress('Underworld', 'G'),
    });
    expect(reset.route).not.toHaveProperty('planEnd');
  });

  it('survives an edit that leaves its occurrence in place', () => {
    const project = replace(createCompleteFGProject(), end('F', 'golden-f-b5-e1'));
    const renamed = applyProjectCommand(project, catalog, {
      kind: 'RenameProject',
      project: createProjectAddress(),
      name: 'Renamed',
    });
    expect(renamed.route.planEnd).toBe(project.route.planEnd);
  });
});

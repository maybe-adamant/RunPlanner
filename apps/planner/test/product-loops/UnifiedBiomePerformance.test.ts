import {
  createHubDecisionAddress,
  createHubSlotAddress,
  createOccurrenceAddress,
  createTargetAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  createApplication,
  type ApplicationEvaluationEvent,
} from '@planner/composition/createApplication';
import {
  authoredProjectCommandDispatched,
  authoredProjectReplaced,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import {
  createGoldenFGHIProject,
  goldenGBiome,
  goldenGOccurrenceId,
  goldenGStartId,
} from '@run-planner/test-fixtures';
import { createRepresentativeNOPQProject, nBiome } from '@run-planner/test-fixtures';

const interactiveBudgetMs = 750;
const cachedUndoBudgetMs = 50;
let underworldProject: ReturnType<typeof createGoldenFGHIProject>;
let surfaceProject: ReturnType<typeof createRepresentativeNOPQProject>;

beforeAll(() => {
  underworldProject = createGoldenFGHIProject();
  surfaceProject = createRepresentativeNOPQProject();
});

function measure<T>(operation: () => T): { readonly durationMs: number; readonly result: T } {
  const started = performance.now();
  const result = operation();
  return Object.freeze({ durationMs: performance.now() - started, result });
}

function expectInteractiveDuration(durationMs: number, label: string): void {
  expect(durationMs, `${label} took ${durationMs.toFixed(1)} ms`).toBeLessThan(interactiveBudgetMs);
}

function expectCachedUndoDuration(durationMs: number, label: string): void {
  expect(durationMs, `${label} took ${durationMs.toFixed(1)} ms`).toBeLessThan(cachedUndoBudgetMs);
}

function expectColdCandidateWork(
  events: readonly ApplicationEvaluationEvent[],
  label: string,
): void {
  const queryBatches = events.filter((event) => event.kind === 'queryBatch');
  expect(queryBatches, `${label} must evaluate exactly one candidate batch`).toHaveLength(1);
  expect(queryBatches[0]?.queryCount).toBeGreaterThan(0);
  expect(
    events.filter((event) => event.kind === 'projectEvaluation'),
    `${label} must not reacquire project evaluation`,
  ).toHaveLength(0);
}

function expectEditWork(events: readonly ApplicationEvaluationEvent[], label: string): void {
  expect(
    events.filter((event) => event.kind === 'projectEvaluation'),
    `${label} must publish exactly one project evaluation`,
  ).toHaveLength(1);
  expect(
    events.filter((event) => event.kind === 'queryBatch'),
    `${label} must not query candidates`,
  ).toHaveLength(0);
}

function expectCachedUndoWork(events: readonly ApplicationEvaluationEvent[], label: string): void {
  expect(
    events.filter((event) => event.kind === 'projectEvaluation'),
    `${label} must reuse its cached project evaluation`,
  ).toHaveLength(0);
  expect(events, `${label} must not perform candidate work`).toHaveLength(0);
}

describe('unified biome performance', () => {
  it('keeps representative Underworld rebuild, candidate, edit, and cached undo work interactive', () => {
    const events: ApplicationEvaluationEvent[] = [];
    const application = createApplication({
      observeEvaluationWork: (event) => events.push(event),
    });
    const project = underworldProject;
    application.store.dispatch(authoredProjectReplaced(project));
    const baseline = application.store.getState().projectWorkspace.assembly.evaluation;
    events.length = 0;

    const rebuild = measure(() => simulateProject(application.catalog, project));
    expect(rebuild.result).toEqual(baseline);

    const target = createTargetAddress(
      goldenGBiome,
      { kind: 'occurrence', occurrenceId: goldenGStartId },
      'exit1',
    );
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const roomCandidates = workspace.interactions.rooms.get(semanticAddressKey(target));
    if (roomCandidates === undefined)
      throw new Error('G cold room-candidate interaction is missing');
    const candidate = measure(() => roomCandidates.load());
    expect(candidate.result.sections.length).toBeGreaterThan(0);
    expectColdCandidateWork(events, 'Underworld cold candidate projection');

    events.length = 0;
    const edit = measure(() =>
      application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceOccurrenceRoom',
          occurrence: createOccurrenceAddress(goldenGBiome, goldenGOccurrenceId(1, 1)),
          gameName: 'G_Combat02',
        }),
      ),
    );
    expect(application.store.getState().projectWorkspace.history.present).not.toBe(project);
    expectEditWork(events, 'Underworld representative edit publication');

    events.length = 0;
    const undo = measure(() => application.store.dispatch(authoredProjectUndoRequested()));
    expect(application.store.getState().projectWorkspace.history.present).toBe(project);
    expect(application.store.getState().projectWorkspace.assembly.evaluation).toBe(baseline);
    expectCachedUndoWork(events, 'Underworld cached undo publication');

    expectInteractiveDuration(rebuild.durationMs, 'Underworld full rebuild');
    expectInteractiveDuration(candidate.durationMs, 'Underworld cold candidate projection');
    expectInteractiveDuration(edit.durationMs, 'Underworld representative edit publication');
    expectCachedUndoDuration(undo.durationMs, 'Underworld cached undo publication');
    application.dispose();
  });

  it('keeps representative Surface rebuild, candidate, edit, and cached undo work interactive', () => {
    const events: ApplicationEvaluationEvent[] = [];
    const application = createApplication({
      observeEvaluationWork: (event) => events.push(event),
    });
    const project = surfaceProject;
    application.store.dispatch(authoredProjectReplaced(project));
    const baseline = application.store.getState().projectWorkspace.assembly.evaluation;
    events.length = 0;

    const rebuild = measure(() => simulateProject(application.catalog, project));
    expect(rebuild.result).toEqual(baseline);

    const hubSlot = createHubSlotAddress(nBiome, 'hub', 'miniBoss02');
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const hubCandidates = workspace.interactions.hubSlots.get(semanticAddressKey(hubSlot));
    if (hubCandidates === undefined || hubCandidates.selected)
      throw new Error('N cold Hub-slot candidate interaction is missing');
    const candidate = measure(() => hubCandidates.beginOpeningAttempt().load());
    expect(candidate.result).toHaveLength(2);
    expectColdCandidateWork(events, 'Surface cold candidate projection');

    events.length = 0;
    const edit = measure(() =>
      application.store.dispatch(
        authoredProjectCommandDispatched({
          hub: createHubDecisionAddress(nBiome, 'hub'),
          hubSlotKeys: ['combat02', 'combat01', 'combat03', 'combat05', 'combat09', 'combat10'],
          kind: 'ReplaceHubVisitOrder',
        }),
      ),
    );
    expect(application.store.getState().projectWorkspace.history.present).not.toBe(project);
    expectEditWork(events, 'Surface representative edit publication');

    events.length = 0;
    const undo = measure(() => application.store.dispatch(authoredProjectUndoRequested()));
    expect(application.store.getState().projectWorkspace.history.present).toBe(project);
    expect(application.store.getState().projectWorkspace.assembly.evaluation).toBe(baseline);
    expectCachedUndoWork(events, 'Surface cached undo publication');

    expectInteractiveDuration(rebuild.durationMs, 'Surface full rebuild');
    expectInteractiveDuration(candidate.durationMs, 'Surface cold candidate projection');
    expectInteractiveDuration(edit.durationMs, 'Surface representative edit publication');
    expectCachedUndoDuration(undo.durationMs, 'Surface cached undo publication');
    application.dispose();
  });
});

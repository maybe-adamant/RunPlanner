import {
  createHubSlotAddress,
  createHubVisitAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createTargetAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { createApplication } from '../../src/composition/createApplication';
import {
  authoredProjectCommandDispatched,
  authoredProjectReplaced,
  authoredProjectUndoRequested,
} from '../../src/state/projectWorkspaceSlice';
import {
  createGoldenFGHIProject,
  goldenGBiome,
  goldenGOccurrenceId,
  goldenGStartId,
} from '../fixtures/underworldProject';
import { createRepresentativeNOPQProject, nBiome } from '../fixtures/surfaceProject';

const interactiveBudgetMs = 750;
const cachedUndoBudgetMs = 50;

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

describe('unified biome performance', () => {
  it('keeps representative Underworld rebuild, candidate, edit, and cached undo work interactive', () => {
    const application = createApplication();
    const project = createGoldenFGHIProject(application.catalog);
    application.store.dispatch(authoredProjectReplaced(project));
    const baseline = application.store.getState().projectWorkspace.evaluation;

    const rebuild = measure(() => simulateProject(application.catalog, project));
    expect(rebuild.result).toEqual(baseline);

    const target = createTargetAddress(
      goldenGBiome,
      { kind: 'occurrence', occurrenceId: goldenGStartId },
      'exit1',
    );
    const workspace = application.structuredWorkspace.project(project, baseline);
    const roomCandidates = workspace.interactions.rooms.get(semanticAddressKey(target));
    if (roomCandidates === undefined)
      throw new Error('G cold room-candidate interaction is missing');
    const candidate = measure(() => roomCandidates.load());
    expect(candidate.result.sections.length).toBeGreaterThan(0);

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

    const undo = measure(() => application.store.dispatch(authoredProjectUndoRequested()));
    expect(application.store.getState().projectWorkspace.history.present).toBe(project);
    expect(application.store.getState().projectWorkspace.evaluation).toBe(baseline);

    expectInteractiveDuration(rebuild.durationMs, 'Underworld full rebuild');
    expectInteractiveDuration(candidate.durationMs, 'Underworld cold candidate projection');
    expectInteractiveDuration(edit.durationMs, 'Underworld representative edit publication');
    expectCachedUndoDuration(undo.durationMs, 'Underworld cached undo publication');
    application.dispose();
  });

  it('keeps representative Surface rebuild, candidate, edit, and cached undo work interactive', () => {
    const application = createApplication();
    const project = createRepresentativeNOPQProject();
    application.store.dispatch(authoredProjectReplaced(project));
    const baseline = application.store.getState().projectWorkspace.evaluation;

    const rebuild = measure(() => simulateProject(application.catalog, project));
    expect(rebuild.result).toEqual(baseline);

    const hubSlot = createHubSlotAddress(nBiome, 'hub', 'miniBoss02');
    const workspace = application.structuredWorkspace.project(project, baseline);
    const hubCandidates = workspace.interactions.hubSlots.get(semanticAddressKey(hubSlot));
    if (hubCandidates === undefined)
      throw new Error('N cold Hub-slot candidate interaction is missing');
    const candidate = measure(() =>
      hubCandidates.bind(createOccurrenceId('surface-performance-miniBoss02')).load(),
    );
    expect(candidate.result).toHaveLength(2);

    const edit = measure(() =>
      application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceHubVisit',
          hubSlotKey: 'combat01',
          visit: createHubVisitAddress(nBiome, 'hub', 1),
        }),
      ),
    );
    expect(application.store.getState().projectWorkspace.history.present).not.toBe(project);

    const undo = measure(() => application.store.dispatch(authoredProjectUndoRequested()));
    expect(application.store.getState().projectWorkspace.history.present).toBe(project);
    expect(application.store.getState().projectWorkspace.evaluation).toBe(baseline);

    expectInteractiveDuration(rebuild.durationMs, 'Surface full rebuild');
    expectInteractiveDuration(candidate.durationMs, 'Surface cold candidate projection');
    expectInteractiveDuration(edit.durationMs, 'Surface representative edit publication');
    expectCachedUndoDuration(undo.durationMs, 'Surface cached undo publication');
    application.dispose();
  });
});

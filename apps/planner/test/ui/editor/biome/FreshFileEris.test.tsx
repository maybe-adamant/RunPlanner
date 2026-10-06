// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createOccurrenceAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { act, cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { PlannerApplication } from '@planner/composition/createApplication';
import { semanticFindingKey } from '@planner/projections/evaluationProjection';
import { findingSelected, semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import {
  authoredProjectRedoRequested,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import { renderWorkspace } from '@planner-test/support/biome-workbench';
import {
  createFreshFileRouteProject,
  freshFileGBiome,
  freshFileGIntroId,
  freshFileHBiome,
  freshFileHIntroId,
} from '@run-planner/test-fixtures/fresh-file';

afterEach(cleanup);

function gIntro(application: PlannerApplication) {
  const project: ProjectDocument | undefined =
    application.store.getState().projectWorkspace.history?.present;
  return project?.route.biomes[1]?.topology?.occurrences.find(
    (occurrence) => occurrence.occurrenceId === freshFileGIntroId,
  );
}

describe('Fresh File Eris', () => {
  it('observes the spawn in the Overview and derives the talk and gift on the Timeline, with undo', async () => {
    const view = renderWorkspace(createFreshFileRouteProject(), 'FreshFile', 'G');
    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(freshFileGBiome, freshFileGIntroId)),
      ),
    );
    const overview = () => screen.getByRole('region', { name: 'Room features' });
    const timeline = () => screen.getByRole('region', { name: 'Room Timeline' });
    const spawned = () => within(overview()).getByRole('checkbox', { name: 'Eris has spawned' });
    const openTab = (name: string) => view.user.click(screen.getByRole('tab', { name }));
    expect(spawned()).toHaveProperty('checked', true);
    await openTab('Room Timeline');
    expect(within(timeline()).queryByRole('checkbox', { name: 'Eris has spawned' })).toBeNull();
    expect(within(timeline()).getByText('Talk to Eris')).toBeTruthy();
    expect(within(timeline()).getByText(/Ashes/)).toBeTruthy();

    await openTab('Room Overview');
    await view.user.click(spawned());
    expect(gIntro(view.application)?.eris).toBeUndefined();
    expect(gIntro(view.application)?.roomActions.order).toEqual([]);
    expect(spawned()).toHaveProperty('checked', false);
    await openTab('Room Timeline');
    expect(within(timeline()).queryByText('Talk to Eris')).toBeNull();

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(gIntro(view.application)?.eris).toEqual({ spawned: true });
    expect(within(timeline()).getByText('Talk to Eris')).toBeTruthy();
    act(() => view.application.store.dispatch(authoredProjectRedoRequested()));
    expect(gIntro(view.application)?.eris).toBeUndefined();
    await openTab('Room Overview');
    await view.user.click(spawned());
    expect(gIntro(view.application)?.eris).toEqual({ spawned: true });
  });

  it('reports a repeated spawn on the Overview observation, not the talk', async () => {
    const hIntro = createOccurrenceAddress(freshFileHBiome, freshFileHIntroId);
    const repeated = applyProjectCommand(createFreshFileRouteProject(), catalog, {
      kind: 'SetErisSpawned',
      occurrence: hIntro,
      spawned: true,
    });
    const view = renderWorkspace(repeated, 'FreshFile', 'H');
    const finding = view.application.store
      .getState()
      .projectWorkspace.assembly!.evaluation.findings.find(
        (candidate) => candidate.code === 'erisSpawnUnavailable',
      );
    if (finding === undefined) throw new Error('repeated Eris spawn finding is missing');
    act(() => view.application.store.dispatch(semanticOwnerFocused(hIntro)));
    await view.user.click(screen.getByRole('tab', { name: 'Room Timeline' }));
    act(() =>
      view.application.store.dispatch(
        findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
      ),
    );
    expect(screen.getByRole('tab', { name: 'Room Overview' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    const spawned = screen.getByRole('checkbox', { name: 'Eris has spawned' });
    expect(spawned.getAttribute('data-has-findings')).toBe('true');
    expect(spawned.getAttribute('aria-description')).toContain('Eris cannot spawn again');
    expect(document.activeElement).toBe(spawned);
  });
});

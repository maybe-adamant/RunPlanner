// @vitest-environment jsdom

import { cleanup, screen, within } from '@testing-library/react';
import { createBiomeAddress, createOccurrenceId } from '@run-planner/engine/authored-project';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApplication } from '../../src/composition/createApplication';
import {
  authoredProjectCommandDispatched,
  authoredProjectReplaced,
} from '../../src/state/projectWorkspaceSlice';
import { createGoldenFGHIProject } from '../fixtures/underworldProject';
import { renderPlannerForInteraction } from '../fixtures/renderPlanner';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('underworld product loop', () => {
  it('renders F through I through one shared biome workspace surface', async () => {
    const application = createApplication();
    application.store.dispatch(
      authoredProjectReplaced(createGoldenFGHIProject(application.catalog)),
    );
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('button', { name: 'Underworld' }));
    for (const [label, structure] of [
      ['Erebus', 'Erebus structure'],
      ['Oceanus', 'Oceanus structure'],
      ['Fields', 'Fields structure'],
      ['Tartarus', 'Tartarus structure'],
    ] as const) {
      await view.user.click(screen.getByRole('button', { name: label }));
      expect(screen.getByRole('region', { name: structure })).toBeTruthy();
      expect(document.querySelector('.biome-workspace')).not.toBeNull();
    }

    const evaluation = application.store.getState().projectWorkspace.evaluation;
    expect(evaluation).toMatchObject({
      findings: [],
      status: 'valid',
      summary: { configuredBiomeCount: 4, eligibleForExecutionPlan: true },
    });
    expect(document.body.textContent).not.toContain('F_Combat');
    expect(document.body.textContent).not.toContain('Linear topology');
  });

  it('keeps a blocked downstream biome structurally authorable through the workspace', async () => {
    const application = createApplication();
    const view = renderPlannerForInteraction({ application });

    await view.user.selectOptions(screen.getByLabelText('Configured biomes'), '2');
    await view.user.click(screen.getByRole('button', { name: 'Oceanus' }));
    expect(screen.getByText(/Oceanus is blocked until Erebus is complete and valid/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start biome' })).toBeTruthy();

    await view.user.click(screen.getByRole('button', { name: 'Start biome' }));
    const structure = screen.getByRole('region', { name: 'Oceanus structure' });
    await view.user.click(
      within(structure).getByRole('button', { name: /Continue authoring here/ }),
    );
    expect(screen.getByRole('button', { name: 'Add normal exits' })).toBeTruthy();
    const g = application.store
      .getState()
      .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'G');
    expect(g?.topology).not.toBeNull();
  });

  it('preserves destructive route-prefix confirmation and undo around shared workspace state', async () => {
    const application = createApplication();
    application.store.dispatch(
      authoredProjectCommandDispatched({
        configuredBiomeCount: 1,
        kind: 'ConfigureRoutePrefix',
        route: { kind: 'route', routeKey: 'Underworld' },
      }),
    );
    application.store.dispatch(
      authoredProjectCommandDispatched({
        biome: createBiomeAddress('Underworld', 'F'),
        gameName: 'F_Opening02',
        kind: 'CreateStart',
        occurrenceId: createOccurrenceId('underworld-prefix-undo-start'),
      }),
    );
    const beforeShrink = application.store.getState().projectWorkspace.history.present;
    const view = renderPlannerForInteraction({ application });
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);

    await view.user.click(screen.getByRole('button', { name: 'Route' }));
    await view.user.selectOptions(screen.getByLabelText('Configured biomes'), '0');
    expect(application.store.getState().projectWorkspace.evaluation.status).toBe('empty');
    expect(globalThis.confirm).toHaveBeenCalledOnce();

    await view.user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(application.store.getState().projectWorkspace.history.present).toBe(beforeShrink);
    await view.user.click(screen.getByRole('button', { name: 'Erebus' }));
    expect(screen.getByText('Opening 02')).toBeTruthy();
  });
});

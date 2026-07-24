// @vitest-environment jsdom

import { act, cleanup, screen, within } from '@testing-library/react';
import type { ProjectDocument } from '@run-planner/engine/authored-project';
import { afterEach, describe, expect, it } from 'vitest';

import { createApplication } from '../../../composition/createApplication';
import type { WorkspaceLinearBiome } from '../../../projections/structuredWorkspace';
import { routePanelSelected, semanticOwnerFocused } from '../../../state/editorSessionSlice';
import { authoredProjectReplaced } from '../../../state/projectWorkspaceSlice';
import { renderPlannerForInteraction } from '../../../../test/fixtures/renderPlanner';
import { createRepresentativeNOPQProject } from '../../../../test/fixtures/surfaceProject';
import { createGoldenFGHIProject } from '../../../../test/fixtures/underworldProject';

afterEach(cleanup);

function renderBiome(project: ProjectDocument, routeKey: string, biomeKey: string) {
  const application = createApplication();
  application.store.dispatch(authoredProjectReplaced(project));
  application.store.dispatch(routePanelSelected({ routeKey, biomeKey }));
  return renderPlannerForInteraction({ application });
}

function projectedLinearBiome(
  application: ReturnType<typeof createApplication>,
  biomeKey: string,
): WorkspaceLinearBiome {
  const state = application.store.getState().projectWorkspace;
  const workspace = application.structuredWorkspace.project(
    state.history.present,
    state.evaluation,
  );
  const biome = workspace.routes
    .flatMap((route) => route.biomes)
    .find((candidate) => candidate.biomeKey === biomeKey);
  if (biome?.kind !== 'LinearBiome') {
    throw new Error(`${biomeKey} has no Linear workspace`);
  }
  return biome;
}

describe('Linear structured workspace', () => {
  it('composes every Linear biome through the common rail and variant-owned terminal', () => {
    const underworld = createGoldenFGHIProject(createApplication().catalog);
    const surface = createRepresentativeNOPQProject();
    const cases = [
      {
        project: underworld,
        routeKey: 'Underworld',
        biomeKey: 'F',
        label: 'Erebus',
        terminal: 'independent',
      },
      {
        project: underworld,
        routeKey: 'Underworld',
        biomeKey: 'G',
        label: 'Oceanus',
        terminal: 'independent',
      },
      {
        project: underworld,
        routeKey: 'Underworld',
        biomeKey: 'H',
        label: 'Fields',
        terminal: 'independent',
      },
      {
        project: underworld,
        routeKey: 'Underworld',
        biomeKey: 'I',
        label: 'Tartarus',
        terminal: 'generatedPeer',
      },
      {
        project: surface,
        routeKey: 'Surface',
        biomeKey: 'O',
        label: 'Thessaly',
        terminal: 'independent',
      },
      {
        project: surface,
        routeKey: 'Surface',
        biomeKey: 'P',
        label: 'Olympus',
        terminal: 'independent',
      },
      {
        project: surface,
        routeKey: 'Surface',
        biomeKey: 'Q',
        label: 'Summit',
        terminal: 'independent',
      },
    ] as const;

    for (const testCase of cases) {
      const view = renderBiome(testCase.project, testCase.routeKey, testCase.biomeKey);
      expect(screen.getByRole('region', { name: `${testCase.label} structure` })).toBeTruthy();
      expect(screen.getByRole('complementary', { name: 'Focused inspector' })).toBeTruthy();
      expect(
        view.container.querySelector(
          `.linear-terminal-stop[data-realization="${testCase.terminal}"]`,
        ),
      ).toBeTruthy();
      view.unmount();
    }
  });

  it('keeps unpicked offers out of the spine and edits every exit in one decision workbench', async () => {
    const seed = createApplication();
    const project = createGoldenFGHIProject(seed.catalog);
    const { application, user } = renderBiome(project, 'Underworld', 'F');
    const projection = projectedLinearBiome(application, 'F');
    const decisionIndex = projection.decisions.findIndex((candidate) =>
      candidate.targets.some((target) => !target.picked),
    );
    const decision = projection.decisions[decisionIndex];
    const picked = decision?.targets.find((target) => target.picked);
    const unpicked = decision?.targets.find((target) => !target.picked);
    if (decision === undefined || picked === undefined || unpicked === undefined) {
      throw new Error('golden F has no multi-offer decision');
    }
    const structure = screen.getByRole('region', { name: 'Erebus structure' });
    const decisionButton = within(structure)
      .getAllByRole('button')
      .find((button) => button.getAttribute('data-workspace-node') === decision.marker.focusKey);
    if (decisionButton === undefined) {
      throw new Error('multi-offer F decision has no compact structure row');
    }

    expect(decisionButton.textContent).toContain(`Decision ${decisionIndex + 1}`);
    expect(decisionButton.textContent).toContain(picked.room.label);
    expect(
      within(structure)
        .getAllByRole('button')
        .some(
          (button) => button.getAttribute('data-workspace-node') === unpicked.room.marker.focusKey,
        ),
    ).toBe(false);

    await user.click(decisionButton);

    expect(application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      decision.marker.address,
    );
    const inspector = screen.getByRole('complementary', { name: 'Focused inspector' });
    expect(
      within(inspector).getByRole('heading', {
        level: 2,
        name: `Decision ${decisionIndex + 1}`,
      }),
    ).toBeTruthy();
    expect(within(inspector).getAllByLabelText('Room')).toHaveLength(decision.targets.length);
    expect(within(inspector).getAllByRole('radio')).toHaveLength(decision.targets.length);

    act(() => {
      application.store.dispatch(semanticOwnerFocused(unpicked.room.marker.address));
    });

    expect(
      within(inspector).getByRole('heading', {
        level: 2,
        name: `Decision ${decisionIndex + 1}`,
      }),
    ).toBeTruthy();
    const exitCards = Array.from(inspector.querySelectorAll('.exit-row'));
    expect(exitCards).toHaveLength(decision.targets.length);
    expect(exitCards.filter((card) => card.getAttribute('data-focused') === 'true')).toHaveLength(
      1,
    );
    expect(
      exitCards.find((card) => card.getAttribute('data-focused') === 'true')?.textContent,
    ).toContain(unpicked.room.label);
  });

  it('keeps layout-owned biome fields reachable from the structure rail', async () => {
    const seed = createApplication();
    const project = createGoldenFGHIProject(seed.catalog);
    const { user } = renderBiome(project, 'Underworld', 'I');
    const structure = screen.getByRole('region', { name: 'Tartarus structure' });

    await user.click(within(structure).getByRole('button', { name: /Biome settings/ }));

    const inspector = screen.getByRole('complementary', { name: 'Focused inspector' });
    expect(within(inspector).getByLabelText('Maximum NonGoal rewards')).toBeTruthy();
  });
});

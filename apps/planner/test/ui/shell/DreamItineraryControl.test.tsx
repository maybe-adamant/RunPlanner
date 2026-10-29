// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';

import { createProjectDocument } from '@run-planner/engine/authored-project';
import { createApplication } from '@planner/composition/createApplication';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import { DreamItineraryControl } from '@planner/ui/shell/DreamItineraryControl';

afterEach(cleanup);

function renderControl() {
  const application = createApplication();
  application.store.dispatch(
    authoredProjectReplaced(
      createProjectDocument(application.catalog, {
        projectId: 'dream-repick',
        routeKey: 'Dream',
        itineraryBiomeKeys: ['Q', 'F', 'N', 'H'],
        configuredBiomeCount: 3,
      }),
    ),
  );
  const history = () => application.store.getState().projectWorkspace.history!;
  render(
    <Provider store={application.store}>
      <DreamItineraryControl catalog={application.catalog} route={history().present.route} />
    </Provider>,
  );
  return { history };
}

/** Opens the picker and revises the third biome from Ephyra to Thessaly. */
function repickThirdBiome() {
  fireEvent.click(screen.getByRole('button', { name: 'Change biomes' }));
  expect(screen.getByRole('button', { name: 'Route order' }).textContent).toContain(
    '1. Summit · 2. Erebus · 3. Ephyra · 4. Fields',
  );
  expect(
    (screen.getByRole('button', { name: 'Use these biomes' }) as HTMLButtonElement).disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '3. Ephyra' }));
  fireEvent.click(screen.getByRole('option', { name: 'Thessaly' }));
  fireEvent.click(screen.getByRole('button', { name: 'Use these biomes' }));
}

describe('DreamItineraryControl', () => {
  it('names the biomes to clear and leaves the project unchanged on cancel', () => {
    const { history } = renderControl();
    const before = history().present;
    repickThirdBiome();
    const dialog = screen.getByRole('dialog', { name: 'Clear later biome plans?' });
    expect(
      within(within(dialog).getByRole('list', { name: 'Biomes to clear' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Ephyra']);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(history().present).toBe(before);
  });

  it('replaces the itinerary as one undoable step once confirmed', () => {
    const { history } = renderControl();
    const depth = history().past.length;
    repickThirdBiome();
    fireEvent.click(screen.getByRole('button', { name: 'Clear and change' }));
    expect(history().present.route.itineraryBiomeKeys).toEqual(['Q', 'F', 'O', 'H']);
    expect(history().present.route.biomes.map((biome) => biome.biomeKey)).toEqual(['Q', 'F', 'O']);
    expect(history().past).toHaveLength(depth + 1);
  });
});

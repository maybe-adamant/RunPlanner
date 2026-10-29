// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Provider, useSelector } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';

import { createProjectDocument } from '@run-planner/engine/authored-project';
import { createApplication } from '@planner/composition/createApplication';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import type { RootState } from '@planner/state/store';
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
  function Connected() {
    const route = useSelector((state: RootState) => state.projectWorkspace.history!.present.route);
    return (
      <DreamItineraryControl
        catalog={application.catalog}
        key={route.itineraryBiomeKeys.join(',')}
        route={route}
      />
    );
  }
  render(
    <Provider store={application.store}>
      <Connected />
    </Provider>,
  );
  return { history };
}

function slotText(slot: number): string | null {
  return screen.getByRole('button', { name: `Biome ${slot}` }).textContent;
}

function pick(slot: number, biome: string) {
  fireEvent.click(screen.getByRole('button', { name: `Biome ${slot}` }));
  fireEvent.click(screen.getByRole('option', { name: biome }));
}

describe('DreamItineraryControl', () => {
  it('shows the itinerary as four slots, each opening its own biome picker', () => {
    renderControl();
    expect([1, 2, 3, 4].map(slotText)).toEqual([
      '1. Summit▾',
      '2. Erebus▾',
      '3. Ephyra▾',
      '4. Fields▾',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Biome 3' }));
    expect(screen.getByText('Biome 3 of 4')).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Thessaly' })).toBeTruthy();
  });

  it('applies a change that clears no biome plans at once, as one undoable step', () => {
    const { history } = renderControl();
    const depth = history().past.length;
    pick(4, 'Tartarus');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(history().present.route.itineraryBiomeKeys).toEqual(['Q', 'F', 'N', 'I']);
    expect(history().past).toHaveLength(depth + 1);
    expect(slotText(4)).toBe('4. Tartarus▾');
  });

  it('names the biomes to clear and reverts the slot on cancel', () => {
    const { history } = renderControl();
    const before = history().present;
    pick(3, 'Thessaly');
    const dialog = screen.getByRole('dialog', { name: 'Clear later biome plans?' });
    expect(
      within(within(dialog).getByRole('list', { name: 'Biomes to clear' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Ephyra']);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(history().present).toBe(before);
    expect(slotText(3)).toBe('3. Ephyra▾');
  });

  it('replaces the itinerary as one undoable step once confirmed', () => {
    const { history } = renderControl();
    const depth = history().past.length;
    pick(3, 'Thessaly');
    fireEvent.click(screen.getByRole('button', { name: 'Clear and change' }));
    expect(history().present.route.itineraryBiomeKeys).toEqual(['Q', 'F', 'O', 'H']);
    expect(history().present.route.biomes.map((biome) => biome.biomeKey)).toEqual(['Q', 'F', 'O']);
    expect(history().past).toHaveLength(depth + 1);
  });

  it('applies nothing while a change leaves later slots to choose', () => {
    const { history } = renderControl();
    const before = history().present;
    const depth = history().past.length;
    pick(3, 'Fields');
    expect(slotText(3)).toBe('3. Fields▾');
    expect(slotText(4)).toBe('4. Choose biome▾');
    expect(history().present).toBe(before);
    pick(4, 'Thessaly');
    fireEvent.click(screen.getByRole('button', { name: 'Clear and change' }));
    expect(history().present.route.itineraryBiomeKeys).toEqual(['Q', 'F', 'H', 'O']);
    expect(history().past).toHaveLength(depth + 1);
  });
});

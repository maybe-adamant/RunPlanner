// @vitest-environment jsdom

import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { encodeProjectDocument } from '@run-planner/engine/authored-project';
import { catalog } from '@run-planner/hades2-catalog';
import { createGoldenFGHProject } from '@run-planner/test-fixtures/underworld';
import { afterEach, describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import type { CatalogFeedSnapshot } from '@planner/persistence/catalogFeedHost';
import {
  catalogEntry,
  catalogSnapshot,
  createFakeCatalogFeedHost,
} from '@planner-test/fixtures/catalogFeedHost';
import { renderPlannerForInteraction } from '@planner-test/fixtures/renderPlanner';
import { createMemoryProjectLibrary } from '@planner-test/support/memoryProjectLibrary';

const planJson = encodeProjectDocument(createGoldenFGHProject());
const wr = catalogEntry({ id: 'underworld-wr', title: 'Underworld WR', tags: ['skull', 'zeus'] });
const surface = catalogEntry({
  id: 'sub-3m-surface',
  title: 'Sub 3m Surface',
  routeKey: 'Surface',
  tags: ['skull', 'hera'],
});
const practice = catalogEntry({
  id: 'chronos',
  title: 'Chronos practice',
  category: 'practice',
  tags: ['boss'],
});
const future = catalogEntry({ id: 'future', title: 'Future run', planSchemaVersion: 999 });

async function renderCatalog(
  snapshot: CatalogFeedSnapshot = catalogSnapshot([wr, surface, practice, future]),
) {
  const feed = createFakeCatalogFeedHost(snapshot, { [wr.id]: planJson, [surface.id]: planJson });
  const library = createMemoryProjectLibrary();
  const application = createApplication({
    catalogFeedHost: feed.host,
    projectLibrary: library.adapter,
  });
  await application.startupReady;
  const rendered = renderPlannerForInteraction({ application, startWithProject: false });
  await screen.findByRole('region', { name: 'Library' });
  await rendered.user.click(
    within(screen.getByRole('navigation', { name: 'Home' })).getByRole('button', {
      name: 'Catalog',
    }),
  );
  const page = await screen.findByRole('region', { name: 'Catalog' });
  return { ...rendered, application, feed, library, page };
}

const titles = () =>
  Array.from(
    document.querySelectorAll('.catalog-table .library-plan-name'),
    (cell) => cell.textContent,
  );
const rowOf = (title: string) =>
  screen.getByText(title, { selector: '.library-plan-name' }).closest('tr')!;

describe('Catalog screen', () => {
  afterEach(cleanup);

  it('is a Home tab only with a catalog host, linked from the Library', async () => {
    const application = createApplication({ projectLibrary: createMemoryProjectLibrary().adapter });
    await application.startupReady;
    renderPlannerForInteraction({ application, startWithProject: false });
    await screen.findByRole('region', { name: 'Library' });
    expect(screen.queryByRole('button', { name: 'Catalog' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Browse catalog' })).toBeNull();
    cleanup();

    const { user, feed } = await renderCatalog();
    await user.click(screen.getByRole('button', { name: 'Library' }));
    await user.click(await screen.findByRole('button', { name: 'Browse catalog' }));
    expect(await screen.findByRole('region', { name: 'Catalog' })).toBeTruthy();
    // Showing the Catalog retries a failed read.
    expect(feed.host.refresh).toHaveBeenCalledWith(true);
  });

  it('shows categories with counts, and searches, filters and sorts the entries', async () => {
    const { page, user } = await renderCatalog();
    expect(await within(page).findByText('Underworld WR')).toBeTruthy();
    const tabs = within(page).getByRole('navigation', { name: 'Categories' });
    expect(
      within(tabs)
        .getAllByRole('button')
        .map((tab) => tab.textContent),
    ).toEqual(['All4', 'Speedrun3', 'Practice1']);
    expect(titles()).toEqual(['Chronos practice', 'Future run', 'Sub 3m Surface', 'Underworld WR']);
    // The panel's heading counts the entries shown.
    expect(within(page).getByRole('heading', { name: /^Catalog/ }).textContent).toBe(
      'Catalog · 4 plans',
    );
    const row = rowOf('Underworld WR');
    expect(within(row).getByText(wr.description)).toBeTruthy();
    expect(within(row).getByText('4 biomes')).toBeTruthy();
    expect(
      within(within(row).getByRole('list', { name: 'Tags' }))
        .getAllByRole('listitem')
        .map((tag) => tag.textContent),
    ).toEqual(['skull', 'zeus']);
    expect(within(row).getByText('Hippo')).toBeTruthy();

    await user.click(within(tabs).getByRole('button', { name: /^Speedrun/ }));
    expect(titles()).toEqual(['Future run', 'Sub 3m Surface', 'Underworld WR']);
    await user.selectOptions(within(page).getByRole('combobox', { name: 'Tag' }), 'zeus');
    expect(titles()).toEqual(['Underworld WR']);
    await user.selectOptions(within(page).getByRole('combobox', { name: 'Tag' }), '');
    await user.click(
      within(within(page).getByRole('group', { name: 'Route' })).getByRole('button', {
        name: catalog.routes.byKey.Surface!.label,
      }),
    );
    expect(titles()).toEqual(['Sub 3m Surface']);
    await user.click(within(page).getByRole('button', { name: 'Any route' }));
    await user.type(within(page).getByRole('searchbox', { name: 'Search the catalog' }), 'hera');
    expect(titles()).toEqual(['Future run', 'Sub 3m Surface', 'Underworld WR']);
    await user.clear(within(page).getByRole('searchbox', { name: 'Search the catalog' }));
    await user.type(within(page).getByRole('searchbox', { name: 'Search the catalog' }), 'zeus');
    expect(titles()).toEqual(['Underworld WR']);
    expect(within(page).getByText('Showing 1 of 3')).toBeTruthy();
  });

  it('adds an entry to the library named after it, then opens it from the row', async () => {
    const { application, library, page, user } = await renderCatalog();
    await user.click(
      await within(page).findByRole('button', { name: 'Add Underworld WR to library' }),
    );
    const row = rowOf('Underworld WR');
    expect(await within(row).findByText('In library')).toBeTruthy();
    expect((await library.plans(catalog)).map((plan) => plan.name)).toEqual(['Underworld WR']);
    expect(within(rowOf('Future run')).getByText('Needs a newer planner')).toBeTruthy();
    expect(within(rowOf('Future run')).queryByRole('button')).toBeNull();

    await user.click(within(row).getByRole('button', { name: 'Open Underworld WR' }));
    await waitFor(() =>
      expect(application.store.getState().librarySession.view).toEqual({ kind: 'editor' }),
    );
  });

  it('reports a catalog that could not load and one read offline', async () => {
    const { feed, page, user } = await renderCatalog(
      catalogSnapshot([], { source: 'none', problem: 'Could not download the catalog.' }),
    );
    expect(
      await within(page).findByText('The catalog couldn’t be loaded.', { exact: false }),
    ).toBeTruthy();
    feed.answer(catalogSnapshot([wr], { source: 'cache', problem: 'offline' }));
    await user.click(within(page).getByRole('button', { name: 'Try again' }));
    expect(await within(page).findByText('Offline · the catalog as last downloaded')).toBeTruthy();
    expect(titles()).toEqual(['Underworld WR']);
  });
});

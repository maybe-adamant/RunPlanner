// @vitest-environment jsdom

import { cleanup, screen, waitFor, within } from '@testing-library/react';
import {
  createProjectDocument,
  DEFAULT_PROJECT_NAME,
  encodeProjectDocument,
} from '@run-planner/engine/authored-project';
import { catalog } from '@run-planner/hades2-catalog';
import { createCompleteFGProject } from '@run-planner/test-fixtures/underworld';
import { afterEach, describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { renderPlannerForInteraction } from '@planner-test/fixtures/renderPlanner';
import { createMemoryProjectLibrary } from '@planner-test/support/memoryProjectLibrary';

function plan(projectId: string, name: string, routeKey = 'Underworld') {
  return createProjectDocument(catalog, { projectId, name, routeKey, configuredBiomeCount: 1 });
}

async function renderLibrary(
  prepare?: (library: ReturnType<typeof createMemoryProjectLibrary>) => Promise<unknown>,
  options: Parameters<typeof createMemoryProjectLibrary>[0] = {},
) {
  const library = createMemoryProjectLibrary(options);
  await prepare?.(library);
  const application = createApplication({ projectLibrary: library.adapter });
  await application.startupReady;
  const rendered = renderPlannerForInteraction({ application, startWithProject: false });
  const page = await screen.findByRole('region', { name: 'Your plans' });
  await within(page).findByText(/ in the library$/);
  return { ...rendered, application, library, page };
}

const table = () => screen.getByRole('table');
const rowOf = (name: string) =>
  within(table())
    .getByText(name, { selector: '.library-plan-name, .library-folder-name' })
    .closest('tr')!;

describe('Library screen', () => {
  afterEach(cleanup);

  it('starts on the Library and creates a blank plan in the folder shown, which opens', async () => {
    const { application, library, user } = await renderLibrary();
    expect(screen.getByRole('button', { name: 'Library' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(
      screen.getByText('No plans yet. Start one with New plan, or import a plan file.'),
    ).toBeTruthy();
    // Home starts with no plan open.
    expect(application.store.getState().projectWorkspace.kind).toBe('noProject');

    await user.click(screen.getByRole('button', { name: 'New plan' }));
    const dialog = await screen.findByRole('dialog', { name: 'Choose a route' });
    expect(
      within(dialog)
        .getAllByRole('button', { name: /^Create / })
        .map((button) => button.textContent),
    ).toEqual(application.editorNavigation.routes.values.map((route) => route.label));
    await user.click(within(dialog).getByRole('button', { name: 'Create Surface plan' }));
    await waitFor(() =>
      expect(application.store.getState().librarySession.view).toEqual({ kind: 'editor' }),
    );
    expect((await library.plans(catalog)).map((stored) => stored.route.routeKey)).toEqual([
      'Surface',
    ]);

    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(await within(table()).findByText(DEFAULT_PROJECT_NAME)).toBeTruthy();
    // Going Home keeps the plan open.
    expect(application.store.getState().projectWorkspace.kind).toBe('openProject');
  });

  it('lists plans with their route, biomes and slots, and the reason a file cannot open', async () => {
    const { page } = await renderLibrary(async (library) => {
      await library.file(plan('a', 'Erebus opener'));
      await library.adapter.create('{"schemaVersion":120,"projectId":"f","name":"Future"}', '');
    });
    const row = rowOf('Erebus opener');
    expect(within(row).getByText(/^Underworld · /)).toBeTruthy();
    expect(within(row).getByText('1 of 4')).toBeTruthy();
    expect(within(row).getByText(`· ${catalog.biomes.byKey.F!.label}`)).toBeTruthy();
    const future = rowOf('Future');
    expect(
      within(future).getByText('Made by a newer Run Planner (schema 120); update to open it.'),
    ).toBeTruthy();
    expect(within(future).getByRole('button', { name: 'Open Future' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(within(future).getByRole('button', { name: 'Delete Future' })).toHaveProperty(
      'disabled',
      false,
    );
    expect(within(page).getByText('2 plans in the library')).toBeTruthy();
    // The web library has no folder to reveal.
    expect(within(page).queryByRole('button', { name: 'Open folder' })).toBeNull();
  });

  it('duplicates a plan in place and undoes a deletion from its notice', async () => {
    const { user, library } = await renderLibrary(async (library) => {
      await library.file(plan('a', 'Erebus opener'));
    });
    await user.click(screen.getByRole('button', { name: 'Duplicate Erebus opener' }));
    expect(await within(table()).findByText('Erebus opener (copy)')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Delete Erebus opener' }));
    const notice = await screen.findByRole('status');
    expect(notice.textContent).toBe('Deleted “Erebus opener”Undo');
    await waitFor(() => expect(within(table()).queryByText('Erebus opener')).toBeNull());
    await user.click(within(notice).getByRole('button', { name: 'Undo' }));
    expect(await within(table()).findByText('Erebus opener')).toBeTruthy();
    expect((await library.plans(catalog)).map((stored) => stored.projectId).sort()).toEqual([
      'a',
      expect.any(String),
    ]);
  });

  it('imports into the folder shown and says why a file cannot open', async () => {
    const { application, library, user } = await renderLibrary();
    await user.click(screen.getByRole('button', { name: 'Import…' }));
    expect(screen.queryByRole('alert')).toBeNull();

    library.choose({ fileName: 'broken.runplanner.json', json: '{not json' });
    await user.click(screen.getByRole('button', { name: 'Import…' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Open file failed: $: must be valid JSON',
    );
    expect(application.store.getState().projectWorkspace.kind).toBe('noProject');

    library.choose({
      fileName: 'surface.runplanner.json',
      json: encodeProjectDocument(plan('outside', 'Outside', 'Surface')),
    });
    await user.click(screen.getByRole('button', { name: 'Import…' }));
    await waitFor(() =>
      expect(application.store.getState().projectWorkspace.history?.present.name).toBe('Outside'),
    );
  });

  it('offers the earlier file once and opens it when imported', async () => {
    const previous = {
      fileName: 'Earlier.runplanner.json',
      json: encodeProjectDocument({ ...createCompleteFGProject(), projectId: 'earlier' }),
    };
    const { application, library, page, user } = await renderLibrary(undefined, {
      previousFile: previous,
    });
    const offer = within(page).getByRole('region', { name: 'Import Earlier.runplanner.json?' });
    await user.click(within(offer).getByRole('button', { name: 'Import' }));
    await waitFor(() =>
      expect(application.store.getState().projectWorkspace.history?.present.projectId).toBe(
        'earlier',
      ),
    );
    cleanup();

    const again = createApplication({ projectLibrary: library.adapter });
    await again.startupReady;
    expect(again.store.getState().librarySession.previousFileOffer).toBeNull();
    expect(again.store.getState().projectWorkspace.kind).toBe('noProject');
  });

  it('nests folders, moves plans between them and restores a deleted folder', async () => {
    const { user } = await renderLibrary(async (library) => {
      await library.file(plan('a', 'Erebus opener'));
      await library.file(plan('b', 'Typhon practice', 'Surface'), 'Practice/Bosses');
    });
    await user.click(screen.getByRole('button', { name: 'New folder' }));
    const name = await screen.findByRole('dialog', { name: 'New folder' });
    await user.type(within(name).getByRole('textbox', { name: 'Folder name' }), 'Practice');
    await user.click(within(name).getByRole('button', { name: 'Create' }));
    expect((await within(name).findByRole('alert')).textContent).toBe(
      'Folder failed: A folder named “Practice” is already here.',
    );
    await user.clear(within(name).getByRole('textbox', { name: 'Folder name' }));
    await user.type(within(name).getByRole('textbox', { name: 'Folder name' }), 'Speedrun');
    await user.click(within(name).getByRole('button', { name: 'Create' }));
    expect(await screen.findByRole('button', { name: 'Open folder Speedrun' })).toBeTruthy();
    expect(within(rowOf('Practice')).getByText(/1 plan$/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Move Erebus opener' }));
    const move = await screen.findByRole('dialog', { name: 'Erebus opener' });
    expect(within(move).getByRole('radio', { name: /Library/ })).toHaveProperty('disabled', true);
    await user.click(within(move).getByRole('radio', { name: 'Bosses' }));
    await user.click(within(move).getByRole('button', { name: 'Move to Practice › Bosses' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Erebus opener' })).toBeNull());
    await waitFor(() => expect(within(table()).queryByText('Erebus opener')).toBeNull());

    await user.click(screen.getByRole('button', { name: 'Open folder Practice' }));
    await user.click(await screen.findByRole('button', { name: 'Open folder Bosses' }));
    const crumbs = screen.getByRole('navigation', { name: 'Folder' });
    expect(crumbs.textContent).toBe('Library›Practice›Bosses');
    expect(within(table()).getByText('Erebus opener')).toBeTruthy();
    expect(within(table()).getByText('Typhon practice')).toBeTruthy();
    await user.click(within(crumbs).getByRole('button', { name: 'Practice' }));

    await user.click(await screen.findByRole('button', { name: 'Rename folder Bosses' }));
    const rename = await screen.findByRole('dialog', { name: 'Rename folder' });
    const field = within(rename).getByRole('textbox', { name: 'Folder name' });
    await user.clear(field);
    await user.type(field, 'Boss fights');
    await user.click(within(rename).getByRole('button', { name: 'Rename' }));
    expect(await screen.findByRole('button', { name: 'Open folder Boss fights' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Delete folder Boss fights' }));
    const notice = await screen.findByRole('status');
    expect(notice.textContent).toBe('Deleted folder “Boss fights”Undo');
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Open folder Boss fights' })).toBeNull(),
    );
    await user.click(within(notice).getByRole('button', { name: 'Undo' }));
    await user.click(await screen.findByRole('button', { name: 'Open folder Boss fights' }));
    expect(await within(table()).findByText('Erebus opener')).toBeTruthy();
  });

  it('searches the whole library by name or route, naming each result’s folder', async () => {
    const { application, user } = await renderLibrary(async (library) => {
      await library.file(plan('a', 'Erebus practice'));
      await library.file(plan('b', 'Typhon practice', 'Surface'), 'Practice/Bosses');
      await library.file(plan('c', 'Fresh run', 'FreshFile'), 'Practice');
    });
    const chips = screen.getByRole('group', { name: 'Show' });
    expect(
      within(chips)
        .getAllByRole('button')
        .map((chip) => chip.textContent),
    ).toEqual([
      'All',
      ...application.editorNavigation.routes.values.map((route) => route.label),
      'In game',
    ]);

    await user.type(screen.getByRole('searchbox', { name: 'Search plans by name' }), 'practice');
    expect(screen.getByRole('navigation', { name: 'Folder' }).textContent).toBe('Whole library');
    expect(
      within(rowOf('Typhon practice')).getByRole('button', { name: 'in Practice › Bosses' }),
    ).toBeTruthy();
    expect(
      within(rowOf('Erebus practice')).getByRole('button', { name: 'in Library' }),
    ).toBeTruthy();
    expect(within(table()).queryByText('Fresh run')).toBeNull();

    await user.clear(screen.getByRole('searchbox', { name: 'Search plans by name' }));
    await user.click(
      within(chips).getByRole('button', { name: catalog.routes.byKey.FreshFile!.label }),
    );
    expect(
      within(chips)
        .getByRole('button', { name: catalog.routes.byKey.FreshFile!.label })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(within(table()).getAllByRole('row')).toHaveLength(2);
    await user.click(within(rowOf('Fresh run')).getByRole('button', { name: 'in Practice' }));
    // Opening a result's folder leaves the search.
    expect(screen.getByRole('navigation', { name: 'Folder' }).textContent).toBe('Library›Practice');
    expect(within(chips).getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });
});

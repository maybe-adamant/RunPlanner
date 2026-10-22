import { createProjectAddress, createProjectDocument } from '@run-planner/engine/authored-project';
import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it, vi } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { routePanelSelected } from '@planner/state/editorSessionSlice';
import { libraryFolderChanged, viewChanged } from '@planner/state/librarySessionSlice';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import {
  installNavigationHistory,
  type NavigationHistoryEnvironment,
  type NavigationLocation,
} from '@planner/workspace/navigationHistory';
import { createMemoryProjectLibrary } from '@planner-test/support/memoryProjectLibrary';

// A History stack in memory whose back and forward announce popstate, as a browser does.
function createFakeHistory() {
  const entries: unknown[] = [null];
  let index = 0;
  const listeners = new Map<string, Set<(event: never) => void>>();
  const timers: (() => void)[] = [];
  const pop = () => {
    for (const listener of listeners.get('popstate') ?? []) {
      listener({ state: entries[index] } as never);
    }
  };
  const environment: NavigationHistoryEnvironment = {
    history: {
      get state() {
        return entries[index];
      },
      pushState(state: unknown) {
        entries.splice(index + 1);
        entries.push(state);
        index += 1;
      },
      replaceState(state: unknown) {
        entries[index] = state;
      },
      back() {
        if (index === 0) return;
        index -= 1;
        pop();
      },
      forward() {
        if (index === entries.length - 1) return;
        index += 1;
        pop();
      },
    } as NavigationHistoryEnvironment['history'],
    addEventListener: ((type: string, listener: (event: never) => void) => {
      listeners.set(type, (listeners.get(type) ?? new Set()).add(listener));
    }) as Window['addEventListener'],
    removeEventListener: ((type: string, listener: (event: never) => void) => {
      listeners.get(type)?.delete(listener);
    }) as Window['removeEventListener'],
    setTimeout: (callback) => timers.push(callback),
  };
  return {
    environment,
    locations: () =>
      entries.map((entry) => (entry as { location?: NavigationLocation } | null)?.location),
    index: () => index,
    dispatch: (type: string, event: object) => {
      for (const listener of listeners.get(type) ?? []) listener(event as never);
    },
    runTimers: () => timers.splice(0).forEach((timer) => timer()),
  };
}

async function setUp() {
  const library = createMemoryProjectLibrary();
  const key = await library.file(
    createProjectDocument(catalog, {
      projectId: 'p-erebus',
      name: 'Erebus run',
      routeKey: 'Underworld',
      configuredBiomeCount: 1,
    }),
  );
  const application = createApplication({ projectLibrary: library.adapter });
  await application.startupReady;
  const fake = createFakeHistory();
  const uninstall = installNavigationHistory({
    store: application.store,
    operations: application.projectOperations,
    environment: fake.environment,
    explicitBackForward: true,
  });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  // The user's own navigation: their input, then what it does.
  const userNavigates = async (navigation: () => unknown) => {
    fake.dispatch('pointerdown', {});
    await navigation();
    await settle();
  };
  return { application, fake, key, library, settle, uninstall, userNavigates };
}

describe('navigation history', () => {
  it('pushes one entry per navigation and restores each on back and forward', async () => {
    const { application, fake, key, userNavigates } = await setUp();
    const { store } = application;
    expect(fake.locations()).toEqual([{ view: 'home', tab: 'library', folder: '' }]);

    await userNavigates(() => store.dispatch(viewChanged({ kind: 'home', tab: 'game' })));
    // A change that leaves the location as it is pushes nothing.
    await userNavigates(() => store.dispatch(viewChanged({ kind: 'home', tab: 'game' })));
    await userNavigates(() => {
      store.dispatch(viewChanged({ kind: 'home', tab: 'library' }));
      store.dispatch(libraryFolderChanged('Practice'));
    });
    await userNavigates(() => application.projectOperations.openPlan(key));
    await userNavigates(() =>
      store.dispatch(routePanelSelected({ routeKey: 'Underworld', panel: { kind: 'loadout' } })),
    );
    const editor = { view: 'editor', plan: { key, projectId: 'p-erebus' } };
    expect(fake.locations()).toEqual([
      { view: 'home', tab: 'library', folder: '' },
      { view: 'home', tab: 'game' },
      { view: 'home', tab: 'library', folder: 'Practice' },
      { ...editor, section: { kind: 'route' } },
      { ...editor, section: { kind: 'loadout' } },
    ]);

    fake.environment.history.back();
    await vi.waitFor(() =>
      expect(store.getState().editorSession.activePanel).toEqual({ kind: 'route' }),
    );
    fake.environment.history.back();
    await vi.waitFor(() =>
      expect(store.getState().librarySession.view).toEqual({ kind: 'home', tab: 'library' }),
    );
    expect(store.getState().librarySession.libraryFolder).toBe('Practice');
    // The plan stays open on Home, and restoring pushed no entries of its own.
    expect(store.getState().projectWorkspace.kind).toBe('openProject');
    expect(fake.locations()).toHaveLength(5);

    fake.environment.history.forward();
    fake.environment.history.forward();
    await vi.waitFor(() =>
      expect(store.getState().editorSession.activePanel).toEqual({ kind: 'loadout' }),
    );
    expect(store.getState().librarySession.view).toEqual({ kind: 'editor' });
    expect(fake.index()).toBe(4);
  });

  it('opens a plan again from history, and shows the Library when it is gone', async () => {
    const { application, fake, key, userNavigates } = await setUp();
    const { store } = application;
    await userNavigates(() => application.projectOperations.openPlan(key));
    await userNavigates(() => store.dispatch(viewChanged({ kind: 'home', tab: 'library' })));
    // Deleting the plan closes it; its editor entry stays behind.
    await userNavigates(() => application.projectOperations.deletePlan(key));

    fake.environment.history.back();
    await vi.waitFor(() =>
      expect(store.getState().librarySession.navigationNotice).toBe(
        'That plan is no longer in the library, so the Library is shown.',
      ),
    );
    expect(store.getState().librarySession.view).toEqual({ kind: 'home', tab: 'library' });
    // The entry now names where back landed.
    expect(fake.locations()[fake.index()]).toMatchObject({ view: 'home', tab: 'library' });
  });

  it('stays on the open plan and says why when it cannot be saved before going back', async () => {
    const { application, fake, key, library, userNavigates } = await setUp();
    const { store } = application;
    const other = await library.file(
      createProjectDocument(catalog, {
        projectId: 'p-surface',
        name: 'Surface run',
        routeKey: 'Surface',
      }),
    );
    await userNavigates(() => application.projectOperations.openPlan(key));
    await userNavigates(() => application.projectOperations.openPlan(other));
    library.failWrites(new Error('disk full'));
    store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'RenameProject',
        project: createProjectAddress(),
        name: 'Edited',
      }),
    );

    fake.environment.history.back();
    await vi.waitFor(() =>
      expect(store.getState().librarySession.navigationNotice).toBe(
        'Open plan failed: Could not save the current plan: disk full',
      ),
    );
    expect(store.getState().librarySession.view).toEqual({ kind: 'editor' });
    expect(application.projectOperations.openKey()).toBe(other);
    expect(fake.locations()[fake.index()]).toMatchObject({ plan: { key: other } });
  });

  it('steps back on the back mouse button only when the host did not', async () => {
    const { application, fake, userNavigates } = await setUp();
    await userNavigates(() =>
      application.store.dispatch(viewChanged({ kind: 'home', tab: 'settings' })),
    );
    expect(fake.index()).toBe(1);

    fake.dispatch('mouseup', { button: 3 });
    fake.runTimers();
    await vi.waitFor(() =>
      expect(application.store.getState().librarySession.view).toEqual({
        kind: 'home',
        tab: 'library',
      }),
    );
    expect(fake.index()).toBe(0);

    // The host's own navigation arrives first, so the app does not step again.
    fake.dispatch('keydown', { altKey: true, key: 'ArrowRight' });
    fake.environment.history.forward();
    fake.runTimers();
    expect(fake.index()).toBe(1);
  });
  it('keeps the entries ahead when a restored editor corrects its section by itself', async () => {
    const { application, fake, key, userNavigates } = await setUp();
    const { store } = application;
    await userNavigates(() => application.projectOperations.openPlan(key));
    await userNavigates(() =>
      store.dispatch(routePanelSelected({ routeKey: 'Underworld', panel: { kind: 'loadout' } })),
    );
    await userNavigates(() => store.dispatch(viewChanged({ kind: 'home', tab: 'library' })));
    await userNavigates(() => store.dispatch(viewChanged({ kind: 'home', tab: 'game' })));
    expect(fake.locations()).toHaveLength(5);

    fake.environment.history.back();
    fake.environment.history.back();
    await vi.waitFor(() =>
      expect(store.getState().librarySession.view).toEqual({ kind: 'editor' }),
    );
    await vi.waitFor(() => expect(fake.index()).toBe(2));
    // Once the restore settles, the editor shows another section without the user's input,
    // as when the restored section is no longer available.
    store.dispatch(routePanelSelected({ routeKey: 'Underworld', panel: { kind: 'route' } }));
    await vi.waitFor(() =>
      expect(fake.locations()[2]).toMatchObject({ section: { kind: 'route' } }),
    );
    expect(fake.locations()).toHaveLength(5);

    fake.environment.history.forward();
    await vi.waitFor(() =>
      expect(store.getState().librarySession.view).toEqual({ kind: 'home', tab: 'library' }),
    );
    fake.environment.history.forward();
    await vi.waitFor(() =>
      expect(store.getState().librarySession.view).toEqual({ kind: 'home', tab: 'game' }),
    );
    expect(fake.index()).toBe(4);
  });

  it('keeps the entries ahead when the Library changes its folder by itself after back', async () => {
    const { application, fake, key, userNavigates } = await setUp();
    const { store } = application;
    await userNavigates(() => store.dispatch(libraryFolderChanged('Practice')));
    await userNavigates(() => application.projectOperations.openPlan(key));
    expect(fake.locations()).toHaveLength(3);

    fake.environment.history.back();
    await vi.waitFor(() =>
      expect(store.getState().librarySession.view).toEqual({ kind: 'home', tab: 'library' }),
    );
    await vi.waitFor(() => expect(fake.index()).toBe(1));
    store.dispatch(libraryFolderChanged(''));
    await vi.waitFor(() => expect(fake.locations()[1]).toMatchObject({ folder: '' }));

    fake.environment.history.forward();
    await vi.waitFor(() =>
      expect(store.getState().librarySession.view).toEqual({ kind: 'editor' }),
    );
    expect(fake.index()).toBe(2);
    expect(fake.locations()).toHaveLength(3);

    // The user's next navigation still pushes.
    await userNavigates(() => store.dispatch(viewChanged({ kind: 'home', tab: 'settings' })));
    expect(fake.locations()).toHaveLength(4);
  });
});

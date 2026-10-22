import { routePanelSelected, settingsSelected, type RoutePanel } from '../state/editorSessionSlice';
import {
  libraryFolderChanged,
  navigationNoticeShown,
  viewChanged,
  type HomeTab,
} from '../state/librarySessionSlice';
import { selectPresentProject, type PlannerStore, type RootState } from '../state/store';
import type { ProjectOperations } from './projectOperations';

/** Where the app is: a Home tab (with the Library's folder), or a plan's editor and section. */
export type NavigationLocation =
  | { readonly view: 'home'; readonly tab: HomeTab; readonly folder?: string }
  | {
      readonly view: 'editor';
      readonly plan: { readonly key: string; readonly projectId: string };
      readonly section: { readonly kind: 'settings' } | RoutePanel;
    };

/** The slice of the History API navigation uses; a browser window's `history` satisfies it. */
export interface NavigationHistoryEnvironment {
  readonly history: Pick<History, 'pushState' | 'replaceState' | 'state' | 'back' | 'forward'>;
  readonly addEventListener: Window['addEventListener'];
  readonly removeEventListener: Window['removeEventListener'];
  readonly setTimeout: (callback: () => void, ms: number) => unknown;
}

const ENTRY_FORMAT = 'run-planner-navigation';
/** How long a back or forward key or mouse button waits for the host's own navigation. */
const NATIVE_NAVIGATION_GRACE_MS = 120;

interface HistoryEntry {
  readonly format: typeof ENTRY_FORMAT;
  readonly location: NavigationLocation;
}

function entryOf(state: unknown): HistoryEntry | null {
  return typeof state === 'object' &&
    state !== null &&
    (state as { format?: unknown }).format === ENTRY_FORMAT
    ? (state as HistoryEntry)
    : null;
}

/** The location the store shows, or null while the editor shows no stored plan. */
export function currentNavigationLocation(
  state: RootState,
  openKey: string | null,
): NavigationLocation | null {
  const view = state.librarySession.view;
  if (view.kind === 'home') {
    return view.tab === 'library'
      ? { view: 'home', tab: 'library', folder: state.librarySession.libraryFolder }
      : { view: 'home', tab: view.tab };
  }
  const project = selectPresentProject(state);
  if (project === undefined || openKey === null) return null;
  const session = state.editorSession;
  return {
    view: 'editor',
    plan: { key: openKey, projectId: project.projectId },
    section: session.activeSection === 'settings' ? { kind: 'settings' } : session.activePanel,
  };
}

const sameLocation = (left: NavigationLocation | null, right: NavigationLocation | null) =>
  JSON.stringify(left) === JSON.stringify(right);

/**
 * Mirrors app navigation into the History API: each change of Home tab, Library folder, open
 * plan or editor section pushes one entry, and back or forward restores the entry's location.
 * Navigation is UI-session state; authored history and Undo are untouched.
 */
export function installNavigationHistory(options: {
  readonly store: PlannerStore;
  readonly operations: ProjectOperations;
  readonly environment: NavigationHistoryEnvironment;
  /**
   * Also answers the back and forward mouse buttons and Alt+←/→ when the host has not
   * navigated by itself shortly after, for a WebView that may not.
   */
  readonly explicitBackForward?: boolean;
}): () => void {
  const { store, operations, environment } = options;
  const { history } = environment;
  const locate = () => currentNavigationLocation(store.getState(), operations.openKey());
  let shown = locate();
  // Restores run one after another; navigation made meanwhile is theirs, not the user's.
  let restoring = 0;
  let restored: Promise<void> = Promise.resolve();
  let popped = 0;

  const write = (location: NavigationLocation, push: boolean) => {
    const entry: HistoryEntry = { format: ENTRY_FORMAT, location };
    if (push) history.pushState(entry, '');
    else history.replaceState(entry, '');
    shown = location;
  };
  if (shown !== null) write(shown, false);

  // Changes are read once the dispatching task settles: one navigation may dispatch several
  // actions, and an opened plan's key is known only after its document is published.
  let pending = false;
  const sync = () => {
    pending = false;
    if (restoring > 0) return;
    const location = locate();
    if (location === null || sameLocation(location, shown)) return;
    write(location, shown !== null);
  };
  const unsubscribe = store.subscribe(() => {
    if (restoring > 0 || pending) return;
    pending = true;
    queueMicrotask(sync);
  });

  const restoreSection = (section: Extract<NavigationLocation, { view: 'editor' }>['section']) => {
    if (section.kind === 'settings') {
      store.dispatch(settingsSelected());
      return;
    }
    const routeKey = selectPresentProject(store.getState())?.route.routeKey;
    if (routeKey === undefined) return;
    try {
      store.dispatch(routePanelSelected({ routeKey, panel: section }));
    } catch {
      // A section the plan no longer has stays where the editor opened.
    }
  };

  const restore = async (location: NavigationLocation) => {
    const leavingEditor = store.getState().librarySession.view.kind === 'editor';
    if (location.view === 'home') {
      if (leavingEditor) await operations.flush();
      store.dispatch(viewChanged({ kind: 'home', tab: location.tab }));
      if (location.folder !== undefined) store.dispatch(libraryFolderChanged(location.folder));
      return;
    }
    const { key, projectId } = location.plan;
    if (operations.openKey() !== key) {
      // A renamed or moved plan is found again by its identity.
      const items = (await operations.listLibrary()).items;
      const item =
        items.find((candidate) => candidate.key === key) ??
        items.find((candidate) => candidate.kind === 'ready' && candidate.projectId === projectId);
      const opened =
        item === undefined || item.kind !== 'ready' ? null : await operations.openPlan(item.key);
      if (opened === null || opened.status !== 'success') {
        store.dispatch(viewChanged({ kind: 'home', tab: 'library' }));
        store.dispatch(
          navigationNoticeShown('That plan is no longer in the library, so the Library is shown.'),
        );
        return;
      }
    } else {
      store.dispatch(viewChanged({ kind: 'editor' }));
    }
    restoreSection(location.section);
  };

  const popState = (event: PopStateEvent) => {
    popped += 1;
    const entry = entryOf(event.state);
    if (entry === null) return;
    restoring += 1;
    restored = restored
      .then(() => restore(entry.location))
      .catch(() => undefined)
      .finally(() => {
        restoring -= 1;
        if (restoring > 0) return;
        // The entry names where the app now is, which differs when a plan could not open.
        const location = locate();
        if (location !== null && !sameLocation(location, entry.location)) write(location, false);
        shown = location;
      });
  };
  environment.addEventListener('popstate', popState);

  // Back or forward, unless the host navigated by itself within the grace period.
  const step = (direction: 'back' | 'forward') => {
    const before = popped;
    environment.setTimeout(() => {
      if (popped === before) history[direction]();
    }, NATIVE_NAVIGATION_GRACE_MS);
  };
  const mouseUp = (event: MouseEvent) => {
    if (event.button === 3) step('back');
    else if (event.button === 4) step('forward');
  };
  const keyDown = (event: KeyboardEvent) => {
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'ArrowLeft') step('back');
    else if (event.key === 'ArrowRight') step('forward');
  };
  if (options.explicitBackForward === true) {
    environment.addEventListener('mouseup', mouseUp);
    environment.addEventListener('keydown', keyDown);
  }

  return () => {
    unsubscribe();
    environment.removeEventListener('popstate', popState);
    environment.removeEventListener('mouseup', mouseUp);
    environment.removeEventListener('keydown', keyDown);
  };
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { invoke as tauriInvoke, isTauri } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';

import { installDevBrowserErrorReporter } from './diagnostics/devBrowserErrorReporter';
import { createBrowserProjectLibraryAdapter } from './persistence/browserProjectLibraryAdapter';
import { createTauriProjectLibraryAdapter } from './persistence/tauriProjectLibraryAdapter';
import { createBrowserLegacyAutosave } from './persistence/legacyAutosave';
import { installNavigationHistory } from './workspace/navigationHistory';
import { createTauriGameModuleHost } from './persistence/gameModuleHost';
import {
  createBrowserEventDismissalPreference,
  createTauriCommunityEventDevelopmentHost,
  createTauriCommunityEventHost,
} from './persistence/communityEventHost';
import { createApplication } from './composition/createApplication';
import { viewChanged } from './state/librarySessionSlice';
import { selectEditorShown } from './state/store';
import { createTauriCatalogFeedHost } from './persistence/catalogFeedHost';
import { createBrowserRecordingPreference, createTauriRecordHost } from './persistence/recordHost';
import { createWorkerRunImporter } from './workspace/run-recording/runImport';
import { createWorkerDraftRunner } from './workspace/draftRun';
import { unloadNeedsConfirmation } from './workspace/closeRequest';
import './ui/styles.css';
import { App } from './ui/shell/App';
import { ApplicationFaultBoundary } from './ui/shell/ApplicationFaultBoundary';
import { createBrowserAppScalePreference } from './persistence/appScalePreference';
import { createBrowserLoadoutPresets } from './persistence/loadoutPresets';
import type { BuildIdentity } from './composition/buildIdentity';
import {
  createBrowserReleaseSkipPreference,
  createReleaseUpdateController,
  createTauriReleaseUpdateHost,
} from './persistence/releaseUpdates';

declare const __RUN_PLANNER_BUILD_IDENTITY__: BuildIdentity;

const devBrowserErrorReporter = installDevBrowserErrorReporter();
const rootElement = document.getElementById('root');
const tauriHost = isTauri();
const appScalePreference = createBrowserAppScalePreference(() => globalThis.localStorage);
const projectLibrary = tauriHost
  ? createTauriProjectLibraryAdapter({
      invoke: tauriInvoke,
      openDialog: (options) =>
        open({ directory: false, filters: options.filters, multiple: true, title: options.title }),
      readTextFile,
    })
  : createBrowserProjectLibraryAdapter({
      document: globalThis.document,
      indexedDB: () => globalThis.indexedDB,
    });

if (rootElement === null) {
  throw new Error('Run Planner root element is missing');
}

const application = createApplication({
  buildIdentity: __RUN_PLANNER_BUILD_IDENTITY__,
  draftRunner: createWorkerDraftRunner(
    () => new Worker(new URL('./workspace/draftWorker.ts', import.meta.url), { type: 'module' }),
  ),
  projectLibrary,
  legacyAutosave: createBrowserLegacyAutosave(() => globalThis.localStorage),
  ...(tauriHost
    ? {
        catalogFeedHost: createTauriCatalogFeedHost(),
        communityEventDevelopmentHost: createTauriCommunityEventDevelopmentHost(),
        communityEventHost: createTauriCommunityEventHost(),
        eventDismissals: createBrowserEventDismissalPreference(() => globalThis.localStorage),
        gameModuleHost: createTauriGameModuleHost(),
        recordHost: createTauriRecordHost(),
        recordingPreference: createBrowserRecordingPreference(() => globalThis.localStorage),
        runImporter: createWorkerRunImporter(
          () =>
            new Worker(new URL('./workspace/run-recording/runImportWorker.ts', import.meta.url), {
              type: 'module',
            }),
        ),
      }
    : {}),
});

await application.startupReady;

// Pending edits are written before the window closes or the page is hidden; a close asks first
// only while those edits still cannot be saved.
if (tauriHost) {
  const closeWhenWritten = async (): Promise<void> => {
    for (;;) {
      await tauriInvoke('app_close_requested');
      await tauriInvoke('app_close_acknowledged');
      const close = await application.closeRequest.request(() => tauriInvoke('app_close_kept'));
      if (close) {
        await tauriInvoke('app_close_ready');
        return;
      }
    }
  };
  void closeWhenWritten();
} else {
  globalThis.window.addEventListener('beforeunload', (event) => {
    if (unloadNeedsConfirmation(application.store, application.projectOperations)) {
      // The prompt gives the pending write time to finish.
      void application.projectOperations.flush();
      event.preventDefault();
    }
  });
}
globalThis.document.addEventListener('visibilitychange', () => {
  if (globalThis.document.visibilityState === 'hidden') {
    void application.projectOperations.flush();
  }
});

const releaseUpdates =
  tauriHost && __RUN_PLANNER_BUILD_IDENTITY__.version !== 'Development'
    ? createReleaseUpdateController({
        buildIdentity: __RUN_PLANNER_BUILD_IDENTITY__,
        host: createTauriReleaseUpdateHost(),
        saveBeforeInstall: () => application.projectOperations.flush(),
        skipPreference: createBrowserReleaseSkipPreference(() => globalThis.localStorage),
      })
    : undefined;

createRoot(rootElement, devBrowserErrorReporter?.rootOptions).render(
  <StrictMode>
    <Provider store={application.store}>
      <ApplicationFaultBoundary
        {...(application.bugReport === undefined ? {} : { bugReport: application.bugReport })}
        editorOpen={() => selectEditorShown(application.store.getState())}
        returnToLibrary={() =>
          application.store.dispatch(viewChanged({ kind: 'home', tab: 'library' }))
        }
        reload={() => {
          void application.projectOperations.flush().finally(() => {
            application.dispose();
            globalThis.window.location.reload();
          });
        }}
      >
        <App
          appScalePreference={appScalePreference}
          loadoutPresets={createBrowserLoadoutPresets(
            application.catalog,
            () => globalThis.localStorage,
          )}
          {...(application.bugReport === undefined ? {} : { bugReport: application.bugReport })}
          buildIdentity={application.buildIdentity}
          catalog={application.catalog}
          catalogSummary={application.catalogSummary}
          closeRequest={application.closeRequest}
          draftRun={application.draftRun}
          editorNavigation={application.editorNavigation}
          {...(application.communityEvents === undefined
            ? {}
            : { communityEvents: application.communityEvents })}
          {...(application.gameStatus === undefined ? {} : { gameStatus: application.gameStatus })}
          {...(application.planCatalog === undefined
            ? {}
            : { planCatalog: application.planCatalog })}
          {...(application.slotRebuild === undefined
            ? {}
            : { slotRebuild: application.slotRebuild })}
          projectOperations={application.projectOperations}
          selectStructuredWorkspace={application.selectStructuredWorkspace}
          {...(releaseUpdates === undefined ? {} : { releaseUpdates })}
        />
      </ApplicationFaultBoundary>
    </Provider>
  </StrictMode>,
);

installNavigationHistory({
  store: application.store,
  operations: application.projectOperations,
  environment: {
    history: globalThis.history,
    addEventListener: globalThis.addEventListener.bind(globalThis),
    removeEventListener: globalThis.removeEventListener.bind(globalThis),
    setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  },
  // Whether the desktop WebView turns these into history steps by itself is not known for
  // every platform, so the app steps when it has not.
  explicitBackForward: tauriHost,
});
releaseUpdates?.checkAutomatically();
void application.communityEvents?.sync();
void application.planCatalog?.sync();
// Recording reports its own failures in its status; a failed resume leaves it off.
void application.recording?.start().catch(() => undefined);

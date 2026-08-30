import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { isTauri } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

import { installDevBrowserErrorReporter } from './diagnostics/devBrowserErrorReporter';
import { createBrowserProfileFileAdapter } from './persistence/browserProfileFileAdapter';
import { createTauriProfileFileAdapter } from './persistence/tauriProfileFileAdapter';
import { createTauriGamePlanPublisher } from './persistence/gamePlanPublisher';
import {
  createBrowserAutosaveRecoveryAdapter,
  createBrowserAutosaveScheduler,
} from './persistence/browserAutosaveRecoveryAdapter';
import { createApplication } from './composition/createApplication';
import './ui/styles.css';
import { App } from './ui/shell/App';
import { ApplicationFaultBoundary } from './ui/shell/ApplicationFaultBoundary';

const devBrowserErrorReporter = installDevBrowserErrorReporter();
const rootElement = document.getElementById('root');
const autosaveRecovery = createBrowserAutosaveRecoveryAdapter({
  storage: () => globalThis.localStorage,
});
const profileFile = isTauri()
  ? createTauriProfileFileAdapter({
      open: (options) =>
        open({
          directory: false,
          filters: options.filters.map((filter) => ({
            extensions: [...filter.extensions],
            name: filter.name,
          })),
          multiple: false,
          title: options.title,
        }),
      readTextFile,
      save: (options) =>
        save({
          ...(options.defaultPath === undefined ? {} : { defaultPath: options.defaultPath }),
          filters: options.filters.map((filter) => ({
            extensions: [...filter.extensions],
            name: filter.name,
          })),
          title: options.title,
        }),
      writeTextFile,
    })
  : createBrowserProfileFileAdapter({
      Blob: globalThis.Blob,
      URL: globalThis.URL,
      document: globalThis.document,
    });

if (rootElement === null) {
  throw new Error('Run Planner root element is missing');
}

const application = createApplication({
  autosaveRecovery,
  autosaveScheduler: createBrowserAutosaveScheduler<number>({
    clearTimeout: (handle) => globalThis.window.clearTimeout(handle),
    setTimeout: (task, delayMs) => globalThis.window.setTimeout(task, delayMs),
  }),
  profileFile,
  ...(isTauri() ? { gamePlanPublisher: createTauriGamePlanPublisher() } : {}),
});

createRoot(rootElement, devBrowserErrorReporter?.rootOptions).render(
  <StrictMode>
    <ApplicationFaultBoundary
      discardRecoveryAndReload={() => {
        application.dispose();
        autosaveRecovery.clear();
        globalThis.window.location.reload();
      }}
      exportAutosaveRecovery={() => application.projectOperations.exportAutosaveRecovery()}
      loadProfile={() => application.projectOperations.loadProfile()}
      reload={() => {
        application.dispose();
        globalThis.window.location.reload();
      }}
    >
      <Provider store={application.store}>
        <App
          catalog={application.catalog}
          catalogSummary={application.catalogSummary}
          editorNavigation={application.editorNavigation}
          projectOperations={application.projectOperations}
          selectStructuredWorkspace={application.selectStructuredWorkspace}
        />
      </Provider>
    </ApplicationFaultBoundary>
  </StrictMode>,
);

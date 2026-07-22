import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';

import { createBrowserProfileFileAdapter } from './persistence/browserProfileFileAdapter';
import {
  createBrowserAutosaveRecoveryAdapter,
  createBrowserAutosaveScheduler,
} from './persistence/browserAutosaveRecoveryAdapter';
import { createApplication } from './composition/createApplication';
import './ui/styles.css';
import { App } from './ui/shell/App';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('Run Planner root element is missing');
}

const application = createApplication({
  autosaveRecovery: createBrowserAutosaveRecoveryAdapter({
    storage: () => globalThis.localStorage,
  }),
  autosaveScheduler: createBrowserAutosaveScheduler<number>({
    clearTimeout: (handle) => globalThis.window.clearTimeout(handle),
    setTimeout: (task, delayMs) => globalThis.window.setTimeout(task, delayMs),
  }),
  profileFile: createBrowserProfileFileAdapter({
    Blob: globalThis.Blob,
    URL: globalThis.URL,
    document: globalThis.document,
  }),
});

createRoot(rootElement).render(
  <StrictMode>
    <Provider store={application.store}>
      <App
        candidateProjection={application.candidateProjection}
        catalog={application.catalog}
        catalogSummary={application.catalogSummary}
        editorNavigation={application.editorNavigation}
        projectOperations={application.projectOperations}
      />
    </Provider>
  </StrictMode>,
);

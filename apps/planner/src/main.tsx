import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';

import { createBrowserProfileFileAdapter } from './application/browserProfileFileAdapter';
import { createApplication } from './application/createApplication';
import './styles.css';
import { App } from './ui/App';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('Run Planner root element is missing');
}

const application = createApplication({
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

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';

import { createBrowserProjectPersistenceAdapters } from './application/browserProjectAdapters';
import { createApplication } from './application/createApplication';
import './styles.css';
import { App } from './ui/App';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('Run Planner root element is missing');
}

const application = createApplication({
  projectPersistence: createBrowserProjectPersistenceAdapters(),
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

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';

import { createApplication } from './application/createApplication';
import './styles.css';
import { App } from './ui/App';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('Run Planner root element is missing');
}

const application = createApplication();

createRoot(rootElement).render(
  <StrictMode>
    <Provider store={application.store}>
      <App
        catalog={application.catalog}
        catalogSummary={application.catalogSummary}
        editorNavigation={application.editorNavigation}
      />
    </Provider>
  </StrictMode>,
);

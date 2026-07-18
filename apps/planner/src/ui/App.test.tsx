import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';

import { createApplication } from '../application/createApplication';
import { App } from './App';

describe('App', () => {
  it('renders the planner shell from the composed catalog and store', () => {
    const application = createApplication();
    const markup = renderToStaticMarkup(
      <Provider store={application.store}>
        <App catalogSummary={application.catalogSummary} />
      </Provider>,
    );

    expect(markup).toContain('Run Planner');
    expect(markup).toContain('Underworld');
    expect(markup).toContain('0.1.0-fg-slice-5');
    expect(markup).toContain('Catalog migration active');
  });
});

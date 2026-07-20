import userEvent from '@testing-library/user-event';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';

import { createApplication } from '../application/createApplication';
import { App } from '../ui/App';

export function renderPlannerForInteraction(companion?: ReactNode) {
  const application = createApplication();
  const user = userEvent.setup();
  const view = render(
    <Provider store={application.store}>
      {companion}
      <App
        catalog={application.catalog}
        catalogSummary={application.catalogSummary}
        editorNavigation={application.editorNavigation}
      />
    </Provider>,
  );
  return { application, user, ...view };
}

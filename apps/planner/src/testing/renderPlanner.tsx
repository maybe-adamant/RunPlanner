import userEvent from '@testing-library/user-event';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';

import { createApplication, type PlannerApplication } from '../composition/createApplication';
import { App } from '../ui/App';

interface RenderPlannerOptions {
  readonly application?: PlannerApplication;
  readonly companion?: ReactNode;
}

export function renderPlannerForInteraction(options: RenderPlannerOptions = {}) {
  const application = options.application ?? createApplication();
  const user = userEvent.setup();
  const view = render(
    <Provider store={application.store}>
      {options.companion}
      <App
        candidateProjection={application.candidateProjection}
        catalog={application.catalog}
        catalogSummary={application.catalogSummary}
        editorNavigation={application.editorNavigation}
        projectOperations={application.projectOperations}
      />
    </Provider>,
  );
  return { application, user, ...view };
}

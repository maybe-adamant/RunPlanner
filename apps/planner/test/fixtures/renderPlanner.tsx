import userEvent from '@testing-library/user-event';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';

import { createApplication, type PlannerApplication } from '@planner/composition/createApplication';
import { App } from '@planner/ui/shell/App';

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
        catalog={application.catalog}
        catalogSummary={application.catalogSummary}
        editorNavigation={application.editorNavigation}
        projectOperations={application.projectOperations}
        structuredWorkspace={application.structuredWorkspace}
      />
    </Provider>,
  );
  return { application, user, ...view };
}

import userEvent from '@testing-library/user-event';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';

import { createApplication, type PlannerApplication } from '@planner/composition/createApplication';
import { App } from '@planner/ui/shell/App';

interface RenderPlannerOptions {
  readonly application?: PlannerApplication;
  readonly companion?: ReactNode;
  /** Most editor interaction tests need an explicitly open route. */
  readonly startWithProject?: boolean;
}

/** Creates the explicit open-project state used by editor interaction tests. */
export function createOpenTestApplication(routeKey = 'Underworld'): PlannerApplication {
  const application = createApplication();
  application.projectOperations.createNew(routeKey);
  return application;
}

export function renderPlannerForInteraction(options: RenderPlannerOptions = {}) {
  const application =
    options.application ??
    (options.startWithProject === false ? createApplication() : createOpenTestApplication());
  const user = userEvent.setup();
  const view = render(
    <Provider store={application.store}>
      {options.companion}
      <App
        catalog={application.catalog}
        catalogSummary={application.catalogSummary}
        editorNavigation={application.editorNavigation}
        projectOperations={application.projectOperations}
        selectStructuredWorkspace={application.selectStructuredWorkspace}
      />
    </Provider>,
  );
  return { application, user, ...view };
}

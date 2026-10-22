import userEvent from '@testing-library/user-event';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';

import { createApplication, type PlannerApplication } from '@planner/composition/createApplication';
import { createProjectDocument } from '@run-planner/engine/authored-project';
import { App } from '@planner/ui/shell/App';
import { createMemoryProjectLibrary } from '@planner-test/support/memoryProjectLibrary';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';

interface RenderPlannerOptions {
  readonly application?: PlannerApplication;
  readonly companion?: ReactNode;
  /** Most editor interaction tests need an explicitly open route. */
  readonly startWithProject?: boolean;
}

/** Creates a loadout-only fixture; user-facing new projects start with one biome. */
export function createOpenTestApplication(routeKey = 'Underworld'): PlannerApplication {
  const application = createApplication();
  application.store.dispatch(
    authoredProjectReplaced(
      createProjectDocument(application.catalog, {
        projectId: 'run-plan',
        routeKey,
        configuredBiomeCount: 0,
      }),
    ),
  );
  return application;
}

export function renderPlannerForInteraction(options: RenderPlannerOptions = {}) {
  const application =
    options.application ??
    (options.startWithProject === false
      ? createApplication({ projectLibrary: createMemoryProjectLibrary().adapter })
      : createOpenTestApplication());
  const user = userEvent.setup();
  const view = render(
    <Provider store={application.store}>
      {options.companion}
      <App
        catalog={application.catalog}
        catalogSummary={application.catalogSummary}
        draftRun={application.draftRun}
        buildIdentity={application.buildIdentity}
        editorNavigation={application.editorNavigation}
        {...(application.bugReport === undefined ? {} : { bugReport: application.bugReport })}
        {...(application.communityEvents === undefined
          ? {}
          : { communityEvents: application.communityEvents })}
        {...(application.gameStatus === undefined ? {} : { gameStatus: application.gameStatus })}
        {...(application.planCatalog === undefined ? {} : { planCatalog: application.planCatalog })}
        {...(application.slotRebuild === undefined ? {} : { slotRebuild: application.slotRebuild })}
        projectOperations={application.projectOperations}
        selectStructuredWorkspace={application.selectStructuredWorkspace}
      />
    </Provider>,
  );
  return { application, user, ...view };
}

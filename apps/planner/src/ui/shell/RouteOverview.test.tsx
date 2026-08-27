import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import { createRouteAddress } from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { projectFeedbackHierarchy } from '@planner/projections/evaluationProjection';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { RouteOverview } from './RouteOverview';

function routeOverviewMarkup(application: ReturnType<typeof createApplication>): string {
  const state = application.store.getState();
  const routeKey = 'Underworld';
  const navigation = application.editorNavigation.routes.byKey[routeKey];
  const workspace = application.selectStructuredWorkspace(state);
  const workspaceRoute = workspace.routes.find((route) => route.routeKey === routeKey);
  const feedback = projectFeedbackHierarchy(state.projectWorkspace.assembly.evaluation).routes.get(
    routeKey,
  );
  if (navigation === undefined || workspaceRoute === undefined || feedback === undefined)
    throw new Error('Underworld route products are missing');

  return renderToStaticMarkup(
    <Provider store={application.store}>
      <RouteOverview
        catalog={application.catalog}
        feedback={feedback}
        interactions={workspace.interactions}
        label={navigation.label}
        navigation={navigation}
        project={state.projectWorkspace.history.present}
        workspaceRoute={workspaceRoute}
      />
    </Provider>,
  );
}

describe('RouteOverview', () => {
  it('presents the configured route extent and included biomes', () => {
    const application = createApplication();

    for (const [configuredBiomeCount, extent, description] of [
      [1, 'Through Erebus', 'Configuring Erebus.'],
      [2, 'Through Oceanus', 'Configuring Erebus and Oceanus.'],
      [3, 'Through Fields', 'Configuring Erebus, Oceanus, and Fields.'],
      [4, 'Through Tartarus', 'Configuring Erebus, Oceanus, Fields, and Tartarus.'],
    ] as const) {
      application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ConfigureRoutePrefix',
          configuredBiomeCount,
          route: createRouteAddress('Underworld'),
        }),
      );
      const markup = routeOverviewMarkup(application);
      expect(markup).toContain(extent);
      expect(markup).toContain(description);
    }

    expect(routeOverviewMarkup(application)).not.toContain('contiguous route prefix');
  });

  it('presents Aspect of Selene Hex controls only for the active aspect', () => {
    const application = createApplication();
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceRouteLoadout',
        route: createRouteAddress('Underworld'),
        weaponKey: 'WeaponSuit',
        aspectKey: 'SuitHexAspect',
      }),
    );
    expect(routeOverviewMarkup(application)).toContain('Hex talent layout');
    expect(routeOverviewMarkup(application)).toContain('God Sent');

    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceRouteLoadout',
        route: createRouteAddress('Underworld'),
        weaponKey: 'WeaponSuit',
        aspectKey: 'BaseSuitAspect',
      }),
    );
    expect(routeOverviewMarkup(application)).not.toContain('Hex talent layout');
  });
});

import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import { createProjectDocument, createRouteAddress } from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { projectFeedbackHierarchy } from '@planner/projections/evaluationProjection';
import { projectRouteNavigation } from '@planner/projections/editorNavigation';
import {
  authoredProjectCommandDispatched,
  authoredProjectReplaced,
} from '@planner/state/projectWorkspaceSlice';
import { RouteOverview } from '@planner/ui/shell/RouteOverview';
import { createOpenTestApplication } from '@planner-test/fixtures/renderPlanner';

function routeOverviewMarkup(application: ReturnType<typeof createApplication>): string {
  const state = application.store.getState();
  const project =
    state.projectWorkspace.kind === 'openProject'
      ? state.projectWorkspace.history.present
      : undefined;
  const navigation =
    project === undefined ? undefined : projectRouteNavigation(application.catalog, project.route);
  const workspace = application.selectStructuredWorkspace(state)!;
  if (
    project === undefined ||
    navigation === undefined ||
    workspace === undefined ||
    state.projectWorkspace.kind !== 'openProject'
  )
    throw new Error('Underworld route products are missing');
  const workspaceRoute = workspace.route;
  const feedback = projectFeedbackHierarchy(state.projectWorkspace.assembly.evaluation).route;

  return renderToStaticMarkup(
    <Provider store={application.store}>
      <RouteOverview
        catalog={application.catalog}
        feedback={feedback}
        interactions={workspace.interactions}
        label={navigation.label}
        navigation={navigation}
        project={project}
        workspaceRoute={workspaceRoute}
      />
    </Provider>,
  );
}

describe('RouteOverview', () => {
  it('keeps a loaded zero-biome project unchanged while offering only positive counts', () => {
    const application = createOpenTestApplication('Underworld');
    const before = application.store.getState().projectWorkspace.history!.present;
    const markup = routeOverviewMarkup(application);
    expect(markup).toContain('Biomes to configure');
    expect(markup).not.toContain('type="radio" name="Underworld-configured-prefix" checked=""');
    expect(markup).not.toContain('value="0"');
    expect(before.route.biomes).toHaveLength(0);
    expect(application.store.getState().projectWorkspace.history!.present).toBe(before);
  });

  it('presents the configured route extent and included biomes', () => {
    const application = createOpenTestApplication('Underworld');

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
      expect(markup).toContain('Biomes to configure');
      expect(markup).toContain(`checked="" value="${configuredBiomeCount}"`);
      expect(markup.indexOf('aria-label="Edit Arcana"')).toBeLessThan(
        markup.indexOf('Biomes to configure'),
      );
    }

    expect(routeOverviewMarkup(application)).not.toContain('contiguous route prefix');
  });

  it('presents Aspect of Selene Hex controls only for the active aspect', () => {
    const application = createOpenTestApplication('Underworld');
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

  it('owns only the independent starting reward in Route Loadout', () => {
    const application = createOpenTestApplication('Underworld');
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ConfigureRoutePrefix',
        configuredBiomeCount: 1,
        route: createRouteAddress('Underworld'),
      }),
    );
    const markup = routeOverviewMarkup(application);
    expect(markup).toContain('>Starting reward</label>');
    expect(markup).not.toContain('aria-label="Starting room"');
    expect(markup).not.toContain('aria-label="Start room configuration"');
  });

  it('shows the full immutable Dream itinerary in Loadout, not only its configured prefix', () => {
    const application = createApplication();
    application.store.dispatch(
      authoredProjectReplaced(
        createProjectDocument(application.catalog, {
          projectId: 'dream-overview',
          routeKey: 'Dream',
          itineraryBiomeKeys: ['Q', 'F', 'N', 'H'],
          configuredBiomeCount: 1,
        }),
      ),
    );

    const markup = routeOverviewMarkup(application);
    expect(markup).toContain('aria-label="Route order"');
    expect(markup).toContain('Summit → Erebus → Ephyra → Fields');
    expect(markup).toContain('Through Summit');
  });

  it('shows the ordinary route order in the same Loadout summary', () => {
    const markup = routeOverviewMarkup(createOpenTestApplication('Underworld'));
    expect(markup).toContain('<strong>Underworld</strong>');
    expect(markup).toContain('Erebus → Oceanus → Fields → Tartarus');
  });
});

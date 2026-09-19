import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import {
  createBiomeAddress,
  createOccurrenceId,
  createRouteAddress,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { projectFeedbackHierarchy } from '@planner/projections/evaluationProjection';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { RouteOverview } from '@planner/ui/shell/RouteOverview';
import { createOpenTestApplication } from '@planner-test/fixtures/renderPlanner';

function routeOverviewMarkup(application: ReturnType<typeof createApplication>): string {
  const state = application.store.getState();
  const routeKey = 'Underworld';
  const navigation = application.editorNavigation.routes.byKey[routeKey];
  const workspace = application.selectStructuredWorkspace(state)!;
  if (
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
        project={state.projectWorkspace.history.present}
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

  it('owns F start creation and its room and reward controls in Route Loadout', () => {
    const application = createOpenTestApplication('Underworld');
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ConfigureRoutePrefix',
        configuredBiomeCount: 1,
        route: createRouteAddress('Underworld'),
      }),
    );
    expect(routeOverviewMarkup(application)).toContain('>Start Erebus</button>');

    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'CreateStart',
        biome: createBiomeAddress('Underworld', 'F'),
        occurrenceId: createOccurrenceId('overview-f-start'),
        gameName: 'F_Opening01',
      }),
    );
    const markup = routeOverviewMarkup(application);
    expect(markup).toContain('aria-label="Start room configuration"');
    expect(markup).toContain('>Room</label>');
    expect(markup).toContain('>Reward</label>');
  });
});

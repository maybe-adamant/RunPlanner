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
import { RouteScopePanel } from '@planner/ui/shell/RouteScopePanel';
import { createOpenTestApplication } from '@planner-test/fixtures/renderPlanner';

function routeProducts(application: ReturnType<typeof createApplication>) {
  const state = application.store.getState();
  const project =
    state.projectWorkspace.kind === 'openProject'
      ? state.projectWorkspace.history.present
      : undefined;
  const workspace = application.selectStructuredWorkspace(state);
  if (
    project === undefined ||
    workspace === undefined ||
    state.projectWorkspace.kind !== 'openProject'
  )
    throw new Error('Route products are missing');
  return { state: state.projectWorkspace, project, workspace };
}

function routeMarkup(application: ReturnType<typeof createApplication>): string {
  const { state, project, workspace } = routeProducts(application);
  const navigation = projectRouteNavigation(application.catalog, project.route);
  const feedback = projectFeedbackHierarchy(state.assembly.evaluation).route;
  return renderToStaticMarkup(
    <Provider store={application.store}>
      <RouteScopePanel
        feedback={feedback}
        label={navigation.label}
        navigation={navigation}
        replacementKey={project.projectId}
        workspaceRoute={workspace.route}
      />
    </Provider>,
  );
}

describe('RouteScopePanel', () => {
  it('keeps a loaded zero-biome project unchanged while offering only positive counts', () => {
    const application = createOpenTestApplication('Underworld');
    const before = application.store.getState().projectWorkspace.history!.present;
    const markup = routeMarkup(application);
    expect(markup).toContain('Biomes to configure');
    expect(markup).not.toContain('type="radio" name="Underworld-configured-prefix" checked=""');
    expect(markup).not.toContain('value="0"');
    expect(before.route.biomes).toHaveLength(0);
    expect(application.store.getState().projectWorkspace.history!.present).toBe(before);
  });

  it('presents the configured route extent and included biomes', () => {
    const application = createOpenTestApplication('Underworld');

    for (const [configuredBiomeCount, extent] of [
      [1, 'Through Erebus'],
      [2, 'Through Oceanus'],
      [3, 'Through Fields'],
      [4, 'Through Tartarus'],
    ] as const) {
      application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ConfigureRoutePrefix',
          configuredBiomeCount,
          route: createRouteAddress('Underworld'),
        }),
      );
      const markup = routeMarkup(application);
      expect(markup).toContain(extent);
      expect(markup).toContain('Plan up to');
      expect(markup).toContain('Biomes to configure');
      expect(markup).toContain(`checked="" value="${configuredBiomeCount}"`);
    }

    expect(routeMarkup(application)).not.toContain('contiguous route prefix');
  });

  it('shows the full immutable Dream itinerary in the Route panel, not only its configured prefix', () => {
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

    const markup = routeMarkup(application);
    expect(
      [...markup.matchAll(/-configured-prefix"[^>]*>([^<]+)<\/label>/g)].map((match) => match[1]),
    ).toEqual(['Summit', 'Erebus', 'Ephyra', 'Fields']);
    expect(markup).toContain('Through Summit');
  });

  it('shows the ordinary route order in the same Route panel', () => {
    const markup = routeMarkup(createOpenTestApplication('Underworld'));
    expect(
      [...markup.matchAll(/-configured-prefix"[^>]*>([^<]+)<\/label>/g)].map((match) => match[1]),
    ).toEqual(['Erebus', 'Oceanus', 'Fields', 'Tartarus']);
  });

  it('hosts Practice mode beside the route extent, including in Fresh File', () => {
    for (const routeKey of ['Underworld', 'FreshFile']) {
      const markup = routeMarkup(createOpenTestApplication(routeKey));
      expect(markup).toContain('Practice mode');
      expect(markup.indexOf('Biomes to configure')).toBeLessThan(markup.indexOf('Practice mode'));
      expect(markup).not.toContain('Starting weapon');
      expect(markup).not.toContain('Enemy gold drop chance');
    }
  });
});

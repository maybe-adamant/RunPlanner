import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import {
  createBiomeAddress,
  createHubDecisionAddress,
  createOccurrenceId,
  createRouteAddress,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { projectFeedbackHierarchy } from '@planner/projections/evaluationProjection';
import { routePanelSelected, semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import {
  authoredProjectCommandDispatched,
  authoredProjectReplaced,
} from '@planner/state/projectWorkspaceSlice';
import {
  loadSurfaceNOPQProject,
  loadSurfaceNResourcesProject,
} from '@run-planner/test-fixtures/surface';
import { RouteWorkspace } from './RouteWorkspace';
import { semanticOwnerElementId } from '../feedback/semanticOwner';
import { createOpenTestApplication } from '@planner-test/fixtures/renderPlanner';

function routeWorkspaceMarkup(
  application: ReturnType<typeof createApplication>,
  routeKey: 'Underworld' | 'Surface',
): string {
  const state = application.store.getState();
  const navigation = application.editorNavigation.routes.byKey[routeKey];
  const workspace = application.selectStructuredWorkspace(state)!;
  if (
    navigation === undefined ||
    workspace === undefined ||
    state.projectWorkspace.kind !== 'openProject'
  )
    throw new Error(`${routeKey} route products are missing`);
  const workspaceRoute = workspace.route;
  const feedback = projectFeedbackHierarchy(state.projectWorkspace.assembly.evaluation).route;

  return renderToStaticMarkup(
    <Provider store={application.store}>
      <RouteWorkspace
        catalog={application.catalog}
        feedback={feedback}
        interactions={workspace.interactions}
        navigation={navigation}
        project={state.projectWorkspace.history.present}
        projectEvaluation={state.projectWorkspace.assembly.evaluation}
        workspace={workspace}
        workspaceRoute={workspaceRoute}
      />
    </Provider>,
  );
}

describe('RouteWorkspace', () => {
  it('hides empty route indexes and presents Route for a stale empty-index selection', () => {
    const application = createOpenTestApplication('Underworld');
    application.store.dispatch(
      routePanelSelected({ routeKey: 'Underworld', panel: { kind: 'npcIndex' } }),
    );

    const markup = routeWorkspaceMarkup(application, 'Underworld');
    expect(markup).not.toContain('>NPCs</button>');
    expect(markup).not.toContain('>Traits</button>');
    expect(markup).not.toContain('>Resources</button>');
    expect(markup).not.toContain('>Shrines</button>');
    expect(markup).not.toContain('>Wells</button>');
    expect(markup).not.toContain('class="panel-navigation-separator"');
    expect(markup).toContain('data-editor-layout="overview"');
    expect(markup).toContain('Route settings');
  });

  it('orders configured biomes before the non-empty route indexes', () => {
    const application = createOpenTestApplication('Surface');
    application.store.dispatch(authoredProjectReplaced(loadSurfaceNOPQProject()));

    const markup = routeWorkspaceMarkup(application, 'Surface');
    const navigationMarkup = markup.slice(markup.indexOf('<nav'), markup.indexOf('</nav>'));
    const routePosition = navigationMarkup.indexOf('>Route</button>');
    const biomePositions = ['Ephyra', 'Thessaly', 'Olympus', 'Summit'].map((label) =>
      navigationMarkup.indexOf(`>${label}</span>`),
    );
    const separatorPosition = navigationMarkup.indexOf('class="panel-navigation-separator"');
    const indexPositions = ['NPCs', 'Traits', 'Resources', 'Shrines', 'Wells']
      .map((label) => navigationMarkup.indexOf(`>${label}</button>`))
      .filter((position) => position >= 0);
    expect(routePosition).toBeGreaterThanOrEqual(0);
    expect(biomePositions.every((position) => position > routePosition)).toBe(true);
    expect(separatorPosition).toBeGreaterThan(Math.max(...biomePositions));
    expect(indexPositions.length).toBeGreaterThan(0);
    expect(indexPositions.every((position) => position > separatorPosition)).toBe(true);
  });

  it('presents a selected resource placement by room name instead of occurrence identity', () => {
    const application = createOpenTestApplication('Surface');
    application.store.dispatch(authoredProjectReplaced(loadSurfaceNResourcesProject()));
    application.store.dispatch(
      routePanelSelected({ routeKey: 'Surface', panel: { kind: 'resources' } }),
    );

    const markup = routeWorkspaceMarkup(application, 'Surface');
    expect(markup).toContain('N · Opening');
    expect(markup).not.toContain('surface-n-opening');
  });

  it('renders a configured biome through the shared workspace rather than a biome-kind editor', () => {
    const application = createOpenTestApplication('Underworld');
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ConfigureRoutePrefix',
        configuredBiomeCount: 1,
        route: createRouteAddress('Underworld'),
      }),
    );
    application.store.dispatch(
      routePanelSelected({ routeKey: 'Underworld', panel: { kind: 'biome', biomeKey: 'F' } }),
    );
    application.store.dispatch(
      authoredProjectCommandDispatched({
        biome: createBiomeAddress('Underworld', 'F'),
        gameName: 'F_Opening01',
        kind: 'CreateStart',
        occurrenceId: createOccurrenceId('app-shared-workspace-start'),
      }),
    );

    const markup = routeWorkspaceMarkup(application, 'Underworld');
    expect(markup).toContain('Route structure');
    expect(markup).toContain('<strong>Opening</strong>');
    expect(markup).toContain('aria-label="Entering Opening 01"');
    expect(markup).not.toContain('<p class="eyebrow">Details</p>');
    expect(markup).toContain('Continue route');
    expect(markup).toContain('data-editor-layout="biome"');
  });

  it('renders N’s Hub through the same workspace shell and preserves its board owners', () => {
    const application = createOpenTestApplication('Surface');
    application.store.dispatch(authoredProjectReplaced(loadSurfaceNOPQProject()));
    application.store.dispatch(
      routePanelSelected({ routeKey: 'Surface', panel: { kind: 'biome', biomeKey: 'N' } }),
    );
    application.store.dispatch(
      semanticOwnerFocused(createHubDecisionAddress(createBiomeAddress('Surface', 'N'), 'hub')),
    );

    const markup = routeWorkspaceMarkup(application, 'Surface');
    expect(markup).toContain('Hub Overview');
    expect(markup).toContain('Open rooms');
    expect(markup).toContain('data-open="true"');
    expect(markup).toContain(
      semanticOwnerElementId(createHubDecisionAddress(createBiomeAddress('Surface', 'N'), 'hub')),
    );
  });
});

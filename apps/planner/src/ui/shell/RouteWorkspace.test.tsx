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
import { loadSurfaceNOPQProject } from '@run-planner/test-fixtures/surface';
import { RouteWorkspace } from './RouteWorkspace';
import { semanticOwnerElementId } from '../feedback/semanticOwner';

function routeWorkspaceMarkup(
  application: ReturnType<typeof createApplication>,
  routeKey: 'Underworld' | 'Surface',
): string {
  const state = application.store.getState();
  const navigation = application.editorNavigation.routes.byKey[routeKey];
  const workspace = application.selectStructuredWorkspace(state);
  const workspaceRoute = workspace.routes.find((route) => route.routeKey === routeKey);
  const feedback = projectFeedbackHierarchy(state.projectWorkspace.assembly.evaluation).routes.get(
    routeKey,
  );
  if (navigation === undefined || workspaceRoute === undefined || feedback === undefined)
    throw new Error(`${routeKey} route products are missing`);

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
  it('renders the route NPC index as a distinct panel, including an empty route', () => {
    const application = createApplication();
    application.store.dispatch(
      routePanelSelected({ routeKey: 'Underworld', panel: { kind: 'npcIndex' } }),
    );

    const markup = routeWorkspaceMarkup(application, 'Underworld');
    expect(application.store.getState().editorSession.activePanelByRoute.Underworld).toEqual({
      kind: 'npcIndex',
    });
    expect(markup).toContain('NPC encounters');
    expect(markup).toContain('No resolved NPC encounters in this route.');
    expect(markup).toContain('data-editor-layout="npcIndex"');
    expect(markup).not.toContain('Route settings');
  });

  it('renders the four-row read-only resource index for the selected route', () => {
    const application = createApplication();
    application.store.dispatch(
      routePanelSelected({ routeKey: 'Surface', panel: { kind: 'resources' } }),
    );

    const markup = routeWorkspaceMarkup(application, 'Surface');
    expect(application.store.getState().editorSession.activePanelByRoute.Surface).toEqual({
      kind: 'resources',
    });
    expect(markup).toContain('Route outcomes');
    expect(markup).toContain('No selected success');
    expect(markup).toContain('Mining');
    expect(markup).toContain('Spirit');
    expect(markup).toContain('Seed');
    expect(markup).toContain('Fishing');
  });

  it('renders the read-only Hermes Shrine route index', () => {
    const application = createApplication();
    application.store.dispatch(
      routePanelSelected({ routeKey: 'Surface', panel: { kind: 'shrines' } }),
    );

    const markup = routeWorkspaceMarkup(application, 'Surface');
    expect(application.store.getState().editorSession.activePanelByRoute.Surface).toEqual({
      kind: 'shrines',
    });
    expect(markup).toContain('Hermes Shrines');
    expect(markup).toContain('No Shrine hosts in this route.');
  });

  it('renders the read-only Stygian Well route index', () => {
    const application = createApplication();
    application.store.dispatch(
      routePanelSelected({ routeKey: 'Underworld', panel: { kind: 'wells' } }),
    );

    const markup = routeWorkspaceMarkup(application, 'Underworld');
    expect(application.store.getState().editorSession.activePanelByRoute.Underworld).toEqual({
      kind: 'wells',
    });
    expect(markup).toContain('Stygian Wells');
    expect(markup).toContain('No Well hosts in this route.');
  });

  it('renders a configured biome through the shared workspace rather than a biome-kind editor', () => {
    const application = createApplication();
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
    const application = createApplication();
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

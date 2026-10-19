import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import {
  createBiomeAddress,
  createHubDecisionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRouteAddress,
  createStartingRewardAddress,
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
import { RouteWorkspace } from '@planner/ui/shell/RouteWorkspace';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { createOpenTestApplication } from '@planner-test/fixtures/renderPlanner';
import type { WorkspaceRoute } from '@planner/projections/structured-workspace';

const navigationOf = (markup: string) =>
  markup.slice(markup.indexOf('<nav'), markup.indexOf('</nav>'));
const separatorCount = (markup: string) =>
  navigationOf(markup).split('class="panel-navigation-separator"').length - 1;

function routeWorkspaceMarkup(
  application: ReturnType<typeof createApplication>,
  routeKey: 'Underworld' | 'Surface',
  adaptRoute: (route: WorkspaceRoute) => WorkspaceRoute = (route) => route,
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
  const workspaceRoute = adaptRoute(workspace.route);
  const feedback = projectFeedbackHierarchy(state.projectWorkspace.assembly.evaluation).route;

  return renderToStaticMarkup(
    <Provider store={application.store}>
      <RouteWorkspace
        catalog={application.catalog}
        draftRun={application.draftRun}
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
    // Only the separator between the fixed panels and the biomes remains.
    expect(separatorCount(markup)).toBe(1);
    expect(markup).toContain('data-editor-layout="route"');
    expect(markup).toContain('Plan up to');
  });

  it('opens on Route and orders Route, Draft and Loadout above the biomes', () => {
    const application = createOpenTestApplication('Underworld');
    const markup = routeWorkspaceMarkup(application, 'Underworld');
    const navigation = navigationOf(markup);
    const positions = ['Route', 'Draft', 'Loadout'].map((label) =>
      navigation.indexOf(`aria-label="${label}"`),
    );
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(navigation.indexOf('class="panel-navigation-separator"')).toBeGreaterThan(positions[2]!);
    expect(navigation).toMatch(/aria-current="page"[^>]*aria-label="Route"/);
    // The run modifiers live in the Route panel, not a panel of their own.
    expect(navigation).not.toContain('aria-label="Modifiers"');
    for (const text of ['Plan up to', 'Run modifiers', 'Enemy gold drop chance', 'Practice mode'])
      expect(markup).toContain(text);
    application.store.dispatch(
      routePanelSelected({ routeKey: 'Underworld', panel: { kind: 'loadout' } }),
    );
    const loadout = routeWorkspaceMarkup(application, 'Underworld');
    expect(loadout).toContain('Starting weapon');
    expect(loadout).not.toContain('Run modifiers');
  });

  it('marks the Loadout panel with its own findings like a biome panel', () => {
    const application = createOpenTestApplication('Underworld');
    expect(navigationOf(routeWorkspaceMarkup(application, 'Underworld'))).toMatch(
      /aria-label="Loadout"[^>]*>.*?aria-label="Valid"[^>]*><span[^>]*data-tone="valid"[^>]*>✓</,
    );
    // Planning Erebus leaves the route-start reward missing, a Loadout finding.
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ConfigureRoutePrefix',
        configuredBiomeCount: 1,
        route: createRouteAddress('Underworld'),
      }),
    );
    const navigation = navigationOf(routeWorkspaceMarkup(application, 'Underworld'));
    // One fixed marker per panel; the count lives only in the description.
    expect(navigation).toMatch(
      /aria-label="Loadout"[^>]*>.*?aria-label="Incomplete, 1 findings"[^>]*><span[^>]*data-tone="incomplete"[^>]*>!<\/span><\/span>/,
    );
    expect(navigation).not.toContain('findings-count');
    for (const label of ['Route', 'Draft'])
      expect(navigation).not.toMatch(
        new RegExp(`aria-label="${label}"[^>]*><span>${label}</span><span[^>]*navigation-feedback`),
      );
  });

  it('orders configured biomes before the non-empty route indexes', () => {
    const application = createOpenTestApplication('Surface');
    application.store.dispatch(authoredProjectReplaced(loadSurfaceNOPQProject()));

    const markup = routeWorkspaceMarkup(application, 'Surface');
    const navigationMarkup = navigationOf(markup);
    const routePosition = navigationMarkup.indexOf('aria-label="Loadout"');
    const biomePositions = ['Ephyra', 'Thessaly', 'Olympus', 'Summit'].map((label) =>
      navigationMarkup.indexOf(`>${label}</span>`),
    );
    const separatorPosition = navigationMarkup.lastIndexOf('class="panel-navigation-separator"');
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
        kind: 'ReplaceStartingReward',
        reward: createStartingRewardAddress('Underworld'),
        value: { rewardType: 'WeaponUpgrade' },
      }),
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
    expect(markup).not.toContain('<p class="eyebrow">Route structure</p>');
    expect(markup).toContain('<strong>Opening</strong>');
    expect(markup).toContain('aria-label="Opening 01"');
    expect(markup).not.toContain('<p class="eyebrow">Details</p>');
    expect(markup).toContain('Continue route');
    expect(markup).toContain('data-editor-layout="biome"');
    expect(markup).toContain('aria-label="Start room configuration"');
  });

  it('shows only the route issue card in a blocked biome view', () => {
    const application = createOpenTestApplication('Underworld');
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ConfigureRoutePrefix',
        configuredBiomeCount: 2,
        route: createRouteAddress('Underworld'),
      }),
    );
    application.store.dispatch(
      routePanelSelected({ routeKey: 'Underworld', panel: { kind: 'biome', biomeKey: 'G' } }),
    );

    const markup = routeWorkspaceMarkup(application, 'Underworld');
    expect(markup).not.toContain('feedback-context-banner');
    const findings = markup.slice(
      markup.indexOf('class="project-findings"'),
      markup.indexOf('</section>', markup.indexOf('class="project-findings"')),
    );
    expect(findings.match(/class="assessment-issue-button"/g)).toHaveLength(1);
    expect(findings).not.toContain('data-feedback-context');
    expect(findings).not.toContain('is blocked');
    // The missing starting reward blocks the route before any biome.
    expect(findings).toContain('Loadout');
  });

  it('keeps the singleton later P entry automatic in its biome workbench', () => {
    const application = createOpenTestApplication('Surface');
    application.store.dispatch(authoredProjectReplaced(loadSurfaceNOPQProject()));
    application.store.dispatch(
      routePanelSelected({ routeKey: 'Surface', panel: { kind: 'biome', biomeKey: 'P' } }),
    );
    application.store.dispatch(
      semanticOwnerFocused(
        createOccurrenceAddress(
          createBiomeAddress('Surface', 'P'),
          createOccurrenceId('surface-p-intro'),
        ),
      ),
    );

    expect(routeWorkspaceMarkup(application, 'Surface')).not.toContain(
      'aria-label="Start room configuration"',
    );
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
    expect(markup).toContain('Ephyra Hub map');
    expect(markup).toContain('data-open="true"');
    expect(markup).toContain(
      semanticOwnerControlElementId(
        createHubDecisionAddress(createBiomeAddress('Surface', 'N'), 'hub'),
      ),
    );
  });
});

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

  it('opens on Route and orders Route, Loadout and Modifiers above the biomes', () => {
    const application = createOpenTestApplication('Underworld');
    const markup = routeWorkspaceMarkup(application, 'Underworld');
    const navigation = navigationOf(markup);
    const positions = ['Route', 'Loadout', 'Modifiers'].map((label) =>
      navigation.indexOf(`aria-label="${label}"`),
    );
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(navigation.indexOf('class="panel-navigation-separator"')).toBeGreaterThan(positions[2]!);
    expect(navigation).toMatch(/aria-current="page"[^>]*aria-label="Route"/);
    for (const [kind, text, absent] of [
      ['loadout', 'Starting weapon', 'Plan up to'],
      ['modifiers', 'Enemy gold drop chance', 'Starting weapon'],
    ] as const) {
      application.store.dispatch(routePanelSelected({ routeKey: 'Underworld', panel: { kind } }));
      const panel = routeWorkspaceMarkup(application, 'Underworld');
      expect(panel).toContain(text);
      expect(panel).not.toContain(absent);
      expect(panel).not.toContain('Practice mode');
    }
  });

  it('offers Modifiers only while a modifier other than Practice mode is declared', () => {
    const application = createOpenTestApplication('Underworld');
    application.store.dispatch(
      routePanelSelected({ routeKey: 'Underworld', panel: { kind: 'modifiers' } }),
    );
    const markup = routeWorkspaceMarkup(application, 'Underworld', (route) => ({
      ...route,
      runModifiers: {
        ...route.runModifiers,
        declarations: route.runModifiers.declarations.filter(
          (declaration) => declaration.kind === 'startPoint',
        ),
      },
    }));
    expect(navigationOf(markup)).not.toContain('aria-label="Modifiers"');
    // A stale Modifiers selection presents Route.
    expect(markup).toContain('data-editor-layout="route"');
  });

  it('marks the Loadout panel with its own findings like a biome panel', () => {
    const application = createOpenTestApplication('Underworld');
    expect(navigationOf(routeWorkspaceMarkup(application, 'Underworld'))).toMatch(
      /aria-label="Loadout"[^>]*>.*?aria-label="Valid"/,
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
    expect(navigation).toMatch(
      /aria-label="Loadout"[^>]*>.*?aria-label="Incomplete, 1 findings"[^>]*>.*?1 Loadout findings/,
    );
    for (const label of ['Route', 'Modifiers'])
      expect(navigation).not.toMatch(
        new RegExp(`aria-label="${label}"[^>]*><span>${label}</span><span[^>]*navigation-feedback`),
      );
  });

  it('orders configured biomes before the non-empty route indexes', () => {
    const application = createOpenTestApplication('Surface');
    application.store.dispatch(authoredProjectReplaced(loadSurfaceNOPQProject()));

    const markup = routeWorkspaceMarkup(application, 'Surface');
    const navigationMarkup = navigationOf(markup);
    const routePosition = navigationMarkup.indexOf('aria-label="Modifiers"');
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

  it('shows a blocked biome through the findings panel instead of a context banner', () => {
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
    expect(findings).toContain('data-feedback-context="blocked"');
    // The missing starting reward blocks the route before any biome.
    expect(findings).toContain('Oceanus is blocked at Loadout');
    expect(findings).toContain('Finish the earlier biomes before this biome can be evaluated.');
    expect(findings.indexOf('Oceanus is blocked at ')).toBeLessThan(
      findings.lastIndexOf('class="assessment-issue-button"'),
    );
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

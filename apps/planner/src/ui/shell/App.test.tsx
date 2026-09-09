import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import {
  applyProjectCommand,
  createBiomeAddress,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createHubOpenSetAddress,
  createRouteAddress,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { createInitialProject } from '@planner/composition/projectBootstrap';
import { newProjectCreated } from '@planner/state/profileSessionSlice';
import {
  findingSelected,
  routePanelSelected,
  routeSelected,
  settingsSelected,
} from '@planner/state/editorSessionSlice';
import { semanticFindingKey } from '@planner/projections/evaluationProjection';
import {
  authoredProjectCommandDispatched,
  authoredProjectReplaced,
} from '@planner/state/projectWorkspaceSlice';
import {
  loadSurfaceNEntryFrontierResolvedProject,
  nOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import { createOpenTestApplication } from '@planner-test/fixtures/renderPlanner';
import { App } from './App';
import { semanticOwnerControlElementId } from '../feedback/semanticOwner';

function appMarkup(application: ReturnType<typeof createApplication>): string {
  return renderToStaticMarkup(
    <Provider store={application.store}>
      <App
        catalog={application.catalog}
        catalogSummary={application.catalogSummary}
        editorNavigation={application.editorNavigation}
        projectOperations={application.projectOperations}
        selectStructuredWorkspace={application.selectStructuredWorkspace}
      />
    </Provider>,
  );
}

function findingsMarkup(markup: string): string {
  const match = /<section class="project-findings"[\s\S]*?<\/section>/.exec(markup);
  if (match === null) throw new Error('Findings panel is missing');
  return match[0];
}

function configureF(application: ReturnType<typeof createApplication>): void {
  application.store.dispatch(
    newProjectCreated(createInitialProject(application.catalog, 'Underworld')),
  );
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
}

describe('App', () => {
  it('renders the planner shell from the composed catalog and store', () => {
    const application = createApplication();
    const markup = appMarkup(application);

    expect(markup).toContain('Run Planner');
    expect(markup).toContain('Choose your route');
    expect(markup).toContain('Erebus → Oceanus → Fields → Tartarus');
    expect(markup).toContain('Underworld');
    expect(markup).toContain('Surface');
    expect(markup).not.toContain('Settings');
    expect(markup).not.toContain('Hades II Run Director');
    expect(markup).not.toContain('Project editor');
  });

  it('keeps project information out of the route workspace', () => {
    const application = createOpenTestApplication();
    const markup = appMarkup(application);

    expect(markup).toContain('class="project-findings"');
    expect(markup).toContain('class="app-route-identity">Underworld');
    expect(markup).toContain('About</button>');
    expect(markup).not.toContain('Planner sections');
    expect(markup).not.toContain('<h2>Settings</h2>');
  });

  it('limits Findings to the selected route', () => {
    const application = createApplication();
    application.store.dispatch(
      newProjectCreated(createInitialProject(application.catalog, 'Underworld')),
    );
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ConfigureRoutePrefix',
        configuredBiomeCount: 1,
        route: createRouteAddress('Underworld'),
      }),
    );

    expect(findingsMarkup(appMarkup(application))).toContain('Erebus');
    expect(findingsMarkup(appMarkup(application))).not.toContain('Ephyra');
  });

  it('navigates an incomplete finding to its exact shared-workspace frontier without authoring history', () => {
    const application = createApplication();
    configureF(application);
    const finding = application.store.getState().projectWorkspace.assembly!.evaluation.findings[0];
    if (finding === undefined) throw new Error('configured F should have an incomplete finding');

    application.store.dispatch(settingsSelected());
    const historyBeforeNavigation = application.store.getState().projectWorkspace.history!;
    application.store.dispatch(
      findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
    );

    const markup = appMarkup(application);
    expect(finding.code).toBe('biomeTopologyMissing');
    expect(application.store.getState().editorSession.activeSection).toBe('route');
    expect(application.store.getState().editorSession.activePanel).toEqual({
      kind: 'biome',
      biomeKey: 'F',
    });
    expect(application.store.getState().projectWorkspace.history!).toBe(historyBeforeNavigation);
    expect(markup).toContain('Start this biome');
    expect(markup).toContain('Create its opening room before building the route.');
    expect(markup).toContain(semanticOwnerControlElementId(finding.origin));
    expect(markup).not.toContain('biomeTopologyMissing');
  });

  it('navigates a Hub open-set completeness finding to the exact board owner', () => {
    const application = createApplication();
    const biome = createBiomeAddress('Surface', 'N');
    const preHubDecision = createExitDecisionAddress(biome, {
      kind: 'occurrence',
      occurrenceId: nOccurrenceIds.preHub,
    });
    const project = applyProjectCommand(
      loadSurfaceNEntryFrontierResolvedProject(),
      application.catalog,
      {
        decision: preHubDecision,
        hub: createHubDecisionAddress(biome, 'hub'),
        kind: 'ReplaceWithHubDecision',
      },
    );
    application.store.dispatch(authoredProjectReplaced(project));
    const finding = application.store
      .getState()
      .projectWorkspace.assembly!.evaluation.findings.find(
        (candidate) => candidate.code === 'hubOpenSetIncomplete',
      );
    if (finding === undefined) throw new Error('fresh N Hub board has no open-set finding');
    const historyBeforeNavigation = application.store.getState().projectWorkspace.history!;

    application.store.dispatch(settingsSelected());
    application.store.dispatch(
      findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
    );

    const openSet = createHubOpenSetAddress(biome, 'hub');
    const markup = appMarkup(application);
    expect(finding.origin).toEqual(openSet);
    expect(application.store.getState().editorSession.focusedSemanticOwner).toEqual(openSet);
    expect(application.store.getState().projectWorkspace.history!).toBe(historyBeforeNavigation);
    expect(markup).toContain('Hub Overview');
    expect(markup).toContain(semanticOwnerControlElementId(openSet));
  });

  it('keeps route navigation outside authored history', () => {
    const application = createOpenTestApplication();
    application.store.dispatch(
      routePanelSelected({ routeKey: 'Underworld', panel: { kind: 'overview' } }),
    );
    expect(appMarkup(application)).toContain('Route settings');

    application.store.dispatch(routeSelected('Underworld'));
    expect(appMarkup(application)).toContain('Route settings');
    expect(application.store.getState().projectWorkspace.history!.past).toEqual([]);
  });
});

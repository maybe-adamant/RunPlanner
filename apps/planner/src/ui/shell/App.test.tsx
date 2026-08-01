import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import {
  createBiomeAddress,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createHubOpenSetAddress,
  createOccurrenceId,
  createRouteAddress,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import { createApplication } from '../../composition/createApplication';
import {
  findingSelected,
  routePanelSelected,
  routeSelected,
  semanticOwnerFocused,
  settingsSelected,
} from '../../state/editorSessionSlice';
import { semanticFindingKey } from '../../projections/evaluationProjection';
import {
  authoredProjectCommandDispatched,
  authoredProjectReplaced,
} from '../../state/projectWorkspaceSlice';
import { createRepresentativeNOPQProject } from '@run-planner/test-fixtures';
import { App } from './App';
import { semanticOwnerElementId } from '../feedback/semanticOwner';

function appMarkup(application: ReturnType<typeof createApplication>): string {
  return renderToStaticMarkup(
    <Provider store={application.store}>
      <App
        catalog={application.catalog}
        catalogSummary={application.catalogSummary}
        editorNavigation={application.editorNavigation}
        projectOperations={application.projectOperations}
        structuredWorkspace={application.structuredWorkspace}
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
    authoredProjectCommandDispatched({
      kind: 'ConfigureRoutePrefix',
      configuredBiomeCount: 1,
      route: createRouteAddress('Underworld'),
    }),
  );
  application.store.dispatch(routePanelSelected({ routeKey: 'Underworld', biomeKey: 'F' }));
}

describe('App', () => {
  it('renders the planner shell from the composed catalog and store', () => {
    const application = createApplication();
    const markup = appMarkup(application);

    expect(markup).toContain('Run Planner');
    expect(markup).toContain('Underworld');
    expect(markup).toContain('Surface');
    expect(markup).toContain('Settings');
    expect(markup).toContain('Erebus');
    expect(markup).toContain('Route settings');
    expect(markup).toContain('0 configured');
    expect(markup).toContain('Project editor');
    expect(markup).toContain('Empty project');
    expect(markup).toContain('Findings');
    expect(markup).toContain('Configure a biome in this route to begin simulation.');
    expect(markup).toContain('data-editor-layout="overview"');
  });

  it('shows Findings only for the selected route, not Settings', () => {
    const application = createApplication();

    expect(appMarkup(application)).toContain('class="project-findings"');

    application.store.dispatch(settingsSelected());

    expect(appMarkup(application)).not.toContain('class="project-findings"');
  });

  it('limits Findings to the selected route', () => {
    const application = createApplication();
    for (const routeKey of ['Underworld', 'Surface'] as const) {
      application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ConfigureRoutePrefix',
          configuredBiomeCount: 1,
          route: createRouteAddress(routeKey),
        }),
      );
    }

    application.store.dispatch(routeSelected('Underworld'));
    expect(findingsMarkup(appMarkup(application))).toContain('Erebus');
    expect(findingsMarkup(appMarkup(application))).not.toContain('Ephyra');

    application.store.dispatch(routeSelected('Surface'));
    expect(findingsMarkup(appMarkup(application))).toContain('Ephyra');
    expect(findingsMarkup(appMarkup(application))).not.toContain('Erebus');
  });

  it('renders a configured biome through the shared workspace rather than a biome-kind editor', () => {
    const application = createApplication();
    configureF(application);
    application.store.dispatch(
      authoredProjectCommandDispatched({
        biome: createBiomeAddress('Underworld', 'F'),
        gameName: 'F_Opening01',
        kind: 'CreateStart',
        occurrenceId: createOccurrenceId('app-shared-workspace-start'),
      }),
    );

    const markup = appMarkup(application);
    expect(markup).toContain('Biome structure');
    expect(markup).toContain('Opening 01');
    expect(markup).toContain('Focused inspector');
    expect(markup).toContain('Continue authoring here');
    expect(markup).toContain('data-editor-layout="biome"');
  });

  it('renders N’s Hub through the same workspace shell and preserves its board owners', () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createRepresentativeNOPQProject()));
    application.store.dispatch(routePanelSelected({ routeKey: 'Surface', biomeKey: 'N' }));
    application.store.dispatch(
      semanticOwnerFocused(createHubDecisionAddress(createBiomeAddress('Surface', 'N'), 'hub')),
    );

    const markup = appMarkup(application);
    expect(markup).toContain('Open Ephyra rooms');
    expect(markup).toContain('Pylon visit order');
    expect(markup).toContain('data-open="true"');
    expect(markup).toContain(
      semanticOwnerElementId(createHubDecisionAddress(createBiomeAddress('Surface', 'N'), 'hub')),
    );
  });

  it('navigates an incomplete finding to its exact shared-workspace frontier without authoring history', () => {
    const application = createApplication();
    configureF(application);
    const finding = application.store.getState().projectWorkspace.evaluation.findings[0];
    if (finding === undefined) throw new Error('configured F should have an incomplete finding');

    application.store.dispatch(settingsSelected());
    const historyBeforeNavigation = application.store.getState().projectWorkspace.history;
    application.store.dispatch(
      findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
    );

    const markup = appMarkup(application);
    expect(finding.code).toBe('biomeTopologyMissing');
    expect(application.store.getState().editorSession.activeRouteKey).toBe('Underworld');
    expect(application.store.getState().editorSession.activeBiomeKeyByRoute.Underworld).toBe('F');
    expect(application.store.getState().projectWorkspace.history).toBe(historyBeforeNavigation);
    expect(markup).toContain('Start this biome');
    expect(markup).toContain('Choose a starting room before building its route.');
    expect(markup).toContain(semanticOwnerElementId(finding.origin));
    expect(markup).not.toContain('biomeTopologyMissing');
  });

  it('navigates a Hub open-set completeness finding to the exact board owner', () => {
    const application = createApplication();
    const biome = createBiomeAddress('Surface', 'N');
    const opening = createOccurrenceId('app-n-open-set-opening');
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ConfigureRoutePrefix',
        configuredBiomeCount: 1,
        route: createRouteAddress('Surface'),
      }),
    );
    application.store.dispatch(
      authoredProjectCommandDispatched({ kind: 'CreateStart', biome, occurrenceId: opening }),
    );
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'CreateLinkedExit',
        decision: createExitDecisionAddress(biome, { kind: 'occurrence', occurrenceId: opening }),
        occurrenceId: createOccurrenceId('app-n-open-set-prehub'),
      }),
    );
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'CreateHubDecision',
        hub: createHubDecisionAddress(biome, 'hub'),
      }),
    );
    const finding = application.store
      .getState()
      .projectWorkspace.evaluation.findings.find(
        (candidate) => candidate.code === 'hubOpenSetIncomplete',
      );
    if (finding === undefined) throw new Error('fresh N Hub board has no open-set finding');
    const historyBeforeNavigation = application.store.getState().projectWorkspace.history;

    application.store.dispatch(settingsSelected());
    application.store.dispatch(
      findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
    );

    const openSet = createHubOpenSetAddress(biome, 'hub');
    const markup = appMarkup(application);
    expect(finding.origin).toEqual(openSet);
    expect(application.store.getState().editorSession.focusedSemanticOwner).toEqual(openSet);
    expect(application.store.getState().projectWorkspace.history).toBe(historyBeforeNavigation);
    expect(markup).toContain('Open Ephyra rooms');
    expect(markup).toContain(semanticOwnerElementId(openSet));
  });

  it('keeps route and settings navigation outside authored history', () => {
    const application = createApplication();
    application.store.dispatch(routePanelSelected({ routeKey: 'Underworld', biomeKey: null }));
    expect(appMarkup(application)).toContain('Route settings');

    application.store.dispatch(routeSelected('Surface'));
    expect(appMarkup(application)).toContain('0 configured');
    expect(application.store.getState().projectWorkspace.history.past).toEqual([]);
  });
});

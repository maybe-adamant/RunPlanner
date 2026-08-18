import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import {
  createBiomeAddress,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createHubOpenSetAddress,
  createOccurrenceId,
  createRouteAddress,
  createTargetAddress,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import {
  findingSelected,
  routePanelSelected,
  routeSelected,
  semanticOwnerFocused,
  settingsSelected,
} from '@planner/state/editorSessionSlice';
import { semanticFindingKey } from '@planner/projections/evaluationProjection';
import {
  authoredProjectCommandDispatched,
  authoredProjectReplaced,
} from '@planner/state/projectWorkspaceSlice';
import { createRepresentativeNOPQProject } from '@run-planner/test-fixtures';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures';
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
    expect(markup).toContain('Underworld');
    expect(markup).toContain('Surface');
    expect(markup).toContain('Settings');
    expect(markup).toContain('Erebus');
    expect(markup).toContain('Route settings');
    expect(markup).toContain('Configure route up to');
    expect(markup).toContain('No biomes');
    expect(markup).toContain('No biomes configured.');
    expect(markup).toContain('Project editor');
    expect(markup).toContain('Empty project');
    expect(markup).toContain('Findings');
    expect(markup).toContain('Configure a biome in this route to begin simulation.');
    expect(markup).toContain('data-editor-layout="overview"');
  });

  it('renders the route NPC index as a distinct panel, including an empty route', () => {
    const application = createApplication();
    application.store.dispatch(
      routePanelSelected({ routeKey: 'Underworld', panel: { kind: 'npcIndex' } }),
    );

    const markup = appMarkup(application);
    expect(application.store.getState().editorSession.activePanelByRoute.Underworld).toEqual({
      kind: 'npcIndex',
    });
    expect(markup).toContain('NPC encounters');
    expect(markup).toContain('No resolved NPC encounters in this route.');
    expect(markup).toContain('data-editor-layout="npcIndex"');
    expect(markup).not.toContain('Route settings');
  });

  it('presents the configured route extent and included biomes', () => {
    const application = createApplication();
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ConfigureRoutePrefix',
        configuredBiomeCount: 1,
        route: createRouteAddress('Underworld'),
      }),
    );

    expect(appMarkup(application)).toContain('Through Erebus');
    expect(appMarkup(application)).toContain('Configuring Erebus.');

    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ConfigureRoutePrefix',
        configuredBiomeCount: 2,
        route: createRouteAddress('Underworld'),
      }),
    );

    expect(appMarkup(application)).toContain('Through Oceanus');
    expect(appMarkup(application)).toContain('Configuring Erebus and Oceanus.');

    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ConfigureRoutePrefix',
        configuredBiomeCount: 3,
        route: createRouteAddress('Underworld'),
      }),
    );

    const markup = appMarkup(application);
    expect(markup).toContain('Through Fields');
    expect(markup).toContain('Configuring Erebus, Oceanus, and Fields.');
    expect(markup).not.toContain('contiguous route prefix');

    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ConfigureRoutePrefix',
        configuredBiomeCount: 4,
        route: createRouteAddress('Underworld'),
      }),
    );

    expect(appMarkup(application)).toContain('Through Tartarus');
    expect(appMarkup(application)).toContain('Configuring Erebus, Oceanus, Fields, and Tartarus.');
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
    expect(markup).toContain('Route structure');
    expect(markup).toContain('<strong>Opening</strong>');
    expect(markup).toContain('<h3>Opening 01</h3>');
    expect(markup).toContain('Details');
    expect(markup).toContain('Continue route');
    expect(markup).toContain('data-editor-layout="biome"');
  });

  it('renders N’s Hub through the same workspace shell and preserves its board owners', () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createRepresentativeNOPQProject()));
    application.store.dispatch(
      routePanelSelected({ routeKey: 'Surface', panel: { kind: 'biome', biomeKey: 'N' } }),
    );
    application.store.dispatch(
      semanticOwnerFocused(createHubDecisionAddress(createBiomeAddress('Surface', 'N'), 'hub')),
    );

    const markup = appMarkup(application);
    expect(markup).toContain('Hub traversal');
    expect(markup).toContain('Visit order ends here');
    expect(markup).toContain('data-open="true"');
    expect(markup).toContain(
      semanticOwnerElementId(createHubDecisionAddress(createBiomeAddress('Surface', 'N'), 'hub')),
    );
  });

  it('navigates an incomplete finding to its exact shared-workspace frontier without authoring history', () => {
    const application = createApplication();
    configureF(application);
    const finding = application.store.getState().projectWorkspace.assembly.evaluation.findings[0];
    if (finding === undefined) throw new Error('configured F should have an incomplete finding');

    application.store.dispatch(settingsSelected());
    const historyBeforeNavigation = application.store.getState().projectWorkspace.history;
    application.store.dispatch(
      findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
    );

    const markup = appMarkup(application);
    expect(finding.code).toBe('biomeTopologyMissing');
    expect(application.store.getState().editorSession.activeRouteKey).toBe('Underworld');
    expect(application.store.getState().editorSession.activePanelByRoute.Underworld).toEqual({
      kind: 'biome',
      biomeKey: 'F',
    });
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
    const preHub = createOccurrenceId('app-n-open-set-prehub');
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
        kind: 'CreateBatch',
        decision: createExitDecisionAddress(biome, { kind: 'occurrence', occurrenceId: opening }),
      }),
    );
    application.store.dispatch(
      authoredProjectCommandDispatched({
        gameName: 'N_PreHub01',
        kind: 'CreateTarget',
        occurrenceId: preHub,
        target: createTargetAddress(biome, { kind: 'occurrence', occurrenceId: opening }, 'prehub'),
      }),
    );
    const preHubDecision = createExitDecisionAddress(biome, {
      kind: 'occurrence',
      occurrenceId: preHub,
    });
    application.store.dispatch(
      authoredProjectCommandDispatched({ kind: 'CreateBatch', decision: preHubDecision }),
    );
    application.store.dispatch(
      authoredProjectCommandDispatched({
        decision: preHubDecision,
        hub: createHubDecisionAddress(biome, 'hub'),
        kind: 'ReplaceWithHubDecision',
      }),
    );
    const project = application.store.getState().projectWorkspace.history.present;
    application.store.dispatch(authoredProjectReplaced(authorLegalTraitOffers(project)));
    const finding = application.store
      .getState()
      .projectWorkspace.assembly.evaluation.findings.find(
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
    expect(markup).toContain('Hub traversal');
    expect(markup).toContain(semanticOwnerElementId(openSet));
  });

  it('keeps route and settings navigation outside authored history', () => {
    const application = createApplication();
    application.store.dispatch(
      routePanelSelected({ routeKey: 'Underworld', panel: { kind: 'overview' } }),
    );
    expect(appMarkup(application)).toContain('Route settings');

    application.store.dispatch(routeSelected('Surface'));
    expect(appMarkup(application)).toContain('No biomes configured.');
    expect(application.store.getState().projectWorkspace.history.past).toEqual([]);
  });
});

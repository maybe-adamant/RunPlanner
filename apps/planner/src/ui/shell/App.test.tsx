import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import {
  createBiomeAddress,
  createBatchRewardStoreAddress,
  createContinuationAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPickedAddress,
  createRouteAddress,
  createShopOfferAddress,
  createShopPurchaseAddress,
  createTargetAddress,
  decodeProjectDocument,
  semanticAddressKey,
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
import { App } from './App';
import { semanticOwnerElementId } from '../feedback/semanticOwner';

function configureF(application: ReturnType<typeof createApplication>): void {
  application.store.dispatch(
    authoredProjectCommandDispatched({
      kind: 'ConfigureRoutePrefix',
      route: createRouteAddress('Underworld'),
      configuredBiomeCount: 1,
    }),
  );
  application.store.dispatch(routePanelSelected({ routeKey: 'Underworld', biomeKey: 'F' }));
}

describe('App', () => {
  it('renders the planner shell from the composed catalog and store', () => {
    const application = createApplication();
    const markup = renderToStaticMarkup(
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

    expect(markup).toContain('Run Planner');
    expect(markup).toContain('Underworld');
    expect(markup).toContain('Surface');
    expect(markup).toContain('Settings');
    expect(markup).toContain('Erebus');
    expect(markup).toContain('Route settings');
    expect(markup).toContain('0 configured');
    expect(markup).not.toContain('Choose an opening room');
    expect(markup).toContain('Project editor');
    expect(markup).toContain('Empty project');
    expect(markup).toContain('Findings');
    expect(markup).toContain('Configure a biome to begin simulation.');
    expect(application.editorNavigation.routes.byKey.Underworld?.biomePanels).toEqual([
      { biomeKey: 'F', label: 'Erebus' },
      { biomeKey: 'G', label: 'Oceanus' },
      { biomeKey: 'H', label: 'Fields' },
      { biomeKey: 'I', label: 'Tartarus' },
    ]);
    expect(application.editorNavigation.routes.byKey.Surface?.biomePanels).toEqual([
      { biomeKey: 'N', label: 'Ephyra' },
      { biomeKey: 'O', label: 'Thessaly' },
      { biomeKey: 'P', label: 'Olympus' },
      { biomeKey: 'Q', label: 'Summit' },
    ]);
  });

  it('presents incomplete F feedback and navigates to the exact semantic owner', () => {
    const application = createApplication();
    configureF(application);
    const evaluation = application.store.getState().projectWorkspace.evaluation;
    const finding = evaluation.findings[0];
    if (finding === undefined) {
      throw new Error('configured F should have an incomplete finding');
    }

    application.store.dispatch(settingsSelected());
    const historyBeforeNavigation = application.store.getState().projectWorkspace.history;
    application.store.dispatch(
      findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
    );
    const state = application.store.getState();
    const markup = renderToStaticMarkup(
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

    expect(finding.code).toBe('biomeTopologyMissing');
    expect(state.editorSession.activeRouteKey).toBe('Underworld');
    expect(state.editorSession.activeBiomeKeyByRoute.Underworld).toBe('F');
    expect(state.projectWorkspace.history).toBe(historyBeforeNavigation);
    expect(markup).toContain('Start this biome');
    expect(markup).toContain('Choose a starting room before building its route.');
    expect(markup).toContain('aria-label="1 finding"');
    expect(markup).toContain('Start this biome: Choose a starting room before building its route.');
    expect(markup).toContain('Incomplete');
    expect(markup).toContain(semanticOwnerElementId(finding.origin));
    expect(markup).toContain('data-selected="true"');
    expect(markup).not.toContain('biomeTopologyMissing');
    expect(markup).not.toContain('F_Combat');
  });

  it('projects route-local and top-level session navigation without authoring history', () => {
    const application = createApplication();
    application.store.dispatch(routePanelSelected({ routeKey: 'Underworld', biomeKey: null }));
    let markup = renderToStaticMarkup(
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
    expect(markup).toContain('Route settings');
    expect(markup).toContain('0 configured');
    expect(markup).not.toContain('Choose an opening room');

    application.store.dispatch(routeSelected('Surface'));
    markup = renderToStaticMarkup(
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
    expect(markup).toContain('0 configured');
    expect(application.store.getState().projectWorkspace.history.past).toEqual([]);
  });

  it('projects a started F topology from authored application state', () => {
    const application = createApplication();
    configureF(application);
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'CreateStart',
        biome: createBiomeAddress('Underworld', 'F'),
        occurrenceId: createOccurrenceId('test-start'),
        gameName: 'F_Opening01',
      }),
    );
    const markup = renderToStaticMarkup(
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

    expect(markup).toContain('Biome structure');
    expect(markup).toContain('Opening 01');
    expect(markup).toContain('Active frontier');
    expect(markup).toContain('Focused inspector');
  });

  it('projects ordinary decisions, terminal offers, shop state, and retained overflow', () => {
    const application = createApplication();
    configureF(application);
    const biome = createBiomeAddress('Underworld', 'F');
    const startId = createOccurrenceId('test-start');
    const combatId = createOccurrenceId('test-combat');
    const terminalShopId = createOccurrenceId('test-terminal-shop');
    const terminalFreeId = createOccurrenceId('test-terminal-free');
    const dispatchCommand = (command: Parameters<typeof authoredProjectCommandDispatched>[0]) =>
      application.store.dispatch(authoredProjectCommandDispatched(command));

    dispatchCommand({
      kind: 'CreateStart',
      biome,
      occurrenceId: startId,
      gameName: 'F_Opening01',
    });
    dispatchCommand({
      kind: 'CreateBatch',
      continuation: createContinuationAddress(biome, startId),
    });
    dispatchCommand({
      kind: 'CreateTarget',
      target: createTargetAddress(biome, startId, 1),
      occurrenceId: combatId,
      gameName: 'F_Combat02',
    });
    dispatchCommand({
      kind: 'SetPicked',
      picked: createPickedAddress(biome, startId),
      exitIndex: 1,
    });
    dispatchCommand({
      kind: 'CreateTerminalTransition',
      continuation: createContinuationAddress(biome, combatId),
      targetOccurrenceIds: [terminalShopId, terminalFreeId],
    });
    dispatchCommand({
      kind: 'SetTerminalPicked',
      picked: createPickedAddress(biome, combatId),
      exitIndex: 1,
    });
    dispatchCommand({
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(biome, combatId),
      gameName: 'F_Combat01',
    });

    const terminalMarkup = renderToStaticMarkup(
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

    expect(terminalMarkup).toContain('Biome structure');
    expect(terminalMarkup).toContain('Decision 1');
    expect(terminalMarkup).toContain('Combat 01');
    expect(terminalMarkup).toContain('Boon · Apollo');
    expect(terminalMarkup).toContain('Preboss Shop');
    expect(terminalMarkup).toContain('Free Reward');
    expect(terminalMarkup).toContain('Offer 1');
    expect(terminalMarkup).toContain('Purchased');
    expect(terminalMarkup).toContain('Unavailable');
    expect(terminalMarkup).toContain('Remove Unavailable Exits');
    expect(terminalMarkup).toContain(
      semanticOwnerElementId(createContinuationAddress(biome, combatId)),
    );
    expect(terminalMarkup).toContain(
      semanticOwnerElementId(createTargetAddress(biome, combatId, 1)),
    );
    expect(terminalMarkup).toContain(
      semanticOwnerElementId(createShopOfferAddress(biome, terminalShopId, 'MajorNonBoon')),
    );
    expect(terminalMarkup).toContain(
      semanticOwnerElementId(createShopPurchaseAddress(biome, terminalShopId, 'MajorNonBoon')),
    );

    application.store.dispatch(semanticOwnerFocused(createContinuationAddress(biome, startId)));
    const decisionMarkup = renderToStaticMarkup(
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

    expect(decisionMarkup).toContain('Doors from Opening 01');
    expect(decisionMarkup).toContain(
      semanticOwnerElementId(createContinuationAddress(biome, startId)),
    );
    expect(decisionMarkup).toContain(
      semanticOwnerElementId(createTargetAddress(biome, startId, 1)),
    );
    expect(decisionMarkup).toContain(semanticOwnerElementId(createPickedAddress(biome, startId)));
    expect(decisionMarkup).toContain(
      semanticOwnerElementId(createBatchRewardStoreAddress(biome, startId)),
    );
    expect(decisionMarkup).toContain(
      semanticOwnerElementId(createOccurrenceAddress(biome, combatId)),
    );
    expect(decisionMarkup).toContain(
      semanticOwnerElementId(createIncomingRewardAddress(biome, combatId)),
    );
    expect(decisionMarkup).not.toContain(
      semanticAddressKey(createOccurrenceAddress(biome, combatId)),
    );
  });

  it('renders and navigates to a required terminal offer omitted by persisted topology', () => {
    const application = createApplication();
    configureF(application);
    const biome = createBiomeAddress('Underworld', 'F');
    const startId = createOccurrenceId('missing-terminal-start');
    const combatId = createOccurrenceId('missing-terminal-combat');
    const terminalShopId = createOccurrenceId('missing-terminal-shop');
    const terminalFreeId = createOccurrenceId('missing-terminal-free');
    const dispatchCommand = (command: Parameters<typeof authoredProjectCommandDispatched>[0]) =>
      application.store.dispatch(authoredProjectCommandDispatched(command));
    dispatchCommand({
      kind: 'CreateStart',
      biome,
      occurrenceId: startId,
      gameName: 'F_Opening01',
    });
    dispatchCommand({
      kind: 'CreateBatch',
      continuation: createContinuationAddress(biome, startId),
    });
    dispatchCommand({
      kind: 'CreateTarget',
      target: createTargetAddress(biome, startId, 1),
      occurrenceId: combatId,
      gameName: 'F_Combat02',
    });
    dispatchCommand({
      kind: 'SetPicked',
      picked: createPickedAddress(biome, startId),
      exitIndex: 1,
    });
    dispatchCommand({
      kind: 'CreateTerminalTransition',
      continuation: createContinuationAddress(biome, combatId),
      targetOccurrenceIds: [terminalShopId, terminalFreeId],
    });
    dispatchCommand({
      kind: 'SetTerminalPicked',
      picked: createPickedAddress(biome, combatId),
      exitIndex: 1,
    });

    const project = application.store.getState().projectWorkspace.history.present;
    const underworld = project.routes.find((route) => route.routeKey === 'Underworld');
    const plan = underworld?.biomes.find((biomePlan) => biomePlan.biomeKey === 'F');
    if (underworld === undefined || plan?.kind !== 'LinearBiome' || plan.topology === null) {
      throw new Error('terminal omission fixture is incomplete');
    }
    const topology = plan.topology;
    const terminal = topology.continuations.find(
      (continuation) => continuation.kind === 'terminal',
    );
    if (terminal === undefined) {
      throw new Error('terminal omission fixture is incomplete');
    }
    const projectWithMissingOffer = decodeProjectDocument(
      {
        ...project,
        routes: project.routes.map((route) =>
          route.routeKey !== 'Underworld'
            ? route
            : {
                ...route,
                biomes: route.biomes.map((biomePlan) =>
                  biomePlan.biomeKey !== 'F'
                    ? biomePlan
                    : {
                        ...biomePlan,
                        topology: {
                          ...topology,
                          occurrences: topology.occurrences.filter(
                            (occurrence) => occurrence.occurrenceId !== terminalFreeId,
                          ),
                          continuations: topology.continuations.map((continuation) =>
                            continuation !== terminal
                              ? continuation
                              : {
                                  ...continuation,
                                  targets: continuation.targets.filter(
                                    (target) => target.exitIndex !== 2,
                                  ),
                                },
                          ),
                        },
                      },
                ),
              },
        ),
      },
      application.catalog,
    );
    application.store.dispatch(authoredProjectReplaced(projectWithMissingOffer));
    const finding = application.store
      .getState()
      .projectWorkspace.evaluation.findings.find(
        (candidate) =>
          candidate.code === 'targetMissing' &&
          semanticAddressKey(candidate.origin) ===
            semanticAddressKey(createTargetAddress(biome, combatId, 2)),
      );
    if (finding === undefined) {
      throw new Error('missing terminal offer did not produce its target finding');
    }
    application.store.dispatch(
      findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
    );

    const markup = renderToStaticMarkup(
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

    expect(markup).toContain('Missing offer');
    expect(markup).toContain('Terminal decision');
    expect(markup).toContain('Complete the missing offer for this physical exit.');
    expect(markup).toContain(semanticOwnerElementId(createTargetAddress(biome, combatId, 2)));
    expect(markup).toContain('data-selected="true"');
  });

  it('bounds ordinary frontier decisions without bounding the terminal transition', () => {
    const application = createApplication();
    configureF(application);
    const biome = createBiomeAddress('Underworld', 'F');
    const startId = createOccurrenceId('bounded-start');
    const dispatchCommand = (command: Parameters<typeof authoredProjectCommandDispatched>[0]) =>
      application.store.dispatch(authoredProjectCommandDispatched(command));
    dispatchCommand({
      kind: 'CreateStart',
      biome,
      occurrenceId: startId,
      gameName: 'F_Opening01',
    });

    let parentId = startId;
    for (let batchIndex = 0; batchIndex < 10; batchIndex += 1) {
      dispatchCommand({
        kind: 'CreateBatch',
        continuation: createContinuationAddress(biome, parentId),
      });
      const exitCount = batchIndex === 0 ? 1 : 2;
      let pickedId = parentId;
      for (let exitIndex = 1; exitIndex <= exitCount; exitIndex += 1) {
        const targetId = createOccurrenceId(`bounded-${batchIndex}-${exitIndex}`);
        dispatchCommand({
          kind: 'CreateTarget',
          target: createTargetAddress(biome, parentId, exitIndex),
          occurrenceId: targetId,
          gameName: 'F_Combat02',
        });
        if (exitIndex === 1) {
          pickedId = targetId;
        }
      }
      dispatchCommand({
        kind: 'SetPicked',
        picked: createPickedAddress(biome, parentId),
        exitIndex: 1,
      });
      parentId = pickedId;
    }

    const markup = renderToStaticMarkup(
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
    expect(markup).toContain('disabled="" type="button">Add Next Decision');
    expect(markup).toContain('type="button">Go to Preboss');
    expect(markup).not.toContain('disabled="" type="button">Go to Preboss');
  });
});

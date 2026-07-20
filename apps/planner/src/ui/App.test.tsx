import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import {
  createBiomeAddress,
  createContinuationAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPickedAddress,
  createTargetAddress,
} from '@run-planner/core';
import { describe, expect, it } from 'vitest';

import { createApplication } from '../application/createApplication';
import { sectionSelected, underworldPanelSelected } from '../application/editorSessionSlice';
import { authoredProjectCommandDispatched } from '../application/projectWorkspaceSlice';
import { App } from './App';

describe('App', () => {
  it('renders the planner shell from the composed catalog and store', () => {
    const application = createApplication();
    const markup = renderToStaticMarkup(
      <Provider store={application.store}>
        <App
          catalog={application.catalog}
          catalogSummary={application.catalogSummary}
          editorNavigation={application.editorNavigation}
        />
      </Provider>,
    );

    expect(markup).toContain('Run Planner');
    expect(markup).toContain('Underworld');
    expect(markup).toContain('Surface');
    expect(markup).toContain('Settings');
    expect(markup).toContain('Erebus');
    expect(markup).toContain('Choose an opening room');
    expect(markup).toContain('Authored editor smoke');
    expect(application.editorNavigation.routes.Underworld?.biomePanels).toEqual([
      { biomeKey: 'F', label: 'Erebus' },
    ]);
    expect(application.editorNavigation.routes.Surface?.biomePanels).toEqual([]);
  });

  it('projects route-local and top-level session navigation without authoring history', () => {
    const application = createApplication();
    application.store.dispatch(underworldPanelSelected('route'));
    let markup = renderToStaticMarkup(
      <Provider store={application.store}>
        <App
          catalog={application.catalog}
          catalogSummary={application.catalogSummary}
          editorNavigation={application.editorNavigation}
        />
      </Provider>,
    );
    expect(markup).toContain('Route settings');
    expect(markup).toContain('1 configured');
    expect(markup).not.toContain('Choose an opening room');

    application.store.dispatch(sectionSelected('surface'));
    markup = renderToStaticMarkup(
      <Provider store={application.store}>
        <App
          catalog={application.catalog}
          catalogSummary={application.catalogSummary}
          editorNavigation={application.editorNavigation}
        />
      </Provider>,
    );
    expect(markup).toContain('0 configured');
    expect(application.store.getState().projectWorkspace.history.past).toEqual([]);
  });

  it('projects a started F topology from authored application state', () => {
    const application = createApplication();
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
        />
      </Provider>,
    );

    expect(markup).toContain('Starting room');
    expect(markup).toContain('Opening 01');
    expect(markup).toContain('Active frontier');
  });

  it('projects ordinary decisions, terminal offers, shop state, and retained overflow', () => {
    const application = createApplication();
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

    const markup = renderToStaticMarkup(
      <Provider store={application.store}>
        <App
          catalog={application.catalog}
          catalogSummary={application.catalogSummary}
          editorNavigation={application.editorNavigation}
        />
      </Provider>,
    );

    expect(markup).toContain('Doors from Opening 01');
    expect(markup).toContain('Combat 01');
    expect(markup).toContain('Preboss Shop');
    expect(markup).toContain('Free Reward');
    expect(markup).toContain('Offer 1');
    expect(markup).toContain('Purchased');
    expect(markup).toContain('Unavailable');
    expect(markup).toContain('Remove Unavailable Exits');
  });

  it('disables frontier commands that exceed authored topology bounds', () => {
    const application = createApplication();
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
        />
      </Provider>,
    );
    expect(markup).toContain('disabled="" type="button">Add Next Decision');
    expect(markup).toContain('disabled="" type="button">Go to Preboss');
  });
});

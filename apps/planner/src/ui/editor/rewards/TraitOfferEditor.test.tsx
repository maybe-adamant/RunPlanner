// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createApplication,
  type ApplicationEvaluationEvent,
} from '@planner/composition/createApplication';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import { TraitOfferEditor } from './TraitOfferEditor';
import { createGoldenFGHIProject } from '@run-planner/test-fixtures';

afterEach(cleanup);

describe('trait offer editor', () => {
  it('does not evaluate trait eligibility during render', () => {
    const events: ApplicationEvaluationEvent[] = [];
    const application = createApplication({
      observeEvaluationWork: (event) => events.push(event),
    });
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const interaction = [...workspace.interactions.traitOffers.values()][0];
    if (interaction === undefined) throw new Error('trait offer interaction is missing');
    events.length = 0;

    renderToStaticMarkup(
      <Provider store={application.store}>
        <TraitOfferEditor address={interaction.owner} interactions={workspace.interactions} />
      </Provider>,
    );

    expect(events.filter((event) => event?.kind === 'queryBatch')).toEqual([]);
    application.dispose();
  });

  it('loads the edited option only after a deliberate change', async () => {
    const events: ApplicationEvaluationEvent[] = [];
    const application = createApplication({
      observeEvaluationWork: (event) => events.push(event),
    });
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const interaction = [...workspace.interactions.traitOffers.values()][0];
    if (interaction === undefined) throw new Error('trait offer interaction is missing');
    const option = interaction.choices[1];
    if (option === undefined) throw new Error('trait offer choice is missing');

    const view = render(
      <Provider store={application.store}>
        <TraitOfferEditor address={interaction.owner} interactions={workspace.interactions} />
      </Provider>,
    );
    events.length = 0;
    const select = view.getByLabelText('option1 trait') as HTMLSelectElement;
    if (select.value === option.value) {
      throw new Error('trait fixture did not provide a distinct second option');
    }
    select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));

    expect(events.some((event) => event.kind === 'queryBatch')).toBe(true);
    application.dispose();
  });
});

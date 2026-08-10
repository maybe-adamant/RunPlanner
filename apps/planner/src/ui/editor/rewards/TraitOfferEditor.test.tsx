// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createApplication,
  type ApplicationEvaluationEvent,
} from '@planner/composition/createApplication';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import {
  prepareTraitOptionDomain,
  type TraitOptionDomainProjection,
} from '@planner/projections/traitDomainProjection';
import type { WorkspaceTraitOfferInteraction } from '@planner/projections/structured-workspace';
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
    const interaction = [...workspace.interactions.traitOffers.values()].find(
      (candidate) => candidate.giver.providerKind !== 'hammer',
    );
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

  it('loads one focused option domain only when its contextual picker opens', async () => {
    const events: ApplicationEvaluationEvent[] = [];
    const application = createApplication({
      observeEvaluationWork: (event) => events.push(event),
    });
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const interaction = [...workspace.interactions.traitOffers.values()].find(
      (candidate) => candidate.giver.providerKind !== 'hammer',
    );
    if (interaction === undefined) throw new Error('trait offer interaction is missing');
    const user = userEvent.setup();
    render(
      <Provider store={application.store}>
        <TraitOfferEditor address={interaction.owner} interactions={workspace.interactions} />
      </Provider>,
    );
    events.length = 0;
    const trigger = screen.getByLabelText('option1 trait');
    await user.click(trigger);

    const batches = events.filter((event) => event.kind === 'queryBatch');
    const prepared = prepareTraitOptionDomain(
      application.catalog,
      interaction.giver,
      interaction.value,
      'option1',
    );
    expect(batches).toHaveLength(1);
    expect(batches[0]).toEqual(expect.objectContaining({ queryCount: prepared.variants.length }));

    await user.click(trigger);
    await user.click(screen.getByLabelText('option1 rarity'));
    expect(events.filter((event) => event.kind === 'queryBatch')).toEqual(batches);
    await user.click(screen.getByLabelText('option1 rarity'));
    await user.click(trigger);
    expect(events.filter((event) => event.kind === 'queryBatch')).toEqual(batches);
    application.dispose();
  });

  it('ignores a late focused-domain result after a sibling draft revision', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const interaction = [...workspace.interactions.traitOffers.values()].find(
      (candidate) => candidate.giver.providerKind !== 'hammer',
    );
    if (interaction === undefined) throw new Error('ranked trait interaction is missing');
    const trait = interaction.value.options[0]?.traitKey;
    if (trait === undefined) throw new Error('trait offer fixture is missing option1');
    const domain = (label: string): TraitOptionDomainProjection =>
      Object.freeze({
        candidates: Object.freeze([]),
        preferredOptionFor: () => undefined,
        rarityPickerFor: () => undefined,
        traitPicker: Object.freeze({
          sections: Object.freeze([
            Object.freeze({
              collapsible: false,
              items: Object.freeze([
                Object.freeze({
                  disabled: false,
                  key: label,
                  label,
                  selected: true,
                  state: 'possible' as const,
                  value: trait,
                }),
              ]),
              key: label,
              kind: 'category' as const,
              label: 'Available',
            }),
          ]),
        }),
      });
    const stale = domain('Old draft trait');
    const current = domain('Current draft trait');
    let resolveStale: (value: TraitOptionDomainProjection) => void = () => undefined;
    let resolveCurrent: (value: TraitOptionDomainProjection) => void = () => undefined;
    const staleResult = new Promise<TraitOptionDomainProjection>((resolve) => {
      resolveStale = resolve;
    });
    const currentResult = new Promise<TraitOptionDomainProjection>((resolve) => {
      resolveCurrent = resolve;
    });
    const interactions = Object.freeze({
      ...workspace.interactions,
      traitOffers: new Map<string, WorkspaceTraitOfferInteraction>(
        [...workspace.interactions.traitOffers.entries()].map(([key, candidate]) =>
          candidate !== interaction
            ? [key, candidate]
            : [
                key,
                Object.freeze({
                  ...candidate,
                  optionDomain: (value: typeof candidate.value) =>
                    Object.freeze({
                      load: () =>
                        value.selectedOptionKey === 'option1' ? staleResult : currentResult,
                    }),
                }),
              ],
        ),
      ),
    });
    const user = userEvent.setup();
    render(
      <Provider store={application.store}>
        <TraitOfferEditor address={interaction.owner} interactions={interactions} />
      </Provider>,
    );

    const traitTrigger = screen.getByLabelText('option1 trait');
    await user.click(traitTrigger);
    await user.click(screen.getAllByLabelText('Selected')[1]!);
    await user.click(screen.getByLabelText('option1 trait'));

    await act(async () => resolveStale(stale));
    expect(screen.queryByText('Old draft trait')).toBeNull();
    await act(async () => resolveCurrent(current));
    expect(screen.getByText('Current draft trait')).toBeTruthy();
    application.dispose();
  });
});

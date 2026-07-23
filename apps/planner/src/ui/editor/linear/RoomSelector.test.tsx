// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createContinuationAddress,
  createOccurrenceId,
  createOccurrenceAddress,
  createRouteAddress,
  createTargetAddress,
} from '@run-planner/engine/authored-project';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createApplication,
  type ApplicationEvaluationEvent,
} from '../../../composition/createApplication';
import { authoredProjectCommandDispatched } from '../../../state/projectWorkspaceSlice';
import { RoomSelector } from './RoomSelector';

afterEach(cleanup);

describe('RoomSelector', () => {
  it('renders one concrete-room control and follows external room replacement', () => {
    const application = createApplication();
    const biome = createBiomeAddress('Underworld', 'F');
    const startId = createOccurrenceId('selector-start');
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ConfigureRoutePrefix',
        route: createRouteAddress('Underworld'),
        configuredBiomeCount: 1,
      }),
    );
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'CreateStart',
        biome,
        occurrenceId: startId,
        gameName: 'F_Opening01',
      }),
    );
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'CreateBatch',
        continuation: createContinuationAddress(biome, startId),
      }),
    );
    const target = createTargetAddress(biome, startId, 1);
    const combat = catalog.rooms.byKey.F_Combat01;
    const shop = catalog.rooms.byKey.F_Shop01;
    if (combat === undefined || shop === undefined) {
      throw new Error('F selector declarations are missing');
    }
    const targetOccurrenceId = createOccurrenceId('selector-target');
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'CreateTarget',
        target,
        occurrenceId: targetOccurrenceId,
        gameName: combat.gameName,
      }),
    );
    const contextual = () => {
      const state = application.store.getState().projectWorkspace;
      return application.structuredWorkspace.project(state.history.present, state.evaluation)
        .contextual;
    };
    const view = render(
      <Provider store={application.store}>
        <RoomSelector
          contextual={contextual()}
          idPrefix="selector"
          onSelect={() => undefined}
          owner={target}
        />
      </Provider>,
    );

    expect(screen.queryByLabelText('Type')).toBeNull();
    expect(screen.getByLabelText('Room').textContent).toContain(combat.label);
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceOccurrenceRoom',
        occurrence: createOccurrenceAddress(biome, targetOccurrenceId),
        gameName: shop.gameName,
      }),
    );
    view.rerender(
      <Provider store={application.store}>
        <RoomSelector
          contextual={contextual()}
          idPrefix="selector"
          onSelect={() => undefined}
          owner={target}
        />
      </Provider>,
    );

    expect(screen.queryByLabelText('Type')).toBeNull();
    expect(screen.getByLabelText('Room').textContent).toContain(shop.label);
  });

  it('shows every room category in one searchable picker and selects a concrete room', async () => {
    const user = userEvent.setup();
    const evaluationWork: ApplicationEvaluationEvent[] = [];
    const application = createApplication({
      observeEvaluationWork: (event) => evaluationWork.push(event),
    });
    const biome = createBiomeAddress('Underworld', 'F');
    const startId = createOccurrenceId('selector-grouped-start');
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ConfigureRoutePrefix',
        route: createRouteAddress('Underworld'),
        configuredBiomeCount: 1,
      }),
    );
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'CreateStart',
        biome,
        occurrenceId: startId,
        gameName: 'F_Opening01',
      }),
    );
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'CreateBatch',
        continuation: createContinuationAddress(biome, startId),
      }),
    );
    const target = createTargetAddress(biome, startId, 1);
    const combat = catalog.rooms.byKey.F_Combat01;
    const shop = catalog.rooms.byKey.F_Shop01;
    if (combat === undefined || shop === undefined) {
      throw new Error('F selector declarations are missing');
    }
    const onSelect = vi.fn();
    const state = application.store.getState().projectWorkspace;
    evaluationWork.length = 0;
    render(
      <Provider store={application.store}>
        <RoomSelector
          contextual={
            application.structuredWorkspace.project(state.history.present, state.evaluation)
              .contextual
          }
          idPrefix="grouped-selector"
          onSelect={onSelect}
          owner={target}
        />
      </Provider>,
    );

    expect(evaluationWork.filter((event) => event.kind === 'queryBatch')).toEqual([]);
    await user.click(screen.getByLabelText('Room'));
    expect(evaluationWork.some((event) => event.kind === 'queryBatch')).toBe(true);

    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByText('Combat · Not evaluated')).toBeTruthy();
    expect(within(listbox).getByText('Miniboss · Not evaluated')).toBeTruthy();
    expect(within(listbox).getByText('Story · Not evaluated')).toBeTruthy();
    expect(within(listbox).getByText('Fountain · Not evaluated')).toBeTruthy();
    expect(within(listbox).getByText('Shop · Not evaluated')).toBeTruthy();

    await user.click(within(listbox).getByText(shop.label));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(shop.gameName);
  });
});

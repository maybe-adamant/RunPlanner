// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createContinuationAddress,
  createOccurrenceId,
  createRouteAddress,
  createTargetAddress,
} from '@run-planner/engine/authored-project';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApplication } from '../../../composition/createApplication';
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
    const view = render(
      <Provider store={application.store}>
        <RoomSelector
          biomeKey="F"
          candidateProjection={application.candidateProjection}
          catalog={catalog}
          contextualPicker={application.contextualPicker}
          current={combat}
          idPrefix="selector"
          onSelect={() => undefined}
          target={target}
        />
      </Provider>,
    );

    expect(screen.queryByLabelText('Type')).toBeNull();
    expect(screen.getByLabelText('Room').textContent).toContain(combat.label);
    view.rerender(
      <Provider store={application.store}>
        <RoomSelector
          biomeKey="F"
          candidateProjection={application.candidateProjection}
          catalog={catalog}
          contextualPicker={application.contextualPicker}
          current={shop}
          idPrefix="selector"
          onSelect={() => undefined}
          target={target}
        />
      </Provider>,
    );

    expect(screen.queryByLabelText('Type')).toBeNull();
    expect(screen.getByLabelText('Room').textContent).toContain(shop.label);
  });

  it('shows every room category in one searchable picker and selects a concrete room', async () => {
    const user = userEvent.setup();
    const application = createApplication();
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
    render(
      <Provider store={application.store}>
        <RoomSelector
          biomeKey="F"
          candidateProjection={application.candidateProjection}
          catalog={catalog}
          contextualPicker={application.contextualPicker}
          current={combat}
          idPrefix="grouped-selector"
          onSelect={onSelect}
          target={target}
        />
      </Provider>,
    );

    await user.click(screen.getByLabelText('Room'));

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

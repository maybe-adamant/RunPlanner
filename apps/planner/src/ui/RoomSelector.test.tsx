// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createContinuationAddress,
  createOccurrenceId,
  createRouteAddress,
  createTargetAddress,
} from '@run-planner/engine/authored-project';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';

import { createApplication } from '../application/createApplication';
import { authoredProjectCommandDispatched } from '../application/projectWorkspaceSlice';
import { RoomSelector } from './RoomSelector';

describe('RoomSelector', () => {
  it('resynchronizes its category when external history replaces the authored room', () => {
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
          current={combat}
          idPrefix="selector"
          onSelect={() => undefined}
          target={target}
        />
      </Provider>,
    );

    expect(screen.getByLabelText('Type')).toHaveProperty('value', 'Combat');
    view.rerender(
      <Provider store={application.store}>
        <RoomSelector
          biomeKey="F"
          candidateProjection={application.candidateProjection}
          catalog={catalog}
          current={shop}
          idPrefix="selector"
          onSelect={() => undefined}
          target={target}
        />
      </Provider>,
    );

    expect(screen.getByLabelText('Type')).toHaveProperty('value', 'Shop');
    expect(screen.getByLabelText('Room')).toHaveProperty('value', 'F_Shop01');
  });
});

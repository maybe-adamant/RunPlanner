// @vitest-environment jsdom

import {
  createFountainRarityOutcomeAddress,
  createHubDecisionAddress,
  createHubFountainAddress,
  semanticAddressKey,
  type HubAction,
} from '@run-planner/engine/authored-project';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import type {
  WorkspaceHubActionOrderInteraction,
  WorkspaceHubFountain,
  WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import { HubFountainPlacementControls } from '@planner/ui/editor/biome/HubFountainControls';
import { nBiome } from '@run-planner/test-fixtures/surface';
import { hubVisitActions } from '@run-planner/test-fixtures/shared';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('HubFountainControls', () => {
  it('assesses each placement through its engine proposal and disables impossible ones', async () => {
    const user = userEvent.setup();
    const application = createApplication();
    const dispatch = vi
      .spyOn(application.store, 'dispatch')
      .mockImplementation(() => undefined as never);
    const hub = createHubDecisionAddress(nBiome, 'hub');
    const address = createHubFountainAddress(nBiome, 'hub');
    const outcome = createFountainRarityOutcomeAddress(address);
    const marker = (owner: typeof address | typeof outcome) => ({
      address: owner,
      assessment: 'assessed' as const,
      findingCount: 0,
      focusKey: semanticAddressKey(owner),
    });
    const visits = ['combat05', 'miniBoss01'];
    const fountain: WorkspaceHubFountain = {
      actionPosition: 2,
      address,
      controlsHost: { kind: 'hub' },
      hub,
      marker: marker(address),
      outcomeMarker: marker(outcome),
      placements: [0, 1, 2].map((visitCount) => ({
        key: `after:${visitCount}`,
        label: visitCount === 0 ? 'Before visit 1' : `After visit ${visitCount}`,
        precedingVisitCount: visitCount,
        proposedActions: hubVisitActions(visits, visitCount),
      })),
      selectedPlacementKey: 'after:1',
    };
    const impossible = JSON.stringify(hubVisitActions(visits, 0));
    const load = vi.fn();
    const proposalFor = (actions: readonly HubAction[]) => {
      const possible = JSON.stringify(actions) !== impossible;
      return {
        choices: [{ label: 'order', value: actions }],
        intent: () => ({ command: { kind: 'ReplaceHubActionOrder' as const, hub, actions } }),
        key: JSON.stringify(actions),
        load: () => {
          load(actions);
          return [
            {
              value: actions,
              evaluation: {
                kind: 'hubActionOrder' as const,
                result: {
                  candidateActions: actions,
                  findings: [],
                  openHubSlotKeys: [],
                  selectedPossible: possible,
                },
              },
            },
          ];
        },
        owner: hub,
        selected: actions,
      };
    };
    const proposals = new Map<string, ReturnType<typeof proposalFor>>();
    const interaction = {
      key: semanticAddressKey(hub),
      owner: hub,
      proposalFor: (actions: readonly HubAction[]) => {
        const key = JSON.stringify(actions);
        if (!proposals.has(key)) proposals.set(key, proposalFor(actions));
        return proposals.get(key)!;
      },
      selectedActions: hubVisitActions(visits, 1),
      selectedHubSlotKeys: visits,
    } as unknown as WorkspaceHubActionOrderInteraction;
    const interactions = {
      hubActionOrders: new Map([[semanticAddressKey(hub), interaction]]),
    } as unknown as WorkspaceInteractionCatalog;
    render(
      <Provider store={application.store}>
        <HubFountainPlacementControls fountain={fountain} interactions={interactions} />
      </Provider>,
    );
    const group = screen.getByRole('group', { name: 'Fountain use' });
    // Rendering alone does not evaluate proposals.
    expect(load).not.toHaveBeenCalled();

    await user.hover(group);
    const unavailable = await within(group).findByRole('button', {
      name: 'Before visit 1 — unavailable',
    });
    expect(unavailable).toHaveProperty('disabled', true);
    expect(unavailable.getAttribute('data-candidate-support')).toBe('impossible');
    const later = within(group).getByRole('button', { name: 'After visit 2' });
    await waitFor(() => expect(later.getAttribute('data-candidate-support')).toBe('possible'));
    expect(load).toHaveBeenCalledTimes(2);

    await user.click(later);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { kind: 'ReplaceHubActionOrder', hub, actions: hubVisitActions(visits, 2) },
      }),
    );
    application.dispose();
  });
});
